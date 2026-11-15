/** Visual acceptance for the home-only illustration upgrade; uses actual built pages. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.HOME_BASE_URL || 'http://127.0.0.1:4323';
const output = 'output/lead';
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile('public/illustrations/home-assets.json', 'utf8'));
for (const asset of manifest.assets) {
  assert.ok((await stat(asset.file)).size <= 200 * 1024, asset.file);
  assert.ok(asset.width <= 1600);
}
assert.ok((await stat('src/components/HomeArtwork.astro')).size < 30000);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/home/ubuntu/Clovertools/.playwright-browsers/chromium-1234/chrome-linux/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const records = [];
const screenshots = [];
const modules = {
  stats: '.home-stats',
  tools: '.home-featured',
  guides: '.home-guides',
  'recommended-tools': '.home-recommended-tools',
  'recommended-articles': '.home-recommended-guides',
  fortune: '.home-fortune',
  footer: '.home-footer',
};
try {
  for (const theme of ['light', 'dark']) {
    for (const [device, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale: 'zh-CN', reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('clover-lang', 'zh'); localStorage.setItem('clover-theme', theme);
        window.homeDesignCLS = 0;
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.homeDesignCLS += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.home-pick-visual .icon, .home-side-card h2 .icon').count(), 0);
      assert.equal(await page.locator('.home-guide-card img').count(), 3);
      assert.equal(await page.locator('.home-art-hero').count(), 1);
      assert.equal(await page.locator('.home-art-seal').count(), 1);
      assert.equal(await page.locator('ins.adsbygoogle, .ad-slot, [data-grid-filler], script[src*="adsbygoogle"]').count(), 0);
      for (const testWidth of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width: testWidth, height });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}: overflow at ${testWidth}`);
        const rects = await page.locator('.home-pick').evaluateAll(cards => cards.map(card => { const r = card.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
        for (let i = 1; i < rects.length; i++) assert.ok(rects[i].left >= rects[i - 1].right || rects[i].top >= rects[i - 1].bottom, 'Overlapping tool cards');
      }
      await page.setViewportSize({ width, height });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise(resolve => setTimeout(resolve, 35));
        }
        await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      const name = `${output}/design-after-${device}-${theme}`;
      for (const [suffix, fullPage] of [['top', false], ['full', true]]) {
        const path = `${name}-${suffix}.png`;
        await page.screenshot({ path, fullPage, animations: 'disabled' }); screenshots.push(path);
      }
      const selected = theme === 'light' ? Object.entries(modules) : Object.entries(modules).filter(([key]) => ['stats', 'fortune', 'footer', 'guides'].includes(key));
      for (const [key, selector] of selected) {
        const module = page.locator(selector);
        await module.scrollIntoViewIfNeeded();
        await module.evaluate(async el => { await Promise.all([...el.querySelectorAll('img')].map(img => img.decode())); });
        const path = `${name}-${key}.png`;
        await module.screenshot({ path, animations: 'disabled' }); screenshots.push(path);
      }
      // content-visibility:auto may omit offscreen category contents in a full
      // screenshot. Verify and capture the actual viewport after scrolling there.
      await page.locator('#cat-fun').scrollIntoViewIfNeeded();
      await page.locator('#cat-fun .tool-card').first().waitFor({ state: 'visible' });
      assert.ok(await page.locator('#cat-fun').evaluate(el => el.querySelector('.tool-card').getBoundingClientRect().height > 0));
      const path = `${name}-directory-viewport.png`;
      await page.screenshot({ path, animations: 'disabled' }); screenshots.push(path);
      assert.deepEqual(errors, []);
      records.push({ theme, device, widths: [320, 390, 768, 1280], images: 'loaded', layout: 'no overflow or overlap', directoryAfterScroll: 'visible', pageErrors: errors });
      await context.close();
      console.log(`PASS design ${theme}/${device}: assets, 4 widths, screenshots, no ads/errors`);
    }
  }
  // A separate fresh load measures CLS without deliberate resizes or scrolling.
  for (const [device, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.addInitScript(() => { window.homeCLS = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.homeCLS += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => window.homeCLS);
    assert.equal(cls, 0, `${device} initial CLS`);
    records.push({ device, initialCLS: cls }); await page.close();
  }
  const policy = await browser.newPage(); await policy.goto(`${base}/about/`);
  assert.equal(await policy.locator('.home-footer, .home-art-seal').count(), 0, 'Home-only footer art must not change other pages');
  await policy.close();
  await writeFile(`${output}/design-browser-checks.json`, JSON.stringify({ records, screenshots, assets: manifest.assets }, null, 2) + '\n');
} finally { await browser.close(); }
