#!/usr/bin/env node
/**
 * Tick 驱动器（P5：Codex 整趟执行 + 宿主确定性门禁 + 异常自修）
 *
 * 设计：把原来 Lead 手工串的 ~35 步收进一个确定性脚本；Codex 负责「选源 + 冻结摘录 + 写作 + 自检」，
 * 宿主负责「导入 / 截图 / 核验 / 机械预检 / 落盘 / 推送」，失败时把**失败详情**续聊回 Codex 自修，
 * 修不动才升级给 Lead（写 escalate.json）。Lead 只在「独立复核」「翻译复核」「收尾」这些人该管的节点上场。
 *
 * 用法：
 *   node scripts/editorial/tick-driver.mjs prepare  [--slot auto] [--json] [--dry-run]
 *   node scripts/editorial/tick-driver.mjs repair   --run <runKey> --reason <mechanical|review> [--feedback <file>] [--json]
 *   node scripts/editorial/tick-driver.mjs land     --run <runKey> [--json]        # 复核通过后：落盘 + 门禁 + 翻译决策
 *   node scripts/editorial/tick-driver.mjs i18n     --run <runKey> [--json]        # 多语言生产 + 机械预检
 *   node scripts/editorial/tick-driver.mjs finalize --run <runKey> [--json]        # 提交 + 推送 + 部署校验 + 收尾
 *   node scripts/editorial/tick-driver.mjs status   --run <runKey> [--json]
 *
 * 退出码：0 = 完成/已到人该接的节点；2 = 本趟跳过（暂停/限额/脏工作区/队列空）；3 = 失败并已升级。
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { statusPorcelain } from './lib/git.mjs';
import { loadQueue, markQueueItem } from './lib/state.mjs';

const EXIT = { ok: 0, skip: 2, failed: 3 };
const NODE = process.execPath;

function parseArgs(argv) {
  const options = { phase: argv[0], json: false, dryRun: false, slot: 'auto', maxRepairs: null };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--slot') options.slot = argv[++index];
    else if (arg === '--reason') options.reason = argv[++index];
    else if (arg === '--feedback') options.feedback = argv[++index];
    else if (arg === '--max-repairs') options.maxRepairs = Number(argv[++index]);
    else if (arg === '--json') options.json = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runDir(runKey) {
  return join(STATE_PATHS.runs, runKey);
}

function stateFile(runKey) {
  return join(runDir(runKey), 'tick-state.json');
}

function loadState(runKey) {
  return readJson(stateFile(runKey), { runKey, steps: {}, repairs: 0, failures: [], codex: {} });
}

function saveState(state) {
  writeJson(stateFile(state.runKey), state);
}

function log(runKey, line) {
  try {
    mkdirSync(runDir(runKey), { recursive: true });
    appendFileSync(join(runDir(runKey), 'driver.log'), `${new Date().toISOString()} ${line}\n`);
  } catch {
    // 日志失败不影响主流程
  }
}

function emit(payload, code = EXIT.ok, options = {}) {
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else if (payload.title) console.log(`${payload.title}${payload.detail ? ` — ${payload.detail}` : ''}`);
  else console.log(JSON.stringify(payload));
  process.exit(code);
}

/**
 * 跑一个会派生常驻子进程的脚本（如 capture-tool 的 dev server 监督进程）：
 * 输出重定向到文件，避免 spawnSync 等不到被继承的管道而误判超时。
 */
function shToFile(scriptPath, args, { cwd = ROOT, timeoutMs = 30 * 60_000, logFile, env = {} } = {}) {
  const startedAt = Date.now();
  mkdirSync(dirname(logFile), { recursive: true });
  const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
  const command = `"${NODE}" ${[scriptPath, ...args].map(quote).join(' ')} > ${quote(logFile)} 2>&1`;
  const result = spawnSync('bash', ['-c', command], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  let out = '';
  try {
    out = readFileSync(logFile, 'utf8');
  } catch {
    out = '';
  }
  return { code: result.status ?? 127, out, err: result.stderr ?? '', timedOut: result.signal === 'SIGTERM', ms: Date.now() - startedAt };
}

/** 跑一个 node 脚本，返回 {code, out, err, ms}。永不抛出（失败由调用方判定）。 */
function sh(scriptPath, args, { cwd = ROOT, timeoutMs = 30 * 60_000, env = {} } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(NODE, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return {
    code: result.status ?? 127,
    out: result.stdout ?? '',
    err: result.stderr ?? '',
    timedOut: result.signal === 'SIGTERM' || result.error?.code === 'ETIMEDOUT',
    ms: Date.now() - startedAt,
  };
}

function tail(text, chars = 1600) {
  const value = String(text ?? '').trim();
  return value.length > chars ? `…${value.slice(-chars)}` : value;
}

// ---------------------------------------------------------------------------
// prepare：准备 → Codex 整趟 → 导入 → 截图 → 核验 → 预检（失败自修）
// ---------------------------------------------------------------------------

function composeTickPrompt(runKey, slug, item, worktree) {
  const template = readFileSync(join(ROOT, '.editorial/prompts/tick-codex.md'), 'utf8');
  const header = [
    '> 本文件由 tick-driver.prepare 生成；模板：`.editorial/prompts/tick-codex.md`。',
    '',
    `- runKey: \`${runKey}\``,
    `- slug: \`${slug}\``,
    `- toolSlug: \`${item.toolSlug ?? slug}\``,
    `- type: \`${item.type ?? 'new-guide'}\``,
    `- 主查询: \`${item.primaryQuery ?? ''}\``,
    `- 隔离工作区: \`${worktree}\``,
    `- 输入清单: \`.editorial/runs/${runKey}/item.json\`、\`.editorial/runs/${runKey}/brief.md\``,
    '',
  ].join('\n');
  return `${header}\n${template
    .replaceAll('<runKey>', runKey)
    .replaceAll('<slug>', slug)
    .replaceAll('<toolSlug>', item.toolSlug ?? slug)}`;
}

function composeRepairPrompt(runKey, slug, state, options) {
  const lines = [
    `# 续聊修复（第 ${state.repairs + 1} 次）`,
    '',
    `runKey=\`${runKey}\` slug=\`${slug}\`。宿主跑确定性门禁时失败，请**只修被指出的问题**。`,
    '',
    '## 失败详情',
    '',
  ];
  for (const failure of state.failures.slice(-4)) {
    lines.push(`### ${failure.step}（${failure.at ?? ''}）`);
    lines.push('```');
    lines.push(tail(failure.detail, 1200));
    lines.push('```');
    lines.push('');
  }
  if (options.feedback) {
    const feedbackFile = resolve(options.feedback);
    if (existsSync(feedbackFile)) {
      lines.push('## 审校 / 复核反馈');
      lines.push('');
      lines.push(tail(readFileSync(feedbackFile, 'utf8'), 4000));
      lines.push('');
    }
  }
  lines.push('## 硬约束');
  lines.push('');
  lines.push('- 不要重写整篇；不要改白名单、门禁、配置、`.editorial/tools/`；不要删除 `guide.json` / `evidence.json`（缺文件会被判产物缺失）。');
  lines.push('- 改正文后必须重跑 `precheck-zh --strict` 与 `precheck-style --strict`，全过再汇报。');
  lines.push('- 不要执行 git 写操作，不要跑 `capture-tool.mjs`。');
  lines.push('- 最后 ≤6 行汇报：改了什么 / 为什么不会复发 / 还需要宿主做什么。');
  return lines.join('\n');
}

/** 导入 + 冻结摘录 + 截图 + 来源核验 + 机械预检。返回 {name, ok, detail} 列表。 */
function runGates(runKey, slug, config) {
  const state = loadState(runKey);
  const results = [];
  const gate = (name, scriptPath, args, timeoutMs = 10 * 60_000, extra = {}) => {
    const result = sh(scriptPath, args, { timeoutMs, ...extra });
    const ok = result.code === 0;
    results.push({ name, ok, detail: ok ? `ok ${Math.round(result.ms / 1000)}s` : `${result.code}: ${tail(result.err || result.out)}` });
    log(runKey, `gate ${name} code=${result.code} ms=${result.ms}`);
    if (!ok) {
      state.failures.push({ step: name, detail: `${result.out}\n${result.err}`, at: new Date().toISOString() });
      saveState(state);
    }
    return result;
  };

  gate('import', 'scripts/editorial/import-draft.mjs', ['--run', runKey, '--slug', slug]);
  gate('source-digest', 'scripts/editorial/source-digest.mjs', ['--run', runKey], 5 * 60_000);
  const captureStarted = Date.now();
  const captureResult = shToFile('scripts/editorial/capture-tool.mjs', ['--slug', slug, '--timeout-min', '6'], {
    timeoutMs: 8 * 60_000,
    logFile: join(runDir(runKey), 'capture.log'),
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  });
  const captureOk = captureResult.code === 0;
  results.push({
    name: 'capture',
    ok: captureOk,
    detail: captureOk ? `ok ${Math.round((Date.now() - captureStarted) / 1000)}s` : `${captureResult.code}: ${tail(captureResult.out, 1200)}`,
  });
  log(runKey, `gate capture code=${captureResult.code} ms=${captureResult.ms}`);
  if (!captureOk) {
    state.failures.push({ step: 'capture', detail: captureResult.out, at: new Date().toISOString() });
    saveState(state);
  }
  const capture = captureResult;
  if (capture.code !== 0) {
    // 截图失败不阻断后续核验，但必须记入失败清单交给 Codex 修
    log(runKey, 'capture failed; continuing to verify/precheck');
  }
  gate('verify-sources', 'scripts/editorial/verify-sources.mjs', ['--slug', slug, '--run', runKey], 5 * 60_000);
  gate('precheck-zh', '.editorial/tools/precheck-zh.mjs', ['--slug', slug, '--draft-dir', `.editorial/drafts/${slug}`, '--strict'], 5 * 60_000);
  gate('precheck-style', 'scripts/editorial/tools/precheck-style.mjs', ['--slug', slug, '--draft-dir', `.editorial/drafts/${slug}`, '--strict'], 5 * 60_000);
  void config;
  return results;
}

function ensureWorktree(runKey, slug, { force = false } = {}) {
  const status = sh('scripts/editorial/codex-worktree.mjs', ['--status', '--run', runKey]);
  const worktree = join('/tmp/clovertools-codex', runKey);
  if (status.code === 0 && existsSync(worktree) && !force) return worktree;
  const prepared = sh('scripts/editorial/codex-worktree.mjs', ['--prepare', '--run', runKey, '--slug', slug, ...(force ? ['--force'] : [])]);
  if (prepared.code !== 0) throw new Error(`codex-worktree 准备失败：${tail(prepared.err || prepared.out)}`);
  return worktree;
}

/**
 * 延后本趟：释放槽位锁、把队列项放回 ready、清工作区。
 * 用于 codex 套餐额度用尽这类「不是内容问题」的失败——下一趟（12:00/18:00）再自然重试。
 */
function deferRun(state, reason, hint) {
  try {
    rmSync(join(STATE_PATHS.locks, state.runKey), { recursive: true, force: true });
  } catch {
    // 忽略
  }
  try {
    const queue = loadQueue();
    const item = queue.items.find((entry) => entry.runId === state.runKey);
    if (item) markQueueItem(queue, item.id, { status: 'ready', runId: null, deferredAt: new Date().toISOString() });
  } catch {
    // 忽略
  }
  try {
    sh('scripts/editorial/codex-worktree.mjs', ['--cleanup', '--run', state.runKey], { timeoutMs: 2 * 60_000 });
  } catch {
    // 忽略
  }
  state.phase = 'deferred';
  state.deferredReason = reason;
  saveState(state);
  writeJson(join(runDir(state.runKey), 'escalate.json'), { runKey: state.runKey, slug: state.slug, reason, hint, at: new Date().toISOString() });
  log(state.runKey, `deferred ${reason}`);
}

function codexSession(runKey) {
  return readJson(join(runDir(runKey), 'codex-session.json'), { stages: {} });
}

function repair(runKey, slug, state, options) {
  const config = loadConfig();
  const worktree = ensureWorktree(runKey, slug);
  const promptFile = join(runDir(runKey), `repair-${state.repairs + 1}.md`);
  mkdirSync(dirname(promptFile), { recursive: true });
  writeFileSync(promptFile, composeRepairPrompt(runKey, slug, state, options));
  const session = codexSession(runKey);
  const threadId = session.stages?.draft?.threadId ?? session.threadId;
  if (!threadId) throw new Error('缺少 codex thread id，无法续聊修复（先跑 prepare）');
  const timeoutMinutes = config.codex?.timeoutMinutes?.repair ?? 12;
  const args = [
    '--stage', 'repair',
    '--run', runKey,
    '--slug', slug,
    '--resume', threadId,
    '--prompt-file', promptFile,
    '--cwd', worktree,
    '--network',
    '--expect', `.editorial/drafts/${slug}/guide.json`,
    '--expect', `.editorial/drafts/${slug}/evidence.json`,
    '--timeout-min', String(timeoutMinutes),
    '--attempt', String(state.repairs + 1),
  ];
  const result = sh('scripts/editorial/codex-run.mjs', args, { timeoutMs: (timeoutMinutes + 3) * 60_000 });
  log(runKey, `repair #${state.repairs + 1} code=${result.code} ms=${result.ms}`);
  if (result.code === 7) return { ok: false, quota: true, detail: 'codex 套餐额度用尽（下一趟再试）' };
  if (result.code !== 0) {
    return { ok: false, detail: `codex 修复失败（codex-run 退出码 ${result.code}）：${tail(result.err || result.out)}` };
  }
  return { ok: true };
}

function prepare(options) {
  const config = loadConfig();
  const prep = sh('scripts/editorial/tick-prepare.mjs', ['--slot', options.slot, ...(options.dryRun ? ['--dry-run'] : [])], { timeoutMs: 5 * 60_000 });
  let prepared = null;
  try {
    prepared = JSON.parse(prep.out.slice(prep.out.indexOf('{')));
  } catch {
    /* 下面统一处理 */
  }
  if (prep.code !== 0 || !prepared) {
    emit({ ok: false, phase: 'prepare', title: 'tick-driver: prepare 失败', detail: tail(prep.err || prep.out) }, EXIT.failed, options);
  }
  if (!prepared.proceed) {
    emit({ ok: true, skipped: true, phase: 'prepare', reason: prepared.reason, title: `tick-driver: skip ${prepared.reason}` }, EXIT.skip, options);
  }

  const runKey = prepared.runKey;
  const { item } = prepared;
  const slug = item.slug ?? item.toolSlug;
  const state = { runKey, slug, toolSlug: item.toolSlug ?? slug, type: item.type, phase: 'prepare', steps: {}, repairs: 0, failures: [], startedAt: new Date().toISOString() };
  saveState(state);

  // 1.7 记录既有无关改动（供 stage-changes / check-workspace-scope 区分越权）
  const preExisting = statusPorcelain().map((line) => String(line).slice(3).trim().replace(/^"|"$/g, '').replace(/\\/g, '/'));
  writeJson(join(runDir(runKey), 'pre-existing.json'), { paths: preExisting, at: new Date().toISOString() });

  if (options.dryRun) {
    emit({ ok: true, phase: 'prepare', dryRun: true, runKey, slug, title: `tick-driver: dry-run ${runKey} ${slug}` }, EXIT.ok, options);
  }

  let worktree;
  try {
    worktree = ensureWorktree(runKey, slug);
  } catch (error) {
    state.failures.push({ step: 'worktree', detail: String(error.message), at: new Date().toISOString() });
    saveState(state);
    emit({ ok: false, phase: 'prepare', title: 'tick-driver: 工作区准备失败', detail: String(error.message) }, EXIT.failed, options);
  }

  // Codex 整趟：选源 → digest → 写作 → 自检
  const tickPrompt = join(runDir(runKey), 'tick-prompt.md');
  writeFileSync(tickPrompt, composeTickPrompt(runKey, slug, item, worktree));
  const draftMinutes = config.codex?.timeoutMinutes?.draft ?? 22;
  const draft = sh(
    'scripts/editorial/codex-run.mjs',
    [
      '--stage', 'draft',
      '--run', runKey,
      '--slug', slug,
      '--prompt-file', tickPrompt,
      '--cwd', worktree,
      '--network',
      '--expect', `.editorial/drafts/${slug}/guide.json`,
      '--expect', `.editorial/drafts/${slug}/evidence.json`,
      '--expect', `.editorial/runs/${runKey}/source-manifest.json`,
      '--timeout-min', String(draftMinutes),
    ],
    { timeoutMs: (draftMinutes + 4) * 60_000 },
  );
  log(runKey, `codex draft code=${draft.code} ms=${draft.ms}`);
  if (draft.code === 7) {
    deferRun(state, 'codex-usage-limit', tail(draft.out || draft.err, 400));
    emit({ ok: true, skipped: true, phase: 'prepare', reason: 'codex-usage-limit', runKey, title: 'tick-driver: skip codex-usage-limit（下一趟再试）' }, EXIT.skip, options);
  }
  if (draft.code !== 0) {
    state.failures.push({ step: 'codex-draft', detail: `${draft.out}\n${draft.err}`, at: new Date().toISOString() });
    saveState(state);
    // 先修一次：超时/缺产物多数是自检没过
    const fixed = repair(runKey, slug, state, options);
    state.repairs += 1;
    saveState(state);
    if (fixed.quota) {
      deferRun(state, 'codex-usage-limit', fixed.detail);
      emit({ ok: true, skipped: true, phase: 'prepare', reason: 'codex-usage-limit', runKey, title: 'tick-driver: skip codex-usage-limit（下一趟再试）' }, EXIT.skip, options);
    }
    if (!fixed.ok) {
      saveState(state);
      emit({ ok: false, phase: 'prepare', title: 'tick-driver: Codex 首轮失败且修复失败', detail: fixed.detail, runKey }, EXIT.failed, options);
    }
    state.failures.pop();
    saveState(state);
  }

  // 门禁 + 自修环
  const maxRepairs = options.maxRepairs ?? config.caps?.maxRepairsPerTick ?? 3;
  let gates = runGates(runKey, slug, config);
  while (gates.some((gate) => !gate.ok) && state.repairs < maxRepairs) {
    const failed = gates.filter((gate) => !gate.ok).map((gate) => gate.name).join('、');
    log(runKey, `gates failed: ${failed}; repair #${state.repairs + 1}`);
    const fixed = repair(runKey, slug, state, options);
    state.repairs += 1;
    saveState(state);
    if (fixed.quota) {
      deferRun(state, 'codex-usage-limit', fixed.detail);
      emit({ ok: true, skipped: true, phase: 'prepare', reason: 'codex-usage-limit', runKey, title: 'tick-driver: skip codex-usage-limit（下一趟再试）' }, EXIT.skip, options);
    }
    if (!fixed.ok) {
      state.failures.push({ step: 'repair', detail: fixed.detail, at: new Date().toISOString() });
      saveState(state);
      break;
    }
    gates = runGates(runKey, slug, config);
  }

  const failing = gates.filter((gate) => !gate.ok);
  if (failing.length > 0) {
    // 已耗尽自修预算：升级给 Lead（保留 worktree 现场便于排查）
    writeJson(join(runDir(runKey), 'escalate.json'), {
      runKey,
      slug,
      reason: 'gates-failed-after-repairs',
      gates: failing,
      repairs: state.repairs,
      at: new Date().toISOString(),
      worktree,
    });
    state.phase = 'failed';
    saveState(state);
    emit({ ok: false, phase: 'prepare', title: 'tick-driver: 自修预算用尽，已升级', detail: failing.map((gate) => gate.name).join('、'), runKey }, EXIT.failed, options);
  }

  state.phase = 'awaiting-review';
  state.steps.gates = gates;
  state.awaitingReviewAt = new Date().toISOString();
  saveState(state);
  rmSync(join(runDir(runKey), 'escalate.json'), { force: true });
  emit(
    {
      ok: true,
      phase: 'prepare',
      runKey,
      slug,
      repairs: state.repairs,
      gates,
      next: 'awaiting-review',
      title: `tick-driver: 待复核 ${runKey} ${slug}（自修 ${state.repairs} 次）`,
    },
    EXIT.ok,
    options,
  );
}

// ---------------------------------------------------------------------------
// repair：Lead 复核后仍有 blocking / 或 Lead 判定需要再修时调用
// ---------------------------------------------------------------------------

function repairPhase(options) {
  if (!options.run) throw new Error('缺少 --run');
  const state = loadState(options.run);
  if (state.phase !== 'awaiting-review' && state.phase !== 'failed') {
    emit({ ok: false, phase: 'repair', title: `tick-driver: 状态 ${state.phase} 不允许修复`, detail: '先跑 prepare' }, EXIT.failed, options);
  }
  const result = repair(options.run, state.slug, state, options);
  state.repairs += 1;
  if (result.ok) {
    state.failures = [];
    const gates = runGates(options.run, state.slug, loadConfig());
    const failing = gates.filter((gate) => !gate.ok);
    state.steps.gates = gates;
    saveState(state);
    if (failing.length === 0) {
      emit({ ok: true, phase: 'repair', runKey: options.run, slug: state.slug, repairs: state.repairs, gates, title: `tick-driver: 修复完成，待复核 ${options.run}` }, EXIT.ok, options);
    }
    writeJson(join(runDir(options.run), 'escalate.json'), { runKey: options.run, slug: state.slug, reason: 'gates-failed-after-repair', gates: failing, at: new Date().toISOString() });
    emit({ ok: false, phase: 'repair', title: 'tick-driver: 修复后仍有门禁失败', detail: failing.map((gate) => gate.name).join('、'), runKey: options.run }, EXIT.failed, options);
  }
  if (result.quota) {
    deferRun(state, 'codex-usage-limit', result.detail);
    emit({ ok: true, skipped: true, phase: 'repair', reason: 'codex-usage-limit', runKey: options.run, title: 'tick-driver: skip codex-usage-limit（下一趟再试）' }, EXIT.skip, options);
  }
  state.failures.push({ step: options.reason ?? 'manual', detail: result.detail, at: new Date().toISOString() });
  state.phase = 'failed';
  saveState(state);
  writeJson(join(runDir(options.run), 'escalate.json'), { runKey: options.run, slug: state.slug, reason: 'repair-failed', detail: result.detail, at: new Date().toISOString() });
  emit({ ok: false, phase: 'repair', title: 'tick-driver: 修复失败，已升级', detail: result.detail, runKey: options.run }, EXIT.failed, options);
}

// ---------------------------------------------------------------------------
// land：复核通过 → 落盘 zh → 门禁 → 翻译决策
// ---------------------------------------------------------------------------

function requireRun(options, allowedPhases) {
  if (!options.run) throw new Error('缺少 --run');
  const state = loadState(options.run);
  if (allowedPhases && !allowedPhases.includes(state.phase)) {
    emit({ ok: false, phase: options.phase, title: `tick-driver: 当前状态 ${state.phase} 不能进入 ${options.phase}`, detail: state.phase }, EXIT.failed, options);
  }
  return state;
}

/** 把复核结论写进草稿 guide.json 的 _meta（apply-draft 会原样带进正式稿）。 */
function injectReviewMeta(runKey, slug) {
  const review = readJson(join(runDir(runKey), 'review.json'), null);
  if (!review?.verdict) return { ok: false, reason: '缺少 review.json（先做 zh 独立复核）' };
  if (review.verdict !== 'pass') return { ok: false, reason: `复核未通过（${review.verdict}），先 repair 再复审` };
  const guideFile = join(STATE_PATHS.drafts, slug, 'guide.json');
  const guide = readJson(guideFile, null);
  if (!guide) return { ok: false, reason: `缺少草稿 ${guideFile}` };
  guide._meta = {
    ...(guide._meta ?? {}),
    reviewerVerdict: review.verdict,
    reviewerConfidence: review.confidence ?? null,
    reviewer: review.reviewer ?? 'deepseek',
    reviewerRunId: review.runId ?? runKey,
    verifiedAt: new Date().toISOString(),
  };
  writeJson(guideFile, guide);
  return { ok: true, verdict: review.verdict, confidence: review.confidence ?? null, blocking: review.blockingIssues?.length ?? 0 };
}

function land(options) {
  const config = loadConfig();
  const state = requireRun(options, ['awaiting-review', 'landing', 'needs-i18n', 'needs-i18n-review', 'finalizing']);
  const { runKey, slug } = state;
  const meta = injectReviewMeta(runKey, slug);
  log(runKey, `land review-meta ${meta.ok ? 'ok' : meta.reason}`);
  if (!meta.ok) {
    writeJson(join(runDir(runKey), 'escalate.json'), { runKey, slug, reason: 'review-not-pass', detail: meta.reason, at: new Date().toISOString() });
    emit({ ok: false, phase: 'land', title: 'tick-driver: 复核未通过不能落盘', detail: meta.reason, runKey }, EXIT.failed, options);
  }
  if (options.dryRun) emit({ ok: true, phase: 'land', dryRun: true, runKey, slug, title: `tick-driver: dry-run land ${runKey}` }, EXIT.ok, options);

  const steps = [
    ['apply-draft', 'scripts/editorial/apply-draft.mjs', ['--slug', slug, '--run', runKey]],
    ['verify-article', 'scripts/editorial/verify-article.mjs', ['--slug', slug, '--run', runKey]],
  ];
  for (const [name, scriptPath, args] of steps) {
    const result = sh(scriptPath, args, { timeoutMs: 10 * 60_000 });
    log(runKey, `land ${name} code=${result.code}`);
    if (result.code !== 0) {
      state.failures.push({ step: name, detail: `${result.out}\n${result.err}`, at: new Date().toISOString() });
      state.phase = 'failed';
      saveState(state);
      writeJson(join(runDir(runKey), 'escalate.json'), { runKey, slug, reason: `land-${name}-failed`, detail: tail(result.err || result.out), at: new Date().toISOString() });
      emit({ ok: false, phase: 'land', title: `tick-driver: ${name} 失败，已升级`, detail: tail(result.err || result.out), runKey }, EXIT.failed, options);
    }
    state.steps[name] = 'ok';
  }

  const decision = sh('.editorial/tools/decide-translate.mjs', ['--run', runKey, '--json'], { timeoutMs: 3 * 60_000 });
  log(runKey, `land decide-translate code=${decision.code}`);
  let parsed = null;
  try {
    parsed = JSON.parse(decision.out.slice(decision.out.indexOf('{')));
  } catch {
    parsed = null;
  }
  if (!parsed) {
    state.phase = 'failed';
    saveState(state);
    emit({ ok: false, phase: 'land', title: 'tick-driver: 翻译决策解析失败', detail: tail(decision.out || decision.err), runKey }, EXIT.failed, options);
  }
  writeJson(join(runDir(runKey), 'translate-decision.json'), parsed);
  state.translate = Boolean(parsed.translate);
  state.qualityScore = parsed.score ?? null;
  saveState(state);

  if (!state.translate) {
    state.phase = 'finalizing';
    saveState(state);
    emit({ ok: true, phase: 'land', runKey, slug, translate: false, score: parsed.score ?? null, title: `tick-driver: 只发中文（质量分 ${parsed.score ?? '?'}）→ 下一步 finalize` }, EXIT.ok, options);
  }
  state.phase = 'needs-i18n';
  saveState(state);
  emit({ ok: true, phase: 'land', runKey, slug, translate: true, score: parsed.score ?? null, langs: config.translation?.languages ?? ['tw', 'en', 'ko', 'ja'], title: `tick-driver: 过审可翻译（质量分 ${parsed.score ?? '?'}）→ 下一步 i18n` }, EXIT.ok, options);
}

// ---------------------------------------------------------------------------
// i18n：tw 机械 + en/ko/ja Codex → 落盘 → 机械预检
// ---------------------------------------------------------------------------

function translationPrompt(lang, runKey, slug) {
  const base = readFileSync(join(ROOT, '.editorial/prompts/translator-en-codex.md'), 'utf8');
  const head = [
    `# 译文任务（Codex · lang=${lang}）`,
    '',
    `- runKey: \`${runKey}\`，slug: \`${slug}\`，目标语言: \`${lang}\`（${lang === 'en' ? 'English' : lang === 'ko' ? '한국어' : lang === 'ja' ? '日本語' : lang}）`,
    `- 输出文件：\`.editorial/drafts/${slug}/translations/${lang}.json\``,
    '- 本文的「英文」示例仅作口径参考；请按目标语言的母语技术文档习惯写，不逐字直译。',
    '',
  ].join('\n');
  return `${head}\n${base}`;
}

function i18n(options) {
  const config = loadConfig();
  const state = requireRun(options, ['needs-i18n', 'i18n']);
  const { runKey, slug } = state;
  const langs = config.translation?.languages ?? ['tw', 'en', 'ko', 'ja'];
  state.phase = 'i18n';
  saveState(state);

  const fail = (name, detail) => {
    state.failures.push({ step: name, detail, at: new Date().toISOString() });
    state.phase = 'failed';
    saveState(state);
    writeJson(join(runDir(runKey), 'escalate.json'), { runKey, slug, reason: `i18n-${name}-failed`, detail: tail(detail), at: new Date().toISOString() });
    emit({ ok: false, phase: 'i18n', title: `tick-driver: i18n ${name} 失败，已升级`, detail: tail(detail), runKey }, EXIT.failed, options);
  };

  // tw：机械转换
  if (langs.includes('tw')) {
    const tw = sh('scripts/editorial/translate-tw.mjs', ['--slug', slug, '--run', runKey], { timeoutMs: 5 * 60_000 });
    log(runKey, `i18n tw code=${tw.code}`);
    if (tw.code !== 0) fail('translate-tw', `${tw.out}\n${tw.err}`);
  }

  // en/ko/ja：Codex（隔离工作区里翻，白名单导入）
  let worktree;
  try {
    worktree = ensureWorktree(runKey, slug, { force: true });
  } catch (error) {
    fail('worktree', String(error.message));
  }
  const minutes = config.codex?.timeoutMinutes?.translate ?? 12;
  for (const lang of langs.filter((entry) => entry !== 'tw')) {
    const backend = config.backends?.translate?.[lang] ?? 'codex';
    if (backend !== 'codex') {
      fail(`translate-${lang}`, `后端 ${backend} 需要 Lead 子代理翻译：先跑 Translator 子代理写 translations/${lang}.json，再重跑 i18n`);
    }
    const promptFile = join(runDir(runKey), `translate-${lang}-prompt.md`);
    writeFileSync(promptFile, translationPrompt(lang, runKey, slug));
    const translated = sh(
      'scripts/editorial/codex-run.mjs',
      [
        '--stage', 'translate',
        '--run', runKey,
        '--slug', slug,
        '--prompt-file', promptFile,
        '--cwd', worktree,
        '--expect', `.editorial/drafts/${slug}/translations/${lang}.json`,
        '--timeout-min', String(minutes),
      ],
      { timeoutMs: (minutes + 3) * 60_000 },
    );
    log(runKey, `i18n ${lang} code=${translated.code} ms=${translated.ms}`);
    if (translated.code !== 0) fail(`translate-${lang}`, `${translated.out}\n${translated.err}`);
    const imported = sh('scripts/editorial/import-draft.mjs', ['--run', runKey, '--slug', slug], { timeoutMs: 5 * 60_000 });
    if (imported.code !== 0) fail(`import-${lang}`, `${imported.out}\n${imported.err}`);
  }

  const applied = sh('scripts/editorial/apply-translations.mjs', ['--slug', slug, '--run', runKey, '--langs', langs.join(',')], { timeoutMs: 5 * 60_000 });
  log(runKey, `i18n apply-translations code=${applied.code}`);
  if (applied.code !== 0) fail('apply-translations', `${applied.out}\n${applied.err}`);

  const precheck = sh('.editorial/tools/precheck-i18n.mjs', ['--slug', slug], { timeoutMs: 5 * 60_000 });
  log(runKey, `i18n precheck-i18n code=${precheck.code}`);
  if (precheck.code !== 0) fail('precheck-i18n', `${precheck.out}\n${precheck.err}`);

  state.phase = 'needs-i18n-review';
  saveState(state);
  emit({ ok: true, phase: 'i18n', runKey, slug, langs, title: `tick-driver: 译文已落盘（${langs.join('/')}）→ 待多语复核，然后 finalize` }, EXIT.ok, options);
}

// ---------------------------------------------------------------------------
// finalize：提交 + 推送 + 部署校验 + 收尾
// ---------------------------------------------------------------------------

function finalize(options) {
  const config = loadConfig();
  const state = requireRun(options, ['finalizing', 'finalize', 'landing']);
  const { runKey, slug } = state;
  if (!['finalizing'].includes(state.phase)) {
    emit({ ok: false, phase: 'finalize', title: `tick-driver: 当前状态 ${state.phase} 不能收尾`, detail: '先把 state.phase 置为 finalizing（land 会自动置）' }, EXIT.failed, options);
  }
  const fail = (name, detail) => {
    state.failures.push({ step: name, detail, at: new Date().toISOString() });
    state.phase = 'failed';
    saveState(state);
    writeJson(join(runDir(runKey), 'escalate.json'), { runKey, slug, reason: `finalize-${name}-failed`, detail: tail(detail), at: new Date().toISOString() });
    emit({ ok: false, phase: 'finalize', title: `tick-driver: finalize ${name} 失败，已升级`, detail: tail(detail), runKey }, EXIT.failed, options);
  };

  if (state.translate) {
    const asserted = sh('.editorial/tools/decide-translate.mjs', ['--run', runKey, '--assert-applied'], { timeoutMs: 3 * 60_000 });
    if (asserted.code !== 0) fail('assert-applied', `${asserted.out}\n${asserted.err}`);
  }

  const verify = sh('scripts/editorial/verify-article.mjs', ['--slug', slug, '--run', runKey], { timeoutMs: 5 * 60_000 });
  if (verify.code !== 0) fail('verify-article', `${verify.out}\n${verify.err}`);

  const check = spawnSync('npm', ['run', 'check:all'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  log(runKey, `finalize check:all code=${check.status}`);
  if (check.status !== 0) fail('check:all', `${check.stdout ?? ''}\n${check.stderr ?? ''}`);

  const stage = sh('scripts/editorial/stage-changes.mjs', ['--run', runKey], { timeoutMs: 5 * 60_000 });
  if (stage.code !== 0) fail('stage-changes', `${stage.out}\n${stage.err}`);
  const scope = sh('scripts/editorial/check-workspace-scope.mjs', ['--run', runKey], { timeoutMs: 5 * 60_000 });
  if (scope.code !== 0) fail('check-workspace-scope', `${scope.out}\n${scope.err}`);

  const title = readJson(join(ROOT, 'data/editorial-guides', `${slug}.json`), {})?.title ?? slug;
  const message = state.translate ? `content: add guide "${title}"` : `content: add guide "${title}" (zh only)`;
  const commit = spawnSync('git', ['commit', '-m', message], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: config.git.authorName,
      GIT_AUTHOR_EMAIL: config.git.authorEmail,
      GIT_COMMITTER_NAME: config.git.authorName,
      GIT_COMMITTER_EMAIL: config.git.authorEmail,
    },
  });
  log(runKey, `finalize commit code=${commit.status}`);
  if (commit.status !== 0) fail('commit', `${commit.stdout ?? ''}\n${commit.stderr ?? ''}`);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim();

  state.steps.commit = sha;
  saveState(state);

  const push = sh('scripts/editorial/push-main.mjs', [], { timeoutMs: 5 * 60_000 });
  log(runKey, `finalize push code=${push.code}`);
  if (push.code !== 0) {
    const finishFailed = sh('scripts/editorial/finish-run.mjs', [
      '--run', runKey, '--status', 'local-commit', '--slug', slug, '--title', title,
      '--commit', sha ?? '', '--error', tail(push.err || push.out),
    ], { timeoutMs: 2 * 60_000 });
    void finishFailed;
    fail('push', `${push.out}\n${push.err}`);
  }

  const deploy = sh('scripts/editorial/deploy-verify.mjs', ['--run', runKey], { timeoutMs: 8 * 60_000 });
  log(runKey, `finalize deploy-verify code=${deploy.code}`);
  const finish = sh('scripts/editorial/finish-run.mjs', [
    '--run', runKey,
    '--status', 'published',
    '--slug', slug,
    '--title', title,
    '--commit', sha ?? '',
    '--push-ok',
    '--push-sha', sha ?? '',
    '--deploy-status', deploy.code === 0 ? 'pending' : 'failed',
    ...(state.translate ? [] : ['--warning', `zh-only：翻译门槛未过（质量分 ${state.qualityScore ?? '?'}/13）`]),
  ], { timeoutMs: 3 * 60_000 });
  if (finish.code !== 0) fail('finish-run', `${finish.out}\n${finish.err}`);

  state.phase = 'done';
  state.finishedAt = new Date().toISOString();
  saveState(state);
  sh('.editorial/tools/usage-report.mjs', ['--run', runKey], { timeoutMs: 2 * 60_000 });
  try {
    sh('scripts/editorial/codex-worktree.mjs', ['--cleanup', '--run', runKey], { timeoutMs: 2 * 60_000 });
  } catch {
    // 清理失败不影响发布
  }
  emit({ ok: true, phase: 'finalize', runKey, slug, sha, translate: state.translate, title: `tick-driver: 已发布 ${slug}（${sha?.slice(0, 8)}）` }, EXIT.ok, options);
}

// ---------------------------------------------------------------------------

function gatesPhase(options) {
  const state = requireRun(options);
  const gates = runGates(state.runKey, state.slug, loadConfig());
  const failing = gates.filter((gate) => !gate.ok);
  state.steps.gates = gates;
  if (failing.length === 0) {
    state.phase = 'awaiting-review';
    state.awaitingReviewAt = new Date().toISOString();
    saveState(state);
    rmSync(join(runDir(state.runKey), 'escalate.json'), { force: true });
    emit({ ok: true, phase: 'gates', runKey: state.runKey, slug: state.slug, gates, next: 'awaiting-review', title: `tick-driver: 门禁全过 ${state.runKey}` }, EXIT.ok, options);
  }
  state.phase = 'failed';
  saveState(state);
  emit({ ok: false, phase: 'gates', runKey: state.runKey, slug: state.slug, gates, title: 'tick-driver: 门禁仍未过', detail: failing.map((gate) => gate.name).join('、') }, EXIT.failed, options);
}

function status(options) {
  const state = requireRun(options);
  emit({ ok: true, phase: 'status', ...state, title: `tick-driver: ${state.runKey} ${state.phase}` }, EXIT.ok, options);
}

const options = parseArgs(process.argv.slice(2));
try {
  if (options.help || !options.phase) {
    console.log('用法：node scripts/editorial/tick-driver.mjs <prepare|repair|gates|land|i18n|finalize|status> [--run <runKey>] [--json]');
    process.exit(0);
  }
  const phases = { prepare, repair: repairPhase, gates: gatesPhase, land, i18n, finalize, status };
  const handler = phases[options.phase];
  if (!handler) throw new Error(`未知阶段：${options.phase}`);
  handler(options);
} catch (error) {
  console.error(`tick-driver 出错：${error.message}`);
  process.exit(EXIT.failed);
}
