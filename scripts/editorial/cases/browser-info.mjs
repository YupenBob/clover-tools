const SOURCE = '/tools/fun/browser-info/';
const ALT_OVERVIEW = '浏览器与设备信息面板，标题右侧有刷新按钮，表格前两行是浏览器和 User-Agent。';
const CAPTION_OVERVIEW = '「浏览器与设备信息」面板上方是「刷新」按钮，表格从「浏览器」和「User-Agent」开始。';
const ALT_MISSING = '浏览器行的值是横线，设备内存、网络类型、网络带宽和网络延迟的值是未知。';
const CAPTION_MISSING = '「浏览器」一行显示横线，「设备内存」和网络相关行显示「未知」。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  const url = new URL(SOURCE, base).href;
  const table = page.locator('#biTable');
  const workspace = page.locator('.tool-workspace').filter({ has: table });
  const open = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await table.getByRole('rowheader', { name: '触摸支持', exact: true }).waitFor();
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  };

  await open();
  await shot(workspace, 'browser-overview.jpg', {
    alt: ALT_OVERVIEW, caption: CAPTION_OVERVIEW, source: SOURCE, purpose: '浏览器信息表的初始显示',
  });

  await page.addInitScript(() => {
    for (const key of ['userAgentData', 'deviceMemory', 'connection']) {
      Object.defineProperty(navigator, key, { value: undefined });
    }
  });
  await open();
  await table.getByRole('cell', { name: '—', exact: true }).waitFor();
  await shot(workspace, 'missing-fields.jpg', {
    alt: ALT_MISSING, caption: CAPTION_MISSING, source: SOURCE, purpose: '部分浏览器属性缺失时的占位',
  });
}
