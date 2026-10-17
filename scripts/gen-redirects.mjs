/**
 * 从工具清单生成旧站路径 → 新站路径的 301 重定向。
 * 用法：node scripts/gen-redirects.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITORIAL_REDIRECTS } from '../config/editorial-redirects.mjs';
import { getAllTools, getToolHref } from '../src/lib/tools.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entries = [];
const sources = new Set();
for (const tool of getAllTools()) {
  const target = getToolHref(tool.category, tool.slug);
  for (const source of [tool.legacyPath, ...(tool.legacyAliases || [])].filter(Boolean)) {
    if (sources.has(source) || source === target) throw new Error(`Duplicate or looping legacy route: ${source}`);
    sources.add(source);
    entries.push(`${source} ${target} 301`);
  }
}

const header = [
  '# CloverTools V3 - 旧路径 301 重定向（由 scripts/gen-redirects.mjs 生成，勿手改）',
  '# 域名级 www / HTTPS 跳转需由 Cloudflare 站点规则配置，Pages 不支持绝对来源地址',
  '',
  '# 旧站根页面与已下线栏目 → 首页',
  '/home-new.html / 301',
  '/demo.html / 301',
  '/demo2.html / 301',
  '/index.html / 301',
  '/tools/index.html / 301',
  '',
  '# 旧 About 页面 → 新关于页',
  '/about /about/ 301',
  '/about.html /about/ 301',
  '',
  '# 英文版入口补斜杠',
  '/en /en/ 301',
  '',
  '# 繁体版入口补斜杠',
  '/zh-hant /zh-hant/ 301',
  '',
  '# 韩语/日语版入口补斜杠',
  '/ko /ko/ 301',
  '/ja /ja/ 301',
  '',
  '# 已重写的文章：旧地址与历史 .html / 斜杠别名 → 等价指南',
  ...EDITORIAL_REDIRECTS.flatMap(({ legacy, guide }) =>
    ['', '.html', '/'].map(suffix => `${legacy}${suffix} /guides/${guide}/ 301`)),
  '',
  '# 未恢复的旧博客由静态站正常返回 404；不再把无关文章统一跳到首页',
];
writeFileSync(
  join(root, 'public', '_redirects'),
  [...header, '', ...entries.sort(), '', '# 其余历史栏目保留原规则；通配规则放在精确路径之后，后续逐项审查', '/fix/* / 301', '/category/* / 301', '/plugins/* / 301'].join('\n') + '\n',
  'utf8',
);
console.log(`已生成 ${entries.length} 条重定向`);
