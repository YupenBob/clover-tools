/**
 * 图标规范扫描：构建产物中出现 emoji 字形即失败。
 * 全站图标必须使用 iconfont（bootstrap-icons），禁用 emoji。
 * 用法：node scripts/check-emoji.mjs
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
    else files.push(full);
  }
  return files;
}

// 常见 emoji 区段（符号与象形文字、杂项符号、杂项符号与箭头、表情符号等）
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const problems = [];

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const m = content.match(EMOJI_RE);
  if (m) {
    problems.push(
      `${file.replace(dist + '\\', '').replace(dist + '/', '')} 包含 emoji 字形：${m[0]}`,
    );
  }
}

if (problems.length) {
  console.error(`图标规范检查失败，发现 ${problems.length} 处 emoji：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(`图标规范检查通过：${htmlFiles.length} 个页面，无 emoji`);
