import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TRANSLATION_REQUIREMENTS,
  languageScriptStats,
  scanTranslationFiles,
  validateTranslationStatic,
} from '../lib/guide-i18n-audit.mjs';

const EN_WORDS = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'.split(' ');
const EN_FILLER = Array.from(
  { length: 1000 },
  (_, index) => EN_WORDS[index % EN_WORDS.length],
).join(' ');

const sourceGuide = {
  slug: 'json-formatting-validation',
  title: 'JSON 格式化与校验：从报错定位到可读输出',
  description:
    '了解 JSON 格式化、语法校验和压缩的区别，用一套稳定流程定位逗号、引号和数据类型问题。',
  content:
    '<p>JSON 对语法要求严格，排查时先确认文本是标准 JSON，再观察格式化后的层级。</p>' +
    '<h2>格式化、校验和压缩分别做什么</h2><p>格式化只改变空格和换行，校验检查语法，压缩移除空白。</p>' +
    '<h2>推荐的排查顺序</h2><p>先记录错误行号，再检查前一个字段，最后对照接口文档。</p>' +
    '<p><a href="/tools/dev/json-formatter/">打开 JSON 格式化工具</a>验证结果。</p>',
  faqs: [
    { q: '为什么接口返回能看懂，但 JSON.parse 失败？', a: '可能是 HTML 错误页、尾部逗号或 BOM。' },
    { q: '压缩后的 JSON 更安全吗？', a: '不会，压缩只移除空白。' },
  ],
  sources: [
    { title: 'RFC 8259：JSON 数据交换格式', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
    { title: 'MDN JSON', url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON' },
  ],
  published: '2026-09-30',
  updated: '2026-09-30',
  readingMinutes: 2,
  category: '开发实用',
  toolSlug: 'json-formatter',
  _meta: { auto: false },
};

function validEnglishTranslation() {
  return {
    slug: 'json-formatting-validation',
    title: 'JSON formatting and validation: a practical workflow',
    description:
      'Learn how JSON formatting, syntax validation, and minification differ, and follow a stable workflow to find comma, quote, and data type mistakes.',
    content:
      `<p>${EN_FILLER}</p>` +
      '<h2>What formatting, validation, and minification do</h2>' +
      '<p>Formatting changes whitespace, validation checks syntax, and minification removes unnecessary spaces.</p>' +
      '<h2>Recommended troubleshooting order</h2>' +
      '<p>Record the failing line, inspect the previous field, then compare the payload with the API contract.</p>' +
      '<p><a href="/en/tools/dev/json-formatter/">Open the JSON formatter</a> to verify the result.</p>',
    faqs: [
      { q: 'Why does a response look fine but JSON.parse fails?', a: 'It may be an HTML error page, a trailing comma, or a byte order mark.' },
      { q: 'Is minified JSON safer?', a: 'No. Minification only removes whitespace.' },
    ],
    sources: [
      { title: 'RFC 8259: JSON data interchange format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
      { title: 'MDN JSON', url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON' },
    ],
    published: '2026-09-30',
    updated: '2026-09-30',
    readingMinutes: 2,
    category: '开发实用',
    toolSlug: 'json-formatter',
    _meta: {
      auto: false,
      translation: {
        of: 'json-formatting-validation',
        lang: 'en',
        translatedFrom: 'a'.repeat(64),
        translatedAt: '2026-11-06T00:00:00.000Z',
        reviewerVerdict: 'pass',
        reviewerConfidence: 0.9,
      },
    },
  };
}

function errorsAfter(mutate) {
  const translation = structuredClone(validEnglishTranslation());
  mutate(translation);
  return validateTranslationStatic(translation, sourceGuide, 'en').errors.join('\n');
}

test('languageScriptStats 分别统计汉字、Hangul、假名与拉丁字母', () => {
  assert.deepEqual(languageScriptStats('中文测试'), {
    cjk: 4,
    hangul: 0,
    kana: 0,
    latin: 0,
    total: 4,
  });
  const english = languageScriptStats('Hello world');
  assert.equal(english.latin, 10);
  assert.equal(english.total, 10);

  const korean = languageScriptStats('안녕하세요');
  assert.equal(korean.hangul, 5);
  assert.equal(korean.total, 5);

  const japanese = languageScriptStats('こんにちは世界');
  assert.deepEqual(
    { cjk: japanese.cjk, kana: japanese.kana },
    { cjk: 2, kana: 5 },
  );
  assert.equal(japanese.total, 7);

  const mixed = languageScriptStats('中文 English 한국어 かな');
  assert.equal(mixed.cjk, 2);
  assert.equal(mixed.latin, 7);
  assert.equal(mixed.hangul, 3);
  assert.equal(mixed.kana, 2);
  assert.equal(mixed.total, mixed.cjk + mixed.hangul + mixed.kana + mixed.latin);
});

test('合法的英文译文通过结构、内链、长度与元数据检查', () => {
  const result = validateTranslationStatic(
    validEnglishTranslation(),
    sourceGuide,
    'en',
  );
  assert.deepEqual(result.errors, []);
  assert.ok(result.metrics.bodyWords >= TRANSLATION_REQUIREMENTS.en.bodyMinWords);
  assert.ok(result.metrics.bodyTotal > 1500);
  assert.equal(result.metrics.toolLinks, 1);
  assert.equal(result.metrics.sourceToolLinks, 1);
  assert.equal(result.metrics.h2, 2);
  assert.equal(result.metrics.hanRatio, 0);
});

test('sources URL 集合不一致时报错', () => {
  const errors = errorsAfter((translation) => {
    translation.sources[0].url = 'https://example.com/another-source';
  });
  assert.match(errors, /sources URL 集合/);
});

test('工具内链使用简体路径时报错', () => {
  const errors = errorsAfter((translation) => {
    translation.content = translation.content.replace(
      '/en/tools/',
      '/tools/',
    );
  });
  assert.match(errors, /内链缺少目标语言前缀/);
});

test('英文正文残留大段中文时报错', () => {
  const errors = errorsAfter((translation) => {
    translation.content += `<p>${'这是一段没有翻译的中文内容，'.repeat(20)}</p>`;
  });
  assert.match(errors, /Han 字符占比|连续汉字/);
});

test('缺少 reviewerVerdict 时报错', () => {
  const errors = errorsAfter((translation) => {
    delete translation._meta.translation.reviewerVerdict;
  });
  assert.match(errors, /reviewerVerdict/);
});

test('scanTranslationFiles 忽略清单、识别非法命名并报告缺失简体源', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clover-guides-'));
  try {
    const demoSource = { ...sourceGuide, slug: 'demo-guide' };
    const demoTranslation = {
      ...validEnglishTranslation(),
      slug: 'demo-guide',
      _meta: {
        ...validEnglishTranslation()._meta,
        translation: {
          ...validEnglishTranslation()._meta.translation,
          of: 'demo-guide',
        },
      },
    };
    writeFileSync(join(dir, 'demo-guide.json'), JSON.stringify(demoSource));
    writeFileSync(join(dir, 'demo-guide.en.json'), JSON.stringify(demoTranslation));
    writeFileSync(join(dir, 'translations.json'), '{"version":1}');
    writeFileSync(join(dir, 'missing.ja.json'), '{}');
    writeFileSync(join(dir, 'Bad Name.en.json'), '{}');

    const scan = scanTranslationFiles(dir);
    assert.equal(scan.errors.filter((error) => error.includes('非法文件名')).length, 1);
    assert.equal(scan.errors.filter((error) => error.includes('缺少简体源')).length, 1);
    assert.deepEqual(
      scan.translations.map((entry) => `${entry.slug}.${entry.lang}`),
      ['demo-guide.en'],
    );
    assert.equal(scan.translations[0].file, join(dir, 'demo-guide.en.json'));
    assert.equal(scan.translations[0].data.slug, 'demo-guide');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
