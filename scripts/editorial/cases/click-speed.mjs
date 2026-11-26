const ROUTE = '/tools/fun/click-speed/';
const CAPTION_READY = '测试面板上方显示总数、当前速度和剩余时间，下方按钮写着「点击开始」。';
const ALT_READY = '「10 秒手速挑战」面板内，大号总数为 0，当前 0.0 次/秒，剩余 10.0 秒，下方按钮写着「点击开始」。';
const CAPTION_SCORED = '按钮写着「再来一次」，下方成绩卡显示 60 次、6.0 次/秒及「反应敏捷」。';
const ALT_SCORED = '「10 秒手速挑战」面板内，按钮写着「再来一次」，下方显示总点击数 60、6.0 次/秒、评价「反应敏捷」和「新纪录！」。';

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.install({ time: new Date('2026-11-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-26T00:01:00Z'));
  await page.addInitScript(() => localStorage.removeItem('ct-click-best'));
  await page.goto(`${base}${ROUTE}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const button = page.locator('#csBtn');
  const label = button.locator('#csBtnLabel');
  const panel = page.locator('.tool-card-panel').filter({ has: button });
  await label.getByText('点击开始', { exact: true }).waitFor();
  await shot(panel, 'ready.jpg', {
    alt: ALT_READY, caption: CAPTION_READY, source: ROUTE, purpose: '展示开始入口和面板初始读数。',
  });

  await button.click();
  await page.clock.runFor(2100);
  await label.getByText('疯狂点击！', { exact: true }).waitFor();
  for (let click = 0; click < 60; click += 1) {
    await page.clock.runFor(150);
    await button.dispatchEvent('pointerdown', { clientX: 100, clientY: 100 });
  }
  await page.clock.runFor(2500);
  await label.getByText('再来一次', { exact: true }).waitFor();
  await page.locator('#csResult').getByText('6.0', { exact: true }).waitFor();
  await shot(panel, 'scored.jpg', {
    alt: ALT_SCORED, caption: CAPTION_SCORED, source: ROUTE, purpose: '展示结算读数、评价与重试入口。',
  });
}
