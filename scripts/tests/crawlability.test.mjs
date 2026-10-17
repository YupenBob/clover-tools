import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCrawlability } from '../lib/crawlability.mjs';
import { getAllTools, getToolHref } from '../../src/lib/tools.ts';

const origin = 'https://site.example';
const sitemap = { sitemap: origin + '/sitemap-index.xml', urls: [origin + '/'] };
const routes = new Map(getAllTools().flatMap(tool => [tool.legacyPath, ...(tool.legacyAliases || [])].filter(Boolean).map(source => [source, getToolHref(tool.category, tool.slug)])));
function fixture(options = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    url = new URL(url); calls.push({ url: url.href, agent: init?.headers?.['User-Agent'] });
    if (url.origin !== origin) {
      if (options.offsite) return new Response(null, { status: 301, headers: { Location: 'https://outside.example/' } });
      const destination = new URL(url); destination.host = 'site.example'; destination.protocol = 'https:';
      if (options.dropQuery) destination.search = '';
      return new Response(null, { status: 301, headers: { Location: destination.href } });
    }
    if (routes.has(url.pathname)) return new Response(null, { status: options.brokenLegacy ? 404 : 301, headers: { Location: routes.get(url.pathname) } });
    if (url.pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`);
    return new Response(`<html><head><link rel="canonical" href="${origin + url.pathname}">${options.metaNoindex ? '<meta name="googlebot" content="noindex">' : ''}</head><body><h1>Test page</h1></body></html>`, { headers: options.headerNoindex ? { 'X-Robots-Tag': 'noindex' } : {} });
  } };
}
test('public audit records header probes separately from real Google identity and preserves host path/query', async () => {
  const f = fixture();
  // Schema rules are tested separately; isolate HTTP behavior in this fixture.
  const report = await auditCrawlability(origin, { ...f, sitemap, pageAuditor: () => [] });
  assert.equal(report.status, 'passed');
  assert.equal(report.pages.length, 1);
  assert.equal(report.legacyRoutes.length, routes.size);
  assert.equal(report.agentProbes.length, 2);
  assert.equal(report.realGoogleIdentity, false);
  assert.ok(report.agentProbes.every(probe => probe.realGoogleIdentity === false));
  assert.ok(f.calls.some(call => call.agent.includes('Mediapartners-Google')));
});
test('index restrictions and broken legacy entries fail the audit without exposing response bodies', async () => {
  for (const option of ['metaNoindex', 'headerNoindex', 'brokenLegacy']) {
    const report = await auditCrawlability(origin, { ...fixture({ [option]: true }), sitemap, pageAuditor: () => [] });
    assert.equal(report.status, 'failed', option);
    assert.ok(report.failures.length);
    assert.ok(report.pages.every(page => !('body' in page)));
  }
});
test('host redirect issues are explicit warnings; unauthorized hosts are never fetched', async () => {
  for (const option of ['offsite', 'dropQuery']) {
    const f = fixture({ [option]: true });
    const report = await auditCrawlability(origin, { ...f, sitemap, pageAuditor: () => [] });
    assert.equal(report.status, 'needs_attention', option);
    assert.ok(report.warnings.length);
    assert.ok(f.calls.every(call => !call.url.includes('outside.example')));
  }
});
