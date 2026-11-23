const ROUTE = '/tools/fun/ball-tracker/';
const ALT_MARK = '训练画布上方显示「记住金色目标球」，画布中可见带白色虚线圈的金色球和灰褐色球';
const CAPTION_MARK = ALT_MARK;
const ALT_SELECT = '训练画布上方显示「点击你追踪到的目标球」，画布中是灰褐色的球';
const CAPTION_SELECT = ALT_SELECT;

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  const pinned = new Date('2026-11-24T06:00:00Z');
  await page.clock.install({ time: new Date(pinned.getTime() - 1000) });
  await page.clock.pauseAt(pinned);
  await page.addInitScript(() => {
    localStorage.removeItem('ct-balltracker-prefs');
    let seed = 247;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Keep the training overlay in the same viewport in both scenes.
    Element.prototype.requestFullscreen = async () => {};
  });
  await page.goto(new URL(ROUTE, base).href);
  await page.waitForSelector('.bt-mode[data-mode="track"]');
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}.bt-train{animation:none!important}' });

  const duration = page.locator('#btDur');
  await duration.fill('10');
  await page.locator('#btMute').dispatchEvent('click');
  await page.locator('#btStartBtn').dispatchEvent('click');
  const phase = page.locator('#btPhaseText');
  const training = page.locator('#btTrain');
  await page.clock.runFor(40);
  await phase.getByText('记住金色目标球', { exact: true }).waitFor();
  await shot(training, 'target-mark.jpg', {
    alt: ALT_MARK,
    caption: CAPTION_MARK,
    source: ROUTE,
    purpose: '呈现开始后保留金色标记的画布与阶段提示。',
  });

  await page.clock.runFor(12500);
  await phase.getByText('点击你追踪到的目标球', { exact: true }).waitFor();
  await shot(training, 'target-select.jpg', {
    alt: ALT_SELECT,
    caption: CAPTION_SELECT,
    source: ROUTE,
    purpose: '呈现进入选择阶段后的画布与阶段提示。',
  });
}
