/** Local browser acceptance and unedited full-page screenshots for the homepage. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { HOME_DATA } from '../src/lib/home-data.ts';
import { getAllTools } from '../src/lib/tools.ts';
const base = process.env.HOME_BASE_URL || 'http://127.0.0.1:4321';
const output = 'output/lead';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/home/ubuntu/Clovertools/.playwright-browsers/chromium-1234/chrome-linux/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = [];
try {
  for (const [lang, prefix] of [['zh', ''], ['tw', '/zh-hant'], ['en', '/en'], ['ko', '/ko'], ['ja', '/ja']]) {
    const localeTools = ['en', 'ko', 'ja'].includes(lang) ? JSON.parse(await readFile(`src/lib/i18n/${lang}.json`, 'utf8')).tools : null;
    const listedTools = getAllTools().filter(tool => !localeTools || localeTools[tool.slug]).length;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
    await context.addInitScript(lang => { localStorage.setItem('clover-lang', lang); localStorage.setItem('clover-theme', 'light'); }, lang);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${prefix}/`, { waitUntil: 'networkidle' });
    await page.locator('.home-guides').waitFor();
    assert.equal(await page.locator('.tool-card').count(), listedTools);
    assert.equal(Number(await page.locator('#builtCount').textContent()), listedTools);
    assert.equal(await page.locator('.home-guide-card').count(), 3);
    assert.equal(await page.locator('.home-stat-numbers dd').allTextContents().then(values => values.join('/')), `${HOME_DATA.toolCount}/${HOME_DATA.guideCount}`);
    assert.equal(await page.locator('.ad-slot, [data-grid-filler], ins.adsbygoogle, script[src*="adsbygoogle"]').count(), 0);
    const columns = await page.locator('.home-discovery').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').map(Number.parseFloat));
    assert.equal(columns.length, 2);
    assert.ok(columns[0] / (columns[0] + columns[1]) > .7 && columns[0] / (columns[0] + columns[1]) < .76);
    const links = [...new Set(await page.locator('.home-discovery a, .site-footer a').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(href => href.startsWith('/') && !href.startsWith('/#'))))];
    for (const href of links) assert.equal((await context.request.get(base + href)).status(), 200, href);
    const fortune = await page.locator('[data-fortune-message]').textContent();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-fortune-message]').textContent(), fortune);
    await page.goto(`${base}${prefix}/?q=json`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#toolSearch').inputValue(), 'json');
    await page.waitForFunction(() => document.querySelector('.home-discovery').classList.contains('is-filtering'));
    assert.ok(await page.locator('.tool-card:visible').count() > 0);
    assert.equal(await page.locator('.home-guides:visible').count(), 0);
    await page.locator('#toolSearch').fill('zzzz-no-such-tool-zzzz');
    await page.locator('#searchEmpty.show').waitFor();
    await page.locator('#emptyReset').click();
    assert.equal(await page.locator('.tool-card:visible').count(), listedTools);
    await page.locator('[data-tab="dev"]').click();
    assert.equal(await page.locator('[data-category]:visible').count(), 1);
    await page.locator('[data-tab="all"]').click();
    await page.locator('#toolSearch').fill('json');
    await page.locator('#searchClear').click();
    assert.equal(await page.locator('.home-guides:visible').count(), 1);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${lang}: overflow at ${width}`);
    }
    if (lang === 'zh') {
      // Date overrides are confined to this test context; no screenshot is edited.
      await page.clock.install({ time: new Date(2026, 10, 15, 12) });
      await page.reload({ waitUntil: 'networkidle' });
      const today = await page.locator('[data-fortune-message]').textContent();
      await page.clock.setSystemTime(new Date(2026, 10, 16, 12));
      await page.reload({ waitUntil: 'networkidle' });
      assert.notEqual(await page.locator('[data-fortune-message]').textContent(), today);
      await page.clock.setSystemTime(new Date());
      await page.reload({ waitUntil: 'networkidle' });
      for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(async () => { await document.fonts.ready; for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 30)); } window.scrollTo(0, 0); });
        await page.locator('.tool-card').last().evaluate(el => el.classList.add('revealed'));
        await page.screenshot({ path: `${output}/homepage-after-${name}.png`, fullPage: true, animations: 'disabled' });
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      for (const href of ['/tools/dev/json-formatter/', '/guides/json-unexpected-token-html/']) {
        await page.goto(base + href, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('.ad-slot, [data-grid-filler], ins.adsbygoogle, script[src*="adsbygoogle"]').count(), 0);
      }
    }
    assert.deepEqual(errors, []);
    report.push({ lang, listedTools, sourceTools: HOME_DATA.toolCount, localLinks: links.length, columns, search: 'pass', fortune: 'stable', overflowWidths: [320, 390, 768, 1280], pageErrors: errors });
    console.log(`PASS ${lang}: links, source counts, search/reset/filter, fortune, 4 widths, no ads`);
    await context.close();
  }
  await writeFile(`${output}/homepage-browser-checks.json`, JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
