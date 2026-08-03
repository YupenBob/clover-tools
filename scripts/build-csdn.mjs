/**
 * 生成 CSDN 发布包：
 * - csdn/01-SEO文章/：把 data/articles.json 的 HTML 正文转为 CSDN Markdown，
 *   每篇末尾附 CloverTools 工具推广卡片（含工具直达链接）
 * - csdn/发布计划.csv：文章元数据 + 优先级 + 建议排期
 *
 * 用法：node scripts/build-csdn.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'csdn');
const SITE = 'https://clovertools.cn';

/* ---------------------------------- 数据读取 ---------------------------------- */
const articles = JSON.parse(readFileSync(join(root, 'data', 'articles.json'), 'utf8')).articles;
const toolsText = readFileSync(join(root, 'src', 'lib', 'tools.ts'), 'utf8');

/** 解析 tools.ts：category → slug → {name, oneLiner, tier} */
const TOOLS = {};
{
  const blocks = toolsText.split(/(?=^\s{2}(?:dev|daily|fun): \[)/m);
  for (const block of blocks) {
    const catMatch = block.match(/^\s{2}(dev|daily|fun): \[/m);
    if (!catMatch) continue;
    const cat = catMatch[1];
    const re = /slug: '([^']+)',\s*\n\s*name: '([^']+)',\s*\n\s*oneLiner: '([^']*)',[\s\S]*?tier: '([^']+)'/g;
    let m;
    while ((m = re.exec(block))) {
      TOOLS[m[1]] = { slug: m[1], name: m[2], oneLiner: m[3], tier: m[4], category: cat };
    }
  }
}

/** 旧路径 → 新路径（来自 public/_redirects 的 301 规则） */
const REDIRECTS = {};
for (const line of readFileSync(join(root, 'public', '_redirects'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const parts = t.split(/\s+/);
  if (parts.length === 3 && parts[2] === '301' && parts[0].startsWith('/tools/')) {
    REDIRECTS[parts[0].slice('/tools/'.length)] = parts[1];
  }
}

/** 素材里的旧路径 → 当前站内工具 slug（覆盖 _redirects 未覆盖的路径） */
const LEGACY_TO_SLUG = {
  'code/api-test.html': 'http-tester',
  'code/html-entity.html': 'html-formatter',
  'code/http-test.html': 'http-tester',
  'code/json-diff.html': 'diff',
  'code/minify-js.html': 'js-formatter',
  'data/json-to-schema.html': 'json-codegen',
  'encrypt/md5.html': 'hash',
  'encrypt/sha.html': 'hash',
  'encrypt/jwt.html': 'jwt-decoder',
  'json/formatter.html': 'json-formatter',
  'network/http-request.html': 'http-tester',
  'network/user-agent-parser.html': 'ua-parser',
  'other/color.html': 'color-convert',
  'other/uuid.html': 'uuid-generator',
  'text/camel.html': 'text-transform',
  'text/url-encoder.html': 'url-encode',
  'text/uuid-generator.html': 'uuid-generator',
  'time/unix-timestamp.html': 'timestamp',
};

/** 个别素材里 tool 归属明显错配时，按关键词覆盖为站内更相关的工具 */
const KEYWORD_TOOL_OVERRIDES = {
  'markdown语法怎么写': 'markdown',
};

function toolUrlFor(legacyPath) {
  if (!legacyPath) return null;
  const redirectDest = REDIRECTS[legacyPath];
  if (redirectDest) return redirectDest;
  const slug = LEGACY_TO_SLUG[legacyPath];
  if (slug && TOOLS[slug]) return `/tools/${TOOLS[slug].category}/${slug}/`;
  // 兜底：从文件名里猜 slug（去掉 .html，去掉中划线）
  const fileName = basename(legacyPath, '.html').replace(/-/g, '');
  const hit = Object.values(TOOLS).find((t) => t.slug.replace(/-/g, '') === fileName);
  return hit ? `/tools/${hit.category}/${hit.slug}/` : null;
}

/* ---------------------------------- HTML → Markdown ---------------------------------- */
function unescapeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function escapeTableCell(s) {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function inlineToMarkdown(raw) {
  let s = raw;
  // 代码、加粗、斜体、链接 依次处理（用占位符避免嵌套冲突）
  const codes = [];
  s = s.replace(/<code>([\s\S]*?)<\/code>/g, (_, c) => {
    const text = unescapeEntities(c).replace(/`/g, '\\`');
    codes.push(`\`${text}\``);
    return `\x00CODE${codes.length - 1}\x00`;
  });
  s = s.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => {
    const inner = inlineToMarkdown(text).replace(/\|/g, '\\|');
    return `[${inner}](${href})`;
  });
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/g, (_, t) => `**${inlineToMarkdown(t).trim()}**`);
  s = s.replace(/<b>([\s\S]*?)<\/b>/g, (_, t) => `**${inlineToMarkdown(t).trim()}**`);
  s = s.replace(/<em>([\s\S]*?)<\/em>/g, (_, t) => `*${inlineToMarkdown(t).trim()}*`);
  s = s.replace(/<br\s*\/?>/g, '  \n');
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) => codes[Number(i)]);
  return unescapeEntities(s);
}

function guessCodeLang(code) {
  const s = code.slice(0, 500);
  if (/\b(def |import (tensorflow|requests|flask)|print\()/.test(s) && !/\bconst |=>|function /.test(s)) return 'python';
  if (/\b(function |const |=>|let |console\.log|async )/.test(s)) return 'javascript';
  if (/^@|package |public class|System\.out/.test(s)) return 'java';
  if (/\bfunc [a-zA-Z]/.test(s)) return 'go';
  if (/^(npm|git|docker|curl|ssh|pip |python -m|node )/.test(s.trim())) return 'bash';
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE |ALTER )/i.test(s.trim())) return 'sql';
  if (/^[#\$]/.test(s.trim())) return 'bash';
  return '';
}

function htmlToMarkdown(html) {
  const out = [];
  let i = 0;
  let inPre = false;
  let preLang = '';
  let preBuf = '';
  let inTable = false;
  let tableRows = [];
  let curRow = null;
  let curCell = null;
  let curCellIsHead = false;
  let listType = null;
  let olCount = 0;
  let pendingLi = false;

  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*?)?)\s*\/?>|([^<]+)|(<)/g;
  let m;
  while ((m = tokenRe.exec(html))) {
    if (m[4] !== undefined || m[5] !== undefined) {
      const text = m[4];
      if (inPre) {
        preBuf += text !== undefined ? text : '<';
      } else if (inTable) {
        curCell += text !== undefined ? text : '<';
      } else if (pendingLi) {
        out.push(inlineToMarkdown(text !== undefined ? text : '<'));
        pendingLi = false;
      } else {
        const t = inlineToMarkdown(text !== undefined ? text : '<');
        if (t.trim()) out.push(t);
      }
      continue;
    }

    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';

    if (tag === 'pre') {
      if (!closing) {
        inPre = true;
        preBuf = '';
        preLang = '';
      } else {
        inPre = false;
        const code = unescapeEntities(preBuf).replace(/\n$/, '');
        preLang = guessCodeLang(code);
        out.push('\n```' + preLang + '\n' + code + '\n```\n');
        preBuf = '';
      }
      continue;
    }
    if (inPre) {
      if (tag === 'code') continue; // <code> 包裹标签不进入代码内容
      preBuf += m[0];
      continue;
    }

    if (tag === 'table') {
      if (!closing) {
        inTable = true;
        tableRows = [];
      } else {
        inTable = false;
        if (curRow) tableRows.push(curRow);
        if (tableRows.length) {
          out.push('\n');
          const header = tableRows[0];
          out.push('| ' + header.map((c) => escapeTableCell(c)).join(' | ') + ' |\n');
          out.push('| ' + header.map(() => '---').join(' | ') + ' |\n');
          for (const row of tableRows.slice(1)) {
            out.push('| ' + row.map((c) => escapeTableCell(c)).join(' | ') + ' |\n');
          }
          out.push('\n');
        }
        tableRows = [];
        curRow = null;
        curCell = null;
      }
      continue;
    }
    if (inTable) {
      if (tag === 'tr') {
        if (!closing) {
          if (curRow) tableRows.push(curRow);
          curRow = [];
        }
      } else if (tag === 'th' || tag === 'td') {
        if (!closing) {
          curCell = '';
          curCellIsHead = tag === 'th';
        } else if (curRow && curCell !== null) {
          curRow.push(inlineToMarkdown(curCell).trim());
          curCell = null;
        }
      }
      continue;
    }

    if (tag === 'h2' || tag === 'h3') {
      if (!closing) {
        const level = tag === 'h2' ? '##' : '###';
        out.push(`\n${level} `);
      } else {
        out.push('\n');
      }
      continue;
    }
    if (tag === 'p') {
      if (!closing) out.push('\n');
      else out.push('\n');
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (!closing) {
        listType = tag;
        olCount = 0;
        out.push('\n');
      } else {
        listType = null;
        out.push('\n');
      }
      continue;
    }
    if (tag === 'li') {
      if (!closing) {
        if (listType === 'ol') {
          olCount += 1;
          out.push(`${olCount}. `);
        } else {
          out.push('- ');
        }
        pendingLi = true;
      } else {
        out.push('\n');
      }
      continue;
    }
    if (tag === 'div') {
      if (!closing) out.push('\n');
      continue;
    }
    if (tag === 'br') {
      out.push('  \n');
      continue;
    }
  }

  return out
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/* ---------------------------------- 文件生成 ---------------------------------- */
function slugifyFile(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim();
}

function csvCell(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

const CSV_HEADER = [
  '优先级',
  '文件名',
  '标题',
  '摘要',
  '目标关键词',
  '搜索意图',
  '工具名称',
  '工具链接',
  '工具分类',
  '工具级别',
  '状态',
  '建议发布日期',
  'CSDN建议标签',
];

/** 生成未来周一/三/五的日期，跳过今天 */
function* weekdays() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (true) {
    const day = d.getDay();
    if (day === 1 || day === 3 || day === 5) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      yield `${y}-${mo}-${da}`;
    }
    d.setDate(d.getDate() + 1);
  }
}

const wd = weekdays();
const rows = [];
const byCat = {};

for (const a of articles) {
  const overrideSlug = KEYWORD_TOOL_OVERRIDES[a.keyword];
  const toolUrl = overrideSlug && TOOLS[overrideSlug]
    ? `/tools/${TOOLS[overrideSlug].category}/${overrideSlug}/`
    : toolUrlFor(a.tool);
  let toolMeta = null;
  if (toolUrl) {
    const m = toolUrl.match(/^\/tools\/(dev|daily|fun)\/([^/]+)\/$/);
    toolMeta = m ? TOOLS[m[2]] : null;
  }

  const hasContent = Boolean(a.content && a.content.trim());
  const priority = !hasContent ? 3 : toolMeta?.tier === 'P0' ? 1 : 2;
  const status = hasContent ? '已就绪' : '待补全';
  const cat = toolMeta?.category || '其他';
  const folder = toolMeta ? toolMeta.slug : null;

  if (!byCat[cat]) byCat[cat] = {};
  if (!byCat[cat][folder ?? '__none__']) byCat[cat][folder ?? '__none__'] = [];
  byCat[cat][folder ?? '__none__'].push({ a, toolUrl, toolMeta, hasContent, priority });

  const fileName = slugifyFile(`${a.keyword}.md`);
  const relPath = folder ? `01-SEO文章/${cat}/${folder}/${fileName}` : `01-SEO文章/${cat}/${fileName}`;
  rows.push({
    priority,
    fileName: relPath,
    title: a.title || a.keyword,
    desc: a.desc || '',
    keyword: a.keyword,
    intent: a.intent || '',
    toolName: toolMeta?.name || '',
    toolUrl: toolUrl ? `${SITE}${toolUrl}` : '',
    toolCat: cat,
    toolTier: toolMeta?.tier || '',
    status,
    date: '',
    tags: [toolMeta?.name, a.intent === 'error-fix' ? '报错解决' : '教程', '在线工具', 'CloverTools']
      .filter(Boolean)
      .join('、'),
  });
}

// 写文章文件
rmSync(join(OUT, '01-SEO文章'), { recursive: true, force: true });
let written = 0;
for (const [cat, folders] of Object.entries(byCat)) {
  for (const [folder, items] of Object.entries(folders)) {
    const dir = folder === '__none__' ? join(OUT, '01-SEO文章', cat) : join(OUT, '01-SEO文章', cat, folder);
    mkdirSync(dir, { recursive: true });
    for (const { a, toolUrl, toolMeta, hasContent } of items) {
      const md = [];
      md.push(`# ${a.title || a.keyword}`);
      md.push('');
      if (a.desc) {
        md.push(`> ${a.desc}`);
        md.push('');
      }
      if (hasContent) {
        md.push(htmlToMarkdown(a.content));
        md.push('');
        md.push('---');
        md.push('');
      } else {
        md.push('> ⚠️ 本文正文待补全（仅标题/摘要已就绪），发布前请先完善内容。');
        md.push('');
      }
      // 统一的 CloverTools 推广卡片
      md.push('## 相关工具推荐');
      md.push('');
      if (toolMeta && toolUrl) {
        md.push(`**${toolMeta.name}** — ${toolMeta.oneLiner}`);
        md.push('');
        md.push(`在线使用：[${toolMeta.name}](${SITE}${toolUrl})`);
        md.push('');
      }
      md.push('**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。');
      md.push('');
      md.push(`立即体验：[https://clovertools.cn](${SITE})`);
      md.push('');
      writeFileSync(join(dir, slugifyFile(`${a.keyword}.md`)), md.join('\n'), 'utf8');
      written += 1;
    }
  }
}

// 品牌主文作为优先级 0，排在最前
const brandRow = {
  priority: 0,
  fileName: '00-品牌宣传/CloverTools-开发日常趣味三合一在线工具箱.md',
  title: 'CloverTools：开发、日常、趣味三合一的免费在线工具箱（69 个工具即开即用）',
  desc: 'CloverTools 是一个纯浏览器处理、无需注册的在线工具箱：开发实用、日常实用、趣味工具三大类共 69 个工具，覆盖 JSON/正则/加解密/时间戳/生肖星座等高频场景。',
  keyword: '在线工具箱推荐',
  intent: 'brand',
  toolName: '',
  toolUrl: SITE,
  toolCat: '',
  toolTier: '',
  status: '已就绪',
  date: '',
  tags: '在线工具箱、开发工具、效率工具、CloverTools',
};

// 排序后统一分配排期：品牌文 → P0 依次排在最近的周一/三/五
const order = { 1: 0, 2: 1, 3: 2 };
const allRows = [brandRow, ...rows].sort(
  (x, y) => order[x.priority] - order[y.priority] || x.toolName.localeCompare(y.toolName, 'zh'),
);
for (const r of allRows) {
  if (r.priority <= 1) r.date = wd.next().value;
}

const csvLines = [CSV_HEADER.join(',')];
for (const r of allRows) {
  csvLines.push([
    r.priority,
    r.fileName,
    r.title,
    r.desc,
    r.keyword,
    r.intent,
    r.toolName,
    r.toolUrl,
    r.toolCat,
    r.toolTier,
    r.status,
    r.date,
    r.tags,
  ].map(csvCell).join(','));
}
writeFileSync(join(OUT, '发布计划.csv'), csvLines.join('\n') + '\n', 'utf8');

// 统计
const ready = rows.filter((r) => r.status === '已就绪').length;
const todo = rows.filter((r) => r.status === '待补全').length;
const noTool = rows.filter((r) => !r.toolUrl).length;
console.log(`已生成 ${written} 篇文章文件`);
console.log(`已就绪 ${ready} / 待补全 ${todo}`);
console.log(`其中 ${noTool} 篇无对应站内工具（推广卡片仅链接首页）`);
console.log(`工具覆盖：${Object.keys(TOOLS).filter((s) => rows.some((r) => r.toolUrl.endsWith(s + '/'))).length} 个`);
