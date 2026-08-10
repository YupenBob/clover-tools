import en from './i18n/en.json';
// @ts-ignore chinese-s2t 为 CJS 模块，默认导出 { s2t, t2s }
import chineseS2t from 'chinese-s2t';
import { SITE } from './site';
import {
  CATEGORIES,
  TOOLS,
  type ToolCategory,
  type ToolMeta,
  type CategoryMeta,
} from './tools';
import { TOOL_CONTENT, type ToolContent } from './tool-content';

export type Lang = 'zh' | 'tw' | 'en';
export const LANGS: readonly Lang[] = ['zh', 'tw', 'en'];

const { s2t } = chineseS2t as { s2t: (text: string) => string };

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
  tw: 'zh-Hant',
  en: 'en',
};

export const OG_LOCALE: Record<Lang, string> = {
  zh: 'zh_CN',
  tw: 'zh_TW',
  en: 'en_US',
};

/** 从 URL pathname 推断当前语言。 */
export function langFromUrl(pathname: string): Lang {
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  if (pathname === '/zh-hant' || pathname.startsWith('/zh-hant/')) return 'tw';
  return 'zh';
}

/** 去掉语言前缀，返回中立路径。 */
export function stripLang(path: string): string {
  if (path === '/en') return '/';
  if (path.startsWith('/en/')) return path.slice(3) || '/';
  if (path === '/zh-hant') return '/';
  if (path.startsWith('/zh-hant/')) return path.slice(8) || '/';
  return path;
}

/** 把中立路径转成指定语言路径。 */
export function pathForLang(path: string, lang: Lang): string {
  const base = stripLang(path);
  if (lang === 'zh') return base;
  if (lang === 'tw') return base === '/' ? '/zh-hant/' : `/zh-hant${base}`;
  return base === '/' ? '/en/' : `/en${base}`;
}

/** 站点级文案（名称 / 标语 / 描述）。 */
export function siteForLang(lang: Lang): { name: string; tagline: string; description: string } {
  if (lang === 'en') {
    return { name: SITE.name, tagline: EN.site.tagline, description: EN.site.description };
  }
  if (lang === 'tw') {
    return {
      name: SITE.name,
      tagline: s2t(SITE.tagline),
      description: s2t(SITE.description),
    };
  }
  return { name: SITE.name, tagline: SITE.tagline, description: SITE.description };
}

export function getCategoryMeta(category: ToolCategory, lang: Lang): CategoryMeta {
  const base = CATEGORIES.find((c) => c.id === category)!;
  if (lang === 'en') {
    const enCat = EN.categories[category];
    return { ...base, name: enCat.name, blurb: enCat.blurb };
  }
  if (lang === 'tw') {
    return { ...base, name: s2t(base.name), blurb: s2t(base.blurb) };
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
  if (lang === 'tw') {
    return {
      ...base,
      name: s2t(base.name),
      oneLiner: s2t(base.oneLiner),
      description: s2t(base.description),
      keywords: base.keywords.map((k) => s2t(k)),
    };
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
  if (lang === 'en') return EN.content[slug];
  if (lang === 'tw') {
    const c = TOOL_CONTENT[slug];
    return c
      ? {
          usage: s2t(c.usage),
          features: c.features.map((f) => ({ icon: f.icon, text: s2t(f.text) })),
        }
      : undefined;
  }
  return TOOL_CONTENT[slug];
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
  tw: {
    useNow: '立即使用',
    home: '首頁',
    related: '相關工具',
    usageTitle: '使用說明',
    breadcrumb: '麵包屑',
    about: '關於',
    sitemap: '網站地圖',
    footerTagline: '精選線上工具箱，資料在瀏覽器本地處理',
    updated: '最近更新',
    switchTheme: '切換深色/淺色主題',
    themeTitle: '切換主題',
    switchLang: '切換語言',
    copied: '已複製到剪貼簿',
    copyFailed: '複製失敗',
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
