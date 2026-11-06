/** 工具页的可用语言、hreflang 与语言切换链接（数据源：data/i18n-tool-pages.json）。 */
import manifest from '../../data/i18n-tool-pages.json' with { type: 'json' };
import { LOCALES } from '../../config/routes.mjs';
import { SITE } from './site';
import type { Lang } from './i18n';
import type { ToolCategory } from './tools';

type ToolLang = 'zh' | 'tw' | 'en' | 'ko' | 'ja';

interface ManifestShape {
  tools?: Record<string, { category: ToolCategory; langs: ToolLang[] }>;
}

const toolsManifest = (manifest as ManifestShape).tools ?? {};
const LANGS: ToolLang[] = ['zh', 'tw', 'en', 'ko', 'ja'];

export function getToolLanguages(slug: string): ToolLang[] {
  const entry = toolsManifest[slug];
  if (!entry) return ['zh'];
  return LANGS.filter((lang) => entry.langs.includes(lang));
}

function prefixOf(lang: ToolLang): string {
  return LOCALES[lang]?.prefix ?? '';
}

export function toolPath(category: ToolCategory, slug: string, lang: ToolLang): string {
  return `${prefixOf(lang)}/tools/${category}/${slug}/`;
}

export function toolAlternates(category: ToolCategory, slug: string): { locale: Lang; href: string }[] {
  return getToolLanguages(slug).map((lang) => ({
    locale: lang as Lang,
    href: `${SITE.url}${toolPath(category, slug, lang)}`,
  }));
}

export function toolLanguageLinks(category: ToolCategory, slug: string): { locale: Lang; href: string }[] {
  return getToolLanguages(slug).map((lang) => ({
    locale: lang as Lang,
    href: toolPath(category, slug, lang),
  }));
}

export function toolDefaultHref(category: ToolCategory, slug: string): string {
  return `${SITE.url}${toolPath(category, slug, 'zh')}`;
}
