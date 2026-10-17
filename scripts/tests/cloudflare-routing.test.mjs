import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCloudflareRouting } from '../lib/cloudflare-routing.mjs';

test('routing inspection uses GET only and publishes DNS address records without unrelated record content', async () => {
  const methods = [];
  const report = await inspectCloudflareRouting({ token: 'test-token', zoneId: 'zone', domain: 'site.example', request: async (url, options) => {
    methods.push(options.method || 'GET');
    return Response.json({ success: true, result: url.includes('/dns_records') ? [
      { name: 'www.site.example', type: 'CNAME', content: 'site.pages.dev', proxied: true },
      { name: 'www.site.example', type: 'TXT', content: 'unrelated-content' },
    ] : { id: 'always_use_https', value: 'on' } });
  } });
  assert.deepEqual(methods, ['GET', 'GET']);
  assert.equal(report.changed, false);
  assert.equal(report.wwwDns.records.length, 1);
  assert.equal(report.alwaysUseHttps.value, 'on');
  assert.ok(!JSON.stringify(report).includes('unrelated-content'));
});
test('routing read permissions are reported as unverified without changing or failing the bot setting', async () => {
  const report = await inspectCloudflareRouting({ token: 'test-token', zoneId: 'zone', domain: 'site.example', request: async () => Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 }) });
  assert.equal(report.wwwDns.verified, false);
  assert.equal(report.alwaysUseHttps.verified, false);
  assert.equal(report.changed, false);
});
