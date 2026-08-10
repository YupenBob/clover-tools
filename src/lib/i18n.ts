import en from './i18n/en.json';
import { SITE } from './site';
import {
  CATEGORIES,
  TOOLS,
  type ToolCategory,
  type ToolMeta,
  type CategoryMeta,
} from './tools';
import { TOOL_CONTENT, type ToolContent } from './tool-content';

export type Lang = 'zh' | 'en';
export const LANGS: readonly Lang[] = ['zh', 'en'];

interface EnSite {
  tagline: string;
  description: string;
}

interface EnCategory {
  name: string;
  blurb: string;
}

interface EnTool {
  name: string;
  oneLiner: string;
  description: string;
  keywords: string[];
}

interface EnContent {
  usage: string;
  features: { icon: string; text: string }[];
}

interface EnData {
  site: EnSite;
  categories: Record<ToolCategory, EnCategory>;
  tools: Record<string, EnTool>;
  content: Record<string, EnContent>;
}

const EN = en as unknown as EnData;

export const HTML_LANG: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en',
};

export const OG_LOCALE: Record<Lang, string> = {
  zh: 'zh_CN',
  en: 'en_US',
};

/** 从 URL pathname 推断当前语言：/en 或 /en/... 为英文，其余为中文。 */
export function langFromUrl(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';
}

/** 去掉语言前缀，返回中立路径（/en 或 /en/foo/ -> /foo/）。 */
export function stripLang(path: string): string {
  if (path === '/en') return '/';
  if (path.startsWith('/en/')) return path.slice(3) || '/';
  return path;
}

/** 把中立路径转成指定语言路径。 */
export function pathForLang(path: string, lang: Lang): string {
  const base = stripLang(path);
  return lang === 'zh' ? base : base === '/' ? '/en/' : `/en${base}`;
}

/** 站点级文案（名称 / 标语 / 描述）。 */
export function siteForLang(lang: Lang): { name: string; tagline: string; description: string } {
  return lang === 'en'
    ? { name: SITE.name, tagline: EN.site.tagline, description: EN.site.description }
    : { name: SITE.name, tagline: SITE.tagline, description: SITE.description };
}

export function getCategoryMeta(category: ToolCategory, lang: Lang): CategoryMeta {
  const base = CATEGORIES.find((c) => c.id === category)!;
  if (lang === 'en') {
    const enCat = EN.categories[category];
    return { ...base, name: enCat.name, blurb: enCat.blurb };
  }
  return base;
}

export function getCategoryMetas(lang: Lang): CategoryMeta[] {
  return (['dev', 'daily', 'fun'] as ToolCategory[]).map((id) => getCategoryMeta(id, lang));
}

export function getToolMeta(category: ToolCategory, slug: string, lang: Lang): ToolMeta {
  const base = TOOLS[category].find((t) => t.slug === slug)!;
  if (lang === 'en') {
    const enTool = EN.tools[slug];
    if (enTool) {
      return {
        ...base,
        name: enTool.name,
        oneLiner: enTool.oneLiner,
        description: enTool.description,
        keywords: enTool.keywords,
      };
    }
  }
  return base;
}

export function getTools(category: ToolCategory, lang: Lang): ToolMeta[] {
  return TOOLS[category].map((t) => getToolMeta(category, t.slug, lang));
}

export function getRelated(category: ToolCategory, slug: string, lang: Lang, n = 6): ToolMeta[] {
  return getTools(category, lang)
    .filter((t) => t.slug !== slug)
    .slice(0, n);
}

export function getToolContent(slug: string, lang: Lang): ToolContent | undefined {
  return lang === 'en' ? EN.content[slug] : TOOL_CONTENT[slug];
}

/** 共享 UI 文案。 */
export const DICT: Record<Lang, Record<string, string>> = {
  zh: {
    useNow: '立即使用',
    home: '首页',
    related: '相关工具',
    usageTitle: '使用说明',
    breadcrumb: '面包屑',
    about: '关于',
    sitemap: '站点地图',
    footerTagline: '精选在线工具箱，数据在浏览器本地处理',
    updated: '最近更新',
    switchTheme: '切换深色/浅色主题',
    themeTitle: '切换主题',
    switchLang: '切换语言',
    copied: '已复制到剪贴板',
    copyFailed: '复制失败',
  },
  en: {
    useNow: 'Use now',
    home: 'Home',
    related: 'Related tools',
    usageTitle: 'How to use',
    breadcrumb: 'Breadcrumb',
    about: 'About',
    sitemap: 'Sitemap',
    footerTagline: 'Curated online toolbox — everything runs in your browser',
    updated: 'Updated',
    switchTheme: 'Toggle dark/light theme',
    themeTitle: 'Toggle theme',
    switchLang: 'Switch language',
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed',
  },
};
