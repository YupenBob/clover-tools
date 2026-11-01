#!/usr/bin/env node
/**
 * 导入 Search Console 导出（.editorial/gsc/*.csv），生成候选选题写入队列。
 * 用法：node scripts/editorial/import-gsc.mjs [--write]
 * 默认只打印；--write 才写入 .editorial/queue.json。
 */
import { STATE_PATHS } from './lib/paths.mjs';
import { ROOT } from './lib/paths.mjs';
import { ensureStateDirs, loadQueue, saveQueue } from './lib/state.mjs';
import { loadSiteCorpus, loadToolIndex } from './lib/corpus.mjs';
import { buildCandidates, readGscDir } from './lib/gsc.mjs';

async function main() {
  ensureStateDirs();
  const write = process.argv.includes('--write');
  const { rows, files } = readGscDir(STATE_PATHS.gsc);
  if (files.length === 0) {
    console.log(JSON.stringify({ ok: true, status: 'no-files', hint: '把 Search Console 的「查询」和「网页」CSV 放进 .editorial/gsc/' }, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: false, status: 'no-rows', files, hint: 'CSV 未识别到表头（查询/网页/点击次数/展示次数）' }, null, 2));
    process.exit(1);
  }
  const toolIndex = await loadToolIndex(ROOT);
  const guides = await loadSiteCorpus(ROOT);
  const queue = loadQueue();
  const candidates = buildCandidates(rows, { toolIndex, guides, existingQueue: queue });
  const known = new Set(queue.items.map((item) => item.id));
  let added = 0;
  for (const candidate of candidates) {
    if (known.has(candidate.id)) continue;
    queue.items.push(candidate);
    known.add(candidate.id);
    added += 1;
  }
  if (write && added > 0) saveQueue(queue);
  const byType = candidates.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    JSON.stringify(
      {
        ok: true,
        files,
        rows: rows.length,
        candidates: candidates.length,
        added,
        written: write && added > 0,
        byType,
        top: candidates.slice(0, 10).map((item) => ({
          id: item.id,
          type: item.type,
          toolSlug: item.toolSlug,
          query: item.primaryQuery,
          priority: item.priority,
          rows: item.evidence?.rows?.length ?? 0,
        })),
        ready: queue.items.filter((item) => item.status === 'ready').length,
        candidateTotal: queue.items.filter((item) => item.status === 'candidate').length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(1);
});
