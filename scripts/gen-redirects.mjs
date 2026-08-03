/**
 * 从工具清单生成旧站路径 → 新站路径的 301 重定向。
 * 用法：node scripts/gen-redirects.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readFileSync(join(root, 'src', 'lib', 'tools.ts'), 'utf8');

const categories = { dev: '开发实用', daily: '日常实用', fun: '趣味工具' };
const entries = [];

for (const [catKey] of Object.entries(categories)) {
  const section = manifest.split(`${catKey}: [`)[1].split(/\n  (?:dev|daily|fun): \[/)[0];
  const toolBlocks = section.split('\n    {');
  for (const block of toolBlocks) {
    const slug = block.match(/slug: '([^']+)'/)?.[1];
    const legacy = block.match(/legacyPath: '([^']+)'/)?.[1];
    if (slug && legacy) {
      entries.push(`${legacy} /tools/${catKey}/${slug}/ 301`);
      const aliases = [...(block.match(/legacyAliases: \[([^\]]*)\]/)?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
      for (const alias of aliases) {
        entries.push(`${alias} /tools/${catKey}/${slug}/ 301`);
      }
    }
  }
}

const header = [
  '# CloverTools V3 - 旧路径 301 重定向（由 scripts/gen-redirects.mjs 生成，勿手改）',
  '# 统一 https + www → 主域',
  'https://www.clovertools.cn/* https://clovertools.cn/:splat 301',
  '',
  '# 旧站根页面与已下线栏目 → 首页',
  '/about.html / 301',
  '/home-new.html / 301',
  '/demo.html / 301',
  '/demo2.html / 301',
  '/index.html / 301',
  '/tools/index.html / 301',
  '',
  '# 已剥离内容（博客 / fix hub / 分类 / 插件）兜底跳首页，精确规则优先',
  '/blog/* / 301',
  '/fix/* / 301',
  '/category/* / 301',
  '/plugins/* / 301',
];
writeFileSync(
  join(root, 'public', '_redirects'),
  [...header, '', ...entries.sort()].join('\n') + '\n',
  'utf8',
);
console.log(`已生成 ${entries.length} 条重定向`);
