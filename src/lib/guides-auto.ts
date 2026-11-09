import type { Guide } from './guides.ts';

/**
 * 自动化内容流水线产出的指南。
 * 本文件由 scripts/editorial/build-auto-index.mjs 根据 data/editorial-guides/*.json 生成，
 * 请勿手工编辑；新增文章请运行 `node scripts/editorial/build-auto-index.mjs`。
 */
import guide0 from '../../data/editorial-guides/base64-not-encryption.json' with { type: 'json' };
import guide1 from '../../data/editorial-guides/bmi-reference-not-diagnosis.json' with { type: 'json' };
import guide2 from '../../data/editorial-guides/color-convert.json' with { type: 'json' };
import guide3 from '../../data/editorial-guides/cron-expression-basics.json' with { type: 'json' };
import guide4 from '../../data/editorial-guides/css-formatter.json' with { type: 'json' };
import guide5 from '../../data/editorial-guides/date-difference-rules.json' with { type: 'json' };
import guide6 from '../../data/editorial-guides/hash-vs-encryption.json' with { type: 'json' };
import guide7 from '../../data/editorial-guides/html-formatter.json' with { type: 'json' };
import guide8 from '../../data/editorial-guides/jianfan.json' with { type: 'json' };
import guide9 from '../../data/editorial-guides/js-formatter.json' with { type: 'json' };
import guide10 from '../../data/editorial-guides/json-formatting-validation.json' with { type: 'json' };
import guide11 from '../../data/editorial-guides/json-to-csv-excel.json' with { type: 'json' };
import guide12 from '../../data/editorial-guides/json-xml-yaml.json' with { type: 'json' };
import guide13 from '../../data/editorial-guides/jwt-expiry-and-verification.json' with { type: 'json' };
import guide14 from '../../data/editorial-guides/password-strength.json' with { type: 'json' };
import guide15 from '../../data/editorial-guides/qrcode-safe-publishing.json' with { type: 'json' };
import guide16 from '../../data/editorial-guides/random-number-fairness.json' with { type: 'json' };
import guide17 from '../../data/editorial-guides/regex-debugging-method.json' with { type: 'json' };
import guide18 from '../../data/editorial-guides/strong-password-practices.json' with { type: 'json' };
import guide19 from '../../data/editorial-guides/symmetric-encrypt-params.json' with { type: 'json' };
import guide20 from '../../data/editorial-guides/text-diff-review.json' with { type: 'json' };
import guide21 from '../../data/editorial-guides/text-transform.json' with { type: 'json' };
import guide22 from '../../data/editorial-guides/unit-conversion-precision.json' with { type: 'json' };
import guide23 from '../../data/editorial-guides/unix-timestamp-seconds-milliseconds.json' with { type: 'json' };
import guide24 from '../../data/editorial-guides/url-encoding-guide.json' with { type: 'json' };
import guide25 from '../../data/editorial-guides/url-parse.json' with { type: 'json' };
import guide26 from '../../data/editorial-guides/uuid-generator.json' with { type: 'json' };
import guide27 from '../../data/editorial-guides/xml-formatter.json' with { type: 'json' };

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
];
