#!/usr/bin/env node
/**
 * 一次性迁移：把 src/lib/guides.ts 里 16 篇内联指南搬到 data/editorial-guides/<slug>.json，
 * 让自动升级任务可以按文件安全改写（保留 slug、published 与页面 URL）。
 * 用法：node scripts/editorial/migrate-legacy-guides.mjs [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REPO_PATHS } from './lib/paths.mjs';
import { buildAutoIndex } from './build-auto-index.mjs';

const guidesFile = join(ROOT, 'src', 'lib', 'guides.ts');
const guidesSource = readFileSync(guidesFile, 'utf8');
const checkOnly = process.argv.includes('--check');

const { GUIDES } = await import(join(ROOT, 'src', 'lib', 'guides.ts'));
const { EDITORIAL_GUIDES } = await import(join(ROOT, 'src', 'lib', 'editorial-guides.ts'));
const editorialSlugs = new Set(EDITORIAL_GUIDES.map((guide) => guide.slug));
const legacy = GUIDES.filter((guide) => !editorialSlugs.has(guide.slug));

if (legacy.length !== 16) {
  throw new Error(`预期 16 篇内联指南，实际 ${legacy.length} 篇（迁移可能已完成或源码被改动）`);
}

const results = [];
for (const guide of legacy) {
  const target = join(ROOT, REPO_PATHS.guidesDir, `${guide.slug}.json`);
  const payload = {
    ...guide,
    _meta: {
      auto: false,
      source: 'legacy-migration',
      migratedAt: '2026-11-01',
      originalPublished: guide.published,
    },
  };
  if (existsSync(target)) {
    const current = JSON.parse(readFileSync(target, 'utf8'));
    if (JSON.stringify(current) === JSON.stringify(payload)) {
      results.push({ slug: guide.slug, status: 'unchanged' });
      continue;
    }
    if (checkOnly) {
      results.push({ slug: guide.slug, status: 'drifted' });
      continue;
    }
  }
  if (!checkOnly) writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  results.push({ slug: guide.slug, status: existsSync(target) ? 'updated' : 'created' });
}

// 重写 guides.ts：用 AUTO_GUIDES 取代 16 条内联定义
const start = guidesSource.indexOf('export const GUIDES: Guide[] = [');
const marker = guidesSource.indexOf('\nexport function getGuide(', start);
if (start === -1 || marker === -1) throw new Error('无法定位 guides.ts 的 GUIDES 定义');
const head = guidesSource.slice(0, start);
const tail = guidesSource.slice(marker);
const replacement = 'export const GUIDES: Guide[] = [...EDITORIAL_GUIDES, ...AUTO_GUIDES];\n';
const nextSource = `${head}${replacement}${tail}`;
const sourceChanged = nextSource !== guidesSource;
if (!checkOnly && sourceChanged) writeFileSync(guidesFile, nextSource);

const barrel = checkOnly ? null : buildAutoIndex();
console.log(
  JSON.stringify(
    {
      ok: true,
      checkOnly,
      legacyCount: legacy.length,
      sourceChanged,
      barrel,
      results: results.sort((a, b) => a.slug.localeCompare(b.slug)),
    },
    null,
    2,
  ),
);
