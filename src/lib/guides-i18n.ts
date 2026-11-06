/** 多语言指南的读取、路径与 hreflang 计算。 */
import { GUIDES, type Guide } from './guides.ts';
import { TRANSLATED_GUIDES, type TranslatedLang } from './guides-translated.ts';
import { SITE } from './site';
import manifest from '../../data/editorial-guides/translations.json' with { type: 'json' };

export type GuideLang = 'zh' | TranslatedLang;
export const GUIDE_LANGS: GuideLang[] = ['zh', 'tw', 'en', 'ko', 'ja'];

/** 公开路径前缀（与 config/routes.mjs 的 LOCALES 保持一致）。 */
export const GUIDE_LANG_PREFIX: Record<GuideLang, string> = {
  zh: '',
  tw: '/zh-hant',
  en: '/en',
  ko: '/ko',
  ja: '/ja',
};

interface ManifestShape {
  slugs?: Record<string, { zh?: boolean; translations?: string[] }>;
}

const manifestSlugs = (manifest as ManifestShape).slugs ?? {};

function manifestEntry(slug: string) {
  return manifestSlugs[slug] ?? null;
}

/** 该文章实际存在的语言版本（简体优先，其次 tw/en/ko/ja）。 */
export function getGuideLanguages(slug: string): GuideLang[] {
  const entry = manifestEntry(slug);
  const zhExists = Boolean(entry?.zh) || GUIDES.some((guide) => guide.slug === slug);
  const langs: GuideLang[] = zhExists ? ['zh'] : [];
  const translations = new Set(entry?.translations ?? []);
  for (const lang of ['tw', 'en', 'ko', 'ja'] as TranslatedLang[]) {
    if (translations.has(lang) || TRANSLATED_GUIDES[lang].some((guide) => guide.slug === slug)) langs.push(lang);
  }
  return langs;
}

export function getGuideForLang(slug: string, lang: GuideLang): Guide | undefined {
  if (lang === 'zh') return GUIDES.find((guide) => guide.slug === slug);
  return TRANSLATED_GUIDES[lang as TranslatedLang].find((guide) => guide.slug === slug);
}

export function getGuidesForLang(lang: GuideLang): Guide[] {
  if (lang === 'zh') return GUIDES;
  return [...TRANSLATED_GUIDES[lang as TranslatedLang]];
}

export function guidePath(slug: string, lang: GuideLang): string {
  return `${GUIDE_LANG_PREFIX[lang]}/guides/${slug}/`;
}

export function guideIndexPath(lang: GuideLang): string {
  return `${GUIDE_LANG_PREFIX[lang]}/guides/`;
}

/** hreflang 用的绝对地址列表（含自身语言）。 */
export function guideAlternates(slug: string): { locale: GuideLang; href: string }[] {
  return getGuideLanguages(slug).map((lang) => ({ locale: lang, href: `${SITE.url}${guidePath(slug, lang)}` }));
}

/** 语言切换器用的相对路径列表。 */
export function guideLanguageLinks(slug: string): { locale: GuideLang; href: string }[] {
  return getGuideLanguages(slug).map((lang) => ({ locale: lang, href: guidePath(slug, lang) }));
}

/** 指南索引页应存在的语言：zh + 至少有一篇译文的语言。 */
export function getGuideIndexLanguages(): GuideLang[] {
  return GUIDE_LANGS.filter((lang) => {
    if (lang === 'zh') return GUIDES.length > 0;
    return TRANSLATED_GUIDES[lang as TranslatedLang].length > 0;
  });
}

/** 指南索引页的 hreflang（绝对地址）。 */
export function guideIndexAlternates(): { locale: GuideLang; href: string }[] {
  return getGuideIndexLanguages().map((lang) => ({ locale: lang, href: `${SITE.url}${guideIndexPath(lang)}` }));
}

/** 指南索引页的语言切换链接（相对路径）。 */
export function guideIndexLanguageLinks(): { locale: GuideLang; href: string }[] {
  return getGuideIndexLanguages().map((lang) => ({ locale: lang, href: guideIndexPath(lang) }));
}

/** 默认语言（x-default）固定为简体中文。 */
export function guideDefaultHref(slug: string): string {
  return `${SITE.url}${guidePath(slug, 'zh')}`;
}
