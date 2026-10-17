/** Read-only, narrowly scoped diagnostics; never edits DNS or redirect settings. */
export async function inspectCloudflareRouting({ token, zoneId, domain, request = fetch }) {
  const report = { domain, checkedAt: new Date().toISOString(), changed: false };
  async function get(path) {
    try {
      const response = await request(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || data.success !== true) return { verified: false, httpStatus: response.status, codes: (data.errors || []).map(error => error.code) };
      return { verified: true, result: data.result };
    } catch { return { verified: false, error: 'Routing metadata could not be read' }; }
  }
  const [dns, https] = await Promise.all([get(`/dns_records?name=${encodeURIComponent('www.' + domain)}`), get('/settings/always_use_https')]);
  report.wwwDns = dns.verified ? { verified: true, records: dns.result.filter(record => ['A', 'AAAA', 'CNAME'].includes(record.type)).map(record => ({ name: record.name, type: record.type, content: record.content, proxied: record.proxied })) } : dns;
  report.alwaysUseHttps = https.verified ? { verified: true, value: https.result.value } : https;
  return report;
}
