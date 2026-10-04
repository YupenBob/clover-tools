import assert from 'node:assert/strict';
import { join } from 'node:path';
import { localizedPath } from '../../config/routes.mjs';

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'workspace must fit the viewport');
}

async function composition(page, mode) {
  const panels = page.locator('.tool-workspace > .tool-card-panel');
  const first = await panels.nth(0).boundingBox();
  const second = await panels.nth(1).boundingBox();
  assert.ok(first && second);
  if (mode === 'columns') {
    assert.ok(second.x >= first.x + first.width, 'task panels should sit beside each other on desktop');
  } else {
    assert.ok(second.y >= first.y + first.height, 'task panels should stack in reading order on mobile');
  }
  const workspace = await page.locator('.tool-workspace').boundingBox();
  const discovery = await page.locator('.tool-discovery').boundingBox();
  assert.ok(discovery.y >= workspace.y + workspace.height, 'discovery should follow the working area');
  await noOverflow(page);
}

async function swatchRow(page) {
  const positions = await page.locator('#pgPalette button').evaluateAll((buttons) => buttons.map((button) => {
    const { x, y, width } = button.getBoundingClientRect();
    return { x, y, width };
  }));
  assert.equal(positions.length, 5);
  assert.ok(positions.every((position, index) => Math.abs(position.y - positions[0].y) < 1 &&
    (index === 0 || position.x >= positions[index - 1].x + positions[index - 1].width)), 'all five swatches should remain in one row');
  const canvas = await page.locator('#pgPalette').boundingBox();
  assert.ok(positions.reduce((total, position) => total + position.width, 0) > canvas.width * 0.85, 'swatches should fill the visual canvas');
}

export async function runToolWorkspaceChecks({ run, remember, base, artifacts }) {
  for (const lang of ['zh', 'tw', 'en', 'ko', 'ja']) {
    await run(`JSON workspace ${lang}`, { viewport: { width: 1440, height: 1000 } }, async (page, context) => {
      await remember(context, lang);
      await page.goto(base + localizedPath('/tools/dev/json-formatter/', lang));
      await page.fill('#jsonInput', '{"z":2,"a":[true,null]}');
      await page.check('#sortKeys');
      await page.selectOption('#indentSelect', '2');
      await page.locator('#jsonInput').press('Control+Enter');
      const expected = JSON.stringify({ a: [true, null], z: 2 }, null, 2);
      assert.equal(await page.inputValue('#jsonOutput'), expected);
      await composition(page, 'columns');
      await page.click('#minifyBtn');
      assert.equal(await page.inputValue('#jsonOutput'), '{"a":[true,null],"z":2}');
      await page.locator('#jsonInput').press('Meta+Enter');
      assert.equal(await page.inputValue('#jsonOutput'), expected);
      await page.screenshot({ path: join(artifacts, `workspace-json-${lang}-desktop.png`), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      await composition(page, 'stack');
      await page.screenshot({ path: join(artifacts, `workspace-json-${lang}-mobile.png`), animations: 'disabled' });
      await page.fill('#jsonInput', '{');
      await page.click('#formatBtn');
      assert.equal(await page.inputValue('#jsonOutput'), '');
      assert.equal(await page.locator('#statusMsg').evaluate((el) => el.classList.contains('error')), true);
      await page.click('#clearInput');
      assert.equal(await page.inputValue('#jsonInput'), '');
    });

    await run(`palette workspace ${lang}`, {
      viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'],
    }, async (page, context) => {
      await remember(context, lang);
      await page.goto(base + localizedPath('/tools/fun/palette-generator/', lang));
      const swatches = page.locator('#pgPalette button');
      await swatches.first().waitFor();
      assert.equal(await swatches.count(), 5);
      assert.equal(await page.locator('#pgStatus').isVisible(), false, 'initial render should not announce an action');
      await composition(page, 'columns');
      const firstHex = await swatches.first().getAttribute('data-hex');
      await swatchRow(page);
      await swatches.first().focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), firstHex, 'native keyboard activation should copy the focused color');
      await page.locator('#pgHue').focus();
      await page.keyboard.press('ArrowRight');
      assert.notEqual(await swatches.first().getAttribute('data-hex'), firstHex, 'hue changes should update the preview immediately');
      await page.selectOption('#pgScheme', 'mono');
      const luminances = await swatches.locator('.color').evaluateAll((elements) => elements.map((el) => {
        const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }));
      assert.ok(luminances.every((value, index) => index === 0 || value > luminances[index - 1]), 'monochrome swatches should progress from dark to light');
      await page.click('#pgCopyAll');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), (await swatches.evaluateAll((els) => els.map((el) => el.dataset.hex))).join(', '));
      await page.selectOption('#pgScheme', 'complementary');
      await page.screenshot({ path: join(artifacts, `workspace-palette-${lang}-desktop.png`), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      await composition(page, 'stack');
      await swatchRow(page);
      await page.click('#themeToggle');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.screenshot({ path: join(artifacts, `workspace-palette-${lang}-mobile-dark.png`), animations: 'disabled' });
    });

    await run(`timestamp workspace ${lang}`, { viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' }, async (page, context) => {
      await remember(context, lang);
      await page.goto(base + localizedPath('/tools/daily/timestamp/', lang));
      await page.fill('#tsInput', '1785000000');
      await page.click('#tsToDateBtn');
      assert.ok((await page.inputValue('#tsDateOutput')).includes('2026-07-25T17:20:00.000Z'));
      const seconds = Number(await page.locator('#nowSeconds').textContent());
      assert.ok(Math.abs(seconds - Date.now() / 1000) < 5, 'live time should still update');
      const panels = page.locator('.tool-workspace > .tool-card-panel');
      const [header, left, right] = await Promise.all([0, 1, 2].map((i) => panels.nth(i).boundingBox()));
      assert.ok(header.width > left.width + right.width, 'live data should span both conversion panels');
      assert.ok(right.x >= left.x + left.width);
      await page.fill('#dateInput', '2026-07-25T17:20');
      await page.click('#dateToTsBtn');
      assert.ok((await page.inputValue('#dateTsOutput')).includes('1785000000'));
      await noOverflow(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
    });
    await run(`calendar narrow viewport ${lang}`, { viewport: { width: 360, height: 800 } }, async (page, context) => {
      await remember(context, lang);
      await page.goto(base + localizedPath('/tools/daily/calendar/', lang));
      await page.locator('.cal-cell').first().waitFor();
      await noOverflow(page);
      const month = await page.locator('#calMonth').textContent();
      await page.click('#calNext');
      assert.notEqual(await page.locator('#calMonth').textContent(), month);
      await page.click('#calPrev');
      assert.equal(await page.locator('#calMonth').textContent(), month);
      await page.locator('.cal-cell:not(.other-month)').nth(14).click();
      assert.equal(await page.locator('.cal-cell.selected').getAttribute('data-d'), '15');
      await page.click('#themeToggle');
      await noOverflow(page);
    });
  }
}
