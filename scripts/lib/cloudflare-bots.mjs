const writable = new Set(['ai_bots_migration_opt_out', 'ai_bots_protection', 'ai_search', 'ai_training', 'ai_user', 'bot_preference_sync_enabled', 'cf_robots_variant', 'content_bots_protection', 'crawler_protection', 'enable_js', 'fight_mode', 'is_robots_txt_managed', 'jsd_api_results_enabled', 'optimize_wordpress', 'sbfm_definitely_automated', 'sbfm_likely_automated', 'sbfm_static_resource_protection', 'sbfm_verified_bots', 'suppress_session_score']);

export async function ensureBotFightModeOff({ token, accountId, domain, zoneId, request = fetch }) {
  if (!token || !domain) throw new Error('Cloudflare API token and domain are required');
  async function api(path, method = 'GET', body) {
    const response = await request(`https://api.cloudflare.com/client/v4${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok || data.success !== true) {
      const codes = (data.errors || []).map((error) => error.code).join(',');
      throw new Error(`Cloudflare ${method} ${path.split('?')[0]} failed (HTTP ${response.status}, codes ${codes || 'unknown'}). Token requires Zone Read and Bot Management Read; changing the setting additionally requires Bot Management Write.`);
    }
    return data.result;
  }
  if (!zoneId) {
    const query = new URLSearchParams({ name: domain });
    if (accountId) query.set('account.id', accountId);
    const zones = await api(`/zones?${query}`);
    const matches = zones.filter((zone) => zone.name === domain && (!accountId || zone.account?.id === accountId));
    if (matches.length !== 1) throw new Error(`Expected exactly one authorized zone for ${domain}; found ${matches.length}`);
    zoneId = matches[0].id;
  } else {
    const zone = await api(`/zones/${zoneId}`);
    if (zone.name !== domain || (accountId && zone.account?.id !== accountId)) throw new Error('Cloudflare zone does not match the requested domain/account');
  }
  const path = `/zones/${zoneId}/bot_management`;
  const before = await api(path);
  if (typeof before.fight_mode !== 'boolean') throw new Error('Cloudflare did not return a boolean fight_mode; state is unverified');
  let changed = false;
  if (before.fight_mode) {
    const body = Object.fromEntries(Object.entries(before).filter(([key]) => writable.has(key)));
    await api(path, 'PUT', { ...body, fight_mode: false });
    changed = true;
  }
  const after = await api(path);
  if (after.fight_mode !== false) throw new Error('Bot Fight Mode read-back is not false');
  for (const key of writable) {
    if (key !== 'fight_mode' && key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Unrelated Cloudflare setting changed: ${key}`);
  }
  return { domain, zoneId, verifiedAt: new Date().toISOString(), changed, before: before.fight_mode, after: after.fight_mode, verifiedBots: after.sbfm_verified_bots ?? null, staleFightMode: after.stale_zone_configuration?.fight_mode ?? null };
}
