// CSDN 草稿质量校验：真实性、外链数、品牌词、营销词、排版完整性
import fs from 'node:fs';
import path from 'node:path';

const DRAFTS = path.join(process.cwd(), 'csdn/drafts');
const links = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'csdn/tool-links.json'), 'utf-8')).articles;
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'csdn/manifest.json'), 'utf-8')).articles;

const MARKETING = /免费|神器|不容错过|立即体验|强烈推荐|更多工具|点击使用|立即使用|工具推荐|一站找齐|点击查看|前往|欢迎收藏|手把手教你|不迷路|福利|限时|错过/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2B05}-\u{2B07}\u{2934}-\u{2935}\u{23E9}-\u{23F3}]/u;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;
const OLD_LINK = /\]\(\/(tools|blog|fix|category|plugins)|xsanye|tools\.x?sanye/;
const FRAG_LINK = /\]\(#/;

const linkBySlug = new Map(links.map((l) => [l.slug, l]));
let failed = 0;

function bodyOf(text) {
  const i = text.indexOf('---\n\n');
  return i >= 0 ? text.slice(i + 4) : text;
}

function frontmatterOf(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

for (const item of manifest) {
  const file = path.join(DRAFTS, item.file);
  if (!fs.existsSync(file)) {
    console.error(`FAIL ${item.file}: 文件不存在`);
    failed++;
    continue;
  }
  const text = fs.readFileSync(file, 'utf-8');
  const body = bodyOf(text);
  const fm = frontmatterOf(text);
  const issues = [];

  const brandWords = (body.match(/CloverTools(?![.\w-])/gi) || []).length;
  if (brandWords !== 0) issues.push(`品牌词 ${brandWords} 处`);

  const httpLinks = [...body.matchAll(/\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
  if (httpLinks.length > 1) issues.push(`外链 ${httpLinks.length} 个`);
  const expected = linkBySlug.get(item.slug)?.url;
  if (expected && !httpLinks.includes(expected)) issues.push(`缺少预期外链 ${expected}`);
  if (!expected && httpLinks.length > 0) issues.push(`未配置外链但正文含 ${httpLinks[0]}`);
  const badAnchor = httpLinks.some((u, i) => body.match(/\[[^\]]*Clover[^\]]*\]\(/i));
  if (badAnchor) issues.push('锚文本含品牌词');

  const mkt = body.match(MARKETING);
  if (mkt) issues.push(`营销词: ${mkt[0]}`);
  if (EMOJI.test(body)) issues.push('残留 emoji');
  if (HTML_TAG.test(body)) issues.push('残留 HTML 标签');
  if (OLD_LINK.test(body)) issues.push('残留旧站链接');
  if (FRAG_LINK.test(body)) issues.push('残留锚点链接');

  const fences = (body.match(/```/g) || []).length;
  if (fences % 2 !== 0) issues.push(`代码块标记不闭合 (${fences})`);

  const title = (fm.match(/title:\s*"([^"]*)"/) || [])[1] || '';
  if ([...title].filter((c) => /[\u4e00-\u9fffA-Za-z0-9]/.test(c)).length > 30) issues.push(`标题过长 (${title.length})`);

  const wordCount = item.word_count;
  if (wordCount < 800) issues.push(`字数不足 (${wordCount})`);

  // 主链接对应页面存在（优先构建产物，其次源码）
  if (expected) {
    const urlPath = new URL(expected).pathname.replace(/\/$/, '');
    const distPage = path.join(process.cwd(), 'dist', urlPath, 'index.html');
    const srcPage = path.join(process.cwd(), 'src/pages', urlPath.slice(1) + '.astro');
    if (fs.existsSync(distPage) || fs.existsSync(srcPage)) {
      // ok
    } else {
      issues.push(`链接页面不存在: ${expected}`);
    }
  }

  if (issues.length) {
    failed++;
    console.error(`FAIL ${item.file}`);
    issues.forEach((i) => console.error(`  - ${i}`));
  } else {
    console.log(`OK   ${item.file} | ${wordCount}字 | 外链=${httpLinks.length} | 品牌=${brandWords}`);
  }
}

if (failed) {
  console.error(`\n${failed} 篇未通过校验`);
  process.exit(1);
}
console.log(`\n全部 ${manifest.length} 篇通过校验`);
