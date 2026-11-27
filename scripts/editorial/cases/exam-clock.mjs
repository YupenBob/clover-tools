const ROUTE = '/tools/daily/exam-clock/';
const ALT_CLOCK = '黑色投屏中央是白色大号时间，右上角有退出图标。';
const CAPTION_CLOCK = '黑底中央是白色大字时钟，右上角有退出图标';
const ALT_SETTINGS = '黑色背景上的白色大字时钟，右侧设置面板顶部有时间来源，下方有考试表单。';
const CAPTION_SETTINGS = '大号时钟旁打开设置面板，面板内可见时间来源和考试表单';

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  const time = new Date('2026-11-27T04:00:00Z');
  await page.clock.install({ time: new Date(time.getTime() - 1000) });
  await page.clock.pauseAt(time);
  await page.route('**/api/time', route => route.fulfill({ status: 503, body: '' }));
  await page.goto(new URL(ROUTE, base).href);
  await page.waitForSelector('#examClock[data-presentation-state="primary"]');
  await page.locator('#ecTime:text-is("12:00")').waitFor();
  await shot(page.locator('#examClock'), 'projection-clock.jpg', {
    alt: ALT_CLOCK, caption: CAPTION_CLOCK, source: ROUTE, purpose: '记录默认投屏视图。',
  });

  await page.locator('#ecExitProjection').click();
  await page.waitForSelector('#ecSettings');
  await page.locator('#ecSource:text-is("本地时钟")').waitFor();
  await page.locator('#ecExample').click();
  await shot(page.locator('#examClock'), 'projection-settings.jpg', {
    alt: ALT_SETTINGS, caption: CAPTION_SETTINGS, source: ROUTE, purpose: '记录设置面板里的时间来源和考试表单。',
  });
}
