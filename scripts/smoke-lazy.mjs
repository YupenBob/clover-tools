/**
 * 懒加载页功能验证：用合法数据点击主按钮，确认输出非空且无报错。
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch({ channel: 'msedge', headless: true });

const cases = [
  { path: '/tools/dev/jianfan/', fill: { '#jfInput': '软件开发工具，时间戳转换' }, btn: '#jfBtn', out: '#jfOutput' },
  { path: '/tools/dev/js-formatter/', fill: { '#jsInput': 'const a=1;function f(x){return x+1} console.log(f(a));' }, btn: '#jsFmt', out: '#jsOutput' },
  { path: '/tools/dev/pinyin/', fill: { '#pyInput': '开发者工具箱' }, btn: '#pyBtn', out: '#pyOutput' },
  { path: '/tools/dev/json-xml-yaml/', fill: { '#srcInput': '{"name":"clover","tags":["a","b"]}' }, btn: '#fmtBtn', out: '#outOutput' },
];

let failed = 0;
for (const c of cases) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + c.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(500);
  for (const [sel, val] of Object.entries(c.fill)) {
    await page.locator(sel).fill(val, { timeout: 8000 });
  }
  await page.locator(c.btn).click({ timeout: 10000, force: true });
  await page.waitForTimeout(3000);
  const out = await page.locator(c.out).inputValue().catch(() => '');
  const statusText = await page.locator('.status-msg.show').innerText().catch(() => '');
  const ok = out.trim() !== '' && errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.path} :: 输出长度 ${out.length} :: 状态: ${statusText.slice(0, 60)}`);
  errors.slice(0, 3).forEach((e) => console.log('   error: ' + e));
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
