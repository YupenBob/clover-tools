import { LOCALES, languageFromPath, stripLanguage, localizedPath } from '../../config/routes.mjs';
import en from './i18n/en.json';
import ko from './i18n/ko.json';
import ja from './i18n/ja.json';
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
import { TOOL_DETAILS } from './tool-details';

export type Lang = 'zh' | 'tw' | 'en' | 'ko' | 'ja';
export const LANGS = Object.keys(LOCALES) as Lang[];

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
const KO = ko as unknown as EnData;
const JA = ja as unknown as EnData;

export const HTML_LANG = Object.fromEntries(LANGS.map((lang) => [lang, LOCALES[lang].htmlLang])) as Record<Lang, string>;
export const OG_LOCALE = Object.fromEntries(LANGS.map((lang) => [lang, LOCALES[lang].ogLocale])) as Record<Lang, string>;

export function langFromUrl(pathname: string): Lang {
  return languageFromPath(pathname) as Lang;
}

export function stripLang(path: string): string {
  return stripLanguage(path);
}

export function pathForLang(path: string, lang: Lang): string {
  return localizedPath(path, lang);
}

/** 站点级文案（名称 / 标语 / 描述）。 */
export function siteForLang(lang: Lang): { name: string; tagline: string; description: string } {
  if (lang === 'en') {
    return { name: SITE.name, tagline: EN.site.tagline, description: EN.site.description };
  }
  if (lang === 'ko') {
    return { name: SITE.name, tagline: KO.site.tagline, description: KO.site.description };
  }
  if (lang === 'ja') {
    return { name: SITE.name, tagline: JA.site.tagline, description: JA.site.description };
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
  if (lang === 'ko') {
    const koCat = KO.categories[category];
    return { ...base, name: koCat.name, blurb: koCat.blurb };
  }
  if (lang === 'ja') {
    const jaCat = JA.categories[category];
    return { ...base, name: jaCat.name, blurb: jaCat.blurb };
  }
  if (lang === 'tw') {
    return { ...base, name: s2t(base.name), blurb: s2t(base.blurb) };
  }
  return base;
}

export function getCategoryMetas(lang: Lang): CategoryMeta[] {
  return CATEGORIES.map(({ id }) => getCategoryMeta(id, lang));
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
  if (lang === 'ko') {
    const koTool = KO.tools[slug];
    if (koTool) {
      return {
        ...base,
        name: koTool.name,
        oneLiner: koTool.oneLiner,
        description: koTool.description,
        keywords: koTool.keywords,
      };
    }
  }
  if (lang === 'ja') {
    const jaTool = JA.tools[slug];
    if (jaTool) {
      return {
        ...base,
        name: jaTool.name,
        oneLiner: jaTool.oneLiner,
        description: jaTool.description,
        keywords: jaTool.keywords,
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
  if (lang === 'ko') return KO.content[slug];
  if (lang === 'ja') return JA.content[slug];
  if (lang === 'tw') {
    const c = TOOL_CONTENT[slug];
    return c
      ? {
          usage: s2t(c.usage),
          features: c.features.map((f) => ({ icon: f.icon, text: s2t(f.text) })),
          detail: TOOL_DETAILS[slug]
            ? {
                intro: s2t(TOOL_DETAILS[slug].intro),
                steps: TOOL_DETAILS[slug].steps.map(s2t),
                examples: TOOL_DETAILS[slug].examples.map((e) => ({
                  ...e,
                  label: s2t(e.label),
                  input: e.input,
                  output: e.outputFormat === 'code' ? e.output : s2t(e.output),
                })),
                principles: TOOL_DETAILS[slug].principles.map(s2t),
                pitfalls: TOOL_DETAILS[slug].pitfalls.map(s2t),
                faqs: TOOL_DETAILS[slug].faqs.map((f) => ({ q: s2t(f.q), a: s2t(f.a) })),
                privacy: s2t(TOOL_DETAILS[slug].privacy),
              }
            : undefined,
        }
      : undefined;
  }
  const c = TOOL_CONTENT[slug];
  return c
    ? { ...c, detail: TOOL_DETAILS[slug] ?? c.detail }
    : undefined;
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
    guides: '实用指南',
    privacy: '隐私政策',
    terms: '使用条款',
    contact: '联系我们',
    footerTagline: '精选在线工具箱，多数工具本地处理',
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
    guides: '實用指南',
    privacy: '隱私政策',
    terms: '使用條款',
    contact: '聯絡我們',
    footerTagline: '精選線上工具箱，多數工具本地處理',
    updated: '最近更新',
    switchTheme: '切換深色/淺色主題',
    themeTitle: '切換主題',
    switchLang: '切換語言',
    copied: '已複製到剪貼簿',
    copyFailed: '複製失敗',
  },
  ko: {
    useNow: '지금 사용',
    home: '홈',
    related: '관련 도구',
    usageTitle: '사용 방법',
    breadcrumb: '현재 위치',
    about: '소개',
    sitemap: '사이트맵',
    guides: '실용 가이드',
    privacy: '개인정보처리방침',
    terms: '이용약관',
    contact: '문의하기',
    footerTagline: '선별된 온라인 도구 모음 — 대부분의 도구는 로컬에서 처리됩니다',
    updated: '최근 업데이트',
    switchTheme: '다크/라이트 테마 전환',
    themeTitle: '테마 전환',
    switchLang: '언어 전환',
    copied: '클립보드에 복사됨',
    copyFailed: '복사 실패',
  },
  ja: {
    useNow: '今すぐ使う',
    home: 'ホーム',
    related: '関連ツール',
    usageTitle: '使い方',
    breadcrumb: 'パンくずリスト',
    about: '概要',
    sitemap: 'サイトマップ',
    guides: '実用ガイド',
    privacy: 'プライバシー',
    terms: '利用規約',
    contact: 'お問い合わせ',
    footerTagline: '厳選オンラインツールボックス — 多くのツールはローカルで処理',
    updated: '最終更新',
    switchTheme: 'ダーク/ライトテーマ切替',
    themeTitle: 'テーマ切替',
    switchLang: '言語切替',
    copied: 'クリップボードにコピーしました',
    copyFailed: 'コピーに失敗しました',
  },
  en: {
    useNow: 'Use now',
    home: 'Home',
    related: 'Related tools',
    usageTitle: 'How to use',
    breadcrumb: 'Breadcrumb',
    about: 'About',
    sitemap: 'Sitemap',
    guides: 'Practical guides',
    privacy: 'Privacy',
    terms: 'Terms',
    contact: 'Contact',
    footerTagline: 'Curated online toolbox — most tools process data locally',
    updated: 'Updated',
    switchTheme: 'Toggle dark/light theme',
    themeTitle: 'Toggle theme',
    switchLang: 'Switch language',
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed',
  },
};
