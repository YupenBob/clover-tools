const ROUTE = '/tools/fun/schulte-trainer/';
const ALT_GRID = '经典方格训练页上方显示当前目标，下面是数字方格。';
const CAPTION_GRID = ALT_GRID;
const ALT_RESULT = '结果区上方显示评级，中间列出完成用时、错点次数和平均每数，下方有再来一组和返回选择按钮。';
const CAPTION_RESULT = ALT_RESULT;

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  const pinned = new Date('2026-11-27T10:00:00Z');
  await page.clock.install({ time: new Date(pinned.getTime() - 1000) });
  await page.clock.pauseAt(pinned);
  await page.addInitScript(() => {
    localStorage.setItem('ct-schulte-prefs', JSON.stringify({
      mode: 'classic', size: 3, muted: true, rounds: false,
    }));
    localStorage.removeItem('ct-schulte-history');
    let seed = 247;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    Element.prototype.requestFullscreen = async () => {
      throw new TypeError('Fullscreen unavailable in this scene');
    };
  });
  await page.goto(new URL(ROUTE, base).href);
  await page.waitForSelector('.st-mode[data-mode="classic"]');
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} *,*::before,*::after{animation:none!important;transition:none!important}' });

  const cell = (n) => page.locator(`#stGrid .st-cell[data-num="${n}"]`);
  const training = page.locator('#actTrain');
  await page.locator('#stStart').dispatchEvent('click');
  await training.waitFor();
  await shot(training, 'classic-grid.jpg', {
    alt: ALT_GRID,
    caption: CAPTION_GRID,
    source: ROUTE,
    purpose: '展示经典方格的目标区和数字布局。',
  });

  await page.clock.runFor(2000);
  await cell(2).dispatchEvent('click');
  await cell(1).dispatchEvent('click');
  for (let n = 2; n <= 9; n++) {
    await page.clock.runFor(1000);
    await cell(n).dispatchEvent('click');
  }
  const result = page.locator('#actResult .st-result-inner');
  await result.waitFor();
  await shot(result, 'classic-result.jpg', {
    alt: ALT_RESULT,
    caption: CAPTION_RESULT,
    source: ROUTE,
    purpose: '展示结算指标及下一步按钮。',
  });
}
