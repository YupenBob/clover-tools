import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  canonicalUrl, parseSitemap, liveSitemap, request, indexNowBatches,
  searchConsoleProperty, googleAssertion, submitGoogle, GOOGLE_TOKEN_URL, SEARCH_CONSOLE_SCOPE,
} from '../lib/search-submission.mjs';

const origin = 'https://clovertools.cn';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const credentials = { type: 'service_account', client_email: 'indexing@fixture.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const dependency = fetchImpl => ({ fetchImpl, sleep: async () => {} });

test('live locations reject foreign origins, credentials, tracking parameters and noindex languages', () => {
  assert.equal(canonicalUrl(origin + '/tools/fun/avatar-generator/', origin), origin + '/tools/fun/avatar-generator/');
  for (const value of ['https://clovertools.cn.attacker.test/', 'https://user:password@clovertools.cn/', origin + '/?tracking=1', origin + '/#fragment', origin + '/en/tools/fun/avatar-generator/', origin + '/404/'])
    assert.throws(() => canonicalUrl(value, origin));
  assert.equal(canonicalUrl(origin + '/en/', origin), origin + '/en/');
});

test('sitemap parser handles declarations, CDATA, numeric entities and duplicate canonical locations', () => {
  const result = parseSitemap(`\uFEFF<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc><![CDATA[${origin}/]]></loc></url><url><loc>${origin}/</loc></url><url><loc>${origin}/guides/example&#47;</loc></url></urlset>`, origin);
  assert.deepEqual(result, { index: false, urls: [origin + '/', origin + '/guides/example/'] });
});

test('sitemap errors cannot silently become empty or off-site submissions', () => {
  for (const xml of ['<html>challenge</html>', '<urlset></urlset>', '<!DOCTYPE urlset><urlset/>', '<urlset><loc>https://attacker.test/</loc></urlset>', `<urlset><loc>${origin}/&#0;</loc></urlset>`, `<urlset><loc>${origin}/&unknown;</loc></urlset>`])
    assert.throws(() => parseSitemap(xml, origin));
});

test('live sitemap traverses nested indexes, removes duplicates and stops cyclic indexes', async () => {
  const documents = {
    '/sitemap-index.xml': `<sitemapindex><sitemap><loc>${origin}/nested.xml</loc></sitemap></sitemapindex>`,
    '/nested.xml': `<sitemapindex><sitemap><loc>${origin}/sitemap-index.xml</loc></sitemap><sitemap><loc>${origin}/pages.xml</loc></sitemap></sitemapindex>`,
    '/pages.xml': `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/</loc></url></urlset>`,
  };
  const visited = [];
  const site = await liveSitemap(origin, dependency(async url => {
    visited.push(url);
    return new Response(documents[new URL(url).pathname]);
  }));
  assert.deepEqual(site.urls, [origin + '/']);
  assert.equal(visited.length, 3);
});

test('live sitemap refuses excessive nesting without submitting partial URLs', async () => {
  await assert.rejects(liveSitemap(origin, dependency(async url => {
    const path = new URL(url).pathname;
    const next = path === '/sitemap-index.xml' ? 1 : Number(path.match(/\d+/)[0]) + 1;
    return new Response(`<sitemapindex><sitemap><loc>${origin}/index-${next}.xml</loc></sitemap></sitemapindex>`);
  })), /nesting/);
});

test('retry respects throttling, bounds Retry-After and never follows redirects', async () => {
  const sleeps = []; let attempts = 0;
  const result = await request('https://api.indexnow.org/indexnow', {}, {
    fetchImpl: async (_, options) => {
      assert.equal(options.redirect, 'error');
      return ++attempts === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '9999' } }) : new Response('', { status: 200 });
    }, sleep: async ms => sleeps.push(ms),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(sleeps, [30000]);
});

test('authentication failures are not retried and their response bodies are not logged', async () => {
  let attempts = 0;
  await assert.rejects(request(GOOGLE_TOKEN_URL, {}, dependency(async () => {
    attempts++;
    return new Response('sensitive diagnostic', { status: 403 });
  })), error => error.message === 'Search submission returned HTTP 403');
  assert.equal(attempts, 1);
});

test('temporary errors retry but terminal network failures do not reveal exception data', async () => {
  let attempts = 0;
  await request('https://api.indexnow.org/indexnow', {}, dependency(async () => ++attempts < 3 ? new Response('', { status: 503 }) : new Response('ok')));
  assert.equal(attempts, 3);
  await assert.rejects(request(GOOGLE_TOKEN_URL, {}, dependency(async () => { throw new Error('private token in provider exception'); })), error => error.message === 'Search submission request failed or timed out');
});

test('IndexNow batches respect the 10000 URL limit and public ownership location', () => {
  const urls = Array.from({ length: 10001 }, (_, i) => `${origin}/guides/fixture-${i}/`);
  const result = indexNowBatches(origin, '0123456789abcdef', [...urls, urls[0]]);
  assert.deepEqual(result.map(batch => batch.urlList.length), [10000, 1]);
  assert.equal(result[0].host, 'clovertools.cn');
  assert.equal(result[0].keyLocation, origin + '/0123456789abcdef.txt');
  assert.throws(() => indexNowBatches(origin, 'invalid/', urls));
  assert.throws(() => indexNowBatches(origin, '0123456789abcdef', []));
});

test('Search Console accepts the verified domain or exact root URL-prefix property only', () => {
  assert.equal(searchConsoleProperty(origin), 'sc-domain:clovertools.cn');
  assert.equal(searchConsoleProperty(origin, origin), origin + '/');
  assert.equal(searchConsoleProperty(origin, origin + '/'), origin + '/');
  assert.equal(searchConsoleProperty('https://www.clovertools.cn', 'sc-domain:clovertools.cn'), 'sc-domain:clovertools.cn');
  for (const value of ['sc-domain:attacker.test', 'sc-domain:clovertools.cn/path', 'https://clovertools.cn.attacker.test/', origin + '/tools/', origin + '/?x=1'])
    assert.throws(() => searchConsoleProperty(origin, value));
});

test('service-account JWT uses a valid RSA signature, fixed Google audience and one-hour scope', () => {
  const jwt = googleAssertion({ ...credentials, token_uri: 'https://attacker.test/token' }, 1700000000);
  const [header, claims, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { iss: credentials.client_email, scope: SEARCH_CONSOLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: 1700000000, exp: 1700003600 });
  assert.equal(verify('RSA-SHA256', Buffer.from(header + '.' + claims), publicKey, Buffer.from(signature, 'base64url')), true);
});

test('invalid credentials fail without exposing private-key content', () => {
  for (const input of [{}, { ...credentials, type: 'authorized_user' }, { ...credentials, client_email: 'user@attacker.test' }, { ...credentials, private_key: 'sensitive invalid key' }])
    assert.throws(() => googleAssertion(input), error => !error.message.includes('sensitive invalid key'));
});

test('Google submits encoded sitemap via authenticated PUT rather than an unsupported ping API', async () => {
  const calls = [];
  const result = await submitGoogle(credentials, { origin, sitemap: origin + '/sitemap-index.xml', urls: [origin + '/'] }, undefined, dependency(async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ access_token: 'fixture-token', token_type: 'Bearer' }) : new Response(null, { status: 204 });
  }));
  assert.equal(calls[0].url, GOOGLE_TOKEN_URL);
  assert.equal(new URLSearchParams(calls[0].options.body).get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(calls[1].url, 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aclovertools.cn/sitemaps/https%3A%2F%2Fclovertools.cn%2Fsitemap-index.xml');
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fixture-token');
  assert.equal(result.httpStatus, 204);
  assert.ok(!JSON.stringify(result).includes('fixture-token'));
});

test('Google rejects foreign sitemaps and unusable OAuth responses', async () => {
  await assert.rejects(submitGoogle(credentials, { origin, sitemap: 'https://attacker.test/sitemap.xml', urls: [] }, undefined), /configured origin/);
  await assert.rejects(submitGoogle(credentials, { origin, sitemap: origin + '/sitemap-index.xml', urls: [origin + '/'] }, undefined, dependency(async () => Response.json({ token_type: 'Bearer' }))), /usable access token/);
});
