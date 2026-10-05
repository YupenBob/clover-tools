import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localizedPath } from '../../config/routes.mjs';
import { FLIGHT_STORAGE, createFlight } from '../../src/lib/focus-flight.ts';
import { flightText } from '../../src/lib/focus-flight-i18n.ts';

async function fits(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'flight tool fits the viewport');
}
async function state(page, value) {
  await page.waitForFunction(value => document.querySelector('#ffRoot')?.dataset.state === value, value);
}
export async function runFocusFlightChecks({ run, remember, base, artifacts }) {
  for (const lang of ['zh', 'tw', 'en', 'ko', 'ja']) {
    const t = flightText(lang);
    await run(`focus flight validation, pause, deadline, log and PNG ${lang}`, { viewport: { width: 1440, height: 1080 } }, async (page, context) => {
      await remember(context, lang);
      await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
      await page.goto(base + localizedPath('/tools/fun/focus-flight/', lang));
      await page.clock.pauseAt(new Date('2026-10-05T09:00:01Z'));
      await fits(page);
      assert.equal(await page.locator('[data-route]').count(), 6);
      await page.locator('[data-route="hongkong-singapore"]').click();
      assert.equal(await page.inputValue('#ffMinutes'), '60');
      assert.equal(await page.textContent('#ffToCode'), 'SIN');
      for (const invalid of ['0', '181', '1.5']) {
        await page.fill('#ffMinutes', invalid); await page.click('#ffPrimary');
        assert.equal(await page.locator('#ffMinutes').getAttribute('aria-invalid'), 'true');
        await state(page, 'boarding');
      }
      await page.fill('#ffMinutes', '1');
      await page.fill('#ffTask', '<img src=x onerror=alert(1)> Read a chapter');
      await page.click('#ffPrimary'); await state(page, 'flying');
      assert.equal(await page.locator('#ffTask').isDisabled(), true);
      assert.equal(await page.locator('#ffMinutes').isDisabled(), true);
      assert.equal(await page.locator('#ffRoutes button:disabled').count(), 6);
      await page.clock.fastForward(20_000);
      assert.equal(await page.textContent('#ffClock'), '00:40');
      const plane = await page.locator('#ffPlane').getAttribute('transform');
      const originalArrival = await page.textContent('#ffArrivalTime');
      await page.click('#ffPrimary'); await state(page, 'paused');
      await page.clock.fastForward(60_000);
      assert.equal(await page.textContent('#ffClock'), '00:40');
      assert.equal(await page.locator('#ffPlane').getAttribute('transform'), plane);
      assert.equal(await page.textContent('#ffArrivalTime'), '—');
      await page.click('#ffPrimary'); await state(page, 'flying');
      assert.notEqual(await page.textContent('#ffArrivalTime'), originalArrival);
      await page.clock.fastForward(40_000); await state(page, 'landed');
      assert.equal(await page.textContent('#ffClock'), '00:00');
      assert.equal(await page.locator('#ffProgress').getAttribute('aria-valuenow'), '100');
      assert.equal(await page.locator('#ffLogList li').count(), 1);
      assert.equal(await page.locator('#ffLogList img').count(), 0);
      assert.equal(await page.locator('#ffActiveTask').textContent(), '<img src=x onerror=alert(1)> Read a chapter');
      assert.equal(await page.textContent('#ffLandings'), '1');
      assert.ok((await page.textContent('#ffNotice')).includes(t.cities[6]));
      const pending = page.waitForEvent('download');
      await page.click('#ffSave');
      const download = await pending;
      assert.equal(await download.failure(), null);
      const path = join(artifacts, `focus-flight-card-${lang}.png`); await download.saveAs(path);
      const bytes = await readFile(path);
      assert.deepEqual([...bytes.subarray(0,8)], [137,80,78,71,13,10,26,10]);
      assert.equal(bytes.readUInt32BE(16), 1080); assert.equal(bytes.readUInt32BE(20), 900);
      assert.ok(bytes.length > 1000);
      await page.reload(); await state(page, 'landed');
      assert.equal(await page.locator('#ffLogList li').count(), 1, 'reload does not duplicate completed flights');
      await page.click('#ffClear');
      assert.equal(await page.locator('#ffClearDialog').isVisible(), true);
      await page.click('#ffClearConfirm'); await page.reload(); await state(page, 'boarding');
      assert.equal(await page.locator('#ffLogList li').count(), 0, 'cleared records do not reappear after reload');
    });
    await run(`focus flight mobile themes, audio, immersive and early end ${lang}`, { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }, async (page, context) => {
      await remember(context, lang);
      await page.goto(base + localizedPath('/tools/fun/focus-flight/', lang));
      await fits(page);
      await page.selectOption('#ffRouteSelect', 'tokyo-sapporo');
      assert.equal(await page.textContent('#ffToCode'), 'CTS');
      assert.equal(await page.inputValue('#ffMinutes'), '120');
      if (['zh','en'].includes(lang)) await page.screenshot({ path: join(artifacts, `focus-flight-mobile-${lang}.png`), fullPage: true });
      await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
      await fits(page);
      const themeColor = await page.locator('#ffRoot').evaluate(el => getComputedStyle(el).getPropertyValue('--ff-ocean').trim());
      assert.equal(themeColor, '#1b2e2a');
      await page.click('#ffSound');
      assert.equal(await page.locator('#ffSound').getAttribute('aria-checked'), 'true');
      await page.locator('#ffVolume').fill('10');
      assert.equal(await page.textContent('#ffVolumeValue'), '10%');
      await page.click('#ffSound');
      assert.equal(await page.locator('#ffSound').getAttribute('aria-checked'), 'false');
      await page.click('#ffPrimary'); await state(page, 'flying');
      await page.click('#ffImmersive');
      assert.equal(await page.locator('#ffImmersive').getAttribute('aria-pressed'), 'true');
      await fits(page);
      await page.click('#ffEnd');
      assert.equal(await page.locator('#ffStopDialog').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ffStopDialog').isVisible(), false);
      assert.equal(await page.locator('#ffImmersive').getAttribute('aria-pressed'), 'true', 'Esc closes the dialog first');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ffImmersive').getAttribute('aria-pressed'), 'false');
      await page.click('#ffEnd'); await page.click('#ffKeepFlying'); await state(page, 'flying');
      await page.click('#ffEnd'); await page.click('#ffStopConfirm'); await state(page, 'boarding');
      assert.equal(await page.locator('#ffLogList li').count(), 0);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), FLIGHT_STORAGE.active), null);
    });
  }
  await run('focus flight restores a paused session across languages', {}, async (page, context) => {
    await remember(context, 'zh');
    await page.goto(base + '/tools/fun/focus-flight/');
    await page.click('#ffPrimary'); await page.click('#ffPrimary'); await state(page, 'paused');
    const remaining = await page.textContent('#ffClock');
    await page.reload(); await state(page, 'paused');
    assert.equal(await page.textContent('#ffClock'), remaining);
    await remember(context, 'en');
    await page.goto(base + '/en/tools/fun/focus-flight/'); await state(page, 'paused');
    assert.equal(await page.textContent('#ffClock'), remaining);
    assert.equal(await page.textContent('#ffStateText'), 'Flight paused');
    await page.click('#ffPrimary'); await state(page, 'flying');
  });
  await run('focus flight catches up a closed session without duplicate arrivals', {}, async (page, context) => {
    await remember(context, 'zh');
    await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
    await context.addInitScript(({key, value}) => localStorage.setItem(key, value), { key: FLIGHT_STORAGE.active, value: JSON.stringify(createFlight('closed-flight','beijing-seoul','Closed session',1,Date.UTC(2026,9,5,8,57))) });
    await page.goto(base + '/tools/fun/focus-flight/'); await state(page, 'landed');
    await page.clock.pauseAt(new Date('2026-10-05T09:00:01Z'));
    assert.equal(await page.locator('#ffLogList li').count(), 1);
    assert.equal(await page.textContent('#ffToCode'), 'ICN');
    await page.reload(); await state(page, 'landed');
    assert.equal(await page.locator('#ffLogList li').count(), 1);
    assert.equal(await page.textContent('#ffToday'), '1分钟');
    await page.clock.fastForward(24 * 60 * 60_000);
    assert.equal(await page.textContent('#ffToday'), '0分钟', 'the daily log summary rolls over without a reload');
  });
  await run('focus flight tolerates unavailable storage and audio', {}, async (page, context) => {
    await context.addInitScript(() => {
      localStorage.setItem('clover-lang', 'zh');
      Storage.prototype.setItem = function() { throw new Error('Storage denied'); };
      Storage.prototype.getItem = function() { throw new Error('Storage denied'); };
      window.AudioContext = class { constructor() { throw new Error('Audio denied'); } };
    });
    await page.goto(base + '/tools/fun/focus-flight/');
    await page.click('#ffSound');
    await page.waitForFunction(() => document.querySelector('#ffSound').getAttribute('aria-checked') === 'false');
    await page.click('#ffPrimary'); await state(page, 'flying');
    assert.ok((await page.textContent('#ffLocalNote')).includes('无法恢复'));
  });
  await run('focus flight synchronizes active sessions between tabs', {}, async (page, context) => {
    await remember(context, 'zh');
    await page.goto(base + '/tools/fun/focus-flight/');
    const other = await context.newPage(); await other.goto(base + '/tools/fun/focus-flight/');
    await page.fill('#ffTask','Shared task'); await page.click('#ffPrimary');
    await state(other,'flying'); assert.equal(await other.inputValue('#ffTask'),'Shared task');
    await other.click('#ffPrimary'); await state(page,'paused');
    await page.click('#ffEnd'); await page.click('#ffStopConfirm'); await state(other,'boarding');
    await other.close();
  });
  await run('focus flight supports the production CSP', {}, async (page, context) => {
    await remember(context, 'en');
    const headers = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
    const csp = headers.match(/Content-Security-Policy: ([^\r\n]+)/)[1];
    await page.route('**/tools/fun/focus-flight/', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    await page.goto(base + '/en/tools/fun/focus-flight/');
    await page.click('#ffSound');
    await page.waitForFunction(() => document.querySelector('#ffSound').getAttribute('aria-checked') === 'true');
    await page.click('#ffPrimary'); await state(page, 'flying');
    await fits(page);
  });
}
