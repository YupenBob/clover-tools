import assert from 'node:assert/strict';
import { EDITORIAL_GUIDES } from '../../src/lib/editorial-guides.ts';
import { getAllTools, getToolHref } from '../../src/lib/tools.ts';
import { LOCALES, localizedPath } from '../../config/routes.mjs';
import { buildSiteUrl } from './build-config.mjs';

/** Actual rendered articles, keyboard events and integer conversions, shared by CI and production. */
export async function runEditorialChecks({ run, base }) {
  for (const width of [320, 390, 1440]) {
    await run(`illustrated guides fit ${width}px`, { viewport: { width, height: 900 }, colorScheme: width === 390 ? 'dark' : 'light' }, async page => {
      for (const guide of EDITORIAL_GUIDES) {
        const path = `/guides/${guide.slug}/`;
        const response = await page.goto(base + path);
        assert.equal(response.status(), 200, path);
        assert.equal(await page.locator('h1').textContent(), guide.title);
        assert.equal(await page.getAttribute('link[rel=canonical]', 'href'), buildSiteUrl() + path);
        const tool = getAllTools().find(tool => tool.slug === guide.toolSlug);
        assert.equal(await page.getAttribute('.article-tool-link', 'href'), getToolHref(tool.category, tool.slug));
        for (const img of await page.locator('.article-content img').all()) {
          await img.scrollIntoViewIfNeeded();
          const data = await img.evaluate(async image => { await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight, expectedWidth: Number(image.getAttribute('width')), expectedHeight: Number(image.getAttribute('height')) }; });
          assert.ok(data.width > 0, path + ': image should decode');
          assert.equal(data.width, data.expectedWidth, path + ': intrinsic image width');
          assert.equal(data.height, data.expectedHeight, path + ': intrinsic image height');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ': horizontal overflow');
      }
      await page.goto(base + '/guides/');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'guide index overflow');
      for (const guide of EDITORIAL_GUIDES) assert.ok(await page.locator(`h2 a[href="/guides/${guide.slug}/"]`).count(), 'guide index should link to ' + guide.slug);
      await page.goto(base + '/');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'home overflow');
    });
  }
  for (const lang of Object.keys(LOCALES)) {
    await run(`${lang} integer conversion and invalidation`, {}, async page => {
      await page.goto(base + localizedPath('/tools/dev/base-converter/', lang));
      for (const [value, from, to, expected] of [
        ['9007199254740993', '10', '16', '20000000000001'],
        ['20000000000001', '16', '10', '9007199254740993'],
        ['-255', '10', '16', '-ff'],
        ['-0', '10', '2', '0'],
      ]) {
        await page.fill('#bcValue', value); await page.selectOption('#bcFrom', from); await page.selectOption('#bcTo', to); await page.click('#bcBtn');
        assert.equal(await page.inputValue('#bcOutput'), expected);
      }
      for (const value of ['-', '', '102', '0b10', '1.5']) {
        await page.selectOption('#bcFrom', '2'); await page.fill('#bcValue', value); await page.click('#bcBtn');
        assert.equal(await page.inputValue('#bcOutput'), '', 'invalid input must clear previous success');
        assert.ok(await page.locator('#bcStatus').evaluate(el => el.classList.contains('error')));
      }
    });
    await run(`${lang} keyboard records, layout and clearing`, { viewport: { width: 320, height: 800 } }, async page => {
      await page.goto(base + localizedPath('/', lang));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), lang + ': narrow home overflow');
      await page.goto(base + localizedPath('/tools/daily/keyboard-test/', lang));
      await page.click('#ktBox');
      await page.keyboard.press('ControlLeft');
      assert.match(await page.textContent('#ktCode'), /ControlLeft/);
      await page.keyboard.press('ControlRight');
      assert.match(await page.textContent('#ktCode'), /ControlRight/);
      for (let i = 0; i < 25; i++) await page.keyboard.press('a');
      assert.equal(await page.locator('.kt-row').count(), 20);
      assert.equal(await page.locator('.kt-row').first().evaluate(el => getComputedStyle(el).display), 'flex');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.click('#ktClear'); assert.equal(await page.locator('.kt-row').count(), 0);
      await page.keyboard.press('Tab');
      assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'ktClear', 'Tab must remain available for keyboard navigation');
    });
  }
  await run('public HLS companion exports eight-second MP4', {}, async page => {
    await page.goto(base + '/tools/daily/m3u8-downloader/');
    await page.fill('#hlsUrl', base + '/article-assets/hls-sample/index.m3u8');
    await page.click('#hlsParse'); await page.locator('#hlsTask').waitFor();
    const [file] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#hlsStart')]);
    assert.equal(await file.failure(), null);
    await page.waitForFunction(() => document.querySelector('#hlsPreview').readyState >= 1, null, { timeout: 180000 });
    assert.equal(await page.textContent('#hlsDone'), '4');
    assert.equal(await page.textContent('#hlsSkipped'), '0');
    assert.ok(Math.abs(await page.locator('#hlsPreview').evaluate(video => video.duration) - 8) < 0.2);
  });
}
