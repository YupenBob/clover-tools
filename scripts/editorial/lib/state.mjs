/** 流水线本地状态：槽位、幂等锁、队列、暂停开关、运行记录。 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './paths.mjs';
import { siteToday } from '../../lib/site-date.mjs';

const STALE_LOCK_MS = 3 * 60 * 60 * 1000;

export function ensureStateDirs() {
  for (const dir of [
    STATE_PATHS.dir,
    STATE_PATHS.locks,
    STATE_PATHS.drafts,
    STATE_PATHS.runs,
    STATE_PATHS.gsc,
    STATE_PATHS.secrets,
  ]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(file, data) {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

/** 返回指定 IANA 时区的日期（YYYY-MM-DD）与小时（0-23）。 */
export function zonedNow(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** 依据当前时间落在哪个槽位：取不晚于当前小时的最近槽位；早于首个槽位则归入首个。 */
export function currentSlot(now, config) {
  const { date, hour } = zonedNow(config.timezone, now);
  const slots = [...config.slots].sort();
  const numeric = slots.map((slot) => Number(slot));
  let index = -1;
  for (let i = 0; i < numeric.length; i += 1) if (numeric[i] <= hour) index = i;
  const slot = index === -1 ? slots[0] : slots[index];
  return { date, slot, hour };
}

/** 原子占用槽位锁；返回 { ok, key, path, reason }。 */
export function acquireSlotLock(runKey, { now = Date.now() } = {}) {
  ensureStateDirs();
  const lockPath = join(STATE_PATHS.locks, runKey);
  const attempt = () => {
    try {
      mkdirSync(lockPath);
      return { ok: true, key: runKey, path: lockPath };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stat = statSync(lockPath);
      if (now - stat.mtimeMs > STALE_LOCK_MS) {
        rmSync(lockPath, { recursive: true, force: true });
        mkdirSync(lockPath);
        return { ok: true, key: runKey, path: lockPath, reclaimed: true };
      }
      return { ok: false, key: runKey, path: lockPath, reason: 'slot-already-run' };
    }
  };
  return attempt();
}

export function writeLockMeta(lockPath, data) {
  writeJsonAtomic(join(lockPath, 'lock.json'), data);
}

/** 暂停开关：.editorial/PAUSED 存在即暂停。 */
export function readPause() {
  if (!existsSync(STATE_PATHS.paused)) return { paused: false };
  const data = readJson(STATE_PATHS.paused, {});
  return { paused: true, reason: data.reason ?? '未记录原因', at: data.at ?? null };
}

export function pause(reason) {
  ensureStateDirs();
  writeJsonAtomic(STATE_PATHS.paused, { reason, at: new Date().toISOString() });
}

export function resume() {
  rmSync(STATE_PATHS.paused, { force: true });
}

export function loadState() {
  return readJson(STATE_PATHS.state, { consecutiveFailures: 0, runs: [], daily: {}, throttle: null }) ?? {};
}

export function saveState(state) {
  writeJsonAtomic(STATE_PATHS.state, state);
}

export function loadQueue() {
  const queue = readJson(STATE_PATHS.queue, null);
  return queue && Array.isArray(queue.items) ? queue : { version: 1, items: [] };
}

export function saveQueue(queue) {
  writeJsonAtomic(STATE_PATHS.queue, queue);
}

export function markQueueItem(queue, id, patch) {
  const item = queue.items.find((entry) => entry.id === id);
  if (!item) throw new Error(`队列项不存在：${id}`);
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  saveQueue(queue);
  return item;
}

const TYPE_ORDER = ['new-guide', 'upgrade-guide'];

/** 选取下一项：ready、按 priority 降序、同优先级按任务配比轮转。 */
export function pickNextItem(queue, config) {
  const ready = queue.items.filter((item) => item.status === 'ready');
  if (ready.length === 0) return null;
  const counts = queue.items.filter((item) => item.status === 'in_progress').length;
  const ranked = [...ready].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (counts === 0) {
    const mix = config.taskMix ?? {};
    const total = Object.values(mix).reduce((sum, value) => sum + value, 0) || 1;
    const target = Object.entries(mix).sort((a, b) => (b[1] / total) - (a[1] / total))[0]?.[0];
    const preferred = ranked.find((item) => item.type === target);
    if (preferred) return preferred;
  }
  return ranked[0];
}

export function countRunsForDate(date) {
  if (!existsSync(STATE_PATHS.runs)) return 0;
  return readdirSync(STATE_PATHS.runs).filter((name) => name.startsWith(`${date}T`)).length;
}

export function recordOutcome(state, outcome) {
  const runs = Array.isArray(state.runs) ? state.runs : [];
  runs.unshift({
    runKey: outcome.runKey,
    slug: outcome.slug ?? null,
    status: outcome.status,
    at: new Date().toISOString(),
    durationMs: outcome.durationMs ?? null,
  });
  state.runs = runs.slice(0, 30);
  const failures = outcome.status === 'failed' || outcome.status === 'reverted';
  state.consecutiveFailures = failures ? (state.consecutiveFailures ?? 0) + 1 : 0;
  state.daily = state.daily ?? {};
  const date = outcome.date ?? siteToday();
  state.daily[date] = (state.daily[date] ?? 0) + (outcome.status === 'published' ? 1 : 0);
  return state;
}

/** 近 N 次运行的复核通过率；无数据时返回 1。 */
export function reviewPassRate(state, window) {
  const runs = (state.runs ?? []).slice(0, window);
  if (runs.length === 0) return 1;
  return runs.filter((run) => run.status === 'published').length / runs.length;
}

export function evaluateSafety(state, config) {
  const failures = state.consecutiveFailures ?? 0;
  if (failures >= config.caps.consecutiveFailuresToPause) {
    return { blocked: true, reason: `连续 ${failures} 次失败，流水线已暂停` };
  }
  const rate = reviewPassRate(state, config.caps.throttleWindow);
  if ((state.runs ?? []).length >= config.caps.throttleWindow && rate < config.caps.throttleReviewPassRate) {
    return { blocked: true, reason: `近 ${config.caps.throttleWindow} 次通过率 ${(rate * 100).toFixed(0)}% 低于阈值，已暂停` };
  }
  return { blocked: false };
}

export function writeRunRecord(run) {
  ensureStateDirs();
  const file = join(STATE_PATHS.runs, `${run.runKey}.json`);
  writeJsonAtomic(file, run);
  return file;
}

export function listRunRecords() {
  if (!existsSync(STATE_PATHS.runs)) return [];
  return readdirSync(STATE_PATHS.runs)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(STATE_PATHS.runs, name), null))
    .filter(Boolean);
}

export function pruneDrafts(slug) {
  if (!slug) return;
  rmSync(join(STATE_PATHS.drafts, slug), { recursive: true, force: true });
}

export { STATE_PATHS };
