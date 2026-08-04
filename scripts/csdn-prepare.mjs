// CloverTools CSDN 草稿生成管线
// 输入：csdn/tool-links.json（外链映射）、csdn/intros.json（标题/导语/收尾）、data/articles.json（元数据）
// 正文源：legacy/article_contents/<slug>.html（完整长文，优先）
// 输出：csdn/drafts/<发布日期>-<slug>.md + csdn/manifest.json
// 原则：真实、自然、不刻意宣传——正文清理 CloverTools 品牌与营销尾巴，每篇至多 1 个自然外链。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEGACY_DIR = path.join(ROOT, 'legacy/article_contents');
const DRAFTS_DIR = path.join(ROOT, 'csdn/drafts');

const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'csdn/tool-links.json'), 'utf-8')).articles;
const intros = JSON.parse(fs.readFileSync(path.join(ROOT, 'csdn/intros.json'), 'utf-8')).articles;
const allArticles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/articles.json'), 'utf-8')).articles;
const articlesBySlug = new Map(allArticles.map((a) => [a.slug, a]));

const legacyFiles = fs.readdirSync(LEGACY_DIR);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const legacySet = new Map(legacyFiles.map((f) => [norm(f.replace(/\.html$/, '')), f]));

// ---------- 计划发布日期：从 2026-08-05 起的工作日 ----------
function plannedDates(count) {
  const dates = [];
  const d = new Date('2026-08-05T00:00:00+08:00');
  while (dates.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
const dates = plannedDates(links.length);

// ---------- 营销/品牌痕迹：按段落整体删除 ----------
const BLOCK_RE = [
  /CloverTools|Clover Tools|Clover ·|Clover -|clovertools\.cn|Clover 后端|Clover 2026|Clover 技术/i,
  /工具推荐|实用工具推荐|在线工具合集|工具速查不迷路|立即使用|点击使用|点击查看|立即查看|前往 CloverTools|更多开发工具|更多工具尽在|一站找齐|一键扫项目|排错效率翻倍|顺手检查一下|快速测试接口响应|支持自定义超时时间|自动生成请求代码|打开 URL 编码工具|需要在线测试|试试 [^。\n]*工具|不想折腾命令行|写不动了|试试这些工具|Docker 启动命令生成器|一键复制|少加班|多摸鱼|SSL 检测工具|需要配置 HTTPS|提供可视化|我整理的|快速生成带盐值|支持密钥上传|打开浏览器就能连|一个工具全搞定|直接扔进去检查|JSON 报错不用再一个个搜|本文由|首发于|© Clover|收录了大量|推荐使用 [^。\n]*工具|在线工具推荐|工具站|整理发布|立即体验|在线测试 CORS|不需要安装|打开就能用|说了这么多|不如动手试试|想快速验证|手动算 Cron 容易出错|在线工具推荐/i,
];

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2B05}-\u{2B07}\u{2934}-\u{2935}\u{23E9}-\u{23F3}]/gu;

// ---------- HTML → Markdown ----------
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&copy;/g, '©')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)));
}

function inline(s) {
  return s
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<kbd[^>]*>([\s\S]*?)<\/kbd>/gi, '`$1`')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, url, txt) =>
      /^javascript:/i.test(url) ? txt : `[${txt}](${url})`,
    )
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![image]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

function stripTagsRaw(s) {
  return s.replace(/<[^>]+>/g, '');
}

function htmlToMarkdown(html) {
  let h = html;
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<head[\s\S]*?<\/head>/gi, '');
  h = h.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  h = h.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  // 剔除旧站工具链接（避免重复外链 / 失效链接）
  h = h.replace(/<a[^>]*href=["'][^"']*(?:\/tools\/|xsanye|clovertools)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');

  // 保护代码块
  const pres = [];
  h = h.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, inner) => {
    const langMatch = m.match(/class="[^"]*(?:language|lang)-?([\w+-]+)/i);
    const codeMatch = inner.match(/<code[^>]*class="[^"]*(?:language|lang)-?([\w+-]+)/i);
    const lang = (langMatch || codeMatch || [])[1] || '';
    const code = decodeEntities(stripTagsRaw(inner)).trim();
    pres.push({ lang, code });
    return `\u0000PRE${pres.length - 1}\u0000`;
  });

  // 表格
  h = h.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (m, inner) => {
    const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => r[1]);
    if (!rows.length) return '';
    const cells = (row) =>
      [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        inline(c[1]).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'),
      );
    const header = /<th/i.test(rows[0]) ? cells(rows.shift()) : null;
    const body = rows.map(cells);
    const colCount = header ? header.length : Math.max(0, ...body.map((r) => r.length));
    const lines = [];
    if (header) {
      lines.push(`| ${header.join(' | ')} |`);
      lines.push(`| ${new Array(colCount).fill('---').join(' | ')} |`);
    }
    for (const r of body) {
      const cellsPadded = [...r];
      while (cellsPadded.length < colCount) cellsPadded.push('');
      lines.push(`| ${cellsPadded.join(' | ')} |`);
    }
    return `\n\n${lines.join('\n')}\n\n`;
  });

  // 标题
  h = h.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (m, t) => `\n\n# ${inline(t).trim()}\n\n`);
  h = h.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m, t) => `\n\n## ${inline(t).trim()}\n\n`);
  h = h.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (m, t) => `\n\n### ${inline(t).trim()}\n\n`);
  h = h.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (m, t) => `\n\n#### ${inline(t).trim()}\n\n`);

  // 列表（有序/无序分开处理）
  h = h.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (m, inner) => {
    let i = 1;
    return (
      '\n\n' +
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (mm, li) => `\n${i++}. ${inline(li).trim()}`) +
      '\n\n'
    );
  });
  h = h.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (m, inner) => {
    return (
      '\n\n' +
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (mm, li) => `\n- ${inline(li).trim()}`) +
      '\n\n'
    );
  });

  // 引用、段落、分隔线
  h = h.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
    const lines = inline(inner)
      .split('\n')
      .map((l) => `> ${l.trim()}`)
      .join('\n');
    return `\n\n${lines}\n\n`;
  });
  h = h.replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '\n');
  h = h.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  h = h.replace(/<br\s*\/?>/gi, '\n');
  // 目录锚点链接整行删除（如 "7. [在线工具推荐](#tool)"）
  h = h.replace(/^\s*([-*]\s+|\d+\.?\s+)?\[[^\]]*\]\(#[^)]*\)\s*$/gm, '');
  // 正文中的锚点链接只留文字
  h = h.replace(/\[([^\]]*)\]\(#[^)]*\)/g, '$1');
  // 工具测试/验证类小节整体删除（正文已由收尾自然覆盖）
  h = h.replace(/(^#{1,4}\s+[^\n]*?(在线.*测试|工具.*测试|工具验证)[^\n]*\n)([\s\S]*?)(?=^#{1,4}\s|\Z)/gm, '\n');

  // 其余行内标签统一处理 + 还原代码块
  h = inline(h);
  h = h.replace(/\u0000PRE(\d+)\u0000/g, (m, i) => {
    const { lang, code } = pres[Number(i)];
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  });

  // 清理
  h = decodeEntities(h);
  h = h.replace(/[ \t]+\n/g, '\n');
  h = h.replace(/\n{3,}/g, '\n\n');
  return h.trim();
}

// ---------- 营销段落清理 ----------
function stripPromo(md) {
  const blocks = md.split(/\n{2,}/);
  const kept = blocks.filter((b) => !BLOCK_RE.some((re) => re.test(b)));
  return kept.join('\n\n').replace(EMOJI_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- 营销尾巴截断（处理段落清理后残留的碎片行） ----------
const TAIL_MARKER =
  /工具推荐|实用工具推荐|在线工具合集|工具速查不迷路|立即使用|点击使用|点击查看|说了这么多|不如动手试试|欢迎收藏|有问题？评论区|有问题直接去|想快速测试|不需要安装|打开就能用|需要在线测试|在线测试 CORS|去[^。\n]*工具|试试[^。\n]*工具|更多工具|一站找齐|本文由|首发于|©|☘|🚨|🔧|手把手教你/;

function stripTail(md) {
  const lines = md.split('\n');
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TAIL_MARKER.test(lines[i])) cut = i;
  }
  return cut >= 0 ? lines.slice(0, cut).join('\n').trim() : md.trim();
}

// ---------- 正文抽取 ----------
function extractBody(file) {
  const html = fs.readFileSync(path.join(LEGACY_DIR, file), 'utf-8');
  const isFull = /<html|<body/i.test(html);
  let h = html;
  if (isFull) {
    const m = h.match(/<(h[1-4])[^>]*>/i);
    if (m) h = h.slice(m.index);
  }
  return htmlToMarkdown(h);
}

// ---------- 组装草稿 ----------
fs.mkdirSync(DRAFTS_DIR, { recursive: true });

const manifest = [];
let errors = [];

links.forEach((item, idx) => {
  const { slug, url, anchor } = item;
  const meta = articlesBySlug.get(slug);
  const curated = intros[slug];
  const lf = legacySet.get(norm(slug));
  if (!meta || !curated || !lf) {
    errors.push(`缺少素材: slug=${slug} meta=${!!meta} curated=${!!curated} legacy=${lf}`);
    return;
  }

  const md = extractBody(lf);
  const cleaned = stripTail(stripPromo(md));
  const cleanedNorm = cleaned
    .replace(/^(#{1,4})\s{2,}/gm, '$1 ')
    .replace(/\n{3,}/g, '\n\n');
  const title = curated.title || meta.title;
  const desc = (meta.desc || '').replace(/\s*-\s*CloverTools\s*$/i, '').trim();
  const tags = curated.tags || [];

  let outro = curated.outro;
  if (outro.includes('{{L}}')) {
    if (!url || !anchor) {
      errors.push(`${slug}: 收尾含 {{L}} 但未配置外链`);
      return;
    }
    outro = outro.replace('{{L}}', `[${anchor}](${url})`);
  } else if (url && anchor) {
    errors.push(`${slug}: 已配置外链但收尾未使用 {{L}}`);
    return;
  }

  const plannedDate = dates[idx];
  const body = [curated.intro.trim(), '', cleanedNorm, '', curated.extra ? curated.extra.trim() : '', '', outro.trim()].join('\n');
  const wordCount = body.replace(/```[\s\S]*?```/g, '').replace(/[#>`|*_\-\[\]()]/g, '').replace(/\s/g, '').length;
  const linkCount = url ? 1 : 0;
  const brandCount = (body.match(/CloverTools(?![.\w-])/gi) || []).length;
  const fileName = `${plannedDate}-${slug}.md`;

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `description: "${desc}"`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `category: "${meta.category || ''}"`,
    'original: true',
    `planned_date: "${plannedDate}"`,
    `link: "${url || ''}"`,
    'status: draft',
    '---',
  ].join('\n');

  fs.writeFileSync(path.join(DRAFTS_DIR, fileName), `${frontmatter}\n\n${body}\n`, 'utf-8');
  manifest.push({
    slug,
    file: fileName,
    title,
    description: desc,
    category: meta.category || '',
    tags,
    planned_date: plannedDate,
    link: url || null,
    link_anchor: anchor || null,
    link_count: linkCount,
    brand_mentions: brandCount,
    word_count: wordCount,
    content_source: lf,
    status: 'draft',
  });
  console.log(`OK ${fileName} | ${wordCount}字 | 外链=${linkCount} | 品牌=${brandCount}`);
});

fs.writeFileSync(path.join(ROOT, 'csdn/manifest.json'), JSON.stringify({ generated_at: new Date().toISOString(), articles: manifest }, null, 2), 'utf-8');

if (errors.length) {
  console.error('\nERRORS:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
console.log(`\n完成：${manifest.length} 篇草稿 -> csdn/drafts/，清单 -> csdn/manifest.json`);
