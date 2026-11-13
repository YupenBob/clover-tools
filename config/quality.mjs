/**
 * Editorial thresholds, not search-engine ranking guarantees.
 *
 * 2026-11-13：按 Bing Webmaster Tools 对 clovertools.cn 的 SEO/GEO 报告（标题过短、
 * meta description 过短）收紧简体中文下限；工具页与固定页的目标区间是
 * 标题 50–60 字符、meta description 150–160 字符，见 docs/SEO-BING-REMEDIATION.md。
 * 其它语言的译文本轮维持旧门槛，待各自内容完成同口径整改后再收紧。
 */
export const SEO_LIMITS = {
  /** 每语言 `<title>` 下限。简体中文/英文对齐 Bing 的「少于 20 字符即过短」规则。 */
  titleMin: { zh: 20, tw: 0, ko: 0, ja: 0, en: 20 },
  titleMax: 80,
  /** 每语言 `<meta name="description">` 下限。简体中文按 Bing 建议的目标区间要求 ≥150。 */
  descriptionMin: { zh: 150, tw: 40, ko: 40, ja: 40, en: 40 },
  descriptionMax: { zh: 160, tw: 120, en: 160, ko: 160, ja: 160 },
  featureMin: 3,
};

export const CONTENT_LIMITS = {
  stepsMin: 3,
  examplesMin: 2,
  faqsMin: 2,
};

/** Chromium denies pointer relock briefly after a native Esc exit; this is test pacing, not a game rule. */
export const BROWSER_CHECKS = { pointerUnlockSettleMs: 1500 };
