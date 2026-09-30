import { SITE } from '../lib/site';

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap-index.xml\n`,
    {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  );
}
