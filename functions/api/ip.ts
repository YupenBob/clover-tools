/**
 * IP 地址查询 API（Cloudflare Pages Function）
 * - 无参数：返回访客 IP 与 Cloudflare 边缘地理信息
 * - ?ip=xxx：IPv4 走 ipapi.co，IPv6 走 ipwho.is（ipapi 不支持 IPv6）
 *   统一输出相同字段，前端无需区分来源
 */

function normalizeIpapi(data: any, queryIp: string) {
  return {
    ip: data.ip || queryIp,
    version: 4,
    country: data.country_name || null,
    countryCode: data.country_code || null,
    region: data.region || null,
    city: data.city || null,
    postal: data.postal || null,
    continent: data.continent_code || null,
    timezone: data.timezone || null,
    utcOffset: data.utc_offset || null,
    asn: data.asn ? `AS${data.asn}` : null,
    org: data.org || null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
  };
}

function normalizeIpwho(data: any, queryIp: string) {
  if (!data || data.success === false) return null;
  const conn = data.connection || {};
  return {
    ip: data.ip || queryIp,
    version: data.version || (queryIp.includes(':') ? 6 : 4),
    country: data.country || null,
    countryCode: data.country_code || null,
    region: data.region || null,
    city: data.city || null,
    postal: data.postal || null,
    continent: data.continent || null,
    timezone: data.timezone || null,
    utcOffset: data.offset || null,
    asn: conn.asn ? `AS${conn.asn}` : null,
    org: conn.org || null,
    isp: conn.isp || null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
  };
}

export const onRequest: any = async (context: any) => {
  const req = context.request;
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const cf: any = (req as any).cf || {};

  const url = new URL(req.url);
  const queryIp = url.searchParams.get('ip');

  if (queryIp && /^[0-9a-fA-F.:]+$/.test(queryIp)) {
    const isV6 = queryIp.includes(':');
    try {
      const upstream = await fetch(
        isV6 ? `https://ipwho.is/${encodeURIComponent(queryIp)}` : `https://ipapi.co/${queryIp}/json/`,
        { headers: { 'User-Agent': 'CloverTools-IP-Lookup/1.0' } },
      );
      const raw: any = await upstream.json();
      const data = isV6 ? normalizeIpwho(raw, queryIp) : normalizeIpapi(raw, queryIp);
      if (!data) throw new Error('empty result');
      return new Response(
        JSON.stringify({
          ...data,
        }, null, 2),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    } catch {
      return new Response(JSON.stringify({ error: '查询上游服务失败' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  }

  const data = {
    ip,
    version: ip.includes(':') ? 6 : 4,
    country: cf.country || null,
    countryCode: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    postal: cf.postalCode || null,
    continent: cf.continent || null,
    timezone: cf.timezone || null,
    asn: cf.asn ? `AS${cf.asn}` : null,
    org: cf.asOrganization || null,
    colo: cf.colo || null,
    latitude: typeof cf.latitude === 'number' ? cf.latitude : null,
    longitude: typeof cf.longitude === 'number' ? cf.longitude : null,
  };

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
