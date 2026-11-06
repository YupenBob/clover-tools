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
import guide4 from '../../data/editorial-guides/date-difference-rules.json' with { type: 'json' };
import guide5 from '../../data/editorial-guides/hash-vs-encryption.json' with { type: 'json' };
import guide6 from '../../data/editorial-guides/json-formatting-validation.json' with { type: 'json' };
import guide7 from '../../data/editorial-guides/json-to-csv-excel.json' with { type: 'json' };
import guide8 from '../../data/editorial-guides/jwt-expiry-and-verification.json' with { type: 'json' };
import guide9 from '../../data/editorial-guides/qrcode-safe-publishing.json' with { type: 'json' };
import guide10 from '../../data/editorial-guides/random-number-fairness.json' with { type: 'json' };
import guide11 from '../../data/editorial-guides/regex-debugging-method.json' with { type: 'json' };
import guide12 from '../../data/editorial-guides/strong-password-practices.json' with { type: 'json' };
import guide13 from '../../data/editorial-guides/text-diff-review.json' with { type: 'json' };
import guide14 from '../../data/editorial-guides/unit-conversion-precision.json' with { type: 'json' };
import guide15 from '../../data/editorial-guides/unix-timestamp-seconds-milliseconds.json' with { type: 'json' };
import guide16 from '../../data/editorial-guides/url-encoding-guide.json' with { type: 'json' };
import guide17 from '../../data/editorial-guides/uuid-generator.json' with { type: 'json' };

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
];
