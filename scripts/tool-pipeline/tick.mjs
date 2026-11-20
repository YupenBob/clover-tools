#!/usr/bin/env node
/**
 * CloverTools daily tool pipeline.
 *
 * Usage:
 *   node scripts/tool-pipeline/tick.mjs --dry-run [--slug <slug>] [--slot manual]
 *   node scripts/tool-pipeline/tick.mjs --slot nightly [--no-push]
 *   node scripts/tool-pipeline/tick.mjs --report [--verify] [--json]
 *   node scripts/tool-pipeline/tick.mjs --verify
 *   node scripts/tool-pipeline/tick.mjs --repair-incident [--dry-run] [--json]
 *   node scripts/tool-pipeline/tick.mjs --resume <runKey>
 */
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';

import { loadConfig, timeoutMs } from './lib/config.mjs';
import { validatePresentationContract } from './lib/presentation.mjs';
import { registeredToolSlugs } from './lib/tool-registry.mjs';
import {
  LATEST_FILE,
  PIPELINE_DIR,
  REPO,
  RUNS_DIR,
  WORKTREES_DIR,
} from './lib/paths.mjs';
import {
  ensureDir,
  formatDuration,
  nowIso,
  parseTimeToMinutes,
  readJson,
  readText,
  sleep,
  writeJsonAtomic,
  writeTextAtomic,
  zonedNow,
} from './lib/util.mjs';
import {
  addWorktree,
  changedPaths,
  commitsAhead,
  currentBranch,
  fetchOrigin,
  git,
  headSha,
  isClean,
  resetSoft,
  removeWorktree,
  remoteHead,
} from './lib/git.mjs';
import {
  acquireGlobalLock,
  acquireRunLock,
  clearPause,
  ensureStateDirs,
  loadBacklog,
  loadQueue,
  loadState,
  pause,
  readLatest,
  readPause,
  readRun,
  runDir,
  saveQueue,
  saveRun,
  saveState,
  seedQueue,
  updateQueueItem,
  writeLatest,
} from './lib/state.mjs';
import {
  findItem,
  loadRegistrySlugs,
  markFailed,
  markInProgress,
  markPublished,
  markStalled,
  prepareQueue,
  selectNext,
  syncPublished,
} from './lib/select.mjs';
import {
  architectPrompt,
  builderPrompt,
  lintSpec,
  parseVerifierJson,
  repairPrompt,
  VERIFIER_SCHEMA,
  verifierPrompt,
} from './lib/prompt.mjs';
import { runCodex } from './lib/codex.mjs';
import { auditDiff } from './lib/diff-guard.mjs';
import { failedGateText, runGates, screenshotFiles, summarizeGates } from './lib/gates.mjs';
import { commitTool, publishWithRebase } from './lib/publish.mjs';
import { verifyDeploy } from './lib/verify-deploy.mjs';
import { readRunReport, summarizeRun, writeRun } from './lib/report.mjs';
import {
  buildIncidentEvidence,
  escalatedRepair,
  formatLastFailure,
  incidentCommit,
  incidentEligibility,
  verifyFailureReason,
} from './lib/incident.mjs';

function parseArgs(argv) {
  const options = {
    action: 'run',
    slot: '',
    slug: '',
    runKey: '',
    dryRun: false,
    noPush: false,
    force: false,
    resume: '',
    verify: false,
    report: false,
    repairIncident: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-push') options.noPush = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--report') options.report = true;
    else if (arg === '--repair-incident') options.repairIncident = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--slot') options.slot = argv[++index] ?? '';
    else if (arg === '--slug') options.slug = argv[++index] ?? '';
    else if (arg === '--run') options.runKey = argv[++index] ?? '';
    else if (arg === '--resume') options.resume = argv[++index] ?? '';
    else if (arg === '--help' || arg === '-h') {
      console.log(readText(join(REPO, 'docs/TOOL-PIPELINE.md')));
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function emit(value) {
  console.log(JSON.stringify(value, null, 2));
}

/** runPipeline 的 JSON 输出；silent 时交给调用方统一输出（异常修复 CLI）。 */
function emitRunJson(options, value) {
  options.lastSummary = value;
  if (!options.silent) console.log(JSON.stringify(value, null, 2));
}

// 异常修复 CLI 只允许 stdout 出现一条 JSON；期间的过程日志改由调用方决定。
let quietOutput = false;
function pipelineLog(...args) {
  if (!quietOutput) console.log(...args);
}

function freeDiskGb() {
  try {
    const stats = statfsSync(REPO);
    return (stats.bavail * stats.bsize) / 1024 ** 3;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function findChromium() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH && existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }
  const base = join(REPO, '.playwright-browsers');
  if (existsSync(base)) {
    for (const entry of readdirSync(base)) {
      const candidate = join(base, entry, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  for (const candidate of ['/usr/bin/chromium', '/snap/bin/chromium']) {
    if (existsSync(candidate)) return candidate;
  }
  return '';
}

function gateEnv() {
  const env = { ASTRO_TELEMETRY_DISABLED: '1' };
  const chromium = findChromium();
  if (chromium) env.PLAYWRIGHT_EXECUTABLE_PATH = chromium;
  return env;
}

async function waitForLoad(config) {
  const max = Number(process.env.TOOL_PIPELINE_MAX_LOAD ?? config.guard.maxLoadAverage ?? 8);
  const waitMinutes = Number(
    process.env.TOOL_PIPELINE_LOAD_WAIT_MINUTES ?? config.guard.loadWaitMinutes ?? 10,
  );
  const deadline = Date.now() + waitMinutes * 60 * 1000;
  while (os.loadavg()[0] > max && Date.now() < deadline) {
    pipelineLog(
      `[guard] load ${os.loadavg()[0].toFixed(1)} > ${max}; waiting 30s…`,
    );
    await sleep(30000);
  }
  return os.loadavg()[0];
}

function ensureBudget(run, config, minutes = 0) {
  const start = new Date(run.startedAt).getTime();
  const deadline = start + Number(config.budget.maxTotalMinutes ?? 330) * 60 * 1000;
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('预算耗尽：超过 maxTotalMinutes，停止发布');
  if (minutes && remaining < minutes * 60 * 1000) {
    throw new Error(
      `预算不足：剩余 ${Math.max(0, Math.round(remaining / 60000))} 分钟，下一阶段需要 ${minutes} 分钟`,
    );
  }
}

function setPhase(run, name, status, detail = '') {
  run.phases = run.phases ?? {};
  const previous = run.phases[name] ?? {};
  run.phases[name] = {
    ...previous,
    status,
    detail,
    updatedAt: nowIso(),
  };
  if (status === 'running') run.phases[name].startedAt = nowIso();
  if ((status === 'done' || status === 'failed' || status === 'skipped') && previous.startedAt) {
    run.phases[name].endedAt = nowIso();
    run.phases[name].durationMs = Date.now() - new Date(previous.startedAt).getTime();
  }
  writeRun(run);
}

function codexSummary(result) {
  return {
    ok: result.ok,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    usageLimited: result.usageLimited,
    durationMs: result.durationMs,
    model: result.model,
    reasoning: result.reasoning,
    sandbox: result.sandbox,
    usage: result.usage,
    eventCount: result.eventCount,
    stdoutFile: result.stdoutFile,
    stderrFile: result.stderrFile,
    lastMessageFile: result.lastMessageFile,
    lastMessagePreview: String(result.lastMessage ?? '').slice(0, 1200),
  };
}

function runKeyFor(options, config) {
  const zoned = zonedNow(config.timezone);
  const slot = options.slot || config.slot || 'nightly';
  if (slot === 'nightly') return { runKey: `${zoned.date}T00`, date: zoned.date, slot, zoned };
  return {
    runKey: `${zoned.date}Tmanual-${zoned.time.slice(0, 5).replace(':', '')}`,
    date: zoned.date,
    slot: 'manual',
    zoned,
  };
}

function queueSummary(queue) {
  const counts = { ready: 0, published: 0, failed: 0, stalled: 0, in_progress: 0, candidate: 0 };
  for (const item of queue.items ?? []) counts[item.status] = (counts[item.status] ?? 0) + 1;
  counts.total = queue.items?.length ?? 0;
  return counts;
}

function recordOutcome({ run, queue, status, config, error = '' }) {
  const item = queue.items.find((entry) => entry.id === run.item.id);
  const state = loadState();
  if (status === 'published') {
    markPublished(queue, item, { runId: run.runKey, commit: run.publish?.commit });
    state.consecutiveFailures = 0;
    state.daily = state.daily ?? {};
    state.daily[run.date] = Number(state.daily[run.date] ?? 0) + 1;
  } else if (status === 'failed') {
    markFailed(queue, item, { runId: run.runKey, error, cooldownHours: 0 });
    state.consecutiveFailures = Number(state.consecutiveFailures ?? 0) + 1;
  } else if (status === 'stalled') {
    markStalled(queue, item, { runId: run.runKey, error });
    state.consecutiveFailures = Number(state.consecutiveFailures ?? 0) + 1;
  }
  run.queue = queueSummary(queue);
  run.historyEntry = {
    runKey: run.runKey,
    status,
    item: run.item.slug,
    commit: run.publish?.commit ?? null,
    at: nowIso(),
  };
  state.history = [...(state.history ?? []), run.historyEntry].slice(-200);
  state.lastRun = run.historyEntry;
  saveQueue(queue);
  saveState(state);
  if (
    (status === 'failed' || status === 'stalled') &&
    state.consecutiveFailures >= Number(config.caps.consecutiveFailuresToPause ?? 2)
  ) {
    pause(`连续 ${state.consecutiveFailures} 次失败/停滞`, { runKey: run.runKey });
  }
  return state;
}

/**
 * A scoped pause (改造窗口) must not block the pipeline forever: when `until`
 * has passed and the reason asks for the presentation acceptance artifact, the
 * pause only lifts if that artifact is valid and still matches the sources.
 */
function presentationAcceptanceIssues() {
  const artifactPath = join(REPO, 'data/tool-presentation/acceptance.json');
  if (!existsSync(artifactPath)) return ['缺少 data/tool-presentation/acceptance.json'];
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    return [`acceptance.json 无法解析：${error.message}`];
  }
  const issues = [];
  if (artifact.valid !== true) issues.push('acceptance.json 已失效');
  if (artifact.contractVersion !== 1) issues.push(`contractVersion ${artifact.contractVersion} 不受支持`);
  const checks = artifact.checks ?? {};
  for (const [name, value] of Object.entries(checks)) if (value !== true) issues.push(`acceptance 检查未通过：${name}`);
  const sources = artifact.hashes?.sources ?? {};
  const fileFor = {
    policy: 'config/presentation-policy.json',
    schema: 'config/schemas/tool-presentation.schema.json',
    checker: 'scripts/lib/presentation-check.mjs',
    cases: 'scripts/lib/presentation-cases.mjs',
    validator: 'scripts/tool-pipeline/lib/presentation.mjs',
  };
  for (const [name, file] of Object.entries(fileFor)) {
    if (!sources[name]) {
      issues.push(`acceptance 未记录 ${name} 的哈希`);
      continue;
    }
    const path = join(REPO, file);
    if (!existsSync(path)) {
      issues.push(`acceptance 依赖文件缺失：${file}`);
      continue;
    }
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hash !== sources[name]) issues.push(`acceptance 依赖已变化：${file}`);
  }
  return issues;
}

function maybeAutoResume(pauseInfo) {
  if (!pauseInfo.paused) return pauseInfo;
  const until = pauseInfo.until ? Date.parse(pauseInfo.until) : NaN;
  if (!Number.isFinite(until) || Date.now() < until) return pauseInfo;
  // Codex 额度耗尽只是临时资源问题：到预计重置时间后自动解除，不阻塞下一晚。
  if (pauseInfo.resumeCheck === 'quota-reset') {
    rmSync(join(PIPELINE_DIR, 'PAUSED'), { force: true });
    appendFileSync(join(RUNS_DIR, 'nightly.log'), `\n=== ${nowIso()} PAUSED 自动解除：Codex 额度窗口预计已重置 ===\n`);
    return { paused: false };
  }
  if (pauseInfo.resumeCheck !== 'presentation-ready') return pauseInfo;
  const issues = presentationAcceptanceIssues();
  if (issues.length) return { ...pauseInfo, blocked: issues };
  rmSync(join(PIPELINE_DIR, 'PAUSED'), { force: true });
  appendFileSync(join(RUNS_DIR, 'nightly.log'), `\n=== ${nowIso()} PAUSED 自动解除：presentation 验收凭证有效 ===\n`);
  return { paused: false };
}

/**
 * 主 checkout 的前置检查：干净、在 main、与 origin 同步、磁盘充足。
 * 正常 tick 与异常修复共用同一套逻辑。
 */
function mainGuard(config) {
  if (!isClean(REPO)) {
    return { ok: false, status: 'skipped', reason: '主 checkout 不干净', clean: false };
  }
  const branch = currentBranch(REPO);
  if (branch !== 'main') {
    return {
      ok: false,
      status: 'skipped',
      reason: `主 checkout 不在 main（${branch}）`,
      clean: true,
      branch,
    };
  }
  fetchOrigin(REPO);
  if (commitsAhead(REPO) !== 0) {
    return {
      ok: false,
      status: 'skipped',
      reason: 'main 有未推送提交，先处理内容流水线',
      clean: true,
      branch,
      synced: false,
    };
  }
  const local = headSha(REPO);
  const remote = remoteHead(REPO);
  if (remote !== local) {
    return {
      ok: false,
      status: 'skipped',
      reason: `本地 main 与 origin/main 不一致（${local.slice(0, 8)} vs ${remote.slice(0, 8)}）`,
      clean: true,
      branch,
      synced: false,
    };
  }
  const free = freeDiskGb();
  if (free < Number(config.guard.minFreeDiskGb ?? 5)) {
    return {
      ok: false,
      status: 'skipped',
      reason: `磁盘仅剩 ${free.toFixed(1)}G`,
      clean: true,
      branch,
      synced: true,
      freeDiskGb: free,
    };
  }
  return { ok: true, status: 'ok', reason: '', clean: true, branch, synced: true, freeDiskGb: free };
}

function assertGuard(config, options, runKey, zoned) {
  const pauseInfo = maybeAutoResume(readPause());
  // 异常修复本身就是失败后的恢复动作：verify 失败会自动写 PAUSED，
  // 这里只对 --repair-incident 放行，其余路径保持原语义。
  if (pauseInfo.paused && !options.ignorePause) {
    const detail = pauseInfo.blocked?.length ? `；仍未满足：${pauseInfo.blocked.join('；')}` : '';
    return { ok: false, status: 'paused', reason: `PAUSED: ${pauseInfo.reason}${detail}` };
  }
  const repo = mainGuard(config);
  if (!repo.ok) return { ok: false, status: repo.status, reason: repo.reason };
  const codexAuth = join(process.env.HOME || '/home/ubuntu', '.codex', 'auth.json');
  if (!existsSync(codexAuth)) {
    return { ok: false, status: 'skipped', reason: `codex 未登录：缺少 ${codexAuth}` };
  }
  const gh = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', timeout: 30000 });
  if (gh.status !== 0) {
    return { ok: false, status: 'skipped', reason: 'gh 未登录，无法推送/验证' };
  }
  if (options.slot === 'nightly' && zoned.hour >= 6 && !options.force) {
    return {
      ok: false,
      status: 'skipped',
      reason: `补跑窗口已过（Asia/Shanghai ${zoned.time}），避免与 06:00 内容流水线冲突`,
    };
  }
  const previous = readRun(runKey);
  if (previous && !options.force && options.action === 'run') {
    return { ok: false, status: 'already-ran', reason: `${runKey} 已存在（${previous.status}）` };
  }
  return { ok: true };
}

function ensureWorktree(runKey, base) {
  const worktree = join(WORKTREES_DIR, runKey);
  if (existsSync(worktree)) {
    removeWorktree(worktree, REPO);
    rmSync(worktree, { recursive: true, force: true });
  }
  ensureDir(WORKTREES_DIR);
  addWorktree(worktree, base, REPO);
  for (const dependency of ['node_modules', '.playwright-browsers']) {
    const target = join(REPO, dependency);
    if (existsSync(target)) {
      try {
        symlinkSync(target, join(worktree, dependency), 'dir');
      } catch {
        /* already linked */
      }
    }
  }
  const envFile = join(REPO, '.env');
  if (existsSync(envFile)) {
    try {
      symlinkSync(envFile, join(worktree, '.env'), 'file');
    } catch {
      /* already linked */
    }
  }
  const excludeFile = join(REPO, '.git/info/exclude');
  const exclude = readText(excludeFile);
  if (!exclude.includes('# tool-pipeline worktree-owned')) {
    appendFileSync(
      excludeFile,
      '\n# tool-pipeline worktree-owned\nnode_modules\n.playwright-browsers\n.env\n.env.local\n',
    );
  }
  return worktree;
}

async function architectStep({ run, item, config, worktree, runKey, logDir }) {
  ensureBudget(run, config, 35);
  setPhase(run, 'architect', 'running');
  const seedPath = item.spec ? join(PIPELINE_DIR, item.spec) : '';
  const seedSpec = seedPath && existsSync(seedPath) ? readText(seedPath) : '';
  const promptItem = seedSpec ? { ...item, seedSpec } : item;
  const prompt = architectPrompt({ item: promptItem, config, base: run.baseSha });
  let result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name: 'architect',
    model: config.models.architect,
    reasoning: config.reasoning.architect,
    sandbox: 'read-only',
    timeoutMs: timeoutMs(config, 'architect'),
    config,
  });
  run.codex.architect = codexSummary(result);
  if (!result.ok) {
    throw new Error(
      `Architect 失败：exit=${result.exitCode}${result.timedOut ? ' timeout' : ''}\n${result.stderrTail}`,
    );
  }
  let spec = result.lastMessage?.trim() ?? '';
  let lint = lintSpec(spec, item);
  if (!lint.ok) {
    const retryPrompt = `${prompt}\n\n上一次输出没有通过 spec lint，问题如下：\n- ${lint.issues.join(
      '\n- ',
    )}\n请重新输出完整 spec（只输出 Markdown）。`;
    result = await runCodex({
      prompt: retryPrompt,
      cwd: worktree,
      logDir,
      name: 'architect-retry',
      model: config.models.architect,
      reasoning: config.reasoning.architect,
      sandbox: 'read-only',
      timeoutMs: timeoutMs(config, 'architect'),
      config,
    });
    run.codex.architect = codexSummary(result);
    spec = result.lastMessage?.trim() ?? '';
    lint = lintSpec(spec, item);
  }
  if (!lint.ok) throw new Error(`spec lint 失败：${lint.issues.join('；')}`);
  const specFile = join(runDir(runKey), 'spec.md');
  writeTextAtomic(specFile, `${spec}\n`);
  run.specFile = specFile;
  setPhase(run, 'architect', 'done', `${spec.length} chars`);
  return spec;
}

async function builderStep({
  run,
  item,
  config,
  worktree,
  spec,
  logDir,
  name = 'builder',
  incident = false,
  failure = '',
}) {
  const timeoutRole = incident ? 'repairIncident' : 'builder';
  ensureBudget(run, config, Number(config.timeoutsMinutes?.[timeoutRole] ?? 165));
  setPhase(run, 'builder', 'running');
  const prompt = builderPrompt({ item, config, base: run.baseSha, spec, failure });
  const result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name,
    model: name === 'builder' ? config.models.builder : config.models.repair,
    reasoning: config.reasoning.builder,
    sandbox: 'workspace-write',
    timeoutMs: timeoutMs(config, timeoutRole),
    config,
  });
  run.codex[name] = codexSummary(result);
  if (!result.ok) {
    throw new Error(
      `${name} 失败：exit=${result.exitCode}${result.timedOut ? ' timeout' : ''}\n${result.stderrTail}`,
    );
  }
  setPhase(run, 'builder', 'done', `${result.durationMs}ms`);
  return result;
}

async function repairStep({ run, item, config, worktree, spec, failure, kind, logDir, name }) {
  ensureBudget(run, config, 45);
  const escalation = escalatedRepair(config, run.repairRounds ?? []);
  const detail = escalation.escalated ? `${kind} · escalation` : kind;
  if (escalation.escalated) {
    pipelineLog(
      `[repair] 既往失败修复轮 ${escalation.failedRounds} 次，升级模型 ${escalation.model}（reasoning=${escalation.reasoning}）`,
    );
  }
  setPhase(run, 'repair', 'running', detail);
  const prompt = repairPrompt({ item, config, base: run.baseSha, spec, failure, kind });
  const result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name,
    model: escalation.model,
    reasoning: escalation.reasoning,
    sandbox: 'workspace-write',
    timeoutMs: timeoutMs(config, 'repair'),
    config,
  });
  run.codex[name] = codexSummary(result);
  run.repairRounds = [
    ...(run.repairRounds ?? []),
    {
      ok: result.ok,
      model: escalation.model,
      kind,
      name,
      reasoning: escalation.reasoning,
      escalated: escalation.escalated,
      at: nowIso(),
    },
  ];
  setPhase(run, 'repair', result.ok ? 'done' : 'failed', detail);
  return result;
}

function audit(run, item, config, worktree, label = 'diff') {
  const result = auditDiff({ worktree, base: run.baseSha, item, config });
  run.diff = {
    ok: result.ok,
    counts: result.counts,
    issues: result.issues,
    files: result.files,
    label,
    at: nowIso(),
  };
  writeRun(run);
  return result;
}

async function gatesWithRepair({ run, item, config, worktree, spec, runDirPath, logDir, allowRepair = true }) {
  ensureBudget(run, config, 45);
  setPhase(run, 'gates', 'running');
  let result = await runGates({
    worktree,
    base: run.baseSha,
    item,
    config,
    runDir: runDirPath,
    env: gateEnv(),
  });
  run.gates = result.results;
  writeJsonAtomic(join(runDirPath, 'gates.json'), result.results);
  if (!result.ok && allowRepair) {
    setPhase(run, 'gates', 'failed', result.failed);
    const failure = failedGateText(result.results);
    const repair = await repairStep({
      run,
      item,
      config,
      worktree,
      spec,
      failure,
      kind: `gates:${result.failed}`,
      logDir,
      name: 'repair-gates',
    });
    if (!repair.ok) throw new Error(`门禁修复失败：${repair.stderrTail || failure}`);
    const diff = audit(run, item, config, worktree, 'post-repair');
    if (!diff.ok) throw new Error(`修复后 diff 违规：${diff.issues.map((issue) => issue.message).join('；')}`);
    result = await runGates({
      worktree,
      base: run.baseSha,
      item,
      config,
      runDir: runDirPath,
      env: gateEnv(),
    });
    run.gates = result.results;
    writeJsonAtomic(join(runDirPath, 'gates.json'), result.results);
  }
  if (!result.ok) {
    setPhase(run, 'gates', 'failed', result.failed);
    throw new Error(`门禁失败：${result.failed}\n${failedGateText(result.results)}`);
  }
  setPhase(run, 'gates', 'done', `${result.results.length} gates`);
  return result;
}

async function verifierStep({ run, item, config, worktree, spec, logDir, runDirPath }) {
  ensureBudget(run, config, 30);
  setPhase(run, 'review', 'running');
  const schemaDir = join(runDirPath, 'schemas');
  ensureDir(schemaDir);
  const schemaFile = join(schemaDir, 'verifier.json');
  writeJsonAtomic(schemaFile, VERIFIER_SCHEMA);
  const images = screenshotFiles(runDirPath).slice(0, 8);
  const prompt = verifierPrompt({
    item,
    config,
    base: run.baseSha,
    spec,
    gatesSummary: summarizeGates(run.gates ?? []),
  });
  const result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name: 'verifier',
    model: config.models.verifier,
    reasoning: config.reasoning.verifier,
    sandbox: 'read-only',
    timeoutMs: timeoutMs(config, 'verifier'),
    schemaFile,
    images,
    config,
  });
  run.codex.verifier = codexSummary(result);
  if (!result.ok) {
    throw new Error(`Verifier 失败：exit=${result.exitCode}${result.timedOut ? ' timeout' : ''}\n${result.stderrTail}`);
  }
  const review = parseVerifierJson(result.lastMessage);
  writeJsonAtomic(join(runDirPath, 'review.json'), {
    ...review,
    model: config.models.verifier,
    lastMessageFile: result.lastMessageFile,
    at: nowIso(),
  });
  run.review = {
    verdict: review.verdict,
    confidence: review.confidence,
    blockingIssues: review.blockingIssues,
    nonBlocking: review.nonBlocking,
    rubric: review.rubric,
    notes: review.notes,
    model: config.models.verifier,
  };
  setPhase(
    run,
    'review',
    review.verdict === 'pass' ? 'done' : 'failed',
    `${review.verdict} ${review.confidence}`,
  );
  return review;
}

async function publishStep({ run, item, config, worktree, noPush }) {
  ensureBudget(run, config, 10);
  setPhase(run, 'publish', 'running');
  const diff = audit(run, item, config, worktree, 'final');
  if (!diff.ok) {
    throw new Error(`最终 diff 违规：${diff.issues.map((issue) => issue.message).join('；')}`);
  }
  const paths = diff.files.map((file) => file.path);
  if (!paths.length) throw new Error('没有可提交的改动');
  if (noPush) {
    run.publish = { status: 'local-ok', detail: '--no-push：未提交/未推送', files: paths.length };
    setPhase(run, 'publish', 'done', 'local-ok');
    return;
  }
  // Codex is told not to commit; if it did, squash that commit back into the
  // working tree so the published history is exactly one bot-authored commit.
  if (headSha(worktree) !== run.baseSha) {
    resetSoft(run.baseSha, worktree);
  }
  const commit = commitTool({
    worktree,
    paths,
    item,
    author: config.author,
  });
  run.publish = { status: 'committing', commit: commit.sha, message: commit.message, files: paths.length };
  writeRun(run);
  const published = publishWithRebase({
    mainRepo: REPO,
    base: run.baseSha,
    sha: commit.sha,
    worktree,
  });
  if (!published.ok) {
    run.publish = {
      status: 'failed',
      commit: commit.sha,
      message: commit.message,
      reason: published.reason,
      detail: published.detail,
    };
    setPhase(run, 'publish', 'failed', published.reason);
    throw new Error(`发布失败：${published.reason} ${published.detail ?? ''}`);
  }
  const publishedSha = published.sha ?? commit.sha;
  if (published.rebased) {
    run.notes = [
      ...(run.notes ?? []),
      `main 在构建期间被并发提交推进（${String(run.baseSha).slice(0, 8)} → ${String(published.base).slice(0, 8)}），改动路径不重叠，已自动 rebase 后发布。`,
    ];
    run.baseSha = published.base;
  }
  run.publish = {
    status: 'pushed',
    commit: publishedSha,
    message: commit.message,
    mainHead: published.mainHead,
    files: paths.length,
    rebased: Boolean(published.rebased),
  };
  run.apiPath = item.apiPath ?? (item.network ? `/api/${item.slug}` : null);
  setPhase(run, 'publish', 'done', publishedSha.slice(0, 8));
}

function cleanupWorktree(runKey) {
  const worktree = join(WORKTREES_DIR, runKey);
  if (!existsSync(worktree)) return;
  removeWorktree(worktree, REPO);
  rmSync(worktree, { recursive: true, force: true });
}

/** 异常修复复用旧 run 的 plan.md（兼容只有 spec.md 的历史 run）。 */
function incidentPlanText(priorRunKey) {
  if (!priorRunKey) return '';
  const priorDir = runDir(priorRunKey);
  for (const name of ['plan.md', 'spec.md']) {
    const text = readText(join(priorDir, name));
    if (text.trim()) return text;
  }
  return '';
}

async function runPipeline(options, existingRun = null) {
  const config = loadConfig();
  const computed = runKeyFor(options, config);
  const incidentOf = options.incidentOf ?? existingRun?.incidentOf ?? '';
  const runKey = existingRun?.runKey ?? options.incidentRunKey ?? computed.runKey;
  const date = existingRun?.date ?? computed.date;
  const slot = existingRun?.slot ?? computed.slot;
  const zoned = computed.zoned;
  options.slot = slot;
  const guard = assertGuard(config, options, runKey, zoned);
  if (!guard.ok) {
    emitRunJson(options, {
      ok: guard.status === 'skipped',
      status: guard.status,
      reason: guard.reason,
      runKey,
    });
    return 0;
  }

  await waitForLoad(config);
  const globalLock = acquireGlobalLock();
  if (!globalLock.ok) {
    emitRunJson(options, {
      ok: false,
      status: 'locked',
      runKey,
      reason: 'another pipeline run holds global.lock',
    });
    return 0;
  }
  const lock = acquireRunLock(runKey);
  if (!lock.ok) {
    globalLock.stop();
    emitRunJson(options, { ok: false, status: 'locked', runKey, reason: lock.reason });
    return 0;
  }

  ensureStateDirs();
  const queue = prepareQueue();
  const registry = await loadRegistrySlugs();
  syncPublished(queue, registry);

  let item;
  if (existingRun) {
    item = findItem(queue, { slug: existingRun.item.slug });
    if (!item) {
      lock.stop();
      emitRunJson(options, { ok: false, status: 'resume-item-missing' });
      return 1;
    }
  } else if (options.slug) {
    item = findItem(queue, { slug: options.slug });
    if (!item) {
      const backlog = loadBacklog();
      const candidate = backlog.items?.find((entry) => entry.slug === options.slug);
      if (!candidate) {
        lock.stop();
        emitRunJson(options, { ok: false, status: 'unknown-slug', slug: options.slug });
        return 1;
      }
      item = { ...candidate, status: 'ready', attempts: 0, createdAt: nowIso() };
      queue.items.push(item);
    }
  } else {
    const selection = selectNext(queue, { registry });
    item = selection.item;
    if (!item) {
      lock.stop();
      emitRunJson(options, { ok: false, status: 'queue-empty', skipped: selection.skipped });
      return 0;
    }
  }
  // 异常修复针对的走查失败可能仍留在 registry（revert 失败）：允许就地修复。
  if (registry.has(item.slug) && !incidentOf) {
    lock.stop();
    emitRunJson(options, { ok: false, status: 'already-in-registry', slug: item.slug });
    return 0;
  }

  const base = existingRun?.baseSha ?? headSha(REPO);
  if (!existingRun) {
    markInProgress(queue, item, runKey);
    saveQueue(queue);
  }

  const runDirPath = runDir(runKey);
  ensureDir(runDirPath);
  ensureDir(join(runDirPath, 'logs'));
  ensureDir(join(runDirPath, 'screenshots'));

  const freshRun = {
    version: 1,
    runKey,
    date,
    slot: incidentOf ? 'incident' : slot,
    timezone: config.timezone,
    status: 'in_progress',
    startedAt: nowIso(),
    finishedAt: null,
    baseSha: base,
    incidentOf: incidentOf || null,
    incident: incidentOf
      ? { of: incidentOf, evidence: options.incidentEvidencePath ?? join(runDirPath, 'incident.md') }
      : null,
    item: {
      id: item.id,
      slug: item.slug,
      title: item.title ?? item.slug,
      category: item.category,
      scope: item.scope ?? 'medium',
      network: Boolean(item.network),
      requiresSecrets: item.requiresSecrets ?? [],
      apiPath: item.apiPath ?? null,
      apiFile: item.apiFile ?? null,
      specPath: item.spec ?? null,
    },
    phases: {},
    codex: {},
    gates: [],
    diff: null,
    review: null,
    publish: null,
    verify: null,
    repairRounds: [],
    lastFailure: item.lastFailure ?? null,
    queue: queueSummary(queue),
    error: null,
    notes: [],
  };
  const run = existingRun ?? freshRun;
  if (existingRun) {
    run.status = 'in_progress';
    run.error = null;
    run.finishedAt = null;
    // A resume gets a fresh budget window; otherwise yesterday's startedAt would
    // immediately trip the 330-minute guard.
    run.resumedAt = nowIso();
    run.startedAt = nowIso();
    run.updatedAt = nowIso();
  }
  saveRun(run);
  writeLatest(run);

  const logDir = join(runDirPath, 'logs');
  let worktree = '';
  try {
    setPhase(run, 'guard', 'done', `base=${base.slice(0, 8)}`);
    // Fail closed before any Codex work: the presentation contract must load and
    // every declared tool config must still satisfy the shared policy.
    const contractIssues = validatePresentationContract({ toolSlugs: registeredToolSlugs() });
    if (contractIssues.length) throw new Error(`主视图契约校验失败：${contractIssues.join('；')}`);
    setPhase(run, 'select', 'done', `${item.slug} priority=${item.priority ?? '-'}`);

    const resumeWorktree = join(WORKTREES_DIR, runKey);
    worktree =
      existingRun && existsSync(resumeWorktree)
        ? resumeWorktree
        : ensureWorktree(runKey, base);
    run.worktree = worktree;
    setPhase(run, 'worktree', 'done', worktree);

    let spec = existsSync(join(runDirPath, 'spec.md'))
      ? readText(join(runDirPath, 'spec.md'))
      : '';
    if (!spec.trim() && incidentOf) {
      // 异常修复沿用被修 run 的架构产物，避免重新 architect 改变方案。
      const plan = incidentPlanText(incidentOf);
      if (plan) {
        writeTextAtomic(join(runDirPath, 'plan.md'), plan);
        writeTextAtomic(join(runDirPath, 'spec.md'), plan);
        spec = plan;
        setPhase(run, 'architect', 'skipped', `incident: 复用 ${incidentOf}/plan.md`);
      }
    }
    if (!spec.trim()) spec = await architectStep({ run, item, config, worktree, runKey, logDir });
    run.specFile = join(runDirPath, 'spec.md');
    if (!spec.trim()) throw new Error('spec 为空');

    const changedBefore = changedPaths(base, worktree);
    const hasChanges =
      changedBefore.all.some((path) => !path.startsWith('.editorial/') && !path.startsWith('.tool-pipeline/'));
    if (hasChanges) {
      setPhase(run, 'builder', 'done', 'resume: existing changes');
    } else {
      const priorFailure =
        options.priorFailure ??
        (incidentOf ? readText(join(runDirPath, 'incident.md')) : '');
      const failure = priorFailure || formatLastFailure(item.lastFailure);
      await builderStep({
        run,
        item,
        config,
        worktree,
        spec,
        logDir,
        incident: Boolean(incidentOf),
        failure,
      });
    }

    const diff = audit(run, item, config, worktree, 'post-build');
    if (!diff.ok) {
      throw new Error(`Diff 违规：${diff.issues.map((issue) => `${issue.path}:${issue.message}`).join('；')}`);
    }
    setPhase(run, 'diff', 'done', `${diff.counts.total} files`);

    let gates = await gatesWithRepair({
      run,
      item,
      config,
      worktree,
      spec,
      runDirPath,
      logDir,
      allowRepair: true,
    });
    let review = await verifierStep({
      run,
      item,
      config,
      worktree,
      spec,
      logDir,
      runDirPath,
    });
    if (review.verdict !== 'pass') {
      if (run.codex['repair-review']) {
        throw new Error(`复核失败：${review.blockingIssues.join('；')}`);
      }
      const failure = `Reviewer verdict=${review.verdict} confidence=${review.confidence}\nblocking:\n- ${review.blockingIssues.join(
        '\n- ',
      )}`;
      const repair = await repairStep({
        run,
        item,
        config,
        worktree,
        spec,
        failure,
        kind: 'review',
        logDir,
        name: 'repair-review',
      });
      if (!repair.ok) throw new Error(`复核修复失败：${repair.stderrTail || failure}`);
      const diffAfterRepair = audit(run, item, config, worktree, 'post-review-repair');
      if (!diffAfterRepair.ok) {
        throw new Error(
          `复核修复后 diff 违规：${diffAfterRepair.issues.map((issue) => issue.message).join('；')}`,
        );
      }
      gates = await gatesWithRepair({
        run,
        item,
        config,
        worktree,
        spec,
        runDirPath,
        logDir,
        allowRepair: false,
      });
      review = await verifierStep({
        run,
        item,
        config,
        worktree,
        spec,
        logDir,
        runDirPath,
      });
      if (review.verdict !== 'pass') {
        throw new Error(`复核仍失败：${review.blockingIssues.join('；')}`);
      }
    }

    await publishStep({ run, item, config, worktree, noPush: options.noPush });
    run.status = options.noPush ? 'local-ok' : 'published';
    run.finishedAt = nowIso();
    writeRun(run);
    try {
      recordOutcome({
        run,
        queue,
        status: options.noPush ? 'local-ok' : 'published',
        config,
        error: '',
      });
    } catch (queueError) {
      // The commit is already pushed; never turn a queue bookkeeping failure into
      // a "failed" run. Surface it in the report instead.
      run.notes = [...(run.notes ?? []), `queue update failed: ${queueError.message}`];
    }
    writeRun(run);
    if (!options.noPush) cleanupWorktree(runKey);
    emitRunJson(options, {
      ok: true,
      status: run.status,
      runKey,
      slug: item.slug,
      incidentOf: run.incidentOf ?? null,
      commit: run.publish?.commit ?? null,
      report: join(runDirPath, 'report.md'),
      duration: formatDuration(Date.now() - new Date(run.startedAt).getTime()),
    });
    return 0;
  } catch (error) {
    const usageLimited =
      Object.values(run.codex ?? {}).some((entry) => entry?.usageLimited) ||
      /usage limit/i.test(String(error.message ?? ''));
    run.status = usageLimited
      ? 'stalled'
      : /预算|超过|cutoff|timeout/i.test(error.message)
        ? 'stalled'
        : 'failed';
    run.error = String(error.stack ?? error.message ?? error);
    if (usageLimited) {
      run.notes = [
        ...(run.notes ?? []),
        'Codex 账号额度耗尽；等待额度重置后使用 --resume <runKey> 继续，无需重跑 Builder。',
      ];
      pause('Codex usage limit 已耗尽，等待额度重置后 --resume', {
        runKey: run.runKey,
        resumeCheck: 'quota-reset',
        // Codex 额度窗口（默认 5 小时）：留出余量后自动解除暂停，避免永久阻塞后续 nightly。
        until: new Date(
          Date.now() + Number(config.budget?.quotaResetHours ?? 5) * 60 * 60 * 1000,
        ).toISOString(),
      });
    }
    run.finishedAt = nowIso();
    recordOutcome({ run, queue, status: run.status, config, error: run.error });
    writeRun(run);
    emitRunJson(options, { ok: false, status: run.status, runKey, reason: error.message });
    console.error(`[tool-pipeline] ${run.status}: ${error.message}`);
    console.error(`[tool-pipeline] report: ${join(runDirPath, 'report.md')}`);
    if (worktree) console.error(`[tool-pipeline] worktree kept: ${worktree}`);
    return 1;
  } finally {
    lock.stop();
    globalLock.stop();
    writeLatest(run);
  }
}

function recordVerifyOutcome(run, result, config) {
  const status = String(result?.status ?? '');
  if (!status) return;
  const queue = loadQueue();
  const item = findItem(queue, { slug: run.item.slug });
  if (!item) return;
  if (!['reverted', 'ci-failed', 'deploy-failed', 'production-failed'].includes(status)) {
    if (status === 'verified' || status === 'skipped') {
      if (item.lastFailure) {
        delete item.lastFailure;
        saveQueue(queue);
      }
    }
    return;
  }
  // 把失败摘要留在队列条目上，下一晚常规 builder prompt 会自动附带，
  // 避免在完全没有上下文的情况下盲修。
  if (status === 'reverted') {
    markFailed(queue, item, {
      runId: run.runKey,
      error: `生产/CI 校验失败，已 revert：${result.reason ?? result.status}`,
    });
  }
  item.lastFailure = {
    runKey: run.runKey,
    status,
    reason: verifyFailureReason(result),
    evidencePath: join(runDir(run.runKey), 'report.md'),
    at: nowIso(),
  };
  saveQueue(queue);
  if (status !== 'reverted') return;
  const state = loadState();
  state.consecutiveFailures = Number(state.consecutiveFailures ?? 0) + 1;
  saveState(state);
}

function countIncidentRepairs(targetRunKey) {
  let count = 0;
  try {
    for (const entry of readdirSync(RUNS_DIR)) {
      const candidate = readRun(entry);
      if (candidate?.incidentOf === targetRunKey) count += 1;
    }
  } catch {
    /* RUNS_DIR 尚未创建时视为 0 次 */
  }
  return count;
}

function incidentRunKeyFor(config) {
  const zoned = zonedNow(config.timezone);
  const base = `${zoned.date}Tincident-${zoned.time.slice(0, 5).replace(':', '')}`;
  let key = base;
  let suffix = 2;
  while (existsSync(runDir(key))) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
}

function gitShowCommit(sha) {
  if (!sha) return '';
  const result = git(['show', '--stat', '--patch', '--no-color', sha], {
    cwd: REPO,
    allowFailure: true,
    timeoutMs: 60000,
  });
  if (result.code !== 0) {
    return `（git show ${sha} 失败：${String(result.stderr || '').trim().slice(0, 500)}）`;
  }
  const text = result.stdout;
  return text.length <= 30000 ? text : `${text.slice(0, 30000)}\n…(truncated)`;
}

async function handleRepairIncident(options) {
  const config = loadConfig();
  const latest = readLatest();
  if (!latest?.runKey) {
    emit({ ok: false, runKey: null, status: 'no-run' });
    return 1;
  }
  const targetRunKey = latest.runKey;
  const target = readRun(targetRunKey);
  if (!target) {
    emit({ ok: false, runKey: targetRunKey, status: 'run-missing' });
    return 1;
  }
  const queue = seedQueue(loadQueue());
  const item = target.item?.slug ? findItem(queue, { slug: target.item.slug }) : null;
  const incidentRepairs = countIncidentRepairs(targetRunKey);
  let repo;
  try {
    repo = mainGuard(config);
  } catch (error) {
    repo = {
      ok: false,
      status: 'skipped',
      reason: `主 checkout 检查失败：${error.message}`,
      clean: false,
      synced: false,
    };
  }
  const eligibility = incidentEligibility({
    verifyStatus: target.verify?.status,
    item,
    incidentRepairs,
    maxIncidentRepairs: Number(config.caps?.maxIncidentRepairs ?? 1),
    clean: repo.clean !== false,
    branch: repo.branch ?? 'unknown',
    synced: repo.synced !== false,
    freeDiskGb: repo.freeDiskGb ?? 0,
    minFreeDiskGb: Number(config.guard?.minFreeDiskGb ?? 5),
  });
  if (!eligibility.ok) {
    emit({
      ok: false,
      runKey: targetRunKey,
      status: eligibility.status,
      reason: eligibility.reason,
    });
    return 0;
  }

  const commit = incidentCommit(target);
  const specPath = target.item?.specPath
    ? `scripts/tool-pipeline/${target.item.specPath}`
    : '';
  const commitShow = gitShowCommit(commit);
  const evidence = buildIncidentEvidence({
    run: target,
    commitShow,
    specPath,
    previousIncidentRepairs: incidentRepairs,
  });

  if (options.dryRun) {
    emit({
      ok: true,
      dryRun: true,
      runKey: incidentRunKeyFor(config),
      incidentOf: targetRunKey,
      item: target.item,
      verify: {
        status: target.verify?.status,
        reason: verifyFailureReason(target.verify ?? {}),
      },
      commit,
      specPath,
      evidence: evidence.slice(0, 1500),
      models: {
        builder: config.models.builder,
        repair: config.models.repair,
        repairEscalation: config.models.repairEscalation ?? config.models.repair,
      },
      budget: {
        maxTotalMinutes: config.budget.maxTotalMinutes,
        repairIncidentMinutes: config.timeoutsMinutes?.repairIncident ?? 165,
        timeoutsMinutes: config.timeoutsMinutes,
      },
    });
    return 0;
  }

  const incidentRunKey = incidentRunKeyFor(config);
  const incidentDir = runDir(incidentRunKey);
  ensureDir(incidentDir);
  const evidencePath = join(incidentDir, 'incident.md');
  writeTextAtomic(evidencePath, evidence);
  const incidentOptions = {
    action: 'run',
    slot: 'manual',
    slug: target.item.slug,
    runKey: '',
    dryRun: false,
    noPush: false,
    force: true,
    resume: '',
    verify: false,
    report: false,
    json: options.json,
    // 由本函数统一输出一条 JSON，避免 verify-later 解析到多段 JSON。
    silent: true,
    ignorePause: true,
    incidentOf: targetRunKey,
    priorFailure: evidence,
    incidentRunKey,
    incidentEvidencePath: evidencePath,
  };
  let code = 1;
  let runError = '';
  quietOutput = true;
  try {
    code = await runPipeline(incidentOptions);
  } catch (error) {
    runError = String(error.message ?? error);
  } finally {
    quietOutput = false;
  }
  const finished = readRun(incidentRunKey);
  const status =
    finished?.status ?? incidentOptions.lastSummary?.status ?? (code === 0 ? 'skipped' : 'failed');
  const ok = code === 0 && status === 'published';
  if (ok) {
    // verify 失败会自动写 PAUSED；修复已重新发布并通过全部门禁，这里只解除
    // 因自动 revert 造成的暂停，其它原因的 PAUSED 保持不动。
    const current = readPause();
    if (current.paused && /已自动 revert/.test(String(current.reason ?? ''))) {
      clearPause();
      pipelineLog('[incident] 异常修复已发布，清除自动 revert 留下的 PAUSED');
    }
  }
  emit({
    ok,
    runKey: incidentRunKey,
    status,
    incidentOf: targetRunKey,
    evidence: evidencePath,
    ...(ok
      ? {}
      : { reason: incidentOptions.lastSummary?.reason ?? finished?.error ?? runError ?? '' }),
  });
  return ok ? 0 : 1;
}

async function handleReport(options) {
  const config = loadConfig();
  const latest = readLatest();
  if (!latest?.runKey) {
    emit({ ok: false, reason: 'no-run' });
    return 0;
  }
  let run = readRun(latest.runKey);
  if (!run) {
    emit({ ok: false, reason: 'run-missing', runKey: latest.runKey });
    return 1;
  }
  if (options.verify && run.publish?.status === 'pushed' && !['verified', 'reverted', 'deploy-failed', 'ci-failed'].includes(run.verify?.status)) {
    const result = await verifyDeploy({ run, config, mainRepo: REPO, autoRevert: true });
    run.verify = result;
    if (result.status === 'reverted') run.status = 'reverted';
    if (result.status === 'verified') run.status = 'published';
    recordVerifyOutcome(run, result, config);
    writeRun(run);
  }
  if (options.json) emit(summarizeRun(run));
  else process.stdout.write(readText(join(runDir(run.runKey), 'report.md')) || `${JSON.stringify(summarizeRun(run), null, 2)}\n`);
  return 0;
}

async function handleVerify(options) {
  const config = loadConfig();
  const latest = readLatest();
  if (!latest?.runKey) {
    emit({ ok: false, reason: 'no-run' });
    return 0;
  }
  const run = readRun(latest.runKey);
  if (!run) {
    emit({ ok: false, reason: 'run-missing' });
    return 1;
  }
  const result = await verifyDeploy({ run, config, mainRepo: REPO, autoRevert: true });
  run.verify = result;
  if (result.status === 'reverted') run.status = 'reverted';
  if (result.status === 'verified') run.status = 'published';
  recordVerifyOutcome(run, result, config);
  writeRun(run);
  const bad = ['ci-failed', 'production-failed', 'reverted', 'deploy-failed'];
  emit({ ok: !bad.includes(result.status), runKey: run.runKey, ...result });
  return 0;
}

async function handleDryRun(options) {
  const config = loadConfig();
  const { runKey, date, slot } = runKeyFor(options, config);
  const queue = seedQueue(loadQueue());
  const registry = await loadRegistrySlugs();
  let item = options.slug ? findItem(queue, { slug: options.slug }) : selectNext(queue, { registry }).item;
  if (!item) {
    const backlog = loadBacklog();
    item = options.slug ? backlog.items?.find((entry) => entry.slug === options.slug) : null;
  }
  if (!item) {
    emit({ ok: false, status: 'queue-empty' });
    return 0;
  }
  const specPath = item.spec ? join(REPO, 'scripts/tool-pipeline', item.spec) : null;
  emit({
    ok: true,
    dryRun: true,
    runKey,
    date,
    slot,
    item,
    specPath,
    specExists: specPath ? existsSync(specPath) : false,
    worktree: join(WORKTREES_DIR, runKey),
    models: config.models,
    timeoutMinutes: config.timeoutsMinutes,
    commands: {
      architect: ['codex', 'exec', '-s', 'read-only', '-C', '<worktree>'],
      builder: ['codex', 'exec', '-s', 'workspace-write', '-C', '<worktree>'],
      gates: ['npm test', 'npm run build', 'node scripts/smoke-tool.mjs --slug', item.slug],
      verifier: ['codex', 'exec', '-s', 'read-only', '-C', '<worktree>', '-i', '<screenshots>'],
    },
  });
  return 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return 0;
  if (options.repairIncident) return handleRepairIncident(options);
  if (options.runKey && !options.resume) options.resume = options.runKey;
  if (options.resume) {
    const existing = readRun(options.resume);
    if (!existing) {
      emit({ ok: false, status: 'run-missing', runKey: options.resume });
      return 1;
    }
    options.slug = existing.item.slug;
    options.force = true;
    options.slot = 'manual';
    if (existing.incidentOf) {
      options.incidentOf = existing.incidentOf;
      // 异常修复伴随 verify 失败留下的 PAUSED，resume 时同样需要放行。
      options.ignorePause = true;
    }
    return runPipeline(options, existing);
  }
  if (options.report) return handleReport(options);
  if (options.verify) return handleVerify(options);
  if (options.dryRun) return handleDryRun(options);
  return runPipeline(options);
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
