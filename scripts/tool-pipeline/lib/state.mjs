import { closeSync, existsSync, openSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import {
  BACKLOG_FILE,
  LATEST_FILE,
  PAUSE_FILE,
  QUEUE_FILE,
  RUNS_DIR,
  STATE_DIR,
  STATE_FILE,
} from './paths.mjs';
import {
  ensureDir,
  isProcessAlive,
  nowIso,
  readJson,
  removeFile,
  touch,
  writeJsonAtomic,
} from './util.mjs';

export function ensureStateDirs() {
  ensureDir(STATE_DIR);
  ensureDir(RUNS_DIR);
}

export function readPause() {
  if (!existsSync(PAUSE_FILE)) return { paused: false };
  const meta = readJson(PAUSE_FILE, {});
  return { paused: true, ...meta };
}

export function pause(reason, extra = {}) {
  ensureStateDirs();
  writeJsonAtomic(PAUSE_FILE, {
    reason,
    ...extra,
    at: nowIso(),
  });
  return readPause();
}

export function clearPause() {
  removeFile(PAUSE_FILE);
}

export function loadState() {
  return readJson(STATE_FILE, {
    version: 1,
    consecutiveFailures: 0,
    lastRun: null,
    daily: {},
    history: [],
  });
}

export function saveState(state) {
  ensureStateDirs();
  writeJsonAtomic(STATE_FILE, state);
  return state;
}

export function loadQueue() {
  return readJson(QUEUE_FILE, { version: 1, items: [] });
}

export function saveQueue(queue) {
  ensureStateDirs();
  writeJsonAtomic(QUEUE_FILE, queue);
  return queue;
}

export function loadBacklog() {
  return readJson(BACKLOG_FILE, { version: 1, items: [] });
}

function runtimeItem(item) {
  return {
    ...item,
    status: item.status ?? 'ready',
    attempts: item.attempts ?? 0,
    runId: item.runId ?? null,
    lastError: item.lastError ?? null,
    createdAt: item.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    publishedAt: item.publishedAt ?? null,
    cooldownUntil: item.cooldownUntil ?? null,
    commit: item.commit ?? null,
  };
}

/** Merge committed backlog into the runtime queue without resetting existing state. */
export function seedQueue(queue = loadQueue()) {
  const backlog = loadBacklog();
  const byId = new Map(queue.items.map((item) => [item.id, item]));
  for (const item of backlog.items ?? []) {
    if (!byId.has(item.id)) {
      queue.items.push(runtimeItem(item));
      byId.set(item.id, queue.items.at(-1));
    }
  }
  queue.version = 1;
  return queue;
}

export function updateQueueItem(queue, id, patch) {
  const item = queue.items.find((entry) => entry.id === id);
  if (!item) throw new Error(`queue item not found: ${id}`);
  Object.assign(item, patch, { updatedAt: nowIso() });
  return item;
}

export function countDaily(state, date) {
  return Number(state.daily?.[date] ?? 0);
}

export function runDir(runKey) {
  return join(RUNS_DIR, runKey);
}

export function runJsonPath(runKey) {
  return join(runDir(runKey), 'run.json');
}

export function readRun(runKey) {
  return readJson(runJsonPath(runKey), null);
}

export function saveRun(run) {
  ensureStateDirs();
  ensureDir(runDir(run.runKey));
  writeJsonAtomic(runJsonPath(run.runKey), run);
  return run;
}

export function writeLatest(run) {
  ensureStateDirs();
  writeJsonAtomic(LATEST_FILE, {
    runKey: run.runKey,
    status: run.status,
    item: run.item ?? null,
    commit: run.publish?.commit ?? null,
    updatedAt: nowIso(),
  });
}

export function readLatest() {
  return readJson(LATEST_FILE, null);
}

export function acquireGlobalLock() {
  ensureStateDirs();
  const lockPath = join(STATE_DIR, 'global.lock');
  if (existsSync(lockPath)) {
    const meta = readJson(lockPath, null);
    if (meta && isProcessAlive(meta.pid)) {
      return { ok: false, reason: 'locked', lockPath, meta };
    }
    removeFile(lockPath);
  }
  try {
    const fd = openSync(lockPath, 'wx');
    try {
      writeSync(fd, `${JSON.stringify({ pid: process.pid, startedAt: nowIso() }, null, 2)}\n`);
    } finally {
      closeSync(fd);
    }
    const heartbeat = setInterval(() => touch(lockPath), 60000);
    heartbeat.unref?.();
    return {
      ok: true,
      lockPath,
      stop() {
        clearInterval(heartbeat);
        rmSync(lockPath, { force: true });
      },
    };
  } catch (error) {
    if (error?.code === 'EEXIST') return { ok: false, reason: 'locked', lockPath };
    throw error;
  }
}

export function acquireRunLock(runKey) {
  ensureStateDirs();
  const lockPath = join(STATE_DIR, `run-${runKey}.lock`);
  if (existsSync(lockPath)) {
    const meta = readJson(lockPath, null);
    if (meta && isProcessAlive(meta.pid)) {
      return { ok: false, reason: 'locked', lockPath, meta };
    }
    removeFile(lockPath);
  }
  try {
    const fd = openSync(lockPath, 'wx');
    try {
      writeSync(
        fd,
        `${JSON.stringify({ pid: process.pid, runKey, startedAt: nowIso() }, null, 2)}\n`,
      );
    } finally {
      closeSync(fd);
    }
    const heartbeat = setInterval(() => touch(lockPath), 60000);
    heartbeat.unref?.();
    return {
      ok: true,
      lockPath,
      stop() {
        clearInterval(heartbeat);
        rmSync(lockPath, { force: true });
      },
    };
  } catch (error) {
    if (error?.code === 'EEXIST') return { ok: false, reason: 'locked', lockPath };
    throw error;
  }
}

export function appendHistory(state, entry) {
  state.history = [...(state.history ?? []), entry].slice(-200);
  state.lastRun = entry;
  return state;
}
