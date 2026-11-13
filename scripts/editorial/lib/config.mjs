/** 流水线配置：默认值 + 本地覆盖（.editorial/config.json）。 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { STATE_PATHS } from './paths.mjs';

export const DEFAULT_CONFIG = {
  /** 槽位所在时区与时刻（24h，两位小时） */
  timezone: 'Asia/Shanghai',
  slots: ['06', '12', '18'],
  maxArticlesPerSlot: 1,
  maxArticlesPerDay: 3,

  /** push-main：通过 PAT 推送 main（默认，用户决定）；local-commit：只本地提交；review-branch：推分支并开 PR */
  publishMode: 'push-main',
  dryRun: false,

  quality: {
    minCjk: 1500,
    targetCjkMin: 1800,
    maxCjk: 6000,
    minH2: 5,
    minParagraphs: 5,
    minSources: 2,
    minInternalToolLinks: 2,
    minEvidenceClaims: 5,
    minReviewerConfidence: 0.7,
    maxSimilarity: 0.2,
    maxCsdnSimilarity: 0.25,
    maxTitleSimilarity: 0.6,
    minReadingMinutes: 2,
    maxDescriptionCjk: 120,
    minDescriptionCjk: 40,
    /** 简体中文指南的 SEO meta description 长度（Unicode 码点，Bing 建议 150–160）。 */
    seoDescriptionMinChars: 150,
    seoDescriptionMaxChars: 160,
    maxTitleCjk: 40,
    maxFirstParagraphCjk: 120,
  },

  /** 多语言：新增自动文章必须同时产出这些语言的译文（2026-11-06 决策，旧文章不回填） */
  translation: {
    languages: ['tw', 'en', 'ko', 'ja'],
    requireAll: true,
  },

  caps: {
    maxDraftAttempts: 2,
    maxWebFetches: 40,
    maxMinutesPerTick: 45,
    consecutiveFailuresToPause: 2,
    throttleWindow: 6,
    throttleReviewPassRate: 0.8,
  },

  git: {
    branch: 'main',
    remote: 'origin',
    authorName: 'CloverTools Content Bot',
    authorEmail: 'content-bot@clovertools.cn',
    /** 流水线只允许改这些路径；前缀以 / 结尾表示目录 */
    allowedPaths: [
      'data/editorial-guides/',
      'src/lib/guides-auto.ts',
      'src/lib/guides-translated.ts',
      'public/article-images/',
      'public/article-assets/',
      'scripts/editorial/cases/',
    ],
    /** 人工复核后可随流水线一起推送的引导提交（sha 列表，通常用于初始化） */
    approvedCommits: [],
  },

  capture: {
    enabled: true,
    /** 工作区内安装的 Playwright 浏览器目录（.gitignore 已忽略） */
    browsersPath: '.playwright-browsers',
    devServerPort: 4399,
    baseUrl: 'http://127.0.0.1:4399',
    viewport: { width: 1280, height: 1000 },
  },

  /** 任务配比：每 3 篇≈2 新 + 1 升级 */
  taskMix: { 'new-guide': 2, 'upgrade-guide': 1 },

  /** 允许的新文章分类（与现有指南分类一致；不在列表内会被门禁拒绝） */
  contentCategories: [
    '开发实用',
    '日常实用',
    '趣味工具',
    '接口排错',
    '手作与图像',
    '日常排查',
    '专注与练习',
    '媒体处理',
    '写作与文档',
  ],
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] =
      current && typeof current === 'object' && !Array.isArray(current) && value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(current, value)
        : value;
  }
  return out;
}

/** 流水线固定生成物：即使本地 .editorial/config.json 覆盖了 allowedPaths，也必须允许。 */
const PIPELINE_ARTIFACT_PATHS = ['src/lib/guides-translated.ts'];

function withPipelineArtifacts(config) {
  if (!config.git || !Array.isArray(config.git.allowedPaths)) return config;
  config.git.allowedPaths = [...new Set([...config.git.allowedPaths, ...PIPELINE_ARTIFACT_PATHS])];
  return config;
}

export function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(STATE_PATHS.config, 'utf8'));
    return withPipelineArtifacts(deepMerge(structuredClone(DEFAULT_CONFIG), raw));
  } catch {
    return withPipelineArtifacts(structuredClone(DEFAULT_CONFIG));
  }
}

export function saveConfig(config) {
  mkdirSync(dirname(STATE_PATHS.config), { recursive: true });
  const tmp = `${STATE_PATHS.config}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(tmp, STATE_PATHS.config);
}

export function ensureDefaultConfig() {
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(STATE_PATHS.config, 'utf8'));
  } catch {
    existing = null;
  }
  if (!existing) {
    saveConfig(DEFAULT_CONFIG);
    return { created: true, config: DEFAULT_CONFIG };
  }
  return { created: false, config: loadConfig() };
}
