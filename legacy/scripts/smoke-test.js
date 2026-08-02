#!/usr/bin/env node
/**
 * Smoke test for clovertools.cn
 * Tests key pages, exits non-zero on failure.
 * Feishu push handled by caller (cron isolated mode with delivery).
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
  const output = { date: new Date().toISOString(), total: results.length, ok: ok.length, fail: fail.length };
  console.log(JSON.stringify(output, null, 2));

  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  if (fail.length === 0) {
    console.log(`🍀 CloverTools 冒烟测试 ${time}`);
    console.log(`✅ 全部 ${ok.length}/${results.length} 个页面正常`);
  } else {
    console.error('FAILED PAGES:');
    fail.forEach(f => console.error(`  ${f.path} -> ${f.status} ${f.error || ''}`));
    console.error(`❌ CloverTools 冒烟测试 ${time}`);
    console.error(`⚠️  ${fail.length}/${results.length} 页面异常`);
    process.exit(1);
  }
}

run();