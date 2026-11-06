#!/usr/bin/env node
/**
 * 生成工具页语言清单：data/i18n-tool-pages.json
 * 扫描 src/pages[/<lang>]/tools/<category>/<slug>.astro，记录每个工具实际存在的语言版本，
 * 供 hreflang、语言切换、SEO 检查与收录策略使用（不存在的译文不输出 hreflang）。
 *
 * 用法：node scripts/editorial/build-tool-locales.mjs [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/paths.mjs';

const LOCALE_DIRS = { zh: '', tw: 'zh-hant', en: 'en', ko: 'ko', ja: 'ja' };
const LANGS = ['zh', 'tw', 'en', 'ko', 'ja'];
const outputPath = join(ROOT, 'data', 'i18n-tool-pages.json');

export async function scanToolPages() {
  const { getAllTools } = await import(join(ROOT, 'src', 'lib', 'tools.ts'));
  const tools = getAllTools();
  const entries = {};
  for (const tool of tools) {
    if (!tool.slug || !tool.category) continue;
    const langs = [];
    for (const lang of LANGS) {
      const dir = LOCALE_DIRS[lang];
      const file = dir
        ? join(ROOT, 'src', 'pages', dir, 'tools', tool.category, `${tool.slug}.astro`)
        : join(ROOT, 'src', 'pages', 'tools', tool.category, `${tool.slug}.astro`);
      if (existsSync(file)) langs.push(lang);
    }
    entries[tool.slug] = { category: tool.category, langs };
  }
  return entries;
}

export function buildToolManifest(entries) {
  const tools = {};
  for (const slug of Object.keys(entries).sort()) {
    const entry = entries[slug];
    tools[slug] = { category: entry.category, langs: LANGS.filter((lang) => entry.langs.includes(lang)) };
  }
  return { version: 1, langs: LANGS, tools };
}

export async function buildToolLocales({ check = false } = {}) {
  const entries = await scanToolPages();
  const manifest = buildToolManifest(entries);
  const source = `${JSON.stringify(manifest, null, 2)}\n`;
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null;
  const changed = current !== source;
  if (!check && changed) writeFileSync(outputPath, source);
  return { check, changed, tools: Object.keys(manifest.tools).length, partial: Object.entries(manifest.tools).filter(([, entry]) => entry.langs.length < 5).map(([slug, entry]) => `${slug}:${entry.langs.join('/')}`) };
}

const executedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('build-tool-locales.mjs');
if (executedDirectly) {
  const result = await buildToolLocales({ check: process.argv.includes('--check') });
  console.log(JSON.stringify(result, null, 2));
  if (result.check && result.changed) process.exit(1);
}
