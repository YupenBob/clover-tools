#!/usr/bin/env node
/**
 * 生成 src/lib/guides-auto.ts：把 data/editorial-guides/*.json 显式 import 成 AUTO_GUIDES。
 * 用法：node scripts/editorial/build-auto-index.mjs [--check]
 * --check 只比对，不写文件；不一致时退出码 1（供 CI 使用）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, REPO_PATHS } from './lib/paths.mjs';

const HEADER = `import type { Guide } from './guides.ts';

/**
 * 自动化内容流水线产出的指南。
 * 本文件由 scripts/editorial/build-auto-index.mjs 根据 data/editorial-guides/*.json 生成，
 * 请勿手工编辑；新增文章请运行 \`node scripts/editorial/build-auto-index.mjs\`。
 */
`;

export function readGuideEntries(guidesDir = join(ROOT, REPO_PATHS.guidesDir)) {
  if (!existsSync(guidesDir)) return [];
  const entries = [];
  for (const name of readdirSync(guidesDir)) {
    // 只读简体源文件 `<slug>.json`；跳过清单 translations.json 与译文 `<slug>.<lang>.json`
    if (name === 'translations.json') continue;
    if (/\.(tw|en|ko|ja)\.json$/.test(name)) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name)) continue;
    const data = JSON.parse(readFileSync(join(guidesDir, name), 'utf8'));
    if (!data || typeof data.slug !== 'string') throw new Error(`自动文章缺少 slug：${name}`);
    entries.push({ name, slug: data.slug, data });
  }
  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  return entries;
}

export function buildAutoIndexSource(entries) {
  const imports = entries
    .map((entry, index) => `import guide${index} from '../../${REPO_PATHS.guidesDir}${entry.name}' with { type: 'json' };`)
    .join('\n');
  const values = entries.map((entry, index) => `  guide${index} as unknown as Guide,`).join('\n');
  const body =
    entries.length === 0
      ? 'export const AUTO_GUIDES: Guide[] = [];\n'
      : `export const AUTO_GUIDES: Guide[] = [\n${values}\n];\n`;
  return `${HEADER}${imports ? `${imports}\n\n` : '\n'}${body}`;
}

export function buildAutoIndex({ check = false } = {}) {
  const entries = readGuideEntries();
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) throw new Error(`自动文章 slug 重复：${entry.slug}`);
    seen.add(entry.slug);
  }
  const source = buildAutoIndexSource(entries);
  const target = join(ROOT, REPO_PATHS.autoIndex);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  const changed = current !== source;
  if (!check && changed) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return {
    count: entries.length,
    changed,
    check,
    target: REPO_PATHS.autoIndex,
    slugs: entries.map((entry) => entry.slug),
  };
}

const executedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('build-auto-index.mjs');
if (executedDirectly) {
  const result = buildAutoIndex({ check: process.argv.includes('--check') });
  console.log(JSON.stringify(result, null, 2));
  if (result.check && result.changed) process.exit(1);
}
