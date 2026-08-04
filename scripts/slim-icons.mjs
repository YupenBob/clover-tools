/**
 * 图标字体瘦身：扫描源码中实际使用的 bi-* 图标类，
 * 只保留这些图标的 CSS 规则，减少全站加载体积。
 * 始终从 node_modules 原始 CSS 生成，保证 @font-face 完整。
 * 用法：node scripts/slim-icons.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const cssOut = join(srcDir, 'styles', 'vendor', 'bootstrap-icons.css');
const cssSrc = join(root, 'node_modules', 'bootstrap-icons', 'font', 'bootstrap-icons.css');

if (!existsSync(cssSrc)) {
  console.error('未找到 node_modules/bootstrap-icons/font/bootstrap-icons.css');
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(astro|ts|tsx|js|css)$/.test(entry)) files.push(full);
  }
  return files;
}

// 1) 扫描实际使用的图标类
const used = new Set();
for (const file of walk(srcDir)) {
  if (file.includes(join('styles', 'vendor'))) continue;
  const content = readFileSync(file, 'utf8');
  for (const m of content.matchAll(/bi-([a-z0-9-]+)/g)) {
    used.add(m[1]);
  }
}

// 2) 读取原始 CSS 并修正字体路径
const raw = readFileSync(cssSrc, 'utf8').replace(/\.\/fonts\//g, '/fonts/');

// 3) 保留所有 @font-face 块（含开头的版权注释前导）
const fontFaces = [...raw.matchAll(/@font-face\s*\{[\s\S]*?\}/g)]
  .map((m) => m[0])
  // 现代浏览器全支持 woff2，移除冗余 woff fallback，减少 170KB+ 部署体积
  .map((face) => face.replace(/,\s*url\("\/fonts\/bootstrap-icons\.woff[^)]*"\)\s*format\("woff"\)/g, ''));
if (fontFaces.length === 0) {
  console.error('原始 CSS 中未找到 @font-face');
  process.exit(1);
}

// 4) 处理普通规则（去掉注释后按 } 切分）
const rest = raw
  .replace(/@font-face\s*\{[\s\S]*?\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const kept = [...fontFaces];
let totalCount = 0;
for (const seg of rest.split('}')) {
  const brace = seg.lastIndexOf('{');
  if (brace === -1) continue;
  const selector = seg.slice(0, brace).trim();
  const body = seg.slice(brace + 1).trim();
  totalCount++;
  const keep =
    /^\.bi[,{]/.test(selector) ||
    /\.bi::before/.test(selector) ||
    [...selector.matchAll(/\.bi-([a-z0-9-]+)::before/g)].some((m) => used.has(m[1]));
  if (keep) kept.push(`${selector}{${body}}`);
}

const output = kept.join('\n') + '\n';
writeFileSync(cssOut, output, 'utf8');

// 5) 自检：字体声明与基础规则必须存在，所有使用的图标必须保留
if (!output.includes('@font-face')) {
  console.error('自检失败：输出缺少 @font-face');
  process.exit(1);
}
if (!output.includes('.bi::before')) {
  console.error('自检失败：输出缺少 .bi::before 基础规则');
  process.exit(1);
}
const missing = [...used].filter((name) => !output.includes(`.bi-${name}::before`));
if (missing.length) {
  console.error(`缺少图标规则：${missing.join(', ')}`);
  process.exit(1);
}
console.log(`图标瘦身完成：规则 ${totalCount} -> ${kept.length - fontFaces.length}（使用 ${used.size} 个图标类，@font-face ${fontFaces.length} 个）`);
