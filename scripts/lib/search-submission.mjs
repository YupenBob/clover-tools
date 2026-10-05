import { createPrivateKey, sign } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isIndexablePath } from '../../config/routes.mjs';
import { resolveSiteUrl } from '../../config/site.mjs';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters';

export function canonicalUrl(value, origin, xml = false) {
  const url = new URL(value);
  if (url.origin !== resolveSiteUrl(origin) || url.username || url.password || url.search || url.hash)
    throw new Error('Sitemap URL must belong to the configured origin, without credentials, queries or fragments');
  if (xml ? !url.pathname.endsWith('.xml') : !isIndexablePath(url.pathname))
    throw new Error('Sitemap contains a URL outside the current indexing policy');
  return url.href;
}

function xmlText(value) {
  const cdata = value.trim().match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) return cdata[1].trim();
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const decoded = value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
    const number = entity.toLowerCase().startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!number || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) throw new Error('Invalid XML character reference');
    return String.fromCodePoint(number);
  });
  if (/<|>|&\w+;/.test(decoded)) throw new Error('Invalid sitemap location text');
  return decoded.trim();
}

export function parseSitemap(xml, origin) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Sitemap entity declarations are not supported');
  const root = xml.replace(/^\uFEFF/, '').replace(/^\s*<\?xml[^>]*\?>/, '').trimStart();
  const index = /^<sitemapindex(?:\s|>)/.test(root);
  if (!index && !/^<urlset(?:\s|>)/.test(root)) throw new Error('Response is not a sitemap XML document');
  const urls = [...xml.matchAll(/<loc\s*>([\s\S]*?)<\/loc\s*>/g)].map(match => canonicalUrl(xmlText(match[1]), origin, index));
  if (!urls.length || urls.length > 50000) throw new Error('Sitemap must contain between 1 and 50000 locations');
  return { index, urls: [...new Set(urls)] };
}

export async function request(url, options = {}, { fetchImpl = fetch, sleep = delay, attempts = 3 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
    } catch {
      last = new Error('Search submission request failed or timed out');
    }
    if (response) {
      if (response.ok) return response;
      last = new Error(`Search submission returned HTTP ${response.status}`);
      if (response.status !== 429 && response.status < 500) throw last;
    }
    if (attempt < attempts) {
      const header = response?.headers.get('retry-after');
      const seconds = header && /^\d+$/.test(header) ? Number(header) : 2 ** attempt;
      await sleep(Math.min(30, Math.max(1, seconds)) * 1000);
    }
  }
  throw last;
}

export async function liveSitemap(origin, dependencies = {}) {
  origin = resolveSiteUrl(origin);
  const sitemap = origin + '/sitemap-index.xml';
  const pending = [{ url: sitemap, depth: 0 }];
  const visited = new Set();
  const urls = new Set();
  while (pending.length) {
    const item = pending.shift();
    if (visited.has(item.url)) continue;
    if (item.depth > 4 || visited.size >= 50) throw new Error('Sitemap index nesting exceeds the submission limit');
    visited.add(item.url);
    const response = await request(item.url, { headers: { 'User-Agent': 'CloverTools-Search-Submission/1.0' } }, dependencies);
    const xml = await response.text();
    if (Buffer.byteLength(xml) > 50 * 1048576) throw new Error('Sitemap exceeds 50 MiB');
    const parsed = parseSitemap(xml, origin);
    if (parsed.index) pending.push(...parsed.urls.map(url => ({ url, depth: item.depth + 1 })));
    else for (const url of parsed.urls) urls.add(url);
    if (urls.size > 50000) throw new Error('Combined sitemap exceeds 50000 URLs');
  }
  if (!urls.size) throw new Error('Published sitemap contains no indexable URLs');
  return { origin, sitemap, urls: [...urls] };
}

export function indexNowBatches(origin, key, urls) {
  origin = resolveSiteUrl(origin);
  if (!/^[a-z0-9-]{8,128}$/i.test(key)) throw new Error('Invalid IndexNow key');
  const validated = [...new Set(urls.map(url => canonicalUrl(url, origin)))];
  if (!validated.length) throw new Error('IndexNow submission cannot be empty');
  const batches = [];
  for (let start = 0; start < validated.length; start += 10000) {
    batches.push({ host: new URL(origin).host, key, keyLocation: `${origin}/${key}.txt`, urlList: validated.slice(start, start + 10000) });
  }
  return batches;
}

export function searchConsoleProperty(origin, property) {
  origin = resolveSiteUrl(origin);
  property = property || `sc-domain:${new URL(origin).hostname}`;
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice('sc-domain:'.length);
    const host = new URL(origin).hostname;
    if (!/^[a-z0-9.-]+$/i.test(domain) || !(host === domain || host.endsWith('.' + domain)))
      throw new Error('GSC_SITE_URL domain does not cover the production site');
  } else if (resolveSiteUrl(property) !== origin) {
    throw new Error('GSC_SITE_URL URL-prefix property does not match the production site');
  } else property = origin + '/';
  return property;
}

export function googleAssertion(credentials, now = Math.floor(Date.now() / 1000)) {
  if (credentials?.type !== 'service_account' || typeof credentials.private_key !== 'string' || !/^[^@\s]+@[^@\s]+\.gserviceaccount\.com$/.test(credentials.client_email || ''))
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must contain a Google service-account key');
  let key;
  try { key = createPrivateKey(credentials.private_key); }
  catch { throw new Error('Google service-account private key cannot be read'); }
  if (key.asymmetricKeyType !== 'rsa') throw new Error('Google service-account key must be RSA');
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: credentials.client_email, scope: SEARCH_CONSOLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 })).toString('base64url');
  const input = header + '.' + claims;
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), key).toString('base64url');
}

export async function submitGoogle(credentials, site, property, dependencies = {}) {
  property = searchConsoleProperty(site.origin, property);
  canonicalUrl(site.sitemap, site.origin, true);
  const assertion = googleAssertion(credentials);
  const tokenResponse = await request(GOOGLE_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  }, dependencies);
  const token = await tokenResponse.json();
  if (typeof token.access_token !== 'string' || !token.access_token || token.token_type?.toLowerCase() !== 'bearer')
    throw new Error('Google did not return a usable access token');
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(site.sitemap)}`;
  const response = await request(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${token.access_token}` } }, dependencies);
  return { engine: 'Google Search Console', status: 'submitted', property, sitemap: site.sitemap, urlCount: site.urls.length, httpStatus: response.status };
}

export async function writeReport(root, name, result) {
  const directory = join(root, 'output/search-submission');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name + '.json'), JSON.stringify({ ...result, recordedAt: new Date().toISOString() }, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const message = `### ${result.engine}\n\n状态：${result.status}。${result.urlCount == null ? '' : ` 正式站点 URL：${result.urlCount}。`}\n\n${result.sitemap ? `Sitemap：${result.sitemap}\n\n` : ''}${result.error ? `说明：${result.error}\n\n` : ''}提交被接受不代表页面已收录或获得排名。\n\n`;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, message);
  }
}
