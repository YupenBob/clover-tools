/**
 * IP 地址查询 API（Cloudflare Pages Function）
 * 利用 Cloudflare 边缘提供的连接信息，无需第三方接口。
 */
export const onRequest: any = async (context: any) => {
  const req = context.request;
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const cf = (req as any).cf || {};

  const url = new URL(req.url);
  const queryIp = url.searchParams.get('ip');

  if (queryIp && /^[0-9a-fA-F.:]+$/.test(queryIp)) {
    try {
      const upstream = await fetch(`https://ipapi.co/${queryIp}/json/`, {
        headers: { 'User-Agent': 'CloverTools-IP-Lookup/1.0' },
      });
      const data: any = await upstream.json();
      return new Response(
        JSON.stringify({
          ip: data.ip || queryIp,
          country: data.country_name || null,
          region: data.region || null,
          city: data.city || null,
          timezone: data.timezone || null,
          asn: data.asn ? `AS${data.asn}` : null,
          org: data.org || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
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
    country: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    timezone: cf.timezone || null,
    asn: cf.asn || null,
    colo: cf.colo || null,
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
