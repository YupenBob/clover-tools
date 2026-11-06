import { readFileSync } from 'node:fs';
import {
  LOCALES,
  languageFromPath,
  stripLanguage,
  localizedPath,
  alternateLanguages,
  isErrorPath,
  isIndexablePath,
} from '../../config/routes.mjs';
import { SEO_LIMITS } from '../../config/quality.mjs';
import { structuredData, auditBreadcrumbs, hasType } from './structured-data.mjs';
import {
  attributes,
  decodeEntities,
  pagePath,
  htmlTags,
} from './artifacts.mjs';

const GUIDE_ARTICLE_PATH = /^\/guides\/([^/]+)\/$/;
const TOOL_ARTICLE_PATH = /^\/tools\/(dev|daily|fun)\/([^/]+)\/$/;
const TOOL_PAGES_FILE = new URL('../../data/i18n-tool-pages.json', import.meta.url);
let toolManifestCache;
function toolManifest() {
  if (toolManifestCache === undefined) {
    try {
      toolManifestCache = JSON.parse(readFileSync(TOOL_PAGES_FILE, 'utf8'))?.tools ?? {};
    } catch {
      toolManifestCache = {};
    }
  }
  return toolManifestCache;
}
const GUIDE_TRANSLATIONS_FILE = new URL(
  '../../data/editorial-guides/translations.json',
  import.meta.url,
);

/** 译文清单是页面 hreflang 的数据源；读取失败时按“只有简体源”处理。 */
let guideManifestCache;
function guideManifest() {
  if (guideManifestCache === undefined) {
    try {
      guideManifestCache =
        JSON.parse(readFileSync(GUIDE_TRANSLATIONS_FILE, 'utf8'))?.slugs ?? {};
    } catch {
      guideManifestCache = {};
    }
  }
  return guideManifestCache;
}

/**
 * 指南文章只有存在译文时才输出对应 hreflang；旧文章（清单无记录）回退为仅有简体。
 * 其他页面继续使用路由策略（现在 /guides/ 列表页对五种语言开放）。
 */
function expectedAlternates(path) {
  const base = stripLanguage(path);
  if (base === '/guides/') {
    // 指南索引页：简体 + 至少有一篇译文的语言（与页面生成逻辑一致）。
    const withTranslation = new Set();
    for (const entry of Object.values(guideManifest())) {
      for (const locale of entry?.translations ?? []) withTranslation.add(locale);
    }
    const langs = ['zh', ...['tw', 'en', 'ko', 'ja'].filter((locale) => withTranslation.has(locale))].filter((locale) => Object.hasOwn(LOCALES, locale));
    return { langs, defaultLang: 'zh' };
  }
  const slug = stripLanguage(path).match(GUIDE_ARTICLE_PATH)?.[1];
  if (slug) {
    const entry = guideManifest()[slug];
    const translations = Array.isArray(entry?.translations)
      ? entry.translations.filter(
          (locale) => locale !== 'zh' && Object.hasOwn(LOCALES, locale),
        )
      : [];
    return { langs: ['zh', ...new Set(translations)], defaultLang: 'zh' };
  }
  const toolSlug = stripLanguage(path).match(TOOL_ARTICLE_PATH)?.[2];
  if (toolSlug && toolManifest()[toolSlug]) {
    const available = toolManifest()[toolSlug].langs ?? ['zh'];
    return { langs: available.filter((locale) => Object.hasOwn(LOCALES, locale)), defaultLang: 'zh' };
  }
  const langs = alternateLanguages(path);
  return { langs, defaultLang: langs.includes('zh') ? 'zh' : langs[0] };
}

export function auditSeoPage(content, file, siteUrl) {
  const problems = [];
  const path = pagePath(file);
  const lang = languageFromPath(path);
  const errorPage = isErrorPath(path);
  const tags = htmlTags(content)
    .filter((tag) => /^<(?:meta|link)\b/.test(tag))
    .map(attributes);
  const meta = (key, value) =>
    tags.find((tag) => tag[key] === value)?.content ?? '';
  const h1s = content.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  if (h1s.length !== 1) problems.push(`h1 数量为 ${h1s.length}（应为 1）`);
  const title = decodeEntities(
    content.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '',
  );
  if (!title || [...title].length > SEO_LIMITS.titleMax)
    problems.push('title 缺失或过长');
  const desc = meta('name', 'description');
  const descMax = SEO_LIMITS.descriptionMax[lang];
  if (
    !desc ||
    (!errorPage &&
      ([...desc].length < SEO_LIMITS.descriptionMin ||
        [...desc].length > descMax))
  ) {
    problems.push(
      `meta description 长度 ${[...desc].length} 超出 ${SEO_LIMITS.descriptionMin}~${descMax}`,
    );
  }
  const canonical = tags.find((tag) => tag.rel === 'canonical')?.href;
  try {
    const url = new URL(canonical);
    if (
      url.origin !== siteUrl ||
      url.search ||
      url.hash ||
      (!errorPage && url.pathname !== path)
    ) {
      problems.push(`canonical 与页面地址不一致（${canonical}）`);
    }
  } catch {
    problems.push(`canonical 缺失或不是有效的绝对地址（${canonical ?? ''}）`);
  }
  const htmlLang = attributes(content.match(/<html\b[^>]*>/)?.[0] ?? '').lang;
  if (htmlLang !== LOCALES[lang].htmlLang)
    problems.push(
      `html lang 应为 ${LOCALES[lang].htmlLang}（实际 ${htmlLang}）`,
    );
  if (meta('property', 'og:locale') !== LOCALES[lang].ogLocale)
    problems.push('og:locale 与页面语言不一致');
  const noindex = meta('name', 'robots')
    .split(/[\s,]+/)
    .includes('noindex');
  if (noindex === isIndexablePath(path))
    problems.push('robots noindex 与共享收录策略不一致');

  const { langs, defaultLang } = expectedAlternates(path);
  const expected = Object.fromEntries(
    langs.map((locale) => [
      LOCALES[locale].htmlLang,
      siteUrl + localizedPath(path, locale),
    ]),
  );
  if (langs.length) expected['x-default'] = siteUrl + localizedPath(path, defaultLang);
  const alternates = tags.filter(
    (tag) => tag.rel === 'alternate' && tag.hreflang,
  );
  if (alternates.length !== Object.keys(expected).length)
    problems.push(`hreflang 数量 ${alternates.length} 与可收录版本不一致`);
  for (const [locale, href] of Object.entries(expected)) {
    if (
      alternates.filter((tag) => tag.hreflang === locale && tag.href === href)
        .length !== 1
    ) {
      problems.push(`hreflang="${locale}" 应指向 ${href}`);
    }
  }

  const data = structuredData(content);
  const blocks = data.nodes;
  problems.push(...data.problems, ...auditBreadcrumbs(blocks, canonical, siteUrl));
  const types = blocks.flatMap((block) => Array.isArray(block?.['@type']) ? block['@type'] : [block?.['@type']]);
  const base = stripLanguage(path);
  if (/^\/tools\/[^/]+\/[^/]+\/$/.test(base)) {
    for (const type of ['SoftwareApplication', 'BreadcrumbList']) {
      if (!types.includes(type)) problems.push(`缺少 ${type} JSON-LD`);
    }
    const usage =
      content.match(
        /<ul\b[^>]*class="usage-features"[^>]*>([\s\S]*?)<\/ul>/,
      )?.[1] ?? '';
    if ((usage.match(/<li\b/g) ?? []).length < SEO_LIMITS.featureMin)
      problems.push('「使用说明」功能要点不足');
    if (!content.includes('class="tool-about"'))
      problems.push('缺少「使用说明」区块');
  } else if (/^\/tools\/[^/]+\/$/.test(base)) {
    const list = blocks.find((block) => hasType(block, 'ItemList'));
    const count = (content.match(/class="tool-card"/g) ?? []).length;
    if (!list || list.numberOfItems !== count)
      problems.push('ItemList 工具数量与卡片不一致');
  } else if (base === '/') {
    for (const type of ['WebSite', 'Organization'])
      if (!types.includes(type)) problems.push(`缺少 ${type} JSON-LD`);
    const website = blocks.find((block) => hasType(block, 'WebSite'));
    if (website?.potentialAction?.['@type'] !== 'SearchAction')
      problems.push('WebSite 缺少 SearchAction');
  } else if (/^\/guides\/[^/]+\/$/.test(base)) {
    if (!types.includes('Article') || !types.includes('BreadcrumbList'))
      problems.push('指南缺少 Article / BreadcrumbList JSON-LD');
    const article = blocks.find((block) => hasType(block, 'Article'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(article?.dateModified ?? ''))
      problems.push('指南 dateModified 格式无效');
    if (article?.mainEntityOfPage !== canonical)
      problems.push('指南 mainEntityOfPage 与 canonical 不一致');
    if (article?.inLanguage !== LOCALES[lang].htmlLang)
      problems.push(
        `指南 inLanguage 应为 ${LOCALES[lang].htmlLang}（实际 ${article?.inLanguage ?? ''}）`,
      );
    if (!content.includes('class="article-sources"'))
      problems.push('指南缺少参考来源');
  }
  return problems.map((problem) => `${file}: ${problem}`);
}
