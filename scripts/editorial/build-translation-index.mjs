#!/usr/bin/env node
/**
 * 生成多语言指南索引：
 *  - data/editorial-guides/translations.json：slug → 已有语言（zh + tw/en/ko/ja）
 *  - src/lib/guides-translated.ts：显式 import 全部译文 JSON，供页面与检查使用
 *
 * 命名约定：`<slug>.json` 为简体中文源；`<slug>.<lang>.json` 为译文（lang ∈ tw/en/ko/ja）。
 * 用法：node scripts/editorial/build-translation-index.mjs [--check]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REPO_PATHS } from './lib/paths.mjs';

export const TRANSLATED_LANGS = ['tw', 'en', 'ko', 'ja'];
const guidesDir = join(ROOT, REPO_PATHS.guidesDir);
const manifestPath = join(guidesDir, 'translations.json');
const barrelPath = join(ROOT, 'src', 'lib', 'guides-translated.ts');

const SLUG_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.(tw|en|ko|ja))?\.json$/;

/** 扫描目录：返回 Map<slug, { zh, tw, en, ko, ja }>。 */
export function scanTranslations(dir = guidesDir) {
  const slugs = new Map();
  if (!existsSync(dir)) return slugs;
  const names = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'translations.json')
    .sort();
  for (const name of names) {
    const match = name.match(SLUG_PATTERN);
    if (!match) continue;
    const [, slug, lang] = match;
    const entry = slugs.get(slug) ?? { zh: false, tw: false, en: false, ko: false, ja: false };
    if (lang) entry[lang] = true;
    else entry.zh = true;
    slugs.set(slug, entry);
  }
  return slugs;
}

export function buildManifest(slugs) {
  const entries = [...slugs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const out = {};
  for (const [slug, entry] of entries) {
    if (!entry.zh) throw new Error(`译文缺少简体源文件：${slug}（缺少 ${slug}.json）`);
    out[slug] = {
      zh: true,
      translations: TRANSLATED_LANGS.filter((lang) => entry[lang]),
    };
  }
  return { version: 1, langs: TRANSLATED_LANGS, slugs: out };
}

export function buildBarrel(slugs) {
  const imports = [];
  const values = { tw: [], en: [], ko: [], ja: [] };
  let index = 0;
  for (const language of TRANSLATED_LANGS) {
    const entries = [...slugs.entries()]
      .filter(([, entry]) => entry[language])
      .sort((a, b) => a[0].localeCompare(b[0]));
    for (const [slug] of entries) {
      const alias = `guide${index}`;
      imports.push(`import ${alias} from '../../${REPO_PATHS.guidesDir}${slug}.${language}.json' with { type: 'json' };`);
      values[language].push(alias);
      index += 1;
    }
  }
  const header = `import type { Guide } from './guides.ts';
${imports.length ? `${imports.join('\n')}\n\n` : '\n'}/**
 * 多语言指南译文索引（tw / en / ko / ja）。
 * 本文件由 scripts/editorial/build-translation-index.mjs 生成，请勿手工编辑。
 */

export type TranslatedLang = 'tw' | 'en' | 'ko' | 'ja';

`;
  const body = `export const TRANSLATED_GUIDES: Record<TranslatedLang, Guide[]> = {
${TRANSLATED_LANGS.map((language) => {
  const list = values[language];
  if (list.length === 0) return `  ${language}: [],`;
  return `  ${language}: [\n${list.map((alias) => `    ${alias} as unknown as Guide,`).join('\n')}\n  ],`;
}).join('\n')}
};
`;
  return `${header}${body}`;
}

export function buildTranslationArtifacts({ check = false } = {}) {
  const slugs = scanTranslations();
  const manifest = buildManifest(slugs);
  const manifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
  const barrelSource = buildBarrel(slugs);
  const currentManifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  const currentBarrel = existsSync(barrelPath) ? readFileSync(barrelPath, 'utf8') : null;
  const manifestChanged = currentManifest !== manifestSource;
  const barrelChanged = currentBarrel !== barrelSource;
  if (!check) {
    if (manifestChanged) {
      mkdirSync(guidesDir, { recursive: true });
      writeFileSync(manifestPath, manifestSource);
    }
    if (barrelChanged) writeFileSync(barrelPath, barrelSource);
  }
  return {
    check,
    slugs: Object.keys(manifest.slugs),
    manifestChanged,
    barrelChanged,
    changed: manifestChanged || barrelChanged,
    translatedCount: Object.values(manifest.slugs).reduce((sum, entry) => sum + entry.translations.length, 0),
  };
}

const executedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('build-translation-index.mjs');
if (executedDirectly) {
  const result = buildTranslationArtifacts({ check: process.argv.includes('--check') });
  console.log(JSON.stringify(result, null, 2));
  if (result.check && result.changed) process.exit(1);
}
