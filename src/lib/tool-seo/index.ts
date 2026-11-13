import { DEV_TOOL_SEO } from './dev.ts';
import { DAILY_TOOL_SEO } from './daily.ts';
import { FUN_TOOL_SEO } from './fun.ts';

export type { ToolSeoZh } from './types.ts';

/**
 * 简体中文工具页的 SEO 标题与 meta description 汇总。
 * 只在 `lang === 'zh'` 时由 `ToolLayout` 使用；其它语言继续使用各自的翻译元信息。
 * 由 `scripts/check-seo-metadata.mjs` 校验 slug 覆盖与长度。
 */
export const TOOL_SEO_ZH: Record<string, import('./types.ts').ToolSeoZh> = {
  ...DEV_TOOL_SEO,
  ...DAILY_TOOL_SEO,
  ...FUN_TOOL_SEO,
};
