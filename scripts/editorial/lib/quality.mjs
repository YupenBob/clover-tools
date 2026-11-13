/**
 * 文章质量规则（纯函数，可被 CI 门禁、tick 校验和单元测试共用）。
 * 规则来源：docs/EDITORIAL-AUTOMATION.md 的"质量定义与硬门禁"。
 */

export const PRIMARY_SOURCE_DOMAINS = [
  'developer.mozilla.org',
  'www.rfc-editor.org',
  'rfc-editor.org',
  'datatracker.ietf.org',
  'www.w3.org',
  'w3.org',
  'www.whatwg.org',
  'html.spec.whatwg.org',
  'nodejs.org',
  'developer.chrome.com',
  'web.dev',
  'docs.python.org',
  'www.unicode.org',
  'unicode.org',
  'www.ietf.org',
  'ietf.org',
  'developers.google.com',
  'support.google.com',
  'csrc.nist.gov',
  'nvlpubs.nist.gov',
  'www.json.org',
  'json.org',
  'tc39.es',
  '262.ecma-international.org',
  'docs.github.com',
  'git-scm.com',
  'learn.microsoft.com',
  'docs.oracle.com',
  'www.php.net',
  'caniuse.com',
  'www.postgresql.org',
  'dev.mysql.com',
  'redis.io',
  'www.iso.org',
];

export const BANNED_PHRASES = [
  '待补全',
  '内容占位',
  'lorem ipsum',
  'TODO',
  '我实测',
  '我亲测',
  '笔者亲测',
  '我们实测',
  '保证收益',
  '包治',
  '一定有效',
  '绝对安全',
  '100% 准确',
  '最强工具',
  '全网第一',
  '永久免费',
];

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|hellip|mdash|ndash);/g, (match) => ENTITIES[match] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cjkCount(text) {
  return (String(text).match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []).length;
}

export function visibleChars(text) {
  return String(text).replace(/\s+/g, '').length;
}

export function expectedReadingMinutes(cjk) {
  return Math.max(2, Math.ceil(cjk / 400));
}

export function analyzeStructure(html) {
  const source = String(html ?? '');
  const count = (pattern) => (source.match(pattern) ?? []).length;
  return {
    h1: count(/<h1\b/gi),
    h2: count(/<h2\b/gi),
    h3: count(/<h3\b/gi),
    p: count(/<p\b/gi),
    ol: count(/<ol\b/gi),
    ul: count(/<ul\b/gi),
    table: count(/<table\b/gi),
    figure: count(/<figure\b/gi),
    img: count(/<img\b/gi),
    pre: count(/<pre\b/gi),
    code: count(/<code\b/gi),
    details: count(/<details\b/gi),
  };
}

export function firstParagraphCjk(html) {
  const match = String(html ?? '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return match ? cjkCount(stripHtml(match[1])) : 0;
}

export function extractLinks(html) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(String(html ?? ''))) !== null) links.push(match[1]);
  return links;
}

export function extractImages(html) {
  const images = [];
  const pattern = /<img\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(String(html ?? ''))) !== null) {
    const tag = match[0];
    const attr = (name) => (tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i')) ?? [])[1] ?? null;
    images.push({ tag, src: attr('src'), alt: attr('alt'), width: attr('width'), height: attr('height') });
  }
  return images;
}

/** 归一化：去 HTML、去标点空白、小写，保留字母数字与 CJK。 */
export function normalizeForShingles(text) {
  return stripHtml(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function shingleSet(text, size = 8) {
  const normalized = normalizeForShingles(text);
  const set = new Set();
  for (let index = 0; index + size <= normalized.length; index += 1) set.add(normalized.slice(index, index + size));
  return set;
}

export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = smaller === a ? b : a;
  for (const item of smaller) if (larger.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function titleBigrams(title) {
  const normalized = normalizeForShingles(title);
  const set = new Set();
  for (let index = 0; index + 2 <= normalized.length; index += 1) set.add(normalized.slice(index, index + 2));
  return set;
}

/** 相对语料的最大相似度：返回 {max, slug}。 */
export function maxSimilarity(text, corpus, { size = 8 } = {}) {
  const candidate = shingleSet(text, size);
  let best = { max: 0, slug: null };
  for (const entry of corpus ?? []) {
    const score = jaccard(candidate, shingleSet(entry.text ?? '', size));
    if (score > best.max) best = { max: score, slug: entry.slug ?? null };
  }
  return best;
}

export function maxTitleSimilarity(title, corpus) {
  const candidate = titleBigrams(title);
  let best = { max: 0, slug: null };
  for (const entry of corpus ?? []) {
    const score = jaccard(candidate, titleBigrams(entry.title ?? ''));
    if (score > best.max) best = { max: score, slug: entry.slug ?? null };
  }
  return best;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isPrimarySource(url) {
  const host = hostOf(url);
  if (!host) return false;
  return PRIMARY_SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function findBannedPhrases(text) {
  const haystack = String(text ?? '');
  return BANNED_PHRASES.filter((phrase) => haystack.includes(phrase));
}

export function findEmoji(text) {
  const matches = String(text ?? '').match(/\p{Extended_Pictographic}/gu) ?? [];
  return [...new Set(matches)];
}

export function normalizeInternalToolPath(href) {
  if (!href) return null;
  let path = href;
  if (path.startsWith('https://clovertools.cn')) path = new URL(path).pathname;
  if (!path.startsWith('/tools/')) return null;
  return path.endsWith('/') ? path : `${path}/`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value) {
  if (!DATE_PATTERN.test(String(value ?? ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 静态质量校验（不联网、不读 .editorial）：
 * @param {object} guide 指南对象
 * @param {object} ctx {
 *   mode: 'new-guide' | 'upgrade-guide',
 *   config, today,
 *   toolIndex: { slugs:Set, hrefs:Map<slug,string> },
 *   categories: string[],
 *   corpus: Array<{slug,title,text}>,       // 站内语料（不含候选自身）
 *   csdnCorpus: Array<{slug,title,text}>,
 *   imageRegistry: Map<basename,{width,height,sha256,file}>,  // 可空
 *   fileExists: (repoRelativePath)=>boolean,
 *   repoRoot
 * }
 */
export function validateGuideStatic(guide, ctx) {
  const errors = [];
  const warnings = [];
  const config = ctx.config;
  const quality = config.quality;
  const push = (message) => errors.push(message);

  if (!guide || typeof guide !== 'object') return { errors: ['指南对象无效'], warnings, metrics: {} };
  for (const field of ['slug', 'title', 'description', 'category', 'toolSlug', 'published', 'updated', 'content']) {
    if (!guide[field] || typeof guide[field] !== 'string') push(`缺少字段或类型错误：${field}`);
  }
  if (!Array.isArray(guide.sources)) push('sources 必须是数组');
  if (!Array.isArray(guide.faqs)) push('faqs 必须是数组');

  const slug = String(guide.slug ?? '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) push(`slug 必须是 ASCII kebab-case：${slug || '(空)'}`);
  if (slug.length < 3 || slug.length > 80) push('slug 长度必须在 3–80 之间');

  const toolIndex = ctx.toolIndex;
  if (toolIndex?.slugs && !toolIndex.slugs.has(guide.toolSlug)) push(`关联工具不存在：${guide.toolSlug}`);
  if (Array.isArray(ctx.categories) && ctx.categories.length > 0 && !ctx.categories.includes(guide.category)) {
    push(`分类不在既有集合内：${guide.category}`);
  }

  const titleCjk = cjkCount(guide.title ?? '');
  if (titleCjk > quality.maxTitleCjk) push(`标题汉字数 ${titleCjk} 超过 ${quality.maxTitleCjk}`);
  if (String(guide.title ?? '').length > 80) push('标题总长度超过 80 字符');

  const descCjk = cjkCount(guide.description ?? '');
  if (descCjk < quality.minDescriptionCjk || descCjk > quality.maxDescriptionCjk) {
    push(`description 汉字数 ${descCjk} 不在 ${quality.minDescriptionCjk}–${quality.maxDescriptionCjk} 之间`);
  }

  // 简体中文指南另需独立的 SEO meta description：界面 description 保持简短，
  // `<meta name="description">` 用 150–160 字符的长描述（Bing 建议区间）。
  const seoDescription = String(guide.seoDescription ?? '');
  if (!seoDescription.trim()) {
    push('缺少字段或类型错误：seoDescription');
  } else {
    const seoDescriptionLength = [...seoDescription].length;
    if (
      seoDescriptionLength < quality.seoDescriptionMinChars ||
      seoDescriptionLength > quality.seoDescriptionMaxChars
    ) {
      push(
        `seoDescription 长度 ${seoDescriptionLength} 不在 ${quality.seoDescriptionMinChars}–${quality.seoDescriptionMaxChars} 之间`,
      );
    }
  }

  if (!isIsoDate(guide.published)) push(`published 不是合法日期：${guide.published}`);
  if (!isIsoDate(guide.updated)) push(`updated 不是合法日期：${guide.updated}`);
  if (isIsoDate(guide.published) && isIsoDate(guide.updated) && guide.published > guide.updated) push('published 晚于 updated');
  if (isIsoDate(guide.updated) && ctx.today && guide.updated > ctx.today) push(`updated 晚于今天：${guide.updated}`);

  const html = String(guide.content ?? '');
  const text = stripHtml(html);
  const cjk = cjkCount(text);
  const structure = analyzeStructure(html);
  const metrics = {
    slug,
    titleCjk,
    descriptionCjk: descCjk,
    cjk,
    visibleChars: visibleChars(text),
    ...structure,
    readingMinutes: guide.readingMinutes,
    expectedReadingMinutes: expectedReadingMinutes(cjk),
  };

  if (cjk < quality.minCjk) push(`正文汉字数 ${cjk} 少于硬性下限 ${quality.minCjk}`);
  if (cjk > quality.maxCjk) push(`正文汉字数 ${cjk} 超过上限 ${quality.maxCjk}（避免注水）`);
  if (structure.h2 < quality.minH2) push(`H2 数量 ${structure.h2} 少于 ${quality.minH2}`);
  if (structure.h1 > 0) push('正文不得包含 h1');
  if (structure.p < quality.minParagraphs) push(`段落数 ${structure.p} 少于 ${quality.minParagraphs}`);
  if (structure.ol + structure.ul === 0) push('正文至少需要一个有序或无序列表');
  if (structure.table + structure.figure + structure.img === 0) push('正文至少需要一个表格、图片或图例');
  if (/<script\b/i.test(html)) push('正文不得包含 script');
  if (/<h1\b/i.test(html)) push('正文不得包含 h1');

  const firstPara = firstParagraphCjk(html);
  if (firstPara > quality.maxFirstParagraphCjk) push(`首段 ${firstPara} 字超过直答上限 ${quality.maxFirstParagraphCjk}`);

  const banned = findBannedPhrases(text);
  if (banned.length > 0) push(`包含禁用表述：${banned.join('、')}`);
  const emoji = findEmoji(text);
  if (emoji.length > 0) push(`正文包含 emoji：${emoji.join(' ')}`);
  for (const phrase of ['待补全', '占位']) {
    if (html.includes(phrase)) push(`正文包含占位文本：${phrase}`);
  }

  if (!Number.isInteger(guide.readingMinutes) || guide.readingMinutes < quality.minReadingMinutes) {
    push(`readingMinutes 无效：${guide.readingMinutes}`);
  } else if (Math.abs(guide.readingMinutes - expectedReadingMinutes(cjk)) > 1) {
    push(`readingMinutes ${guide.readingMinutes} 与字数推算 ${expectedReadingMinutes(cjk)} 相差超过 1 分钟`);
  }

  // 来源
  const sources = Array.isArray(guide.sources) ? guide.sources : [];
  if (sources.length < quality.minSources) push(`来源数量 ${sources.length} 少于 ${quality.minSources}`);
  const sourceUrls = [];
  let primaryCount = 0;
  for (const source of sources) {
    if (!source || typeof source.title !== 'string' || !source.title.trim()) push('来源标题为空');
    if (!source || typeof source.url !== 'string') {
      push('来源 URL 缺失');
      continue;
    }
    let url;
    try {
      url = new URL(source.url);
    } catch {
      push(`来源 URL 不合法：${source.url}`);
      continue;
    }
    if (url.protocol !== 'https:') push(`来源必须使用 HTTPS：${source.url}`);
    const host = url.hostname.toLowerCase();
    if (host === 'clovertools.cn' || host.endsWith('.clovertools.cn')) push(`不得把本站作为来源：${source.url}`);
    if (isPrimarySource(source.url)) primaryCount += 1;
    sourceUrls.push(source.url);
  }
  if (primaryCount === 0) push('至少需要 1 条官方/标准/一手来源（MDN、RFC、W3C、Node 官方文档等）');
  metrics.primarySources = primaryCount;
  metrics.sources = sources.length;

  // 内链
  const toolIndexHrefs = toolIndex?.hrefs ?? new Map();
  const internal = extractLinks(html)
    .map(normalizeInternalToolPath)
    .filter(Boolean);
  const uniqueInternal = [...new Set(internal)];
  const brokenInternal = uniqueInternal.filter((href) => ![...toolIndexHrefs.values()].includes(href));
  if (brokenInternal.length > 0) push(`内链指向未登记工具：${brokenInternal.join('、')}`);
  if (uniqueInternal.length < quality.minInternalToolLinks) {
    push(`正文工具内链 ${uniqueInternal.length} 个，少于 ${quality.minInternalToolLinks}`);
  }
  metrics.internalToolLinks = uniqueInternal.length;

  // 图片与素材登记
  for (const image of extractImages(html)) {
    if (!image.src) push('图片缺少 src');
    if (!image.alt || !String(image.alt).trim()) push(`图片缺少 alt：${image.src ?? '(空)'}`);
    for (const dimension of ['width', 'height']) {
      const value = Number(image[dimension]);
      if (!Number.isInteger(value) || value <= 0) push(`图片 ${image.src ?? '(空)'} 缺少有效 ${dimension}`);
    }
    if (image.src?.startsWith('/article-images/')) {
      const basename = image.src.split('/').pop();
      const registryEntry = ctx.imageRegistry?.get(basename);
      if (!registryEntry) push(`图片未在 captures.json/diagrams.json 登记：${image.src}`);
      else {
        if (Number(image.width) !== registryEntry.width || Number(image.height) !== registryEntry.height) {
          push(`图片宽高与登记不一致：${image.src}`);
        }
      }
    } else if (image.src?.startsWith('/article-assets/')) {
      const repoPath = image.src.replace(/^\//, '');
      if (typeof ctx.fileExists === 'function' && !ctx.fileExists(repoPath)) push(`文章素材文件不存在：${image.src}`);
    }
  }

  // 相似度
  const corpus = (ctx.corpus ?? []).filter((entry) => entry.slug !== slug);
  const sim = maxSimilarity(text, corpus);
  metrics.maxSimilarity = Number(sim.max.toFixed(4));
  metrics.maxSimilarityWith = sim.slug;
  if (sim.max > quality.maxSimilarity) push(`与站内文章 ${sim.slug} 相似度 ${sim.max.toFixed(3)} 超过 ${quality.maxSimilarity}`);

  const csdnSim = maxSimilarity(text, ctx.csdnCorpus ?? []);
  metrics.maxCsdnSimilarity = Number(csdnSim.max.toFixed(4));
  if (csdnSim.max > quality.maxCsdnSimilarity) push(`与 CSDN 语料 ${csdnSim.slug} 相似度 ${csdnSim.max.toFixed(3)} 超过 ${quality.maxCsdnSimilarity}`);

  const titleSim = maxTitleSimilarity(guide.title ?? '', corpus);
  metrics.maxTitleSimilarity = Number(titleSim.max.toFixed(4));
  if (titleSim.max > quality.maxTitleSimilarity) push(`标题与 ${titleSim.slug} 过于相似 (${titleSim.max.toFixed(3)})`);

  if (Array.isArray(guide.faqs)) {
    for (const faq of guide.faqs) {
      if (!faq || typeof faq.q !== 'string' || typeof faq.a !== 'string' || !faq.q.trim() || !faq.a.trim()) {
        push('FAQ 的 q/a 不能为空');
      }
    }
  }

  metrics.warnings = warnings;
  return { errors, warnings, metrics, sourceUrls, firstParagraphCjk: firstPara };
}

/**
 * 证据包校验（tick 专用；来源抓取结果由 Lead 在 verify-sources 中实际抓取写入）。
 * @param {object} evidence {
 *   claims: [{id,text,type:'source'|'code'|'run',ref}],
 *   runs?: [{command,exitCode,outputPath,ranAt}],
 *   codeRefs?: [{path,line,note}],
 * }
 * @param {object} ctx {
 *   config, verifiedSources: Map<url,{status,finalUrl,sha256}>,
 *   fileExists, readLineCount, verifiedRuns: Map<key,{exitCode,outputPath}>,
 * }
 */
export function validateEvidence(evidence, ctx) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') return { errors: ['缺少证据包 evidence.json'] };
  const claims = Array.isArray(evidence.claims) ? evidence.claims : null;
  if (!claims) return { errors: ['证据包缺少 claims 数组'] };
  if (claims.length < ctx.config.quality.minEvidenceClaims) {
    errors.push(`证据条目 ${claims.length} 条，少于 ${ctx.config.quality.minEvidenceClaims}`);
  }
  const seen = new Set();
  for (const claim of claims) {
    if (!claim || typeof claim.id !== 'string' || !claim.id.trim()) errors.push('证据条目缺少 id');
    else if (seen.has(claim.id)) errors.push(`证据 id 重复：${claim.id}`);
    else seen.add(claim.id);
    if (!claim || typeof claim.text !== 'string' || claim.text.trim().length < 8) errors.push(`证据 ${claim?.id ?? '?'} 的断言文本过短`);
    if (!['source', 'code', 'run'].includes(claim?.type)) {
      errors.push(`证据 ${claim?.id ?? '?'} 类型无效：${claim?.type}`);
      continue;
    }
    if (claim.type === 'source') {
      const verified = ctx.verifiedSources?.get(claim.ref);
      if (!verified) errors.push(`证据 ${claim.id} 的来源未实际抓取：${claim.ref}`);
      else if (verified.status !== 200) errors.push(`证据 ${claim.id} 的来源返回 ${verified.status}：${claim.ref}`);
    }
    if (claim.type === 'code') {
      const match = String(claim.ref ?? '').match(/^(.+?):(\d+)$/);
      if (!match) errors.push(`证据 ${claim.id} 的代码引用格式应为 path:line：${claim.ref}`);
      else {
        const [, repoPath, lineText] = match;
        const line = Number(lineText);
        if (typeof ctx.fileExists === 'function' && !ctx.fileExists(repoPath)) errors.push(`证据 ${claim.id} 的代码文件不存在：${repoPath}`);
        if (typeof ctx.readLineCount === 'function') {
          const total = ctx.readLineCount(repoPath);
          if (!Number.isInteger(total) || line < 1 || line > total) errors.push(`证据 ${claim.id} 的行号越界：${claim.ref}（文件 ${total} 行）`);
        }
      }
    }
    if (claim.type === 'run') {
      const verified = ctx.verifiedRuns?.get(claim.ref);
      if (!verified) errors.push(`证据 ${claim.id} 的运行记录未登记：${claim.ref}`);
      else if (verified.exitCode !== 0) errors.push(`证据 ${claim.id} 的运行失败（exit ${verified.exitCode}）：${claim.ref}`);
    }
  }
  return { errors };
}

/** 供 tick 校验来源抓取覆盖：指南 sources 中每个 URL 都必须被实际抓取且 200。 */
export function validateSourceCoverage(guide, verifiedSources) {
  const errors = [];
  for (const source of guide.sources ?? []) {
    const verified = verifiedSources?.get(source.url);
    if (!verified) errors.push(`来源未抓取验证：${source.url}`);
    else if (verified.status !== 200) errors.push(`来源返回 ${verified.status}：${source.url}`);
  }
  return { errors };
}
