#!/usr/bin/env node
/**
 * 把草稿中的 [[figure:name|caption]] 占位符替换成真实 <figure>（含真实宽高与截图链接），
 * 并把第一张图设为页面主图。
 * 用法：node scripts/editorial/inject-images.mjs --slug <slug>
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { writeJsonAtomic } from './lib/state.mjs';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--slug') options.slug = argv[index + 1];
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug) throw new Error('用法：inject-images.mjs --slug <slug>');
  const draftDir = join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(draftDir, 'guide.json');
  const capturesFile = join(draftDir, 'captures.json');
  const guide = JSON.parse(readFileSync(guideFile, 'utf8'));
  const captures = existsSync(capturesFile) ? JSON.parse(readFileSync(capturesFile, 'utf8')) : [];
  const month = String(guide.updated ?? new Date().toISOString()).slice(0, 7);
  const byName = new Map();
  for (const entry of captures) {
    const stem = entry.file.replace(/\.[^.]+$/, '');
    byName.set(stem, entry);
    byName.set(stem.replace(`${options.slug}-`, ''), entry);
  }

  const placeholders = [...String(guide.content ?? '').matchAll(/\[\[figure:([a-z0-9-]+)\|([^\]]*)\]\]/gi)];
  if (placeholders.length === 0) {
    if (captures.length > 0) console.error(`提醒：草稿有 ${captures.length} 张截图，但正文没有 [[figure:...]] 占位符`);
    return;
  }
  if (captures.length === 0) throw new Error('正文包含 [[figure:...]]，但没有 captures.json（截图未捕获）');

  let content = String(guide.content);
  for (const [token, name, caption] of placeholders) {
    const entry = byName.get(name) ?? byName.get(`${options.slug}-${name}`);
    if (!entry) throw new Error(`未找到截图：${name}（可用：${[...new Set(captures.map((item) => item.file))].join(', ')}）`);
    const src = `/article-images/${month}/${entry.file}`;
    const alt = escapeHtml(entry.alt || caption || guide.title);
    const fig = `<figure><a href="${src}" target="_blank" rel="noopener" aria-label="查看大图：${alt}"><img src="${src}" alt="${alt}" width="${entry.width}" height="${entry.height}" loading="lazy" decoding="async"></a><figcaption>${escapeHtml(caption)} 点击图片可查看原图。</figcaption></figure>`;
    content = content.replace(token, fig);
  }
  if (!guide.image && captures.length > 0) {
    const first = captures[0];
    guide.image = `/article-images/${month}/${first.file}`;
  }
  guide.content = content;
  writeJsonAtomic(guideFile, guide);
  console.log(JSON.stringify({ ok: true, slug: options.slug, figures: placeholders.length, images: captures.length, hero: guide.image }, null, 2));
}

main();
