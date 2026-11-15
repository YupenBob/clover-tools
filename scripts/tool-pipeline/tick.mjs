#!/usr/bin/env node
/**
 * CloverTools daily tool pipeline.
 *
 * Usage:
 *   node scripts/tool-pipeline/tick.mjs --dry-run [--slug <slug>] [--slot manual]
 *   node scripts/tool-pipeline/tick.mjs --slot nightly [--no-push]
 *   node scripts/tool-pipeline/tick.mjs --report [--verify] [--json]
 *   node scripts/tool-pipeline/tick.mjs --verify
 *   node scripts/tool-pipeline/tick.mjs --resume <runKey>
 */
import os from 'node:os';
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
  headSha,
  isClean,
  resetSoft,
  removeWorktree,
  remoteHead,
} from './lib/git.mjs';
import {
  acquireGlobalLock,
  acquireRunLock,
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
import { commitTool, publishToMain } from './lib/publish.mjs';
import { verifyDeploy } from './lib/verify-deploy.mjs';
import { readRunReport, summarizeRun, writeRun } from './lib/report.mjs';

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
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-push') options.noPush = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--report') options.report = true;
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
    console.log(
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

function assertGuard(config, options, runKey, zoned) {
  const pauseInfo = readPause();
  if (pauseInfo.paused) return { ok: false, status: 'paused', reason: `PAUSED: ${pauseInfo.reason}` };
  if (!isClean(REPO)) {
    return { ok: false, status: 'skipped', reason: '主 checkout 不干净' };
  }
  if (currentBranch(REPO) !== 'main') {
    return { ok: false, status: 'skipped', reason: `主 checkout 不在 main（${currentBranch(REPO)}）` };
  }
  fetchOrigin(REPO);
  if (commitsAhead(REPO) !== 0) {
    return { ok: false, status: 'skipped', reason: 'main 有未推送提交，先处理内容流水线' };
  }
  if (remoteHead(REPO) !== headSha(REPO)) {
    return {
      ok: false,
      status: 'skipped',
      reason: `本地 main 与 origin/main 不一致（${headSha(REPO).slice(0, 8)} vs ${remoteHead(REPO).slice(0, 8)}）`,
    };
  }
  const free = freeDiskGb();
  if (free < Number(config.guard.minFreeDiskGb ?? 5)) {
    return { ok: false, status: 'skipped', reason: `磁盘仅剩 ${free.toFixed(1)}G` };
  }
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

async function builderStep({ run, item, config, worktree, spec, logDir, name = 'builder' }) {
  ensureBudget(run, config, 165);
  setPhase(run, 'builder', 'running');
  const prompt = builderPrompt({ item, config, base: run.baseSha, spec });
  const result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name,
    model: name === 'builder' ? config.models.builder : config.models.repair,
    reasoning: config.reasoning.builder,
    sandbox: 'workspace-write',
    timeoutMs: timeoutMs(config, name === 'builder' ? 'builder' : 'repair'),
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
  setPhase(run, 'repair', 'running', kind);
  const prompt = repairPrompt({ item, config, base: run.baseSha, spec, failure, kind });
  const result = await runCodex({
    prompt,
    cwd: worktree,
    logDir,
    name,
    model: config.models.repair,
    reasoning: config.reasoning.repair,
    sandbox: 'workspace-write',
    timeoutMs: timeoutMs(config, 'repair'),
    config,
  });
  run.codex[name] = codexSummary(result);
  setPhase(run, 'repair', result.ok ? 'done' : 'failed', kind);
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
  const published = publishToMain({ mainRepo: REPO, base: run.baseSha, sha: commit.sha });
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
  run.publish = {
    status: 'pushed',
    commit: commit.sha,
    message: commit.message,
    mainHead: published.mainHead,
    files: paths.length,
  };
  run.apiPath = item.apiPath ?? (item.network ? `/api/${item.slug}` : null);
  setPhase(run, 'publish', 'done', commit.sha.slice(0, 8));
}

function cleanupWorktree(runKey) {
  const worktree = join(WORKTREES_DIR, runKey);
  if (!existsSync(worktree)) return;
  removeWorktree(worktree, REPO);
  rmSync(worktree, { recursive: true, force: true });
}

async function runPipeline(options, existingRun = null) {
  const config = loadConfig();
  const { runKey, date, slot, zoned } = runKeyFor(options, config);
  options.slot = slot;
  const guard = assertGuard(config, options, runKey, zoned);
  if (!guard.ok) {
    console.log(
      JSON.stringify({ ok: guard.status === 'skipped', status: guard.status, reason: guard.reason, runKey }, null, 2),
    );
    return 0;
  }

  await waitForLoad(config);
  const globalLock = acquireGlobalLock();
  if (!globalLock.ok) {
    console.log(JSON.stringify({ ok: false, status: 'locked', runKey, reason: 'another pipeline run holds global.lock' }, null, 2));
    return 0;
  }
  const lock = acquireRunLock(runKey);
  if (!lock.ok) {
    globalLock.stop();
    console.log(JSON.stringify({ ok: false, status: 'locked', runKey, reason: lock.reason }, null, 2));
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
      console.log(JSON.stringify({ ok: false, status: 'resume-item-missing' }, null, 2));
      return 1;
    }
  } else if (options.slug) {
    item = findItem(queue, { slug: options.slug });
    if (!item) {
      const backlog = loadBacklog();
      const candidate = backlog.items?.find((entry) => entry.slug === options.slug);
      if (!candidate) {
        lock.stop();
        console.log(JSON.stringify({ ok: false, status: 'unknown-slug', slug: options.slug }, null, 2));
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
      console.log(JSON.stringify({ ok: false, status: 'queue-empty', skipped: selection.skipped }, null, 2));
      return 0;
    }
  }
  if (registry.has(item.slug)) {
    lock.stop();
    console.log(JSON.stringify({ ok: false, status: 'already-in-registry', slug: item.slug }, null, 2));
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
    slot,
    timezone: config.timezone,
    status: 'in_progress',
    startedAt: nowIso(),
    finishedAt: null,
    baseSha: base,
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
    setPhase(run, 'select', 'done', `${item.slug} priority=${item.priority ?? '-'}`);

    const resumeWorktree = join(WORKTREES_DIR, runKey);
    worktree =
      existingRun && existsSync(resumeWorktree)
        ? resumeWorktree
        : ensureWorktree(runKey, base);
    run.worktree = worktree;
    setPhase(run, 'worktree', 'done', worktree);

    const spec = existsSync(join(runDirPath, 'spec.md'))
      ? readText(join(runDirPath, 'spec.md'))
      : await architectStep({ run, item, config, worktree, runKey, logDir });
    run.specFile = join(runDirPath, 'spec.md');
    if (!spec.trim()) throw new Error('spec 为空');

    const changedBefore = changedPaths(base, worktree);
    const hasChanges =
      changedBefore.all.some((path) => !path.startsWith('.editorial/') && !path.startsWith('.tool-pipeline/'));
    if (hasChanges) {
      setPhase(run, 'builder', 'done', 'resume: existing changes');
    } else {
      await builderStep({ run, item, config, worktree, spec, logDir });
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
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: run.status,
          runKey,
          slug: item.slug,
          commit: run.publish?.commit ?? null,
          report: join(runDirPath, 'report.md'),
          duration: formatDuration(Date.now() - new Date(run.startedAt).getTime()),
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (error) {
    run.status = /预算|超过|cutoff|timeout/i.test(error.message) ? 'stalled' : 'failed';
    run.error = String(error.stack ?? error.message ?? error);
    run.finishedAt = nowIso();
    recordOutcome({ run, queue, status: run.status, config, error: run.error });
    writeRun(run);
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
  if (result?.status !== 'reverted') return;
  const queue = loadQueue();
  const item = findItem(queue, { slug: run.item.slug });
  if (!item) return;
  markFailed(queue, item, {
    runId: run.runKey,
    error: `生产/CI 校验失败，已 revert：${result.reason ?? result.status}`,
  });
  saveQueue(queue);
  const state = loadState();
  state.consecutiveFailures = Number(state.consecutiveFailures ?? 0) + 1;
  saveState(state);
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
