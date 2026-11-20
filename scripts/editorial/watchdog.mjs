#!/usr/bin/env node
/**
 * 看守器（watchdog）：定时触发的第一道确定性闸门，决定这一趟值不值得唤醒模型。
 *
 * 用法：
 *   node scripts/editorial/watchdog.mjs [--json] [--quiet] [--no-auto-promote]
 *
 * 输出：`{ wake: boolean, reason, slot, runKey, details }`
 * - `wake=true`  → 有活要干（该跑 tick / 待推送 / 待验部署 / 选题耗尽但可自动补位）；
 * - `wake=false` → 安静跳过（暂停、当天已发够、工作区被其它任务改脏、队列空且无候选、缺 token）。
 *
 * 设计目标：让「无事可做」的那一轮只花几十个 token —— 模型只需回一行 `watchdog: skip <reason>`。
 * 本脚本不调用任何模型，不读大文件，不写仓库内容；只在 `.editorial/` 下写一行日志。
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { currentSlot, countRunsForDate, evaluateSafety, loadQueue, loadState, readPause, saveQueue } from './lib/state.mjs';
import { commitsAhead, pendingCommitsSafe, readToken, statusPorcelain } from './lib/git.mjs';

const LOG_FILE = join(STATE_PATHS.dir, 'watchdog.log');

function parseArgs(argv) {
  const options = { json: false, quiet: false, autoPromote: true };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--no-auto-promote') options.autoPromote = false;
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

function foreignPrefixes() {
  return readJson(join(STATE_PATHS.dir, 'foreign-paths.json'), { paths: [] })?.paths ?? [];
}

function statusPath(line) {
  return String(line).slice(3).trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
}

/** 只关注最近的「已推送但未验证部署」记录：更早的视为历史残留（记日志，不唤醒）。 */
function pendingDeployRuns(today, maxAgeDays = 2) {
  if (!existsSync(STATE_PATHS.runs)) return { recent: [], stale: [] };
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const recent = [];
  const stale = [];
  for (const name of readdirSync(STATE_PATHS.runs)) {
    if (!name.endsWith('.json')) continue;
    const record = readJson(join(STATE_PATHS.runs, name), null);
    if (!record) continue;
    const status = record.deploy?.status;
    if (status !== 'pending' && status !== 'failed') continue;
    const runKey = name.replace(/\.json$/, '');
    const date = runKey.slice(0, 10);
    (date >= cutoffKey ? recent : stale).push(runKey);
  }
  return { recent: recent.sort(), stale: stale.sort() };
}

function promoteTopCandidate(queue) {
  const candidates = queue.items.filter((item) => item.status === 'candidate');
  if (candidates.length === 0) return null;
  const top = [...candidates].sort(
    (a, b) => (b.priority ?? b.score ?? 0) - (a.priority ?? a.score ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)),
  )[0];
  top.status = 'ready';
  top.promotedAt = new Date().toISOString();
  top.promotedBy = 'watchdog';
  saveQueue(queue);
  return { id: top.id, slug: top.slug ?? top.toolSlug, toolSlug: top.toolSlug, type: top.type };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const slotInfo = currentSlot(new Date(), config);
  const runKey = `${slotInfo.date}T${slotInfo.slot}`;
  const details = {};

  const finish = (wake, reason, extra = {}) => {
    const result = { wake, reason, date: slotInfo.date, slot: slotInfo.slot, runKey, checkedAt: new Date().toISOString(), details: { ...details, ...extra } };
    try {
      mkdirSync(STATE_PATHS.dir, { recursive: true });
      appendFileSync(LOG_FILE, `${JSON.stringify({ at: result.checkedAt, wake, reason, runKey, extra })}\n`);
    } catch {
      // 日志失败不影响判断
    }
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (!options.quiet) console.log(`watchdog: ${wake ? 'wake' : 'skip'} ${reason}（${runKey}）`);
    return 0;
  };

  // 1. 暂停
  const pause = readPause();
  if (pause?.paused) return finish(false, 'paused', { pause });
  details.paused = false;

  // 2. 安全闸（连续失败/节流）
  const state = loadState();
  const safety = evaluateSafety(state, config);
  details.safety = safety;
  if (safety?.blocked) return finish(false, 'safety-blocked', { safety });

  // 3. 待办：未推送提交 / 待验证部署（这两件事优先于配额，属于「重要」）
  let ahead = 0;
  try {
    ahead = commitsAhead();
  } catch {
    ahead = 0;
  }
  details.commitsAhead = ahead;
  if (ahead > 0) {
    const pending = pendingCommitsSafe(config);
    details.pending = pending;
    if (!pending.safe) return finish(true, 'unsafe-pending-commits', { pending });
    return finish(true, 'push-pending', { commitsAhead: ahead });
  }
  const deploy = pendingDeployRuns(slotInfo.date);
  details.deployPending = deploy.recent;
  if (deploy.stale.length > 0) details.deployStale = deploy.stale;
  if (deploy.recent.length > 0) return finish(true, 'deploy-verify-pending', { runs: deploy.recent });

  // 4. 当天配额
  const runsToday = countRunsForDate(slotInfo.date);
  details.runsToday = runsToday;
  if (runsToday >= config.maxArticlesPerDay) return finish(false, 'daily-limit-reached', { runsToday, max: config.maxArticlesPerDay });

  // 5. 工作区脏（只记录，不唤醒：多半是同一仓库里别的任务在写，模型也无法安全处理）
  const dirty = statusPorcelain().filter((line) => !foreignPrefixes().some((prefix) => statusPath(line).startsWith(prefix)));
  details.dirty = dirty.slice(0, 8);
  if (dirty.length > 0) return finish(false, 'worktree-dirty', { dirty: dirty.slice(0, 8) });

  // 6. 推送 token
  if (!readToken()) return finish(false, 'token-missing');

  // 7. 队列
  const queue = loadQueue();
  const ready = queue.items.filter((item) => item.status === 'ready');
  details.ready = ready.length;
  details.candidates = queue.items.filter((item) => item.status === 'candidate').length;
  if (ready.length === 0) {
    if (!options.autoPromote) return finish(false, 'queue-empty');
    const promoted = promoteTopCandidate(queue);
    if (!promoted) return finish(false, 'queue-empty');
    return finish(true, 'tick-due', { promoted: true, item: promoted });
  }
  const top = [...ready].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  return finish(true, 'tick-due', { item: { id: top.id, slug: top.slug ?? top.toolSlug, type: top.type } });
}

try {
  process.exit(main());
} catch (error) {
  // 看守器自身出错时选择唤醒（宁可多花一次，也不静默停摆）
  try {
    writeFileSync(join(STATE_PATHS.dir, 'watchdog-error.json'), `${JSON.stringify({ at: new Date().toISOString(), error: String(error.stack ?? error) })}\n`);
  } catch {
    // ignore
  }
  console.error(`watchdog 出错：${error.message}`);
  process.exit(2);
}
