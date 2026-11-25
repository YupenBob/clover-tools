const ROUTE = '/tools/fun/reaction-test/';
const CAPTION_EARLY = '测试区显示「太早了！等变绿再点，点击重试」，下方状态条显示「提前点击，本次无效」';
const ALT_EARLY = '测试区中央写着「太早了！等变绿再点，点击重试」，下方状态条写着「提前点击，本次无效」，底部提示完成一次挑战后显示成绩。';
const CAPTION_SCORED = '测试区显示「反应时间 240 ms，点击再来一次」，下方显示本次反应、平均、最佳和次数';
const ALT_SCORED = '测试区中央写着「反应时间 240 ms，点击再来一次」，下方状态条写着「240 ms · 反应敏捷」，成绩区显示本次反应、平均、最佳均为 240 ms，共 1 次。';

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.install({ time: new Date('2026-11-25T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-25T00:01:00Z'));
  await page.goto(`${base}${ROUTE}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const stage = page.locator('#rtStage');
  const area = page.locator('#rtArea');
  const text = page.locator('#rtText');
  await page.locator('#rtResult .muted').waitFor();
  await page.evaluate(() => { Math.random = () => 0; });
  await area.click();
  await area.click();
  await text.getByText('太早了！等变绿再点，点击重试', { exact: true }).waitFor();
  await shot(stage, 'too-early.jpg', {
    alt: ALT_EARLY,
    caption: CAPTION_EARLY,
    source: ROUTE,
    purpose: '展示提前点击的作废提示与重试入口。',
  });

  await area.click();
  await page.clock.runFor(1500);
  await text.getByText('点击！', { exact: true }).waitFor();
  await page.clock.runFor(240);
  await area.click();
  await text.getByText('反应时间 240 ms，点击再来一次', { exact: true }).waitFor();
  await shot(stage, 'scored.jpg', {
    alt: ALT_SCORED,
    caption: CAPTION_SCORED,
    source: ROUTE,
    purpose: '展示有效用时与成绩区字段。',
  });
}
