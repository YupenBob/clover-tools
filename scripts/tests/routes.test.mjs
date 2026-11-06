import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCALES,
  ROUTE_POLICY,
  languageFromPath,
  stripLanguage,
  localizedPath,
  switchLanguagePath,
  availableLanguages,
  alternateLanguages,
  isIndexablePath,
} from '../../config/routes.mjs';
import { resolveSiteUrl } from '../../config/site.mjs';
import { auditSeoPage } from '../lib/seo-audit.mjs';

const origin = 'https://test.example';
function toolPage(lang = 'zh') {
  const path = localizedPath('/tools/dev/json-formatter/', lang);
  return `<html lang="${LOCALES[lang].htmlLang}"><head><title>JSON formatter</title>
    <meta name="description" content="A browser-based JSON formatter with validation, readable output, and configurable indentation.">
    <meta property="og:locale" content="${LOCALES[lang].ogLocale}">
    ${isIndexablePath(path) ? '' : '<meta name="robots" content="noindex,follow">'}
    <link rel="canonical" href="${origin + path}">
    ${alternateLanguages(path)
      .map(
        (locale) =>
          `<link rel="alternate" hreflang="${LOCALES[locale].htmlLang}" href="${origin + localizedPath(path, locale)}">`,
      )
      .join('')}
    <link rel="alternate" hreflang="x-default" href="${origin}/tools/dev/json-formatter/">
    <script type="application/ld+json">[{"@type":"SoftwareApplication"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${origin + localizedPath('/', lang)}"},{"@type":"ListItem","position":2,"name":"Tools","item":"${origin + localizedPath('/tools/dev/', lang)}"},{"@type":"ListItem","position":3,"name":"JSON formatter","item":"${origin + path}"}]}]</script>
    </head><body><h1>JSON formatter</h1><section class="tool-about"><ul class="usage-features"><li>Format</li><li>Validate</li><li>Copy</li></ul></section></body></html>`;
}

test('all locale paths round-trip, including the traditional Chinese public prefix', () => {
  for (const lang of Object.keys(LOCALES)) {
    for (const base of ['/', '/privacy/', '/tools/dev/json-formatter/']) {
      const path = localizedPath(base, lang);
      assert.equal(languageFromPath(path), lang);
      assert.equal(stripLanguage(path), base);
    }
  }
  assert.equal(localizedPath('/privacy/', 'tw'), '/zh-hant/privacy/');
  for (const path of ['/english/', '/knowledge/', '/jargon/'])
    assert.equal(languageFromPath(path), 'zh');
});

test('guides are open to all five languages; missing translations fall back on the page level', () => {
  // 2026-11-06 决策：/guides 对 5 种语言开放；具体某篇是否有译文由页面数据（translations.json）与页面里的显式语言链接决定。
  assert.deepEqual(availableLanguages('/guides/json-formatting-validation/').sort(), ['zh', 'tw', 'ko', 'ja', 'en'].sort());
  assert.equal(
    switchLanguagePath('/guides/json-formatting-validation/', 'en'),
    '/en/guides/json-formatting-validation/',
  );
  assert.equal(switchLanguagePath('/zh-hant/404/', 'ja'), '/ja/');
  assert.equal(switchLanguagePath('/privacy/', 'tw'), '/zh-hant/privacy/');
});

test('all language versions are indexable and the shared route policy still drives indexing', () => {
  for (const path of ['/tools/dev/', '/en/tools/dev/', '/zh-hant/tools/dev/', '/ko/tools/dev/', '/ja/tools/dev/']) {
    assert.equal(isIndexablePath(path), true);
  }
  assert.equal(isIndexablePath('/404.html'), false);
  assert.equal(isIndexablePath('/en/404/'), false);
  assert.equal(isIndexablePath('/en/guides/'), true);
  assert.deepEqual(alternateLanguages('/en/tools/dev/json-formatter/').sort(), ['zh', 'tw', 'ko', 'ja', 'en'].sort());
  const original = [...ROUTE_POLICY.toolIndexLanguages];
  ROUTE_POLICY.toolIndexLanguages = ['zh'];
  try {
    assert.equal(isIndexablePath('/en/tools/dev/json-formatter/'), false);
    assert.deepEqual(alternateLanguages('/tools/dev/'), ['zh']);
  } finally {
    ROUTE_POLICY.toolIndexLanguages = original;
  }
});

test('site origin configuration rejects misleading hosts and non-origin values', () => {
  assert.equal(
    resolveSiteUrl('https://preview.example/'),
    'https://preview.example',
  );
  for (const input of [
    'javascript:alert(1)',
    'https://user:pass@example.com/',
    'https://example.com/subpath/',
    'https://example.com/?x=1',
  ]) {
    assert.throws(() => resolveSiteUrl(input));
  }
});

test('SEO audit covers both root-language and translated tool pages', () => {
  assert.deepEqual(
    auditSeoPage(toolPage(), 'tools/dev/json-formatter/index.html', origin),
    [],
  );
  assert.deepEqual(
    auditSeoPage(
      toolPage('en'),
      'en/tools/dev/json-formatter/index.html',
      origin,
    ),
    [],
  );
  const broken = toolPage().replace('SoftwareApplication', 'WebPage');
  assert.ok(
    auditSeoPage(broken, 'tools/dev/json-formatter/index.html', origin).some(
      (problem) => problem.includes('SoftwareApplication'),
    ),
  );
});

test('quoted angle brackets do not truncate metadata attributes', () => {
  const content = toolPage().replace(
    'A browser-based',
    'JSON->CSV: browser-based',
  );
  assert.deepEqual(
    auditSeoPage(content, 'tools/dev/json-formatter/index.html', origin),
    [],
  );
});

test('malformed and incorrect canonicals produce diagnostics without crashing', () => {
  for (const replacement of [
    'not-a-url',
    origin + '.attacker/tools/dev/json-formatter/',
    origin + '/other/',
  ]) {
    const broken = toolPage().replace(
      `rel="canonical" href="${origin}/tools/dev/json-formatter/"`,
      `rel="canonical" href="${replacement}"`,
    );
    assert.ok(
      auditSeoPage(broken, 'tools/dev/json-formatter/index.html', origin).some(
        (problem) => problem.includes('canonical'),
      ),
    );
  }
});

test('SEO audit rejects noindex disagreement and nonexistent language alternates', () => {
  // 现在所有语言都可收录：给一个可收录页面错误地加上 noindex，应被审计发现。
  const brokenRobots = toolPage().replace(
    '</head>',
    '<meta name="robots" content="noindex,follow"></head>',
  );
  assert.ok(
    auditSeoPage(
      brokenRobots,
      'tools/dev/json-formatter/index.html',
      origin,
    ).some((problem) => problem.includes('noindex')),
  );
  const brokenAlternate = toolPage().replace(
    '</head>',
    '<link rel="alternate" hreflang="en" href="https://test.example/en/tools/dev/json-formatter/"></head>',
  );
  assert.ok(
    auditSeoPage(
      brokenAlternate,
      'tools/dev/json-formatter/index.html',
      origin,
    ).some((problem) => problem.includes('hreflang')),
  );
});
