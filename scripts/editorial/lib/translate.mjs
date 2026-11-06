/**
 * 多语言译文工具：简体→繁体机械转换、译文 JSON 构造、静态校验。
 *
 * 规则与 scripts/lib/guide-i18n-audit.mjs 保持一致（本文件独立实现，不 import 对方）：
 *  - 来源 URL 集合一致；h2 / 表格 / figure / pre 数量一致；
 *  - 内链必须本地化（tw→/zh-hant/tools/、en→/en/tools/、ko→/ko/tools/、ja→/ja/tools/），
 *    不得出现简体 /tools/，数量与简体源一致；
 *  - en Han 占比 <0.5%（且连续汉字 ≤10）、ko Hangul 占比 ≥20%、ja kana 占比 ≥5%；
 *  - 标题 / 描述 / 正文长度；_meta.translation 合法；无占位符与 emoji。
 */
import { createHash } from 'node:crypto';
import chineseS2t from 'chinese-s2t';
import { stripHtml } from './quality.mjs';

const { s2t } = chineseS2t;

/** 译文语言；zh 为简体源，不在此列表。 */
export const TRANSLATED_LANGS = ['tw', 'en', 'ko', 'ja'];

/** 公开 URL 前缀（与 config/routes.mjs 的 LOCALES 保持一致）。 */
export const LANGUAGE_PREFIX = {
  tw: '/zh-hant',
  en: '/en',
  ko: '/ko',
  ja: '/ja',
};

/** 各语言阈值，与 guide-i18n-audit.mjs 的 TRANSLATION_REQUIREMENTS 相同。 */
export const TRANSLATION_REQUIREMENTS = {
  tw: {
    titleMaxHan: 40,
    descriptionMinHan: 40,
    descriptionMaxHan: 120,
    bodyMinHan: 1500,
  },
  en: {
    titleMaxChars: 80,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinWords: 900,
    maxHanRatio: 0.005,
    maxHanRun: 10,
  },
  ko: {
    titleMaxChars: 80,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinHangul: 1500,
    minHangulRatio: 0.2,
    maxHanRun: 10,
  },
  ja: {
    titleMaxChars: 80,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinHanKana: 1500,
    minKanaRatio: 0.05,
  },
};

export const REQUIRED_TRANSLATION_FIELDS = [
  'slug',
  'title',
  'description',
  'content',
  'faqs',
  'sources',
  'published',
  'updated',
  'readingMinutes',
  'category',
  'toolSlug',
];

const HAN = /\p{Script=Han}/gu;
const HANGUL = /\p{Script=Hangul}/gu;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const LATIN = /\p{Script=Latin}/gu;
const HAN_RUN = /\p{Script=Han}+/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const PROTECT_OPEN = '\uE000';
const PROTECT_CLOSE = '\uE001';
const TOOL_PREFIXES = [
  ['', 'zh'],
  ['/zh-hant', 'tw'],
  ['/en', 'en'],
  ['/ko', 'ko'],
  ['/ja', 'ja'],
];

export function sha256Hex(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

/** 与 buildTranslation 写入的 translatedFrom 使用同一口径。 */
export function translationSourceHash(zhGuide) {
  return sha256Hex(`${zhGuide?.content ?? ''}${zhGuide?.title ?? ''}${zhGuide?.description ?? ''}`);
}

/**
 * 只转换 CJK：HTML 标签属性里的中文会被转换，但 <pre>/<code> 代码块与 URL 原样保留，
 * 因此不会破坏标签、链接与代码。
 */
function convertCjkText(text) {
  if (typeof text !== 'string' || text === '') return text ?? '';
  const kept = [];
  const stash = (value) => {
    kept.push(value);
    return `${PROTECT_OPEN}${kept.length - 1}${PROTECT_CLOSE}`;
  };
  const guarded = text
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, (match) => stash(match))
    .replace(/<code\b[\s\S]*?<\/code>/gi, (match) => stash(match))
    .replace(/\bhttps?:\/\/[^\s"'<>]+/g, (match) => stash(match));
  const converted = s2t(guarded);
  return converted.replace(/\uE000(\d+)\uE001/g, (_, index) => kept[Number(index)] ?? '');
}

/** 把站内工具/指南链接改写到目标语言前缀；站外链接与锚点不动。 */
function localizeHref(href, prefix) {
  let path = String(href ?? '');
  let origin = null;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (!/^(?:www\.)?clovertools\.cn$/i.test(url.hostname)) return href;
      origin = url.origin;
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return href;
    }
  }
  if (!path.startsWith('/')) return href;
  if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  const isSection = (section) => path === section || path.startsWith(`${section}/`);
  if (!isSection('/tools') && !isSection('/guides')) return href;
  const localized = `${prefix}${path}`;
  return origin ? `${origin}${localized}` : localized;
}

export function localizeInternalLinks(html, lang) {
  const prefix = LANGUAGE_PREFIX[lang];
  if (!prefix) return String(html ?? '');
  return String(html ?? '').replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']+)(["'])/gi,
    (match, before, quote, href, closing) => {
      const rewritten = localizeHref(href, prefix);
      return rewritten === href ? match : `${before}${quote}${rewritten}${closing}`;
    },
  );
}

/**
 * 简体草稿 → 繁体译文（机械转换，无需 reviewer）。
 * 只转换 title/description/content/faqs[].q/a/focus/notice；category 保持简体（UI 会本地化显示）。
 */
export function convertGuideToTw(guide) {
  if (!guide || typeof guide !== 'object') throw new Error('convertGuideToTw 需要简体指南对象');
  const output = { ...guide };
  for (const field of ['title', 'description', 'focus', 'notice']) {
    if (typeof guide[field] === 'string') output[field] = convertCjkText(guide[field]);
  }
  if (typeof guide.content === 'string') {
    output.content = localizeInternalLinks(convertCjkText(guide.content), 'tw');
  }
  if (Array.isArray(guide.faqs)) {
    output.faqs = guide.faqs.map((faq) => ({
      ...faq,
      q: typeof faq?.q === 'string' ? convertCjkText(faq.q) : faq?.q,
      a: typeof faq?.a === 'string' ? convertCjkText(faq.a) : faq?.a,
    }));
  }
  return output;
}

function validIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function mergeSources(zhSources, payloadSources) {
  const payloadList = Array.isArray(payloadSources) ? payloadSources : [];
  const byUrl = new Map();
  for (const source of payloadList) {
    if (source && typeof source === 'object' && source.url) byUrl.set(source.url, source);
  }
  return (Array.isArray(zhSources) ? zhSources : [])
    .filter((source) => source && source.url)
    .map((source, index) => {
      const candidate = byUrl.get(source.url) ?? payloadList[index];
      const translatedTitle = typeof candidate === 'string' ? candidate : candidate?.title;
      return {
        title: String(translatedTitle || source.title || '').trim(),
        url: source.url,
      };
    });
}

/**
 * 由简体源 + 译文正文构造译文 JSON。
 * payload：{ title, description, content, faqs, focus, notice, image, sources,
 *            _meta:{translation:{reviewerVerdict, reviewerConfidence, translatedAt}} }
 * 保留 published/updated/readingMinutes/category/toolSlug；sources 只保留 URL，
 * 标题优先取译文 payload，缺省沿用简体标题。
 */
export function buildTranslation(zhGuide, lang, payload = {}) {
  if (!zhGuide || typeof zhGuide !== 'object' || !zhGuide.slug) {
    throw new Error('buildTranslation 需要包含 slug 的简体源指南');
  }
  if (!TRANSLATED_LANGS.includes(lang)) {
    throw new Error(`不支持的语言：${lang}（可选 ${TRANSLATED_LANGS.join('/')}）`);
  }
  const input = payload && typeof payload === 'object' ? payload : {};
  const metaInput = input._meta?.translation ?? {};
  const verdict = String(metaInput.reviewerVerdict ?? input.reviewerVerdict ?? 'pending').toLowerCase();
  const rawConfidence = Number(metaInput.reviewerConfidence ?? input.reviewerConfidence ?? 0);
  const translatedAt = validIsoTimestamp(metaInput.translatedAt)
    ? metaInput.translatedAt
    : new Date().toISOString();

  const translation = {
    slug: zhGuide.slug,
    title: String(input.title ?? zhGuide.title ?? ''),
    description: String(input.description ?? zhGuide.description ?? ''),
    category: zhGuide.category,
    toolSlug: zhGuide.toolSlug,
    published: zhGuide.published,
    updated: zhGuide.updated,
    readingMinutes: zhGuide.readingMinutes,
    content: String(input.content ?? zhGuide.content ?? ''),
    faqs: Array.isArray(input.faqs) ? input.faqs : Array.isArray(zhGuide.faqs) ? zhGuide.faqs : [],
    sources: mergeSources(zhGuide.sources, input.sources),
    _meta: {
      translation: {
        of: zhGuide.slug,
        lang,
        translatedFrom: translationSourceHash(zhGuide),
        translatedAt,
        reviewerVerdict: verdict,
        reviewerConfidence: Number.isFinite(rawConfidence) ? rawConfidence : 0,
      },
    },
  };
  for (const field of ['image', 'focus', 'notice']) {
    const value = input[field] ?? zhGuide[field];
    if (value !== undefined && value !== null && value !== '') translation[field] = value;
  }
  return translation;
}

function countMatches(text, pattern) {
  return (String(text ?? '').match(pattern) ?? []).length;
}

function countTag(html, tag) {
  return (String(html ?? '').match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
}

function longestHanRun(text) {
  return (String(text ?? '').match(HAN_RUN) ?? []).reduce((max, run) => Math.max(max, [...run].length), 0);
}

function ratio(part, total) {
  return total > 0 ? part / total : 0;
}

/**
 * 统计文本中各类文字字符数；total 仅计文字，不计空白与标点。
 * 与 guide-i18n-audit.mjs 的 languageScriptStats 口径一致。
 */
export function languageScriptStats(text) {
  const value = String(text ?? '');
  const cjk = countMatches(value, HAN);
  const hangul = countMatches(value, HANGUL);
  const kana = countMatches(value, KANA);
  const latin = countMatches(value, LATIN);
  return { cjk, hangul, kana, latin, total: cjk + hangul + kana + latin };
}

function extractHrefs(html) {
  const hrefs = [];
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gis)) {
    hrefs.push(match[1] ?? match[2] ?? '');
  }
  return hrefs;
}

/** 仅处理站内相对路径；外部链接与锚点不参与内链语言检查。 */
function internalPath(href) {
  const value = String(href ?? '').trim();
  if (!value || value.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return null;
  return (value.startsWith('/') ? value : `/${value}`).split(/[?#]/)[0];
}

/** 返回内链所属语言；不是工具内链时返回 null。 */
function toolLinkLanguage(href) {
  const path = internalPath(href);
  if (!path) return null;
  for (const [prefix, lang] of TOOL_PREFIXES) {
    const base = `${prefix}/tools/`;
    if (path === base.slice(0, -1) || path.startsWith(base)) return lang;
  }
  return null;
}

function checkMeta(translation, zhGuide, lang, errors) {
  const meta = translation?._meta?.translation;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    errors.push('_meta.translation 缺失');
    return;
  }
  const sourceSlug = zhGuide?.slug ?? translation?.slug;
  if (meta.of !== sourceSlug) errors.push(`_meta.translation.of 应为 ${sourceSlug}（实际 ${meta.of ?? ''}）`);
  if (meta.lang !== lang) errors.push(`_meta.translation.lang 应为 ${lang}（实际 ${meta.lang ?? ''}）`);
  if (typeof meta.translatedFrom !== 'string' || !HEX_64_PATTERN.test(meta.translatedFrom)) {
    errors.push('_meta.translation.translatedFrom 必须是 64 位 hex sha256');
  }
  if (!validIsoTimestamp(meta.translatedAt)) {
    errors.push('_meta.translation.translatedAt 必须是 ISO 时间');
  }
  if (meta.reviewerVerdict !== 'pass') errors.push('_meta.translation.reviewerVerdict 必须是 pass');
  if (
    !(
      typeof meta.reviewerConfidence === 'number' &&
      Number.isFinite(meta.reviewerConfidence) &&
      meta.reviewerConfidence >= 0.7
    )
  ) {
    errors.push('_meta.translation.reviewerConfidence 必须 ≥0.7');
  }
}

/**
 * 译文静态校验（不读网络、不写磁盘）。
 * @returns {{errors: string[], warnings: string[], metrics: object}}
 */
export function validateTranslationStatic(translation, zhGuide, lang) {
  const errors = [];
  const warnings = [];
  const metrics = { slug: translation?.slug ?? zhGuide?.slug ?? null, lang };
  const requirements = TRANSLATION_REQUIREMENTS[lang];

  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    return { errors: ['译文对象无效'], warnings, metrics };
  }
  if (!zhGuide || typeof zhGuide !== 'object' || Array.isArray(zhGuide)) {
    return { errors: ['简体源对象无效'], warnings, metrics };
  }
  if (!requirements) {
    return { errors: [`不支持的语言：${lang}`], warnings, metrics };
  }

  // 字段完整性，以及与源一致的标识字段
  for (const field of REQUIRED_TRANSLATION_FIELDS) {
    const value = translation[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`缺少字段：${field}`);
      continue;
    }
    if (['faqs', 'sources'].includes(field) && !Array.isArray(value)) {
      errors.push(`${field} 必须是数组`);
    }
    if (['slug', 'title', 'description', 'content'].includes(field) && !(typeof value === 'string' && value.trim())) {
      errors.push(`${field} 必须是非空字符串`);
    }
  }
  for (const field of ['slug', 'category', 'toolSlug']) {
    if (translation[field] !== undefined && zhGuide[field] !== undefined && translation[field] !== zhGuide[field]) {
      errors.push(`${field} 应与简体源一致（${zhGuide[field]}）`);
    }
  }
  for (const field of ['published', 'updated', 'readingMinutes']) {
    if (translation[field] !== zhGuide[field]) {
      errors.push(`${field} 应与简体源完全相同（${zhGuide[field]}）`);
    }
  }

  // 来源 URL 集合：允许顺序与标题不同
  const sourceUrls = new Set(
    (Array.isArray(zhGuide.sources) ? zhGuide.sources : []).map((source) => source?.url).filter(Boolean),
  );
  const translatedUrls = new Set(
    (Array.isArray(translation.sources) ? translation.sources : []).map((source) => source?.url).filter(Boolean),
  );
  if (sourceUrls.size !== translatedUrls.size || [...sourceUrls].some((url) => !translatedUrls.has(url))) {
    errors.push('sources URL 集合与简体源不一致');
  }

  // HTML 结构
  const sourceHtml = String(zhGuide.content ?? '');
  const translatedHtml = String(translation.content ?? '');
  const sourceStructure = {
    h2: countTag(sourceHtml, 'h2'),
    table: countTag(sourceHtml, 'table'),
    figure: countTag(sourceHtml, 'figure'),
    pre: countTag(sourceHtml, 'pre'),
  };
  const translatedStructure = {
    h2: countTag(translatedHtml, 'h2'),
    table: countTag(translatedHtml, 'table'),
    figure: countTag(translatedHtml, 'figure'),
    pre: countTag(translatedHtml, 'pre'),
  };
  for (const tag of ['h2', 'table', 'figure', 'pre']) {
    if (translatedStructure[tag] !== sourceStructure[tag]) {
      errors.push(`<${tag}> 数量 ${translatedStructure[tag]} 与简体源 ${sourceStructure[tag]} 不一致`);
    }
  }

  // 内链：所有工具链接必须带目标语言前缀，数量与简体源一致
  const expectedPrefix = `${LANGUAGE_PREFIX[lang]}/tools/`;
  const sourceToolLinks = extractHrefs(sourceHtml).filter((href) => toolLinkLanguage(href));
  const translatedToolLinks = extractHrefs(translatedHtml).filter((href) => toolLinkLanguage(href));
  for (const href of translatedToolLinks) {
    const linkLang = toolLinkLanguage(href);
    if (linkLang === 'zh') {
      errors.push(`工具内链缺少目标语言前缀：${href}（应为 ${expectedPrefix}…）`);
    } else if (linkLang !== lang) {
      errors.push(`工具内链语言前缀错误：${href}（应为 ${expectedPrefix}…）`);
    }
  }
  if (translatedToolLinks.length !== sourceToolLinks.length) {
    errors.push(`工具内链数量 ${translatedToolLinks.length} 与简体源 ${sourceToolLinks.length} 不一致`);
  }

  // 语言比例与正文长度
  const text = stripHtml(translatedHtml);
  const stats = languageScriptStats(text);
  const title = String(translation.title ?? '');
  const description = String(translation.description ?? '');
  const bodyWords = (text.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g) ?? []).length;
  const hanRun = longestHanRun(text);
  Object.assign(metrics, {
    titleLength: [...title].length,
    titleHan: countMatches(title, HAN),
    descriptionLength: [...description].length,
    descriptionHan: countMatches(description, HAN),
    ...translatedStructure,
    toolLinks: translatedToolLinks.length,
    sourceToolLinks: sourceToolLinks.length,
    bodyWords,
    bodyCjk: stats.cjk,
    bodyHangul: stats.hangul,
    bodyKana: stats.kana,
    bodyLatin: stats.latin,
    bodyTotal: stats.total,
    hanRatio: ratio(stats.cjk, stats.total),
    hangulRatio: ratio(stats.hangul, stats.total),
    kanaRatio: ratio(stats.kana, stats.total),
    longestHanRun: hanRun,
  });

  if (requirements.titleMaxChars !== undefined && metrics.titleLength > requirements.titleMaxChars) {
    errors.push(`标题长度 ${metrics.titleLength} 超过 ${requirements.titleMaxChars} 字符`);
  }
  if (requirements.titleMaxHan !== undefined && metrics.titleHan > requirements.titleMaxHan) {
    errors.push(`标题汉字数 ${metrics.titleHan} 超过 ${requirements.titleMaxHan}`);
  }
  if (requirements.descriptionMinHan !== undefined) {
    if (metrics.descriptionHan < requirements.descriptionMinHan || metrics.descriptionHan > requirements.descriptionMaxHan) {
      errors.push(
        `description 汉字数 ${metrics.descriptionHan} 不在 ${requirements.descriptionMinHan}–${requirements.descriptionMaxHan} 之间`,
      );
    }
  }
  if (requirements.descriptionMinChars !== undefined) {
    if (metrics.descriptionLength < requirements.descriptionMinChars || metrics.descriptionLength > requirements.descriptionMaxChars) {
      errors.push(
        `description 长度 ${metrics.descriptionLength} 不在 ${requirements.descriptionMinChars}–${requirements.descriptionMaxChars} 之间`,
      );
    }
  }
  if (requirements.bodyMinWords !== undefined && bodyWords < requirements.bodyMinWords) {
    errors.push(`正文字数 ${bodyWords} 少于 ${requirements.bodyMinWords} 个英文单词`);
  }
  if (requirements.bodyMinHan !== undefined && stats.cjk < requirements.bodyMinHan) {
    errors.push(`正文汉字数 ${stats.cjk} 少于 ${requirements.bodyMinHan}`);
  }
  if (requirements.bodyMinHangul !== undefined && stats.hangul < requirements.bodyMinHangul) {
    errors.push(`正文 Hangul 字符数 ${stats.hangul} 少于 ${requirements.bodyMinHangul}`);
  }
  if (requirements.bodyMinHanKana !== undefined && stats.cjk + stats.kana < requirements.bodyMinHanKana) {
    errors.push(`正文汉字 + 假名数 ${stats.cjk + stats.kana} 少于 ${requirements.bodyMinHanKana}`);
  }
  if (requirements.maxHanRatio !== undefined && metrics.hanRatio >= requirements.maxHanRatio) {
    errors.push(
      `正文 Han 字符占比 ${(metrics.hanRatio * 100).toFixed(2)}% 超过 ${(requirements.maxHanRatio * 100).toFixed(2)}%`,
    );
  }
  if (requirements.minHangulRatio !== undefined && metrics.hangulRatio < requirements.minHangulRatio) {
    errors.push(
      `正文 Hangul 占比 ${(metrics.hangulRatio * 100).toFixed(2)}% 低于 ${(requirements.minHangulRatio * 100).toFixed(2)}%`,
    );
  }
  if (requirements.minKanaRatio !== undefined && metrics.kanaRatio < requirements.minKanaRatio) {
    errors.push(
      `正文假名占比 ${(metrics.kanaRatio * 100).toFixed(2)}% 低于 ${(requirements.minKanaRatio * 100).toFixed(2)}%`,
    );
  }
  if (requirements.maxHanRun !== undefined && hanRun > requirements.maxHanRun) {
    errors.push(`正文出现 ${hanRun} 个连续汉字，疑似未翻译中文段落`);
  }

  // 元数据与占位符
  checkMeta(translation, zhGuide, lang, errors);
  const serialized = JSON.stringify(translation);
  if (serialized.includes('[[figure:')) errors.push('含未替换的 [[figure: 占位符');
  if (serialized.includes('待补全')) errors.push('含“待补全”占位文本');
  const emoji = serialized.match(EMOJI) ?? [];
  if (emoji.length > 0) errors.push(`含 emoji：${[...new Set(emoji)].join(' ')}`);

  metrics.reviewerConfidence = translation?._meta?.translation?.reviewerConfidence ?? 0;
  metrics.translatedAt = translation?._meta?.translation?.translatedAt ?? null;
  metrics.ok = errors.length === 0;
  return { errors, warnings, metrics };
}
