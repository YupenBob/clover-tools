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
    <script type="application/ld+json">[{"@type":"SoftwareApplication"},{"@type":"BreadcrumbList"}]</script>
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

test('single-language content remains available and switching falls back to a real homepage', () => {
  assert.deepEqual(availableLanguages('/guides/json-formatting-validation/'), [
    'zh',
  ]);
  assert.equal(
    switchLanguagePath('/guides/json-formatting-validation/', 'en'),
    '/en/',
  );
  assert.equal(switchLanguagePath('/zh-hant/404/', 'ja'), '/ja/');
  assert.equal(switchLanguagePath('/privacy/', 'tw'), '/zh-hant/privacy/');
});

test('translated tool rollout controls both indexing and alternates through one setting', () => {
  assert.equal(isIndexablePath('/tools/dev/'), true);
  assert.equal(isIndexablePath('/en/tools/dev/'), false);
  assert.equal(isIndexablePath('/404.html'), false);
  assert.equal(isIndexablePath('/en/404/'), false);
  assert.equal(isIndexablePath('/en/guides/'), false);
  assert.deepEqual(alternateLanguages('/en/tools/dev/json-formatter/'), ['zh']);
  ROUTE_POLICY.toolIndexLanguages.push('en');
  try {
    assert.equal(isIndexablePath('/en/tools/dev/json-formatter/'), true);
    assert.deepEqual(alternateLanguages('/tools/dev/'), ['zh', 'en']);
  } finally {
    ROUTE_POLICY.toolIndexLanguages.pop();
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
  const brokenRobots = toolPage('en').replace(
    '<meta name="robots" content="noindex,follow">',
    '',
  );
  assert.ok(
    auditSeoPage(
      brokenRobots,
      'en/tools/dev/json-formatter/index.html',
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
