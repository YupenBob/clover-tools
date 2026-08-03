/**
 * 运行时审计：用系统 Edge（headless）逐个加载所有页面，捕获 JS 报错。
 * 前提：本地预览服务已运行（默认 http://localhost:4321）。
 * 用法：node scripts/runtime-audit.mjs [baseUrl]
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

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];

for (const url of urls) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);
  } catch (e) {
    errors.push(`nav: ${String(e.message).slice(0, 200)}`);
  }
  results.push({ url: url.replace(base, ''), errors });
  await page.close();
}

await browser.close();

const bad = results.filter((r) => r.errors.length > 0);
for (const r of results) {
  if (r.errors.length) {
    console.log(`ERROR ${r.url}`);
    r.errors.forEach((e) => console.log(`  ${e}`));
  } else {
    console.log(`OK    ${r.url}`);
  }
}
console.log(`\n共 ${results.length} 页，${bad.length} 页有 JS 报错`);
process.exit(bad.length ? 1 : 0);
