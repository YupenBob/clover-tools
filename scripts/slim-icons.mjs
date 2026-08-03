/**
 * 图标字体瘦身：扫描源码中实际使用的 bi-* 图标类，
 * 只保留这些图标的 CSS 规则，减少全站加载体积。
 * 用法：node scripts/slim-icons.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const cssPath = join(srcDir, 'styles', 'vendor', 'bootstrap-icons.css');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(astro|ts|tsx|js|css)$/.test(entry)) files.push(full);
  }
  return files;
}

const used = new Set();
for (const file of walk(srcDir)) {
  if (file.includes(join('styles', 'vendor'))) continue;
  const content = readFileSync(file, 'utf8');
  for (const m of content.matchAll(/bi-([a-z0-9-]+)/g)) {
    used.add(m[1]);
  }
}

const css = readFileSync(cssPath, 'utf8');
const kept = [];
const segments = css.split('}');
let keptCount = 0;
let totalCount = 0;

for (const seg of segments) {
  const brace = seg.lastIndexOf('{');
  if (brace === -1) continue;
  const selector = seg.slice(0, brace).trim();
  const body = seg.slice(brace + 1).trim();
  totalCount++;
  const keep =
    selector.startsWith('@font-face') ||
    /^\.bi[,{]/.test(selector) ||
    /\.bi::before/.test(selector) ||
    [...selector.matchAll(/\.bi-([a-z0-9-]+)::before/g)].some((m) => used.has(m[1]));
  if (keep) {
    kept.push(`${selector}{${body}}`);
    keptCount++;
  }
}

writeFileSync(cssPath, kept.join('\n') + '\n', 'utf8');
console.log(`图标瘦身完成：规则 ${totalCount} -> ${keptCount}（使用 ${used.size} 个图标类）`);

// 校验：所有使用到的图标类都应保留
const newCss = readFileSync(cssPath, 'utf8');
const missing = [...used].filter((name) => !newCss.includes(`.bi-${name}::before`));
if (missing.length) {
  console.error(`缺少图标规则：${missing.join(', ')}`);
  process.exit(1);
}
