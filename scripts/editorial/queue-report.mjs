#!/usr/bin/env node
/**
 * 队列与流水线状态报告（只读，给人工和 tick 摘要用）。
 * 用法：node scripts/editorial/queue-report.mjs
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { loadQueue, loadState, readPause } from './lib/state.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { listRunRecords } from './lib/state.mjs';

function main() {
  ensureDefaultConfig();
  const config = loadConfig();
  const queue = loadQueue();
  const state = loadState();
  const pause = readPause();
  const items = queue.items;
  const byStatus = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const byType = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  const ready = items
    .filter((item) => item.status === 'ready')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 12)
    .map((item) => ({ id: item.id, type: item.type, toolSlug: item.toolSlug, slug: item.slug, priority: item.priority }));
  const candidates = items
    .filter((item) => item.status === 'candidate')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 10)
    .map((item) => ({ id: item.id, type: item.type, query: item.primaryQuery, priority: item.priority }));
  const runs = listRunRecords().slice(-8);
  const report = {
    generatedAt: new Date().toISOString(),
    paused: pause.paused ? pause : false,
    config: { publishMode: config.publishMode, maxArticlesPerDay: config.maxArticlesPerDay, dryRun: config.dryRun },
    queue: { total: items.length, byStatus, byType, readyCount: byStatus.ready ?? 0, candidateCount: byStatus.candidate ?? 0 },
    readyTop: ready,
    candidateTop: candidates,
    state: {
      consecutiveFailures: state.consecutiveFailures ?? 0,
      recentRuns: (state.runs ?? []).slice(0, 8),
      daily: state.daily ?? {},
    },
    lastRuns: runs.map((run) => ({
      runKey: run.runKey,
      slug: run.slug,
      status: run.status,
      deploy: run.deploy?.status ?? null,
      finishedAt: run.finishedAt,
    })),
    warnings: [].concat(
      (byStatus.ready ?? 0) < 10 && !pause.paused ? ['就绪队列少于 10 项，请补充选题或导入 GSC 数据'] : [],
      (byStatus.candidate ?? 0) > 0 ? [`有 ${byStatus.candidate} 个 GSC 候选待升为 ready`] : [],
    ),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
