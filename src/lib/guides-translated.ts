import type { Guide } from './guides.ts';
import guide0 from '../../data/editorial-guides/uuid-generator.tw.json' with { type: 'json' };

/**
 * 多语言指南译文索引（tw / en / ko / ja）。
 * 本文件由 scripts/editorial/build-translation-index.mjs 生成，请勿手工编辑。
 */

export type TranslatedLang = 'tw' | 'en' | 'ko' | 'ja';

export const TRANSLATED_GUIDES: Record<TranslatedLang, Guide[]> = {
  tw: [
    guide0 as unknown as Guide,
  ],
  en: [],
  ko: [],
  ja: [],
};
