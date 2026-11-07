import type { Guide } from './guides.ts';
import guide0 from '../../data/editorial-guides/color-convert.tw.json' with { type: 'json' };
import guide1 from '../../data/editorial-guides/jianfan.tw.json' with { type: 'json' };
import guide2 from '../../data/editorial-guides/json-xml-yaml.tw.json' with { type: 'json' };
import guide3 from '../../data/editorial-guides/text-transform.tw.json' with { type: 'json' };
import guide4 from '../../data/editorial-guides/url-parse.tw.json' with { type: 'json' };
import guide5 from '../../data/editorial-guides/uuid-generator.tw.json' with { type: 'json' };
import guide6 from '../../data/editorial-guides/color-convert.en.json' with { type: 'json' };
import guide7 from '../../data/editorial-guides/jianfan.en.json' with { type: 'json' };
import guide8 from '../../data/editorial-guides/json-xml-yaml.en.json' with { type: 'json' };
import guide9 from '../../data/editorial-guides/text-transform.en.json' with { type: 'json' };
import guide10 from '../../data/editorial-guides/url-parse.en.json' with { type: 'json' };
import guide11 from '../../data/editorial-guides/color-convert.ko.json' with { type: 'json' };
import guide12 from '../../data/editorial-guides/jianfan.ko.json' with { type: 'json' };
import guide13 from '../../data/editorial-guides/json-xml-yaml.ko.json' with { type: 'json' };
import guide14 from '../../data/editorial-guides/text-transform.ko.json' with { type: 'json' };
import guide15 from '../../data/editorial-guides/url-parse.ko.json' with { type: 'json' };
import guide16 from '../../data/editorial-guides/color-convert.ja.json' with { type: 'json' };
import guide17 from '../../data/editorial-guides/jianfan.ja.json' with { type: 'json' };
import guide18 from '../../data/editorial-guides/json-xml-yaml.ja.json' with { type: 'json' };
import guide19 from '../../data/editorial-guides/text-transform.ja.json' with { type: 'json' };
import guide20 from '../../data/editorial-guides/url-parse.ja.json' with { type: 'json' };

/**
 * 多语言指南译文索引（tw / en / ko / ja）。
 * 本文件由 scripts/editorial/build-translation-index.mjs 生成，请勿手工编辑。
 */

export type TranslatedLang = 'tw' | 'en' | 'ko' | 'ja';

export const TRANSLATED_GUIDES: Record<TranslatedLang, Guide[]> = {
  tw: [
    guide0 as unknown as Guide,
    guide1 as unknown as Guide,
    guide2 as unknown as Guide,
    guide3 as unknown as Guide,
    guide4 as unknown as Guide,
    guide5 as unknown as Guide,
  ],
  en: [
    guide6 as unknown as Guide,
    guide7 as unknown as Guide,
    guide8 as unknown as Guide,
    guide9 as unknown as Guide,
    guide10 as unknown as Guide,
  ],
  ko: [
    guide11 as unknown as Guide,
    guide12 as unknown as Guide,
    guide13 as unknown as Guide,
    guide14 as unknown as Guide,
    guide15 as unknown as Guide,
  ],
  ja: [
    guide16 as unknown as Guide,
    guide17 as unknown as Guide,
    guide18 as unknown as Guide,
    guide19 as unknown as Guide,
    guide20 as unknown as Guide,
  ],
};
