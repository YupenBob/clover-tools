/**
 * 交互级审计：填充输入 → 点击主按钮 → 捕获 JS 报错与失败的资源请求。
 * 对高风险的懒加载页面（jianfan/js-formatter/pinyin/json-xml-yaml）单独验证。
 * 用法：node scripts/interaction-audit.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const base = process.argv[2] || 'http://localhost:4321';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.html')) files.push(full);
  }
  return files;
}

const urls = walk(dist)
  .map((f) => {
    let p = f.replace(dist, '').replace(/\\/g, '/');
    if (p.endsWith('/index.html')) p = p.slice(0, -10);
    if (p.endsWith('.html')) p = p.slice(0, -5);
    if (p === '/404') return `${base}/404/`;
    return base + p;
  })
  .sort();

// 需要点击转换/生成按钮的页面
const ACTION_PAGES = new Set([
  '/tools/dev/jianfan/',
  '/tools/dev/js-formatter/',
  '/tools/dev/pinyin/',
  '/tools/dev/json-xml-yaml/',
  '/tools/dev/jsonpath/',
  '/tools/dev/base64/',
  '/tools/dev/url-encode/',
  '/tools/dev/text-transform/',
  '/tools/dev/hash/',
  '/tools/dev/symmetric-encrypt/',
  '/tools/dev/jwt-decoder/',
  '/tools/dev/uuid-generator/',
  '/tools/dev/qrcode/',
  '/tools/daily/timestamp/',
  '/tools/fun/fancy-text/',
]);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];

for (const url of urls) {
  if (url.endsWith('/404/')) continue;
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('/api/')) errors.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on('response', (r) => {
    const path = r.url().replace(base, '');
    // 本地 dev 不提供 Pages Functions，/api/* 404 属预期
    if (r.status() >= 400 && !path.startsWith('/api/')) {
      errors.push(`http ${r.status()}: ${path}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(600);

    // 填充第一个可编辑 textarea（跳过只读输出框），避免污染 URL 等输入框
    const ta = page.locator('textarea:not([readonly])').first();
    if (await ta.count()) {
      await ta.fill('测试数据 test 1234', { timeout: 5000 });
    }

    // 点击第一个主按钮
    const btn = page.locator('.btn-primary').first();
    if (await btn.count()) {
      await btn.click({ force: true, timeout: 10000 });
      await page.waitForTimeout(ACTION_PAGES.has(url.replace(base, '')) ? 2500 : 800);
      // 对重点页面断言：点击后应有非空输出
      if (ACTION_PAGES.has(url.replace(base, ''))) {
        const hasOutput = await page
          .locator('textarea[readonly]')
          .evaluateAll((els) => els.some((el) => el.value.trim() !== ''));
        const statusOk = await page
          .locator('.status-msg.show.success')
          .count();
        if (!hasOutput && statusOk === 0) {
          errors.push('点击主按钮后无输出结果');
        }
      }
    }
  } catch (e) {
    errors.push(`step: ${String(e.message).slice(0, 160)}`);
  }

  results.push({ url: url.replace(base, ''), errors });
  await page.close();
}

await browser.close();

const bad = results.filter((r) => r.errors.length > 0);
for (const r of bad) {
  console.log(`ERROR ${r.url}`);
  r.errors.forEach((e) => console.log(`  ${e}`));
}
if (!bad.length) console.log('全部页面交互无报错');
console.log(`共 ${results.length} 页，${bad.length} 页交互报错`);
process.exit(bad.length ? 1 : 0);
