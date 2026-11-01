#!/usr/bin/env node
/**
 * 由 Lead 独立抓取草稿 sources 中的每个 URL，记录状态码与文本哈希，作为可核查证据。
 * 用法：node scripts/editorial/verify-sources.mjs --slug <slug> --run <runKey>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { fetchText } from './lib/git.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--run') options.run = argv[index + 1];
  }
  return options;
}

async function fetchSource(url) {
  const startedAt = Date.now();
  try {
    const response = await fetchText(url, { timeoutMs: 20000 });
    const text = await response.text();
    return {
      url,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type') ?? '',
      bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'),
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      finalUrl: null,
      contentType: null,
      bytes: 0,
      sha256: null,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: String(error.message ?? error),
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug || !options.run) throw new Error('用法：verify-sources.mjs --slug <slug> --run <runKey>');
  const guideFile = join(STATE_PATHS.drafts, options.slug, 'guide.json');
  if (!existsSync(guideFile)) throw new Error(`草稿不存在：${guideFile}`);
  const guide = JSON.parse(readFileSync(guideFile, 'utf8'));
  const sources = (guide.sources ?? []).filter((source) => source?.url);
  if (sources.length === 0) throw new Error('草稿没有来源，无法核验');
  if (sources.length > 6) throw new Error(`来源 ${sources.length} 条，超过单篇上限 6 条`);
  const results = [];
  for (const source of sources) results.push(await fetchSource(source.url));
  const runDir = join(STATE_PATHS.runs, options.run);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'sources.json'), `${JSON.stringify(results, null, 2)}\n`);
  const summary = {
    ok: results.every((result) => result.status === 200),
    total: results.length,
    failed: results.filter((result) => result.status !== 200).map((result) => ({ url: result.url, status: result.status, error: result.error })),
    results: results.map((result) => ({ url: result.url, status: result.status, bytes: result.bytes, sha256: result.sha256?.slice(0, 12) })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exit(2);
}

main().catch((error) => {
  console.error(String(error.message ?? error));
  process.exit(1);
});
