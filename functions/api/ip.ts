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
