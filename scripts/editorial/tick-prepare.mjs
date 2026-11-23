#!/usr/bin/env node
/**
 * tick 准备：守卫 → 槽位幂等锁 → 限额/安全 → 仓库干净 → 队列取项。
 * 用法：node scripts/editorial/tick-prepare.mjs [--slot auto|manual|06|12|18] [--dry-run]
 * 输出 JSON（proceed true/false）；任何"跳过"都以退出码 0 返回，便于上层判断。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import {
  acquireSlotLock,
  countRunsForDate,
  currentSlot,
  ensureStateDirs,
  evaluateSafety,
  loadQueue,
  loadState,
  markQueueItem,
  pause,
  pickNextItem,
  readPause,
  writeJsonAtomic,
  writeLockMeta,
  zonedNow,
} from './lib/state.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { fetchOrigin, pendingCommitsSafe, readToken } from './lib/git.mjs';
import { statusPorcelain } from './lib/git.mjs';

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const options = { slot: 'auto', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slot') options.slot = argv[index + 1] ?? 'auto';
    else if (arg.startsWith('--slot=')) options.slot = arg.slice('--slot='.length);
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

function emit(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

function skip(reason, extra = {}) {
  emit({ proceed: false, reason, ...extra, at: new Date().toISOString() });
}

function main() {
  ensureStateDirs();
  ensureDefaultConfig();
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));

  const pauseInfo = readPause();
  if (pauseInfo.paused) skip('paused', { pause: pauseInfo });

  const today = zonedNow(config.timezone).date;
  const slotInfo = options.slot !== 'auto' ? { date: today, slot: options.slot } : currentSlot(new Date(), config);
  const runKey =
    slotInfo.slot === 'manual'
      ? `${slotInfo.date}Tmanual-${new Date().toISOString().slice(11, 16).replace(':', '')}`
      : `${slotInfo.date}T${slotInfo.slot}`;

  const runsToday = countRunsForDate(slotInfo.date);
  if (runsToday >= config.maxArticlesPerDay) {
    skip('daily-limit-reached', { date: slotInfo.date, runsToday, max: config.maxArticlesPerDay });
  }

  const state = loadState();
  const safety = evaluateSafety(state, config);
  if (safety.blocked) {
    pause(safety.reason);
    skip('safety-blocked', { safety });
  }

  // 同一工作区可能有别的任务（如 tool-pipeline）在改文件：允许按 `.editorial/foreign-paths.json`
  // 声明的前缀豁免那些与本流水线无关的改动，避免把正常 tick 误判为 worktree-dirty。
  const foreignPrefixes = readJson(join(STATE_PATHS.dir, 'foreign-paths.json'), { paths: [] })?.paths ?? [];
  const pathOf = (line) => String(line).slice(3).trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
  const dirtyAll = statusPorcelain();
  const dirty = dirtyAll.filter((line) => !foreignPrefixes.some((prefix) => pathOf(line).startsWith(prefix)));
  if (dirty.length > 0) skip('worktree-dirty', { dirty: dirty.slice(0, 10) });

  fetchOrigin(config.git.remote);
  const pending = pendingCommitsSafe(config);
  const canPush = config.publishMode === 'push-main' && Boolean(readToken());
  if (canPush && !pending.safe) skip('unsafe-pending-commits', { pending });

  const lock = options.dryRun ? { ok: true, path: null } : acquireSlotLock(runKey);
  if (!lock.ok) skip(lock.reason, { runKey, lockPath: lock.path });

  const queue = loadQueue();
  // 防呆：队列建议可能来自旧抓取，同 slug 已有已发布指南时自动判重（除非明确是升级任务），
  // 否则整趟 tick 会白跑（今天 text-transform 就是这样被浪费的）。
  const hasPublished = (entry) => existsSync(join(ROOT, 'data/editorial-guides', `${entry.slug ?? entry.toolSlug}.json`));
  // 定义在 src/lib/editorial-guides.ts / guides.ts 里的内联指南不能直接升级：
  // 升级会同时生成 data/ 文件，与内联定义重复，构建会出现重复路由。必须先做迁移。
  const inlineSources = ['src/lib/editorial-guides.ts', 'src/lib/guides.ts']
    .map((file) => {
      try {
        return readFileSync(join(ROOT, file), 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
  const isInlineGuide = (entry) => {
    const slug = entry.slug ?? entry.toolSlug;
    return new RegExp(`slug:\\s*['\"]${String(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`).test(inlineSources);
  };
  let item = pickNextItem(queue, config);
  const autoDuplicates = [];
  while (item && item.type === 'upgrade-guide' && isInlineGuide(item)) {
    markQueueItem(queue, item.id, {
      status: 'blocked',
      runId: null,
      blockedReason: '指南内联定义在 src/lib/*.ts，需先迁移到 data/editorial-guides/ 才能升级',
      updatedAt: new Date().toISOString(),
    });
    autoDuplicates.push(`${item.slug ?? item.toolSlug}(inline)`);
    item = pickNextItem(queue, config);
  }
  while (item && item.type !== 'upgrade-guide' && hasPublished(item)) {
    markQueueItem(queue, item.id, { status: 'duplicate', duplicate: true, duplicateReason: '同 slug 已有已发布指南', updatedAt: new Date().toISOString() });
    autoDuplicates.push(item.slug ?? item.toolSlug);
    item = pickNextItem(queue, config);
  }
  if (!item) {
    rmSync(lock.path, { recursive: true, force: true });
    skip('queue-empty', {
      ready: queue.items.filter((entry) => entry.status === 'ready').length,
      candidates: queue.items.filter((entry) => entry.status === 'candidate').length,
    });
  }

  const slug = item.slug ?? (item.type === 'new-guide' ? item.toolSlug : null);
  const draftDir = join(STATE_PATHS.drafts, slug);
  mkdirSync(draftDir, { recursive: true });
  writeJsonAtomic(join(draftDir, 'draft-request.json'), {
    ...item,
    runKey,
    date: slotInfo.date,
    slot: slotInfo.slot,
    requestedAt: new Date().toISOString(),
    quality: config.quality,
    caps: config.caps,
  });

  if (!options.dryRun) markQueueItem(queue, item.id, {
    status: 'in_progress',
    runId: runKey,
    attempts: (item.attempts ?? 0) + 1,
    startedAt: new Date().toISOString(),
  });

  if (!options.dryRun) writeLockMeta(lock.path, { runKey, item, startedAt: new Date().toISOString(), dryRun: options.dryRun });
  writeFileSync(
    join(STATE_PATHS.dir, 'last-prepare.json'),
    `${JSON.stringify({ runKey, date: slotInfo.date, slot: slotInfo.slot, dryRun: options.dryRun, item }, null, 2)}\n`,
  );

  emit({
    proceed: true,
    runKey,
    date: slotInfo.date,
    slot: slotInfo.slot,
    dryRun: options.dryRun,
    item,
    pendingPushCommits: pending.total,
    config: {
      publishMode: config.publishMode,
      quality: config.quality,
      caps: config.caps,
      translation: config.translation,
      baseUrl: config.capture.baseUrl,
      devServerPort: config.capture.devServerPort,
    },
    draftDir: join('.editorial', 'drafts', slug),
    runDir: join('.editorial', 'runs', runKey),
  });
}

main();
