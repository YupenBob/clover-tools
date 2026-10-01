/** Editorial thresholds, not search-engine ranking guarantees. */
export const SEO_LIMITS = {
  titleMax: 80,
  descriptionMin: 40,
  descriptionMax: { zh: 120, tw: 120, en: 160, ko: 160, ja: 160 },
  featureMin: 3,
};

export const CONTENT_LIMITS = {
  stepsMin: 3,
  examplesMin: 2,
  faqsMin: 2,
};

/** Chromium denies pointer relock briefly after a native Esc exit; this is test pacing, not a game rule. */
export const BROWSER_CHECKS = { pointerUnlockSettleMs: 1500 };
