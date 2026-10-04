/** Verify the uploaded commit, custom domain, same-build assets, and real browser interactions. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { root } from './lib/build-config.mjs';
import { runFunToolChecks } from './lib/fun-tool-browser-cases.mjs';
import { LOCALES, localizedPath } from '../config/routes.mjs';
import { hlsCorePath } from '../config/hls.mjs';

const base = new URL(process.env.PUBLIC_SITE_URL || 'https://clovertools.cn').origin;
const dist = join(root, 'dist');
const artifacts = join(root, 'output/production-verification');
const report = { origin: base, commit: process.env.GITHUB_SHA || null, deployment: null, checks: [], success: false };
const slugs = ['perler-beads', 'personality-test', 'avatar-generator'];
const expectedCsp = (await readFile(join(root, 'public/_headers'), 'utf8')).match(/Content-Security-Policy: ([^\r\n]+)/)[1];
const assets = new Set();
await mkdir(artifacts, { recursive: true });

function passed(name) {
  report.checks.push(name);
  console.log(`PASS ${name}`);
}

async function retry(name, action, attempts = 8) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await action(); }
    catch (error) {
      if (attempt === attempts) throw error;
      console.log(`Waiting for ${name} (${attempt}/${attempts})`);
      await delay(5000);
    }
  }
}

async function response(path) {
  const result = await fetch(base + path, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'CloverTools-Release-Verification/1.0' } });
  assert.equal(result.status, 200, `${path}: HTTP ${result.status}`);
  assert.equal(new URL(result.url).origin, base, `${path}: unexpected redirect`);
  return result;
}

async function verifyDeployment() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const commit = process.env.GITHUB_SHA;
  assert.ok(account && token && commit, 'Cloudflare credentials and GITHUB_SHA are required');
  await retry('Cloudflare production deployment', async () => {
    const result = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/pages/projects/clovertools/deployments?env=production`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
    });
    assert.equal(result.status, 200, `Cloudflare deployment lookup: HTTP ${result.status}`);
    const data = await result.json();
    assert.equal(data.success, true, 'Cloudflare deployment lookup failed');
    const deployment = data.result.find(item => item.environment === 'production' && item.deployment_trigger?.metadata?.commit_hash === commit);
    assert.ok(deployment, 'Uploaded production commit is not yet listed');
    assert.equal(deployment.deployment_trigger.metadata.branch, 'main');
    assert.equal(deployment.latest_stage.status, 'success', 'Production deployment is not successful');
    report.deployment = { id: deployment.id, url: deployment.url, branch: 'main', commit, status: 'success' };
  });
  passed('Cloudflare production deployment matches this main commit');
}

async function verifyPage(path) {
  await retry(path, async () => {
    const result = await response(path);
    const text = await result.text();
    assert.equal(result.headers.get('content-security-policy'), expectedCsp, `${path}: production CSP`);
    assert.ok(text.includes(`href="${base + path}"`), `${path}: canonical origin`);
    const file = join(dist, path, 'index.html');
    const local = await readFile(file, 'utf8');
    const localScripts = [...local.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)"/g)].map(match => match[1]);
    for (const asset of localScripts) assert.ok(text.includes(asset), `${path}: not the uploaded build`);
    for (const match of local.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css|woff2|svg))"/g)) assets.add(match[1]);
  });
  passed(`custom-domain page ${path}`);
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

async function verifyAssets() {
  for (const folder of [hlsCorePath(), '/fps/audio']) {
    for (const file of await files(join(dist, folder))) assets.add('/' + file.slice(dist.length + 1).replaceAll('\\', '/'));
  }
  const pending = [...assets];
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const path = pending.shift();
      await retry(path, async () => {
        const [remote, local] = await Promise.all([response(path), readFile(join(dist, path))]);
        assert.equal(sha256(Buffer.from(await remote.arrayBuffer())), sha256(local), `${path}: asset differs from this build`);
      });
      passed(`matching asset ${path}`);
    }
  }));
}

async function verifyDiscovery() {
  const localSitemap = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
  await retry('sitemap', async () => {
    const text = await (await response('/sitemap-0.xml')).text();
    assert.equal(text, localSitemap, 'sitemap does not match this build');
    for (const slug of slugs) assert.ok(text.includes(`${base}/tools/fun/${slug}/`), `sitemap missing ${slug}`);
  });
  passed('production sitemap matches this build');
  for (const locale of Object.keys(LOCALES)) {
    const path = localizedPath('/search-index.json', locale);
    await retry(path, async () => {
      const [result, local] = await Promise.all([response(path), readFile(join(dist, path), 'utf8')]);
      const data = await result.json();
      assert.deepEqual(data, JSON.parse(local), `${path}: search index differs from this build`);
      for (const slug of slugs) assert.ok(data.some(item => item.slug === slug), `${path}: missing ${slug}`);
    });
    passed(`production discovery ${locale}`);
  }
  const result = await response('/api/ip');
  const data = await result.json();
  assert.ok(data.ip && [4, 6].includes(data.version), 'Pages Function returned invalid data');
  assert.equal(result.headers.get('cache-control'), 'no-store');
  passed('Pages Function /api/ip (visitor values omitted)');
}

async function verifyBrowser() {
  const proxy = process.env.TEST_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    proxy: proxy ? { server: proxy, bypass: 'localhost,127.0.0.1' } : undefined,
    headless: true,
  });
  async function run(name, options, action) {
    const context = await browser.newContext({ locale: 'zh-CN', ...options });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await action(page, context);
      assert.deepEqual(errors, [], 'unexpected production browser errors');
      passed(`production browser: ${name}`);
    } catch (error) {
      await page.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  async function remember(context, lang) {
    await context.addInitScript(value => localStorage.setItem('clover-lang', value), lang);
  }
  try { await runFunToolChecks({ run, remember, base, artifacts }); }
  finally { await browser.close(); }
}

try {
  await verifyDeployment();
  for (const locale of Object.keys(LOCALES)) {
    await verifyPage(localizedPath('/', locale));
    for (const slug of slugs) await verifyPage(localizedPath(`/tools/fun/${slug}/`, locale));
  }
  await verifyPage('/tools/fun/');
  await verifyDiscovery();
  await verifyAssets();
  await verifyBrowser();
  report.success = true;
  console.log(`Production verification passed: ${report.checks.length} checks`);
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
