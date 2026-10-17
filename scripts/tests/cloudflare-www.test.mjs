import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureWwwCanonical } from '../lib/cloudflare-www.mjs';

const domain = 'clovertools.cn';
function fixture(options = {}) {
  const calls = [], records = options.records || [];
  let ruleset = options.ruleset ? structuredClone(options.ruleset) : null;
  const request = async (url, init) => {
    const parsed = new URL(url), path = parsed.pathname.replace('/client/v4/zones/zone', '');
    const method = init.method, body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body });
    const ok = result => new Response(JSON.stringify({ success: true, result }));
    const error = status => new Response(JSON.stringify({ success: false, errors: [{ code: 10000 }] }), { status });
    if (path === '') return ok({ id: 'zone', name: options.wrongZone ? 'other.example' : domain });
    if (path === '/dns_records' && method === 'GET') return ok(records);
    if (path === '/rulesets/phases/http_request_dynamic_redirect/entrypoint') return ruleset ? ok(ruleset) : error(404);
    if (path === '/rulesets' && method === 'POST') {
      if (options.deniedRule) return error(403);
      ruleset = { ...body, id: 'ruleset', rules: body.rules.map(r => ({ ...r, id: 'new-rule' })) }; return ok(ruleset);
    }
    if (path === '/rulesets/ruleset/rules' && method === 'POST') { ruleset.rules.push({ ...body, id: 'new-rule' }); return ok(ruleset); }
    if (path === '/dns_records' && method === 'POST') {
      if (options.deniedDns) return error(403);
      records.push({ ...body, id: 'new-dns', proxied: !options.badReadback }); return ok(records.at(-1));
    }
    if (path === '/dns_records/new-dns' && method === 'DELETE') { records.length = 0; return ok({ id: 'new-dns' }); }
    if (path === '/rulesets/ruleset/rules/new-rule' && method === 'DELETE') { ruleset.rules = ruleset.rules.filter(r => r.id !== 'new-rule'); return ok(ruleset); }
    throw new Error('Unexpected request ' + method + ' ' + path);
  };
  return { token: 'fixture-token', zoneId: 'zone', domain, request, calls, records, getRules: () => ruleset?.rules || [] };
}

test('www repair verifies zone and preserves all existing DNS, including TXT', async () => {
  const wrong = fixture({ wrongZone: true });
  await assert.rejects(ensureWwwCanonical(wrong), /does not match/);
  assert.ok(wrong.calls.every(c => c.method === 'GET'));
  const existing = fixture({ records: [{ type: 'TXT', name: 'www.' + domain, content: 'verification' }] });
  assert.equal((await ensureWwwCanonical(existing)).status, 'existing-dns-preserved');
  assert.ok(existing.calls.every(c => c.method === 'GET'));
});
test('missing www adds a proxied CNAME and exact-host permanent redirect with path/query retention', async () => {
  const f = fixture(); const report = await ensureWwwCanonical(f);
  assert.equal(report.status, 'configured');
  assert.equal(report.changed, true);
  const rule = f.getRules()[0];
  assert.equal(rule.expression, '(http.host eq "www.clovertools.cn")');
  assert.equal(rule.action_parameters.from_value.status_code, 301);
  assert.equal(rule.action_parameters.from_value.preserve_query_string, true);
  assert.equal(rule.action_parameters.from_value.target_url.expression, 'concat("https://clovertools.cn", http.request.uri.path)');
  assert.equal(f.records[0].content, domain);
  assert.equal(f.records[0].proxied, true);
});
test('www repair appends its rule while preserving existing redirect rules verbatim', async () => {
  const previous = { id: 'keep', expression: '(http.host eq "clovertools.cn")', action: 'redirect', action_parameters: { from_value: { target_url: { value: 'https://clovertools.cn/' }, status_code: 301 } } };
  const f = fixture({ ruleset: { id: 'ruleset', rules: [previous] } });
  await ensureWwwCanonical(f);
  assert.deepEqual(f.getRules()[0], previous);
  assert.ok(!f.calls.some(c => ['PUT', 'PATCH'].includes(c.method)));
});
test('redirect permission failure cannot create www DNS', async () => {
  const f = fixture({ deniedRule: true });
  await assert.rejects(ensureWwwCanonical(f), /HTTP 403/);
  assert.ok(!f.calls.some(c => c.method === 'POST' && c.path === '/dns_records'));
});
test('DNS permission or read-back failure rolls back only newly created resources', async () => {
  for (const option of ['deniedDns', 'badReadback']) {
    const previous = { id: 'keep', ref: 'other-rule' };
    const f = fixture({ [option]: true, ruleset: { id: 'ruleset', rules: [previous] } });
    await assert.rejects(ensureWwwCanonical(f), option === 'deniedDns' ? /HTTP 403/ : /read-back/);
    assert.deepEqual(f.getRules(), [previous]);
    assert.deepEqual(f.records, []);
    assert.ok(f.calls.filter(c => c.method === 'DELETE').every(c => c.path.endsWith('/new-rule') || c.path.endsWith('/new-dns')));
  }
});
