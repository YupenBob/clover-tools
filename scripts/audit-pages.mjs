/**
 * 全站页面运行时审计：检查每个页面脚本中引用的元素 ID 是否存在于 HTML。
 * 脚本在初始化时调用 byId()/getElementById()，ID 缺失会直接抛错导致整页功能不可用。
 * 用法：node scripts/audit-pages.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.html')) files.push(full);
  }
  return files;
}

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('dist 不存在，请先 npm run build');
  process.exit(1);
}

const pages = walk(dist);
const problems = [];
let checked = 0;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const refs = new Map();

  for (const code of scripts) {
    const idRefs = [
      ...code.matchAll(/(?:byId|getElementById)\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const id of idRefs) {
      refs.set(id, (refs.get(id) || 0) + 1);
    }
  }

  if (refs.size > 0) checked++;
  for (const [id, count] of refs) {
    if (!ids.has(id)) {
      problems.push(`${file.replace(dist + '\\', '').replace(dist + '/', '')} 引用不存在的 ID: ${id}（${count} 处）`);
    }
  }
}

if (problems.length) {
  console.error(`发现 ${problems.length} 处缺失元素引用：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(`页面审计通过：${pages.length} 个页面中 ${checked} 个含脚本引用，全部 ID 均存在`);
