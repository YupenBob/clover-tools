/**
 * 链接完整性检查：遍历 dist 内所有 HTML，验证内部 href/src 是否存在。
 * 用法：node scripts/check-links.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const problems = [];
const pending = [];

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const refs = [...content.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (!ref.startsWith('/')) continue;
    if (ref.includes('#') || ref.includes('?')) continue;
    let target = ref;
    if (target.endsWith('/')) target += 'index.html';
    const resolved = normalize(join(dist, target));
    if (!statSync(resolved, { throwIfNoEntry: false })) {
      const from = file.replace(dist + '\\', '').replace(dist + '/', '');
      // 已登记在工具清单但尚未制作页面的工具，属于待建页面（Phase 3），仅警告
      if (/^\/tools\/(dev|daily|fun)\/[^/]+\/$/.test(ref)) {
        pending.push(`${from} -> ${ref}`);
      } else {
        problems.push(`${from} -> ${ref}`);
      }
    }
  }
}

if (pending.length) {
  console.warn(`提示：${pending.length} 个工具页待建（已登记清单，未生成页面）：`);
  pending.slice(0, 8).forEach((p) => console.warn('  ' + p));
  if (pending.length > 8) console.warn(`  ... 等 ${pending.length} 处`);
}

if (problems.length) {
  console.error(`发现 ${problems.length} 个失效链接：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(`链接检查通过：${htmlFiles.length} 个页面，无失效链接`);
