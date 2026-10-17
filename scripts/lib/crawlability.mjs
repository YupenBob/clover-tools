import { auditSeoPage } from './seo-audit.mjs';
import { htmlTags, attributes } from './artifacts.mjs';
import { liveSitemap } from './search-submission.mjs';
import { getAllTools, getToolHref } from '../../src/lib/tools.ts';

const ownAgent = 'CloverTools-SEO-Audit/1.0';
export const GOOGLE_AGENT_PROBES = [
  { name: 'Googlebot UA string', value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'Mediapartners-Google UA string', value: 'Mediapartners-Google' },
];

/** No Google credentials or verified Google IPs are used by this public HTTP audit. */
export async function auditCrawlability(origin, { fetchImpl = fetch, sitemap, pageAuditor = auditSeoPage, concurrency = 4, timeoutMs = 15000 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new RangeError('Audit concurrency must be between 1 and 8');
  origin = new URL(origin).origin;
  const deadline = Date.now() + 300000;
  const report = { origin, checkedAt: new Date().toISOString(), source: 'public HTTP', realGoogleIdentity: false, pages: [], agentProbes: [], hostVariants: [], legacyRoutes: [], failures: [], warnings: [] };
  const request = (url, agent = ownAgent) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Audit time budget exceeded');
    return fetchImpl(url, { redirect: 'manual', headers: { 'User-Agent': agent }, signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)) });
  };
  const safeError = error => String(error?.cause?.code || error?.message || error?.name || 'request failure');
  async function each(items, action) {
    const pending = [...items];
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, async () => { while (pending.length) await action(pending.shift()); }));
  }
  async function inspect(url, agent = ownAgent) {
    const result = { url, status: null, problems: [] };
    try {
      const response = await request(url, agent);
      result.status = response.status;
      result.xRobotsTag = response.headers.get('x-robots-tag') || '';
      result.cfMitigated = response.headers.get('cf-mitigated') || '';
      result.location = response.headers.get('location');
      if (response.status !== 200) { result.problems.push(`HTTP ${response.status}`); await response.body?.cancel(); return result; }
      if (/\b(?:noindex|none)\b/i.test(result.xRobotsTag)) result.problems.push('Unexpected X-Robots-Tag index restriction; check agent scope');
      if (result.cfMitigated === 'challenge') result.problems.push('Cloudflare challenge response');
      const content = await response.text();
      const tags = htmlTags(content).filter(tag => /^<(?:meta|link)\b/i.test(tag)).map(attributes);
      const path = new URL(url).pathname;
      result.canonical = tags.find(tag => tag.rel === 'canonical')?.href || null;
      result.robots = tags.filter(tag => ['robots', 'googlebot'].includes(tag.name?.toLowerCase())).map(tag => ({ agent: tag.name, content: tag.content }));
      if (result.robots.some(tag => /\b(?:noindex|none)\b/i.test(tag.content))) result.problems.push('Unexpected meta robots/googlebot index restriction');
      result.problems.push(...pageAuditor(content, path.slice(1) + 'index.html', origin));
    } catch (error) { result.problems.push(safeError(error)); }
    return result;
  }
  try {
    const live = sitemap || await liveSitemap(origin, { fetchImpl });
    report.sitemap = live.sitemap;
    report.sitemapUrls = live.urls.length;
    const response = await request(origin + '/robots.txt');
    report.robots = { status: response.status, text: await response.text() };
    if (response.status !== 200 || !report.robots.text.includes(`Sitemap: ${origin}/sitemap-index.xml`)) report.failures.push('robots.txt is unavailable or does not advertise the canonical sitemap');
    // Current site intentionally serves a simple allow-all file; report unexpected rules for review.
    const directives = report.robots.text.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean);
    if (directives.some(line => /^Disallow\s*:/i.test(line) && line.split(':').slice(1).join(':').trim())) report.warnings.push('robots.txt contains nonempty Disallow rules; review Googlebot-specific matching');
    await each(live.urls, async url => {
      const page = await inspect(url); report.pages.push(page);
      if (page.problems.length) report.failures.push(`${new URL(url).pathname}: ${page.problems.join('; ')}`);
    });
    const samples = ['/', '/tools/dev/json-formatter/', '/guides/fetch-failed-to-fetch/'].filter(path => live.urls.includes(origin + path));
    for (const agent of GOOGLE_AGENT_PROBES) {
      await each(samples, async path => {
        const result = await inspect(origin + path, agent.value);
        report.agentProbes.push({ ...result, agent: agent.name, realGoogleIdentity: false });
        if (result.problems.length) report.failures.push(`${agent.name} ${path}: ${result.problems.join('; ')}`);
      });
    }
    const canonicalHost = new URL(origin).host;
    const variants = [`http://${canonicalHost}`, `https://www.${canonicalHost}`, `http://www.${canonicalHost}`];
    await each(variants.flatMap(host => ['/', '/guides/fetch-failed-to-fetch/?source=seo-audit'].map(path => host + path)), async initial => {
      const variant = { url: initial, hops: [], problems: [] };
      const expected = new URL(initial); expected.host = canonicalHost; expected.protocol = new URL(origin).protocol;
      let current = initial;
      try {
        const seen = new Set();
        for (let step = 0; step < 6; step++) {
          if (seen.has(current)) throw new Error('Redirect loop');
          seen.add(current);
          const response = await request(current);
          const location = response.headers.get('location');
          variant.hops.push({ url: current, status: response.status, ...(location ? { location } : {}) });
          await response.body?.cancel();
          if ([301, 302, 303, 307, 308].includes(response.status) && location) {
            if (![301, 308].includes(response.status)) variant.problems.push('Host canonicalization uses a temporary redirect');
            const next = new URL(location, current);
            if (!['http:', 'https:'].includes(next.protocol) || ![canonicalHost, 'www.' + canonicalHost].includes(next.host) || next.username || next.password) throw new Error('Redirect leaves the authorized site');
            current = next.href;
            if (step === 5) variant.problems.push('Too many redirect hops');
            continue;
          }
          if (response.status !== 200) variant.problems.push(`Final HTTP ${response.status}`);
          if (current !== expected.href) variant.problems.push('Final URL does not preserve canonical host, path and query');
          break;
        }
      } catch (error) { variant.problems.push(error?.message?.startsWith('Redirect') ? error.message : safeError(error)); }
      report.hostVariants.push(variant);
      if (variant.problems.length) report.warnings.push(`${initial}: ${variant.problems.join('; ')}`);
    });
    const routes = getAllTools().flatMap(tool => [tool.legacyPath, ...(tool.legacyAliases || [])].filter(Boolean).map(source => ({ source, target: getToolHref(tool.category, tool.slug) })));
    await each(routes, async route => {
      const result = { ...route, status: null, location: null, problems: [] };
      try {
        const response = await request(origin + route.source); result.status = response.status; result.location = response.headers.get('location');
        await response.body?.cancel();
        if (response.status !== 301 || !result.location || new URL(result.location, origin).href !== origin + route.target) result.problems.push('Legacy path must redirect directly to the equivalent canonical tool');
      } catch (error) { result.problems.push(safeError(error)); }
      report.legacyRoutes.push(result);
      if (result.problems.length) report.failures.push(`${route.source}: ${result.problems.join('; ')}`);
    });
  } catch (error) { report.failures.push(safeError(error)); }
  for (const key of ['pages', 'agentProbes', 'hostVariants', 'legacyRoutes']) report[key].sort((a, b) => (a.url || a.source).localeCompare(b.url || b.source));
  report.status = report.failures.length ? 'failed' : report.warnings.length ? 'needs_attention' : 'passed';
  return report;
}
