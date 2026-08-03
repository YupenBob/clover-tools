/**
 * SEO 结构检查：构建产物 dist/ 内逐页断言基础 SEO 结构与结构化数据。
 * 用法：node scripts/check-seo.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://clovertools.cn';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const problems = [];

function rel(file) {
  return file.replace(dist + '\\', '').replace(dist + '/', '');
}

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const path = rel(file);

  // 百度验证占位文件为纯注释 HTML，跳过结构断言
  if (/^baidu-verify.*\.html$/.test(path)) continue;

  const h1s = content.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) || [];
  if (h1s.length !== 1) problems.push(`${path}: h1 数量为 ${h1s.length}（应为 1）`);

  const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
  if (!title) problems.push(`${path}: 缺少 title`);
  else if ([...title].length > 80) problems.push(`${path}: title 过长（${[...title].length} 字）`);

  const desc = content.match(/<meta name="description" content="([^"]*)"/)?.[1] || '';
  const descLen = [...desc].length;
  if (!desc) problems.push(`${path}: 缺少 meta description`);
  else if (path !== '404.html' && (descLen < 40 || descLen > 120)) {
    problems.push(`${path}: meta description 长度 ${descLen} 超出 40~120`);
  }

  const canonical = content.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
  if (!canonical.startsWith(SITE)) problems.push(`${path}: canonical 缺失或非绝对地址（${canonical}）`);

  const jsonLdBlocks = [...content.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      problems.push(`${path}: JSON-LD 解析失败`);
      return null;
    }
  }).filter(Boolean);
  const types = jsonLdBlocks.map((b) => (Array.isArray(b) ? b : [b])).flat().map((b) => b['@type']);

  // 工具页
  const toolMatch = path.match(/^tools\/(dev|daily|fun)\/([^/]+)\/index\.html$/);
  if (toolMatch) {
    if (!types.includes('SoftwareApplication')) problems.push(`${path}: 缺少 SoftwareApplication JSON-LD`);
    if (!types.includes('BreadcrumbList')) problems.push(`${path}: 缺少 BreadcrumbList JSON-LD`);
    const featureCount = (content.match(/class="tool-about"[\s\S]*?<ul class="usage-features">[\s\S]*?<li>/g) || [])[0]
      ? [...content.match(/class="usage-features"[\s\S]*?<\/ul>/)[0].matchAll(/<li>/g)].length
      : 0;
    if (featureCount < 3) problems.push(`${path}: 「使用说明」功能要点不足 3 条（${featureCount}）`);
    if (!content.includes('class="tool-about"')) problems.push(`${path}: 缺少「使用说明」区块`);
  }

  // 分类页
  const catMatch = path.match(/^tools\/(dev|daily|fun)\/index\.html$/);
  if (catMatch) {
    const itemList = jsonLdBlocks.map((b) => (Array.isArray(b) ? b : [b])).flat().find((b) => b['@type'] === 'ItemList');
    if (!itemList) {
      problems.push(`${path}: 缺少 ItemList JSON-LD`);
    } else {
      const cards = (content.match(/class="tool-card"/g) || []).length;
      if (itemList.numberOfItems !== cards) {
        problems.push(`${path}: ItemList numberOfItems=${itemList.numberOfItems} 与页面工具卡片 ${cards} 不一致`);
      }
    }
  }

  // 首页
  if (path === 'index.html') {
    const flat = jsonLdBlocks.map((b) => (Array.isArray(b) ? b : [b])).flat();
    if (!flat.some((b) => b['@type'] === 'WebSite')) problems.push(`${path}: 缺少 WebSite JSON-LD`);
    if (!flat.some((b) => b['@type'] === 'Organization')) problems.push(`${path}: 缺少 Organization JSON-LD`);
    const website = flat.find((b) => b['@type'] === 'WebSite');
    if (website && !(website.potentialAction && website.potentialAction['@type'] === 'SearchAction')) {
      problems.push(`${path}: WebSite 缺少 SearchAction`);
    }
  }
}

if (problems.length) {
  console.error(`SEO 结构检查失败（${problems.length} 处）：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(`SEO 结构检查通过：${htmlFiles.length} 个页面，标题 / 描述 / canonical / h1 / JSON-LD / 使用说明均合规`);
