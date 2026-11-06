import type { Guide } from './guides.ts';
import guide0 from '../../data/editorial-guides/color-convert.tw.json' with { type: 'json' };
import guide1 from '../../data/editorial-guides/uuid-generator.tw.json' with { type: 'json' };
import guide2 from '../../data/editorial-guides/color-convert.en.json' with { type: 'json' };
import guide3 from '../../data/editorial-guides/color-convert.ko.json' with { type: 'json' };
import guide4 from '../../data/editorial-guides/color-convert.ja.json' with { type: 'json' };

/**
 * 多语言指南译文索引（tw / en / ko / ja）。
 * 本文件由 scripts/editorial/build-translation-index.mjs 生成，请勿手工编辑。
 */

export type TranslatedLang = 'tw' | 'en' | 'ko' | 'ja';

export const TRANSLATED_GUIDES: Record<TranslatedLang, Guide[]> = {
  tw: [
    guide0 as unknown as Guide,
    guide1 as unknown as Guide,
  ],
  en: [
    guide2 as unknown as Guide,
  ],
  ko: [
    guide3 as unknown as Guide,
  ],
  ja: [
    guide4 as unknown as Guide,
  ],
};
