/**
 * 核心工具功能冒烟：按配置填充合法输入 → 点击主按钮 → 断言输出非空。
 * 用法：node scripts/smoke-core.mjs
 */
import { chromium } from 'playwright-core';

const base = 'http://localhost:4321';
const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function readOut(page, selector) {
  const tag = await page.locator(selector).evaluate((el) => el.tagName).catch(() => '');
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    return await page.locator(selector).inputValue().catch(() => '');
  }
  return await page.locator(selector).innerText().catch(() => '');
}

const cases = [
  { path: '/tools/dev/json-formatter/', fill: { '#jsonInput': '{"a":1,"b":[1,2]}' }, btn: '#formatBtn', out: '#jsonOutput' },
  { path: '/tools/dev/base64/', fill: { '#b64Input': 'CloverTools 测试' }, btn: '#encodeBtn', out: '#b64Output' },
  { path: '/tools/dev/url-encode/', fill: { '#urlInput': 'https://x.com/中文?q=1' }, btn: '#urlBtn', out: '#urlOutput' },
  { path: '/tools/dev/text-transform/', fill: { '#ttInput': 'hello world' }, btn: '#ttBtn', out: '#ttOutput' },
  { path: '/tools/dev/hash/', fill: { '#hashInput': 'clover' }, btn: '#hashBtn', out: '#hashOutput' },
  { path: '/tools/dev/text-toolbox/', fill: { '#ttbInput': 'a\nb\na' }, btn: '#ttbBtn', out: '#ttbOutput' },
  { path: '/tools/dev/uuid-generator/', btn: '#uuidBtn', out: '#uuidOutput' },
  { path: '/tools/dev/password-generator/', btn: '#pgBtn', out: '#pgOutput' },
  { path: '/tools/dev/symmetric-encrypt/', fill: { '#encKey': 'secret123', '#encIv': '00112233445566778899aabbccddeeff', '#encInput': 'hello' }, btn: '#encBtn', out: '#encOutput' },
  { path: '/tools/dev/bcrypt/', fill: { '#bcPwd': 'password123' }, btn: '#bcGen', out: '#bcHash' },
  { path: '/tools/daily/timestamp/', fill: { '#tsInput': '1785000000' }, btn: '#tsToDateBtn', out: '#tsDateOutput' },
  { path: '/tools/daily/date-diff/', fill: { '#ddStart': '2026-01-01', '#ddEnd': '2026-02-01' }, btn: '#ddBtn', out: '#ddResult' },
  { path: '/tools/daily/age-calculator/', fill: { '#ageBirth': '2000-01-01' }, btn: '#ageBtn', out: '#ageResult' },
  { path: '/tools/daily/fuel/', fill: { '#fuelKm': '500', '#fuelAmount': '40', '#fuelPrice': '7.5' }, btn: '#fuelBtn', out: '#fuelResult' },
  { path: '/tools/daily/expiry/', fill: { '#expDate': '2026-01-01', '#expDays': '180' }, btn: '#expBtn', out: '#expResult' },
  { path: '/tools/daily/rmb-uppercase/', fill: { '#rmbInput': '123456.78' }, btn: '#rmbBtn', out: '#rmbOutput' },
  { path: '/tools/daily/workday/', fill: { '#wdStart': '2026-01-01', '#wdEnd': '2026-01-31' }, btn: '#wdBtn', out: '#wdResult' },
  { path: '/tools/daily/sensitive-check/', fill: { '#scInput': '欢迎了解刷单兼职' }, btn: '#scBtn', out: '#scResult' },
  { path: '/tools/daily/zodiac/', fill: { '#zdDate': '2000-01-01' }, btn: '#zdBtn', out: '#zdGrid' },
  { path: '/tools/fun/nickname-text/', fill: { '#nnInput': 'CloverTools 幸运草' }, btn: null, out: '#nnGrid' },
  { path: '/tools/fun/morse/', fill: { '#moInput': 'SOS CLOVER' }, btn: '#moBtn', out: '#moOutput' },
  { path: '/tools/fun/random-number/', fill: { '#rnMin': '1', '#rnMax': '100', '#rnCount': '5' }, btn: '#rnBtn', out: '#rnOutput' },
];

let failed = 0;
for (const c of cases) {
  let ok = false;
  let retried = false;
  let lastNote = '';
  // 顺序加载下偶发超时属于环境抖动，失败时重试一次以区分真实 bug
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    if (attempt === 1) retried = true;
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      await page.goto(base + c.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (c.btn) await page.locator(c.btn).waitFor({ state: 'attached', timeout: 10000 });
      await page.waitForTimeout(1200);
      for (const [sel, val] of Object.entries(c.fill || {})) {
        await page.locator(sel).fill(val, { timeout: 8000 }).catch(() => {});
      }
      if (c.btn) {
        await page.locator(c.btn).click({ force: true, timeout: 20000 });
      }
      await page.waitForTimeout(1500);
      let out = await readOut(page, c.out);
      const statusClass = await page.locator('.status-msg.show').getAttribute('class').catch(() => '');
      const statusOk = statusClass.includes('success');
      for (let i = 0; i < 2 && out.trim() === ''; i++) {
        await page.waitForTimeout(1500);
        out = await readOut(page, c.out);
      }
      ok = (out.trim() !== '' || statusOk) && errors.length === 0;
      lastNote = `输出 ${out.trim().slice(0, 40) || (statusOk ? '(状态成功)' : '(空)')}`;
      errors.slice(0, 2).forEach((e) => console.log(`   error: ${e}`));
      await context.close();
    } catch (e) {
      lastNote = String(e.message).slice(0, 120);
    }
  }
  if (!ok) failed++;
  console.log(`${ok ? (retried ? 'PASS(重试)' : 'PASS') : 'FAIL'} ${c.path} :: ${lastNote}`);
}

await browser.close();
console.log(`\n${cases.length - failed}/${cases.length} 个核心工具通过`);
process.exit(failed ? 1 : 0);
