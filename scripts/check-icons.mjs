/**
 * Icon system checks:
 * 1. no legacy Bootstrap icon classes/imports/font references in src or dist
 * 2. every static <Icon name="..."> and every icon value in tool/content data
 *    resolves in the semantic registry
 * 3. no icon markup embedded inside client-side HTML strings
 * 4. no external icon-font request left in the built site
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

const legacyPattern = /(?:class=["'](?:[^"']*\s)?bi\b|class=["']bi-|"bi-[a-z0-9-]+"|'bi-[a-z0-9-]+'|bootstrap-icons|slim-icons)/;
const embeddedPattern = /(?:innerHTML|insertAdjacentHTML|outerHTML)\s*=\s*[`'"][^`'"]*<Icon\s/;
const iconTagPattern = /<Icon\s+name=["']([^"']+)["']/g;
const dataIconPattern = /icon:\s*'([a-z0-9-]+)'/g;
const embeddedIconPattern = /<i\b[^>]*class=["'][^"']*\bbi\b[^"']*["']/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(src).filter((f) => /\.(astro|ts|tsx|js)$/.test(f) && !f.includes(join('styles', 'vendor')));
const problems = [];
const usedNames = new Set();

for (const file of srcFiles) {
  const rel = file.slice(root.length + 1);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // allow the registry comment that mentions the historical `bi-` prefix wording
    if (rel.endsWith(join('lib', 'icons', 'registry.ts')) && line.trim().startsWith('*')) return;
    if (legacyPattern.test(line)) problems.push(`${rel}:${i + 1} legacy Bootstrap icon reference: ${line.trim()}`);
    if (embeddedPattern.test(line)) problems.push(`${rel}:${i + 1} <Icon> inside a client HTML string (use renderIconSvg)`);
    if (embeddedIconPattern.test(line)) problems.push(`${rel}:${i + 1} <i class="bi"> icon markup left`);
    for (const m of line.matchAll(iconTagPattern)) {
      if (/^[a-z0-9-]+$/.test(m[1])) usedNames.add(m[1]);
    }
    for (const m of line.matchAll(dataIconPattern)) usedNames.add(m[1]);
  });
}

// 2) resolve against the generated registry (parse its keys; avoids TS runtime deps)
const registryFile = join(src, 'lib', 'icons', 'registry.ts');
if (!existsSync(registryFile)) {
  problems.push('缺少 src/lib/icons/registry.ts');
}
const registrySource = existsSync(registryFile) ? readFileSync(registryFile, 'utf8') : '';
const keys = new Set([...registrySource.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]));
if (keys.size < 100) {
  problems.push(`registry 图标数量异常：${keys.size}`);
}
for (const name of usedNames) {
  const clean = name.replace(/^bi-/, '');
  if (!keys.has(clean)) problems.push(`图标未在 registry 中定义：${name}`);
}

// 3) dist checks (when a build exists)
if (existsSync(dist)) {
  const distFiles = walk(dist).filter((f) => /\.(html|css)$/.test(f));
  for (const file of distFiles) {
    const rel = file.slice(dist.length + 1);
    const content = readFileSync(file, 'utf8');
    if (/bootstrap-icons|bootstrap-icons\.woff/.test(content)) problems.push(`${rel} 仍引用 bootstrap-icons`);
    if (/<i\b[^>]*class=["'][^"']*\bbi\b/.test(content)) problems.push(`${rel} 仍存在 <i class="bi"> 图标标记`);
    if (/pagead|^$/.test(rel)) continue;
  }
}

if (problems.length) {
  console.error(`图标检查失败（${problems.length} 项）：`);
  for (const p of problems.slice(0, 40)) console.error('  ' + p);
  if (problems.length > 40) console.error(`  ... 还有 ${problems.length - 40} 项`);
  process.exit(1);
}
console.log(`图标检查通过：${srcFiles.length} 个源文件、${keys.size} 个注册图标、${usedNames.size} 个引用名`);
