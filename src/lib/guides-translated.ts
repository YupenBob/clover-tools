import type { Guide } from './guides.ts';
import guide0 from '../../data/editorial-guides/calendar.tw.json' with { type: 'json' };
import guide1 from '../../data/editorial-guides/color-convert.tw.json' with { type: 'json' };
import guide2 from '../../data/editorial-guides/css-formatter.tw.json' with { type: 'json' };
import guide3 from '../../data/editorial-guides/html-formatter.tw.json' with { type: 'json' };
import guide4 from '../../data/editorial-guides/jianfan.tw.json' with { type: 'json' };
import guide5 from '../../data/editorial-guides/js-formatter.tw.json' with { type: 'json' };
import guide6 from '../../data/editorial-guides/json-xml-yaml.tw.json' with { type: 'json' };
import guide7 from '../../data/editorial-guides/lunar-converter.tw.json' with { type: 'json' };
import guide8 from '../../data/editorial-guides/password-strength.tw.json' with { type: 'json' };
import guide9 from '../../data/editorial-guides/symmetric-encrypt-params.tw.json' with { type: 'json' };
import guide10 from '../../data/editorial-guides/text-transform.tw.json' with { type: 'json' };
import guide11 from '../../data/editorial-guides/url-parse.tw.json' with { type: 'json' };
import guide12 from '../../data/editorial-guides/uuid-generator.tw.json' with { type: 'json' };
import guide13 from '../../data/editorial-guides/world-clock.tw.json' with { type: 'json' };
import guide14 from '../../data/editorial-guides/xml-formatter.tw.json' with { type: 'json' };
import guide15 from '../../data/editorial-guides/calendar.en.json' with { type: 'json' };
import guide16 from '../../data/editorial-guides/color-convert.en.json' with { type: 'json' };
import guide17 from '../../data/editorial-guides/css-formatter.en.json' with { type: 'json' };
import guide18 from '../../data/editorial-guides/html-formatter.en.json' with { type: 'json' };
import guide19 from '../../data/editorial-guides/jianfan.en.json' with { type: 'json' };
import guide20 from '../../data/editorial-guides/js-formatter.en.json' with { type: 'json' };
import guide21 from '../../data/editorial-guides/json-xml-yaml.en.json' with { type: 'json' };
import guide22 from '../../data/editorial-guides/lunar-converter.en.json' with { type: 'json' };
import guide23 from '../../data/editorial-guides/password-strength.en.json' with { type: 'json' };
import guide24 from '../../data/editorial-guides/symmetric-encrypt-params.en.json' with { type: 'json' };
import guide25 from '../../data/editorial-guides/text-transform.en.json' with { type: 'json' };
import guide26 from '../../data/editorial-guides/url-parse.en.json' with { type: 'json' };
import guide27 from '../../data/editorial-guides/world-clock.en.json' with { type: 'json' };
import guide28 from '../../data/editorial-guides/xml-formatter.en.json' with { type: 'json' };
import guide29 from '../../data/editorial-guides/calendar.ko.json' with { type: 'json' };
import guide30 from '../../data/editorial-guides/color-convert.ko.json' with { type: 'json' };
import guide31 from '../../data/editorial-guides/css-formatter.ko.json' with { type: 'json' };
import guide32 from '../../data/editorial-guides/html-formatter.ko.json' with { type: 'json' };
import guide33 from '../../data/editorial-guides/jianfan.ko.json' with { type: 'json' };
import guide34 from '../../data/editorial-guides/js-formatter.ko.json' with { type: 'json' };
import guide35 from '../../data/editorial-guides/json-xml-yaml.ko.json' with { type: 'json' };
import guide36 from '../../data/editorial-guides/lunar-converter.ko.json' with { type: 'json' };
import guide37 from '../../data/editorial-guides/password-strength.ko.json' with { type: 'json' };
import guide38 from '../../data/editorial-guides/symmetric-encrypt-params.ko.json' with { type: 'json' };
import guide39 from '../../data/editorial-guides/text-transform.ko.json' with { type: 'json' };
import guide40 from '../../data/editorial-guides/url-parse.ko.json' with { type: 'json' };
import guide41 from '../../data/editorial-guides/world-clock.ko.json' with { type: 'json' };
import guide42 from '../../data/editorial-guides/xml-formatter.ko.json' with { type: 'json' };
import guide43 from '../../data/editorial-guides/calendar.ja.json' with { type: 'json' };
import guide44 from '../../data/editorial-guides/color-convert.ja.json' with { type: 'json' };
import guide45 from '../../data/editorial-guides/css-formatter.ja.json' with { type: 'json' };
import guide46 from '../../data/editorial-guides/html-formatter.ja.json' with { type: 'json' };
import guide47 from '../../data/editorial-guides/jianfan.ja.json' with { type: 'json' };
import guide48 from '../../data/editorial-guides/js-formatter.ja.json' with { type: 'json' };
import guide49 from '../../data/editorial-guides/json-xml-yaml.ja.json' with { type: 'json' };
import guide50 from '../../data/editorial-guides/lunar-converter.ja.json' with { type: 'json' };
import guide51 from '../../data/editorial-guides/password-strength.ja.json' with { type: 'json' };
import guide52 from '../../data/editorial-guides/symmetric-encrypt-params.ja.json' with { type: 'json' };
import guide53 from '../../data/editorial-guides/text-transform.ja.json' with { type: 'json' };
import guide54 from '../../data/editorial-guides/url-parse.ja.json' with { type: 'json' };
import guide55 from '../../data/editorial-guides/world-clock.ja.json' with { type: 'json' };
import guide56 from '../../data/editorial-guides/xml-formatter.ja.json' with { type: 'json' };

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
    guide6 as unknown as Guide,
    guide7 as unknown as Guide,
    guide8 as unknown as Guide,
    guide9 as unknown as Guide,
    guide10 as unknown as Guide,
    guide11 as unknown as Guide,
    guide12 as unknown as Guide,
    guide13 as unknown as Guide,
    guide14 as unknown as Guide,
  ],
  en: [
    guide15 as unknown as Guide,
    guide16 as unknown as Guide,
    guide17 as unknown as Guide,
    guide18 as unknown as Guide,
    guide19 as unknown as Guide,
    guide20 as unknown as Guide,
    guide21 as unknown as Guide,
    guide22 as unknown as Guide,
    guide23 as unknown as Guide,
    guide24 as unknown as Guide,
    guide25 as unknown as Guide,
    guide26 as unknown as Guide,
    guide27 as unknown as Guide,
    guide28 as unknown as Guide,
  ],
  ko: [
    guide29 as unknown as Guide,
    guide30 as unknown as Guide,
    guide31 as unknown as Guide,
    guide32 as unknown as Guide,
    guide33 as unknown as Guide,
    guide34 as unknown as Guide,
    guide35 as unknown as Guide,
    guide36 as unknown as Guide,
    guide37 as unknown as Guide,
    guide38 as unknown as Guide,
    guide39 as unknown as Guide,
    guide40 as unknown as Guide,
    guide41 as unknown as Guide,
    guide42 as unknown as Guide,
  ],
  ja: [
    guide43 as unknown as Guide,
    guide44 as unknown as Guide,
    guide45 as unknown as Guide,
    guide46 as unknown as Guide,
    guide47 as unknown as Guide,
    guide48 as unknown as Guide,
    guide49 as unknown as Guide,
    guide50 as unknown as Guide,
    guide51 as unknown as Guide,
    guide52 as unknown as Guide,
    guide53 as unknown as Guide,
    guide54 as unknown as Guide,
    guide55 as unknown as Guide,
    guide56 as unknown as Guide,
  ],
};
