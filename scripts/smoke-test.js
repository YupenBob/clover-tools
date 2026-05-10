#!/usr/bin/env node
/**
 * Smoke test for clovertools.cn
 * Tests key pages and reports results as JSON.
 */
const https = require('https');

const TEST_URLS = [
  '/',
  '/tools/encrypt/bcrypt.html',
  '/tools/text/regex-replace.html',
  '/tools/text/fan-jian.html',
  '/tools/network/ip-lookup.html',
  '/tools/life/keyboard-test.html',
  '/tools/time/timestamp.html',
  '/blog/ai接口异常怎么处理',
  '/sitemap.xml',
  '/robots.txt',
  '/about',
];

function testUrl(path) {
  return new Promise((resolve) => {
    const req = https.get(`https://clovertools.cn${path}`, {
      headers: { 'User-Agent': 'clovertools-smoke-test/1.0' },
      timeout: 10000,
    }, (res) => {
      resolve({ path, status: res.statusCode, ok: res.statusCode === 200 });
    });
    req.on('error', (e) => resolve({ path, status: 0, ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ path, status: 0, ok: false, error: 'timeout' }); });
  });
}

async function run() {
  const results = await Promise.all(TEST_URLS.map(testUrl));
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const output = {
    date: new Date().toISOString(),
    total: results.length,
    ok: ok.length,
    fail: fail.length,
    results: results,
  };
  console.log(JSON.stringify(output, null, 2));
  if (fail.length > 0) {
    console.error('FAILED PAGES:');
    fail.forEach(f => console.error(`  ${f.path} -> ${f.status} ${f.error || ''}`));
    process.exit(1);
  }
  console.log(`All ${ok.length}/${results.length} pages OK`);
}

run();
