#!/usr/bin/env node
/**
 * 无凭证需求层：从公开搜索建议（Bing/Google/Baidu autocomplete）采集真实搜索短语，
 * 结合工具覆盖缺口生成候选选题，写入 `.editorial/queue.json`（status: candidate）。
 *
 * 用法：node scripts/editorial/import-suggest.mjs [--write] [--replace] [--seeds 50] [--delay 90] [--per-tool 2]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { ensureStateDirs, loadQueue, saveQueue } from './lib/state.mjs';
import { loadSiteCorpus, loadToolIndex } from './lib/corpus.mjs';
import { buildCandidates, looksArticleIntent, looksBranded, matchQueryToTool } from './lib/gsc.mjs';
import { aggregateSuggestions, clusterByTool, gatherSuggestions, listProviders, looksToolPageQuery, suggestionPriority } from './lib/suggest.mjs';
import { normalizeForShingles } from './lib/quality.mjs';

function parseArgs(argv) {
  const options = { write: false, replace: false, seeds: 50, delay: 90, perTool: 2 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--replace') options.replace = true;
    else if (arg === '--seeds') options.seeds = Number(argv[index + 1]);
    else if (arg === '--delay') options.delay = Number(argv[index + 1]);
    else if (arg === '--per-tool') options.perTool = Number(argv[index + 1]);
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadLegacyKeywords() {
  try {
    const list = JSON.parse(readFileSync(join(ROOT, 'data', 'keywords.json'), 'utf8'));
    return (list ?? []).map((entry) => entry.keyword).filter((keyword) => typeof keyword === 'string' && keyword.length >= 2);
  } catch {
    return [];
  }
}

/** 构造种子：覆盖缺口工具 > 旧关键词表 > 已覆盖工具的扩展问法。 */
async function buildSeeds(toolIndex, siteCorpus, limit) {
  const guidesByTool = new Map();
  for (const guide of siteCorpus) {
    const list = guidesByTool.get(guide.toolSlug) ?? [];
    list.push(guide);
    guidesByTool.set(guide.toolSlug, list);
  }
  const seeds = [];
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (text.length >= 2 && text.length <= 24 && !seeds.includes(text)) seeds.push(text);
  };
  for (const tool of toolIndex.tools) {
    if (!guidesByTool.has(tool.slug)) {
      push(`${tool.name}怎么用`);
      push((tool.keywords ?? [])[0]);
    }
  }
  for (const keyword of loadLegacyKeywords()) push(keyword);
  for (const tool of toolIndex.tools) {
    const list = guidesByTool.get(tool.slug);
    if (list && list.length > 0) push(`${(tool.keywords ?? [])[0] ?? tool.name} 怎么`);
  }
  return seeds.slice(0, limit);
}

async function main() {
  ensureStateDirs();
  const options = parseArgs(process.argv.slice(2));
  const toolIndex = await loadToolIndex(ROOT);
  const siteCorpus = await loadSiteCorpus(ROOT);
  const providers = listProviders();
  const seeds = await buildSeeds(toolIndex, siteCorpus, Math.max(6, Math.min(120, options.seeds)));
  console.log(JSON.stringify({ stage: 'seeds', count: seeds.length, providers, sample: seeds.slice(0, 6) }, null, 2));

  const batches = [];
  for (const seed of seeds) {
    batches.push(await gatherSuggestions(seed, { providers }));
    await sleep(Math.max(60, options.delay));
  }
  const aggregated = aggregateSuggestions(batches);

  const guidesByTool = new Map();
  for (const guide of siteCorpus) {
    const list = guidesByTool.get(guide.toolSlug) ?? [];
    list.push(guide);
    guidesByTool.set(guide.toolSlug, list);
  }

  const rows = [];
  let navigationalSkipped = 0;
  for (const entry of aggregated) {
    const text = entry.text;
    if (looksBranded(text)) continue;
    if (!looksArticleIntent(text)) continue;
    const match = matchQueryToTool(text, toolIndex.tools);
    if (!match.tool || match.score < 2) continue;
    if (looksToolPageQuery(text, match.tool)) {
      navigationalSkipped += 1;
      continue;
    }
    rows.push({ text, matchScore: match.score, tool: match.tool, hasGuide: (guidesByTool.get(match.tool.slug) ?? []).length > 0 });
  }

  const entryByText = new Map(aggregated.map((entry) => [entry.text, entry]));
  const rowByText = new Map(rows.map((row) => [row.text, row]));
  const candidates = buildCandidates(
    rows.map((row) => ({ kind: 'queries', query: row.text, clicks: 0, impressions: 0, ctr: 0, position: 0, file: 'suggest' })),
    {
      toolIndex,
      guides: siteCorpus,
      existingQueue: { items: [] },
      intentMatcher: looksArticleIntent,
      priorityResolver: (row) =>
        suggestionPriority(entryByText.get(row.query) ?? { providers: new Set(['suggest']), bestRank: 999 }, {
          informational: true,
          gap: rowByText.has(row.query) ? !rowByText.get(row.query).hasGuide : false,
        }),
    },
  );
  for (const candidate of candidates) {
    candidate.source = 'suggest';
    candidate.id = `suggest-${createHash('sha1').update(normalizeForShingles(candidate.primaryQuery)).digest('hex').slice(0, 10)}`;
    candidate.createdAt = new Date().toISOString();
    candidate.updatedAt = candidate.createdAt;
  }
  const clustered = clusterByTool(candidates, options.perTool);

  const dir = join(STATE_PATHS.dir, 'suggest');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const serializable = (value) => JSON.parse(JSON.stringify(value, (key, item) => (item instanceof Set ? [...item] : item)));
  writeFileSync(join(dir, `${stamp}.json`), `${JSON.stringify(serializable({ seeds, aggregated, batches, candidates, kept: clustered.kept }), null, 2)}\n`);

  const queue = loadQueue();
  if (options.replace) {
    queue.items = queue.items.filter((item) => !(item.source === 'suggest' && item.status === 'candidate'));
  }
  const known = new Set(queue.items.map((item) => item.id));
  const knownQueries = new Set(queue.items.map((item) => normalizeForShingles(item.primaryQuery ?? '')));
  let added = 0;
  for (const candidate of clustered.kept) {
    if (known.has(candidate.id)) continue;
    if (knownQueries.has(normalizeForShingles(candidate.primaryQuery ?? ''))) continue;
    queue.items.push(candidate);
    known.add(candidate.id);
    knownQueries.add(normalizeForShingles(candidate.primaryQuery ?? ''));
    added += 1;
  }
  queue.lastSuggestImportAt = new Date().toISOString();
  if (options.write) saveQueue(queue);

  const providerFailures = batches
    .flatMap((batch) => Object.entries(batch.errors).map(([provider, error]) => ({ seed: batch.seed, provider, error })))
    .slice(0, 5);
  console.log(
    JSON.stringify(
      {
        ok: true,
        providers,
        seeds: seeds.length,
        suggestions: aggregated.length,
        mappedRows: rows.length,
        navigationalSkipped,
        candidates: candidates.length,
        clustered: clustered.kept.length,
        droppedVariants: clustered.dropped,
        added,
        written: options.write,
        providerFailures,
        top: clustered.kept.slice(0, 12).map((candidate) => ({
          type: candidate.type,
          tool: candidate.toolSlug,
          query: candidate.primaryQuery,
          priority: candidate.priority,
          providers: candidate.evidence?.suggest?.providers,
        })),
        queue: {
          total: queue.items.length,
          ready: queue.items.filter((item) => item.status === 'ready').length,
          candidates: queue.items.filter((item) => item.status === 'candidate').length,
        },
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
