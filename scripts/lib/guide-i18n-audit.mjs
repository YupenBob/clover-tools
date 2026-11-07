/**
 * 多语言指南译文的静态检查（纯函数，不联网、不依赖 src）。
 * 供 scripts/check-guides-quality.mjs、scripts/tests/i18n-guides.test.mjs 使用。
 *
 * 约定：`<slug>.json` 是简体中文源；`<slug>.<lang>.json` 是译文，
 * lang ∈ tw/en/ko/ja；`translations.json` 是生成清单，不参与扫描。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { LOCALES } from '../../config/routes.mjs';

/**
 * 少数指南的内容本身就是汉字字形（简繁、异体字、地区用词），译文正文必须保留
 * 字形示例：只对这些 slug 放宽脚本比例上限，其余门槛不变。与
 * scripts/editorial/lib/translate.mjs 的 SLUG_REQUIREMENT_OVERRIDES 保持一致。
 */
export const SLUG_REQUIREMENT_OVERRIDES = {
  jianfan: { en: { maxHanRatio: 0.02 } },
}

export const SOURCE_LANG = 'zh';
export const TRANSLATION_LANGS = ['tw', 'en', 'ko', 'ja'];

/** 各语言阈值集中在这里，测试与文档直接引用，避免魔法数字漂移。 */
export const TRANSLATION_REQUIREMENTS = {
  zh: {
    titleMaxHan: 40,
    descriptionMinHan: 40,
    descriptionMaxHan: 120,
    bodyMinHan: 1500,
    maxHanRatio: null,
    minHangulRatio: null,
    minKanaRatio: null,
    maxHanRun: null,
  },
  tw: {
    titleMaxHan: 40,
    descriptionMinHan: 40,
    descriptionMaxHan: 120,
    bodyMinHan: 1500,
    maxHanRatio: null,
    minHangulRatio: null,
    minKanaRatio: null,
    maxHanRun: null,
  },
  en: {
    titleMaxChars: 66,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinWords: 900,
    maxHanRatio: 0.005,
    minHangulRatio: null,
    minKanaRatio: null,
    maxHanRun: 10,
  },
  ko: {
    titleMaxChars: 66,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinHangul: 1500,
    maxHanRatio: null,
    minHangulRatio: 0.2,
    minKanaRatio: null,
    maxHanRun: 10,
  },
  ja: {
    titleMaxChars: 66,
    descriptionMinChars: 40,
    descriptionMaxChars: 160,
    bodyMinHanKana: 1500,
    maxHanRatio: null,
    minHangulRatio: null,
    minKanaRatio: 0.05,
    maxHanRun: null,
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

const SLUG_PATTERN = '[a-z0-9]+(?:-[a-z0-9]+)*';
const SOURCE_FILE_PATTERN = new RegExp(`^(${SLUG_PATTERN})\\.json$`);
const TRANSLATION_FILE_PATTERN = new RegExp(
  `^(${SLUG_PATTERN})\\.(tw|en|ko|ja)\\.json$`,
);
const HAN = /\p{Script=Han}/gu;
const HANGUL = /\p{Script=Hangul}/gu;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const LATIN = /\p{Script=Latin}/gu;
const HAN_RUN = /\p{Script=Han}+/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function countMatches(text, pattern) {
  return (String(text ?? '').match(pattern) ?? []).length;
}

/** 去掉标签与常见实体，便于统计正文语言比例与长度。 */
function plainText(html) {
  return String(html ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|mdash|ndash|hellip);/g, (match) => ENTITIES[match] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countTag(html, tag) {
  return (String(html ?? '').match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
}

function longestHanRun(text) {
  return (String(text ?? '').match(HAN_RUN) ?? []).reduce(
    (max, run) => Math.max(max, [...run].length),
    0,
  );
}

function extractHrefs(html) {
  const hrefs = [];
  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gis,
  )) {
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

const TOOL_PREFIXES = [
  ['', 'zh'],
  ['/zh-hant', 'tw'],
  ['/en', 'en'],
  ['/ko', 'ko'],
  ['/ja', 'ja'],
];

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

/**
 * 扫描目录中的译文文件。
 * @returns {{ translations: {slug:string, lang:string, file:string, data:object}[], files: object[], errors: string[] }}
 */
export function scanTranslationFiles(dir) {
  const translations = [];
  const errors = [];
  if (!existsSync(dir)) return { translations, files: translations, errors };

  const names = readdirSync(dir).sort();
  const sourceSlugs = new Set(
    names
      .map((name) => name.match(SOURCE_FILE_PATTERN)?.[1])
      .filter(Boolean),
  );
  const seen = new Map();

  for (const name of names) {
    if (!name.endsWith('.json') || name === 'translations.json') continue;
    if (SOURCE_FILE_PATTERN.test(name)) continue;
    const match = name.match(TRANSLATION_FILE_PATTERN);
    if (!match) {
      errors.push(
        `${name}: 非法文件名（应为 <slug>.<tw|en|ko|ja>.json，slug 限小写 kebab-case）`,
      );
      continue;
    }
    const [, slug, lang] = match;
    const key = `${slug}.${lang}`;
    if (seen.has(key)) {
      errors.push(`${name}: 重复的译文（已存在 ${seen.get(key)}）`);
      continue;
    }
    seen.set(key, name);

    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch (error) {
      errors.push(`${name}: 不是合法 JSON（${error.message}）`);
      continue;
    }
    if (!sourceSlugs.has(slug)) {
      errors.push(`${name}: 缺少简体源文件 ${slug}.json`);
      continue;
    }
    if (data?.slug !== undefined && data.slug !== slug) {
      errors.push(`${name}: 内文 slug (${data.slug}) 与文件名不一致`);
    }
    translations.push({ slug, lang, file: join(dir, name), data });
  }
  return { translations, files: translations, errors };
}

/** 统计文本中各类文字字符数；total 仅计文字，不计空白与标点。 */
export function languageScriptStats(text) {
  const value = String(text ?? '');
  const cjk = countMatches(value, HAN);
  const hangul = countMatches(value, HANGUL);
  const kana = countMatches(value, KANA);
  const latin = countMatches(value, LATIN);
  return { cjk, hangul, kana, latin, total: cjk + hangul + kana + latin };
}

function ratio(part, total) {
  return total > 0 ? part / total : 0;
}

function checkMeta(translation, sourceGuide, lang, errors) {
  const meta = translation?._meta?.translation;
  if (!meta || typeof meta !== 'object') {
    errors.push('_meta.translation 缺失');
    return;
  }
  const sourceSlug = sourceGuide?.slug ?? translation?.slug;
  if (meta.of !== sourceSlug) errors.push(`_meta.translation.of 应为 ${sourceSlug}（实际 ${meta.of ?? ''}）`);
  if (meta.lang !== lang) errors.push(`_meta.translation.lang 应为 ${lang}（实际 ${meta.lang ?? ''}）`);
  if (typeof meta.translatedFrom !== 'string' || !/^[0-9a-f]{64}$/i.test(meta.translatedFrom)) {
    errors.push('_meta.translation.translatedFrom 必须是 64 位 hex sha256');
  }
  if (
    typeof meta.translatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(meta.translatedAt) ||
    Number.isNaN(Date.parse(meta.translatedAt))
  ) {
    errors.push('_meta.translation.translatedAt 必须是 ISO 时间');
  }
  if (meta.reviewerVerdict !== 'pass') errors.push('_meta.translation.reviewerVerdict 必须是 pass');
  if (!(typeof meta.reviewerConfidence === 'number' && Number.isFinite(meta.reviewerConfidence) && meta.reviewerConfidence >= 0.7)) {
    errors.push('_meta.translation.reviewerConfidence 必须 ≥0.7');
  }
}

/**
 * 校验一篇译文相对简体源的结构、内链、语言比例与元数据。
 * @returns {{ errors: string[], warnings: string[], metrics: object }}
 */
export function validateTranslationStatic(translation, sourceGuide, lang) {
  const errors = [];
  const warnings = [];
  const metrics = { slug: translation?.slug ?? sourceGuide?.slug ?? null, lang };
  const requirements = {
    ...TRANSLATION_REQUIREMENTS[lang],
    ...(SLUG_REQUIREMENT_OVERRIDES[translation?.slug]?.[lang] ?? {}),
  };

  if (!translation || typeof translation !== 'object') {
    return { errors: ['译文对象无效'], warnings, metrics };
  }
  if (!sourceGuide || typeof sourceGuide !== 'object') {
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
    if (['slug', 'title', 'description', 'content'].includes(field) && !isNonEmptyString(value)) {
      errors.push(`${field} 必须是非空字符串`);
    }
  }
  for (const field of ['slug', 'category', 'toolSlug']) {
    if (translation[field] !== undefined && sourceGuide[field] !== undefined && translation[field] !== sourceGuide[field]) {
      errors.push(`${field} 应与简体源一致（${sourceGuide[field]}）`);
    }
  }
  for (const field of ['published', 'updated', 'readingMinutes']) {
    if (translation[field] !== sourceGuide[field]) {
      errors.push(`${field} 应与简体源完全相同（${sourceGuide[field]}）`);
    }
  }

  // 来源 URL 集合：允许顺序与标题不同
  const sourceUrls = new Set((Array.isArray(sourceGuide.sources) ? sourceGuide.sources : []).map((source) => source?.url).filter(Boolean));
  const translatedUrls = new Set((Array.isArray(translation.sources) ? translation.sources : []).map((source) => source?.url).filter(Boolean));
  if (sourceUrls.size !== translatedUrls.size || [...sourceUrls].some((url) => !translatedUrls.has(url))) {
    errors.push('sources URL 集合与简体源不一致');
  }

  // HTML 结构
  const sourceHtml = String(sourceGuide.content ?? '');
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
  const expectedPrefix = `${LOCALES[lang].prefix}/tools/`;
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
  const text = plainText(translatedHtml);
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

  if (requirements.titleMaxChars !== undefined && [...title].length > requirements.titleMaxChars) {
    errors.push(`标题长度 ${[...title].length} 超过 ${requirements.titleMaxChars} 字符`);
  }
  if (requirements.titleMaxHan !== undefined && metrics.titleHan > requirements.titleMaxHan) {
    errors.push(`标题汉字数 ${metrics.titleHan} 超过 ${requirements.titleMaxHan}`);
  }
  if (requirements.descriptionMinHan !== undefined) {
    if (metrics.descriptionHan < requirements.descriptionMinHan || metrics.descriptionHan > requirements.descriptionMaxHan) {
      errors.push(`description 汉字数 ${metrics.descriptionHan} 不在 ${requirements.descriptionMinHan}–${requirements.descriptionMaxHan} 之间`);
    }
  }
  if (requirements.descriptionMinChars !== undefined) {
    if (metrics.descriptionLength < requirements.descriptionMinChars || metrics.descriptionLength > requirements.descriptionMaxChars) {
      errors.push(`description 长度 ${metrics.descriptionLength} 不在 ${requirements.descriptionMinChars}–${requirements.descriptionMaxChars} 之间`);
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
  if (requirements.maxHanRatio !== null && metrics.hanRatio >= requirements.maxHanRatio) {
    errors.push(`正文 Han 字符占比 ${(metrics.hanRatio * 100).toFixed(2)}% 超过 ${(requirements.maxHanRatio * 100).toFixed(2)}%`);
  }
  if (requirements.minHangulRatio !== null && metrics.hangulRatio < requirements.minHangulRatio) {
    errors.push(`正文 Hangul 占比 ${(metrics.hangulRatio * 100).toFixed(2)}% 低于 ${(requirements.minHangulRatio * 100).toFixed(2)}%`);
  }
  if (requirements.minKanaRatio !== null && metrics.kanaRatio < requirements.minKanaRatio) {
    errors.push(`正文假名占比 ${(metrics.kanaRatio * 100).toFixed(2)}% 低于 ${(requirements.minKanaRatio * 100).toFixed(2)}%`);
  }
  if (requirements.maxHanRun !== null && hanRun > requirements.maxHanRun) {
    errors.push(`正文出现 ${hanRun} 个连续汉字，疑似未翻译中文段落`);
  }

  // 元数据与占位符
  checkMeta(translation, sourceGuide, lang, errors);
  const serialized = JSON.stringify(translation);
  if (serialized.includes('[[figure:')) errors.push('含未替换的 [[figure: 占位符');
  if (serialized.includes('待补全')) errors.push('含“待补全”占位文本');
  const emoji = serialized.match(EMOJI) ?? [];
  if (emoji.length > 0) errors.push(`含 emoji：${[...new Set(emoji)].join(' ')}`);

  return { errors, warnings, metrics };
}

/** 供检查脚本生成汇总行：统计各语言译文数。 */
export function countTranslations(translations) {
  const counts = Object.fromEntries(TRANSLATION_LANGS.map((lang) => [lang, 0]));
  for (const entry of translations) {
    if (counts[entry.lang] !== undefined) counts[entry.lang] += 1;
  }
  return counts;
}

/** 文件名（不含目录），便于错误信息定位。 */
export function translationFileName(entry) {
  return basename(entry?.file ?? '');
}
