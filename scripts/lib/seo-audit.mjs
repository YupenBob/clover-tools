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
import {
  attributes,
  decodeEntities,
  pagePath,
  htmlTags,
} from './artifacts.mjs';

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

  const langs = alternateLanguages(path);
  const expected = Object.fromEntries(
    langs.map((locale) => [
      LOCALES[locale].htmlLang,
      siteUrl + localizedPath(path, locale),
    ]),
  );
  if (langs.length)
    expected['x-default'] =
      siteUrl + localizedPath(path, langs.includes('zh') ? 'zh' : langs[0]);
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

  const blocks = [...content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => attributes(m[1]).type === 'application/ld+json')
    .flatMap((m) => {
      try {
        const parsed = JSON.parse(m[2]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        problems.push('JSON-LD 解析失败');
        return [];
      }
    });
  const types = blocks.map((block) => block?.['@type']);
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
    const list = blocks.find((block) => block?.['@type'] === 'ItemList');
    const count = (content.match(/class="tool-card"/g) ?? []).length;
    if (!list || list.numberOfItems !== count)
      problems.push('ItemList 工具数量与卡片不一致');
  } else if (base === '/') {
    for (const type of ['WebSite', 'Organization'])
      if (!types.includes(type)) problems.push(`缺少 ${type} JSON-LD`);
    const website = blocks.find((block) => block?.['@type'] === 'WebSite');
    if (website?.potentialAction?.['@type'] !== 'SearchAction')
      problems.push('WebSite 缺少 SearchAction');
  } else if (/^\/guides\/[^/]+\/$/.test(base)) {
    if (!types.includes('Article') || !types.includes('BreadcrumbList'))
      problems.push('指南缺少 Article / BreadcrumbList JSON-LD');
    const article = blocks.find((block) => block?.['@type'] === 'Article');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(article?.dateModified ?? '') ||
      article?.mainEntityOfPage !== canonical
    )
      problems.push('指南日期或 mainEntityOfPage 无效');
    if (!content.includes('class="article-sources"'))
      problems.push('指南缺少参考来源');
  }
  return problems.map((problem) => `${file}: ${problem}`);
}
