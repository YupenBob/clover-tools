import type { Guide } from './guides.ts';

/**
 * 自动化内容流水线产出的指南。
 * 本文件由 scripts/editorial/build-auto-index.mjs 根据 data/editorial-guides/*.json 生成，
 * 请勿手工编辑；新增文章请运行 `node scripts/editorial/build-auto-index.mjs`。
 */
import guide0 from '../../data/editorial-guides/age-calculator.json' with { type: 'json' };
import guide1 from '../../data/editorial-guides/ascii-art.json' with { type: 'json' };
import guide2 from '../../data/editorial-guides/ball-tracker.json' with { type: 'json' };
import guide3 from '../../data/editorial-guides/base64-not-encryption.json' with { type: 'json' };
import guide4 from '../../data/editorial-guides/bcrypt.json' with { type: 'json' };
import guide5 from '../../data/editorial-guides/bmi-reference-not-diagnosis.json' with { type: 'json' };
import guide6 from '../../data/editorial-guides/calculator.json' with { type: 'json' };
import guide7 from '../../data/editorial-guides/calendar.json' with { type: 'json' };
import guide8 from '../../data/editorial-guides/color-convert.json' with { type: 'json' };
import guide9 from '../../data/editorial-guides/cron-expression-basics.json' with { type: 'json' };
import guide10 from '../../data/editorial-guides/css-formatter.json' with { type: 'json' };
import guide11 from '../../data/editorial-guides/date-difference-rules.json' with { type: 'json' };
import guide12 from '../../data/editorial-guides/fuel.json' with { type: 'json' };
import guide13 from '../../data/editorial-guides/hash-vs-encryption.json' with { type: 'json' };
import guide14 from '../../data/editorial-guides/html-formatter.json' with { type: 'json' };
import guide15 from '../../data/editorial-guides/image-to-base64.json' with { type: 'json' };
import guide16 from '../../data/editorial-guides/ip-lookup.json' with { type: 'json' };
import guide17 from '../../data/editorial-guides/jianfan.json' with { type: 'json' };
import guide18 from '../../data/editorial-guides/js-formatter.json' with { type: 'json' };
import guide19 from '../../data/editorial-guides/json-formatting-validation.json' with { type: 'json' };
import guide20 from '../../data/editorial-guides/json-to-csv-excel.json' with { type: 'json' };
import guide21 from '../../data/editorial-guides/json-xml-yaml.json' with { type: 'json' };
import guide22 from '../../data/editorial-guides/jwt-expiry-and-verification.json' with { type: 'json' };
import guide23 from '../../data/editorial-guides/lunar-converter.json' with { type: 'json' };
import guide24 from '../../data/editorial-guides/morse.json' with { type: 'json' };
import guide25 from '../../data/editorial-guides/nickname-text.json' with { type: 'json' };
import guide26 from '../../data/editorial-guides/password-strength.json' with { type: 'json' };
import guide27 from '../../data/editorial-guides/pinyin.json' with { type: 'json' };
import guide28 from '../../data/editorial-guides/qrcode-safe-publishing.json' with { type: 'json' };
import guide29 from '../../data/editorial-guides/random-number-fairness.json' with { type: 'json' };
import guide30 from '../../data/editorial-guides/reaction-test.json' with { type: 'json' };
import guide31 from '../../data/editorial-guides/regex-debugging-method.json' with { type: 'json' };
import guide32 from '../../data/editorial-guides/rmb-uppercase.json' with { type: 'json' };
import guide33 from '../../data/editorial-guides/rsa-encrypt.json' with { type: 'json' };
import guide34 from '../../data/editorial-guides/strong-password-practices.json' with { type: 'json' };
import guide35 from '../../data/editorial-guides/symmetric-encrypt.json' with { type: 'json' };
import guide36 from '../../data/editorial-guides/symmetric-encrypt-params.json' with { type: 'json' };
import guide37 from '../../data/editorial-guides/text-diff-review.json' with { type: 'json' };
import guide38 from '../../data/editorial-guides/text-toolbox.json' with { type: 'json' };
import guide39 from '../../data/editorial-guides/text-transform.json' with { type: 'json' };
import guide40 from '../../data/editorial-guides/time-sync.json' with { type: 'json' };
import guide41 from '../../data/editorial-guides/timer.json' with { type: 'json' };
import guide42 from '../../data/editorial-guides/unicode-converter.json' with { type: 'json' };
import guide43 from '../../data/editorial-guides/unit-conversion-precision.json' with { type: 'json' };
import guide44 from '../../data/editorial-guides/unix-timestamp-seconds-milliseconds.json' with { type: 'json' };
import guide45 from '../../data/editorial-guides/url-encoding-guide.json' with { type: 'json' };
import guide46 from '../../data/editorial-guides/url-parse.json' with { type: 'json' };
import guide47 from '../../data/editorial-guides/uuid-generator.json' with { type: 'json' };
import guide48 from '../../data/editorial-guides/vocab-flash.json' with { type: 'json' };
import guide49 from '../../data/editorial-guides/workday.json' with { type: 'json' };
import guide50 from '../../data/editorial-guides/world-clock.json' with { type: 'json' };
import guide51 from '../../data/editorial-guides/xml-formatter.json' with { type: 'json' };
import guide52 from '../../data/editorial-guides/zodiac.json' with { type: 'json' };

export const AUTO_GUIDES: Guide[] = [
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
];
