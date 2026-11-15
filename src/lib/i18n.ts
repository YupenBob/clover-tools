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
import { relatedScore } from './related-tools';

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
  // Translated tool routes are generated separately. Do not surface a new tool
  // on a localized listing until its metadata and page exist for that language.
  const dictionary = lang === 'en' ? EN : lang === 'ko' ? KO : lang === 'ja' ? JA : null;
  return TOOLS[category]
    .filter((tool) => !dictionary || Boolean(dictionary.tools[tool.slug]))
    .map((tool) => getToolMeta(category, tool.slug, lang));
}

export function getRelated(category: ToolCategory, slug: string, lang: Lang, n = 6): ToolMeta[] {
  return getTools(category, lang)
    .filter((t) => t.slug !== slug)
    .sort((a, b) => relatedScore(slug, b.slug) - relatedScore(slug, a.slug))
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

const HOME_ZH = {
  "homeFeatured": "精选工具",
  "homeFeaturedNote": "从一个具体任务开始，打开就能操作。",
  "homeGuides": "原创指南 · 实战排错",
  "homeGuidesNote": "先看复现与边界，再回到工具验证。每篇均附参考来源。",
  "homeAllGuides": "浏览全部指南",
  "homeDirectory": "全部工具",
  "homeStats": "站点数据",
  "homeMethod": "统计与日期口径",
  "homeToolsLabel": "公开工具",
  "homeGuidesLabel": "原文指南",
  "homeStatsNote": "全站公开工具与简体原文去重计数，译文不重复计入。不展示访问量。",
  "homeDateNote": "更新日期取指南元数据与站点配置的最新日期。",
  "homeRecommendedTools": "按场景选工具",
  "homeRecommendedGuides": "推荐阅读",
  "homeCurated": "人工精选，非热度排名",
  "homeRead": "阅读指南",
  "homeOpenTool": "打开对应工具",
  "homeMinutes": "分钟阅读",
  "homeSourceFallback": "简体中文原文",
  "homeFortune": "今日运势",
  "homeFortuneNote": "仅供娱乐、非预测。按设备本地日期选取，每天一句。",
  "homeFortuneIdle": "启用 JavaScript 后显示今日签语。",
  "homeFortune1": "宜拆小任务：先完成能用一句话说清楚的那一步。",
  "homeFortune2": "宜留个备份：开始修改前，给原文件留一份副本。",
  "homeFortune3": "宜慢读报错：先找第一条错误，再决定改哪里。",
  "homeFortune4": "宜换个视角：把输入缩到最小，试着重现一次。",
  "homeFortune5": "宜收尾：给今天完成的东西起一个好找的名字。",
  "homeFortune6": "宜休息片刻：放下屏幕，给眼睛一点远处的风景。",
  "homeScenarioJson": "接口返回的 JSON 太乱？先校验语法，再展开查看嵌套字段。",
  "homeScenarioTimestamp": "日志时间对不上？对照秒与毫秒，检查对应日期和时区。",
  "homeScenarioDiff": "提交配置前，把修改前后两份文本放在一起核对。",
  "footerMaintainer": "由 YupenBob 独立开发维护的开源项目；源码、变更和问题记录可在 GitHub 核对。",
  "footerRepo": "项目仓库",
  "footerDeveloper": "开发者 GitHub"
};
const HOME_EN = {
  "homeFeatured": "Selected tools",
  "homeFeaturedNote": "Start with a specific task and work directly in your browser.",
  "homeGuides": "Original guides & troubleshooting",
  "homeGuidesNote": "Reproduce the problem, understand the limits, then verify with a tool. References included.",
  "homeAllGuides": "Browse all guides",
  "homeDirectory": "All tools",
  "homeStats": "Site data",
  "homeMethod": "Count & date sources",
  "homeToolsLabel": "Public tools",
  "homeGuidesLabel": "Source guides",
  "homeStatsNote": "Counts public tools and unique Simplified Chinese source guides across the site. Translations count once. No traffic figures.",
  "homeDateNote": "Latest date from guide metadata and site configuration.",
  "homeRecommendedTools": "Tools by task",
  "homeRecommendedGuides": "Recommended reading",
  "homeCurated": "Handpicked, not a popularity ranking",
  "homeRead": "Read guide",
  "homeOpenTool": "Open related tool",
  "homeMinutes": "min read",
  "homeSourceFallback": "Simplified Chinese original",
  "homeFortune": "Today’s fortune",
  "homeFortuneNote": "For entertainment only, not a prediction. One note per device-local calendar day.",
  "homeFortuneIdle": "Enable JavaScript to see today’s note.",
  "homeFortune1": "Break a task down: finish one step you can describe in a sentence.",
  "homeFortune2": "Keep a backup: save a copy before you change the original.",
  "homeFortune3": "Read the error slowly: find the first failure before editing.",
  "homeFortune4": "Try another angle: reduce the input and reproduce the issue.",
  "homeFortune5": "Wrap things up: give today’s work a name you can find again.",
  "homeFortune6": "Take a short break: look away from the screen and into the distance.",
  "homeScenarioJson": "Check messy API JSON for syntax errors and inspect nested fields.",
  "homeScenarioTimestamp": "Compare seconds and milliseconds when log dates or time zones look wrong.",
  "homeScenarioDiff": "Compare the original and revised text before saving a configuration change.",
  "footerMaintainer": "An open-source project independently developed and maintained by YupenBob. Check the code, changes and issues on GitHub.",
  "footerRepo": "Project repository",
  "footerDeveloper": "Developer on GitHub"
};
for (const lang of LANGS) {
  Object.assign(DICT[lang], lang === 'zh' ? HOME_ZH : lang === 'tw'
    ? Object.fromEntries(Object.entries(HOME_ZH).map(([key, value]) => [key, s2t(value)]))
    : HOME_EN);
}
