import { isDeepStrictEqual } from 'node:util';
const phase = 'http_request_dynamic_redirect';
const ref = 'clovertools_www_canonical_v1';

/** Add a missing www entry only. Never replaces existing DNS or redirect rules. */
export async function ensureWwwCanonical({ token, zoneId, domain, request = fetch }) {
  if (!token || !zoneId || domain !== 'clovertools.cn') throw new Error('A verified CloverTools zone and token are required');
  const root = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
  const rule = { ref, description: 'CloverTools www to canonical HTTPS hostname', expression: `(http.host eq "www.${domain}")`, action: 'redirect', action_parameters: { from_value: { status_code: 301, target_url: { expression: `concat("https://${domain}", http.request.uri.path)` }, preserve_query_string: true } }, enabled: true };
  const report = { domain, checkedAt: new Date().toISOString(), changed: false, plan: { dns: { name: 'www.' + domain, type: 'CNAME', content: domain, proxied: true, ttl: 1 }, rule } };
  async function api(path, method = 'GET', body, allowMissing = false) {
    const response = await request(root + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (allowMissing && response.status === 404) return null;
    if (!response.ok || data.success !== true) throw new Error(`Cloudflare ${method} ${path.split('?')[0]} failed (HTTP ${response.status}; codes ${(data.errors || []).map(e => e.code).join(',') || 'unknown'}). No existing DNS or redirect rule is overwritten.`);
    return data.result;
  }
  // Check zone ownership before any write, independently of the calling workflow.
  const zone = await api('');
  if (zone.name !== domain || zone.id !== zoneId) throw new Error('Cloudflare zone does not match clovertools.cn');
  const dnsPath = '/dns_records?name=' + encodeURIComponent('www.' + domain);
  const records = await api(dnsPath);
  if (records.length) return { ...report, status: 'existing-dns-preserved' };
  let ruleset = await api(`/rulesets/phases/${phase}/entrypoint`, 'GET', undefined, true);
  const owned = ruleset?.rules?.find(item => item.ref === ref);
  if (owned && (owned.action !== rule.action || owned.expression !== rule.expression || owned.enabled === false || !isDeepStrictEqual(owned.action_parameters, rule.action_parameters))) throw new Error('Existing managed www rule differs from the reviewed plan; refusing to overwrite');
  let addedRule;
  try {
    if (!owned) {
      if (ruleset) ruleset = await api(`/rulesets/${ruleset.id}/rules`, 'POST', rule);
      else ruleset = await api('/rulesets', 'POST', { name: 'CloverTools canonical hostname', kind: 'zone', phase, rules: [rule] });
      addedRule = ruleset.rules?.find(item => item.ref === ref);
      if (!addedRule?.id) throw new Error('Cloudflare did not return the created www rule');
    }
    // Recheck immediately before creation; a concurrent external change is preserved.
    if ((await api(dnsPath)).length) throw new Error('www DNS changed during review; refusing to add another record');
    const created = await api('/dns_records', 'POST', report.plan.dns);
    report.createdRecordId = created.id;
    report.changed = true;
    const after = await api(dnsPath);
    if (!after.some(item => item.id === created.id && item.type === 'CNAME' && item.content === domain && item.proxied === true)) throw new Error('www DNS read-back does not match the canonical plan');
    const current = await api(`/rulesets/phases/${phase}/entrypoint`);
    if (!current.rules?.some(item => item.ref === ref && item.enabled !== false && item.action === rule.action && item.expression === rule.expression && isDeepStrictEqual(item.action_parameters, rule.action_parameters))) throw new Error('www redirect rule read-back does not match the canonical plan');
    return { ...report, status: 'configured', verifiedAt: new Date().toISOString(), ruleId: (owned || addedRule).id, rulesetId: ruleset.id };
  } catch (error) {
    // Roll back only resources created by this invocation; preserve pre-existing rules.
    const rollbackErrors = [];
    if (report.createdRecordId) try { await api('/dns_records/' + report.createdRecordId, 'DELETE'); } catch { rollbackErrors.push('new www DNS record'); }
    if (addedRule?.id) try { await api(`/rulesets/${ruleset.id}/rules/${addedRule.id}`, 'DELETE'); } catch { rollbackErrors.push('new www redirect rule'); }
    throw new Error(error.message + (rollbackErrors.length ? '; rollback could not remove: ' + rollbackErrors.join(', ') : ''));
  }
}
