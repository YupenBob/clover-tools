const PINNED = new Date('2026-11-24T12:00:00Z');
const TOOL = '/tools/daily/fuel/';
const ALT_FILLED = '油耗计算器显示里程 500、加油量 40、油价 7.50，下方依次为百公里油耗 8.00 L/100km、本次油费 300.00 元和每公里成本 0.600 元/km。';
const CAPTION_FILLED = '加油记录里显示里程 500、加油量 40、油价 7.50，计算结果依次列出百公里油耗、本次油费和每公里成本。';
const ALT_ZERO = '油耗计算器的里程栏显示 0，下方出现「请填写有效的里程与加油量」，结果区仍显示 8.00 L/100km、300.00 元和 0.600 元/km。';
const CAPTION_ZERO = '行驶里程栏显示 0，加油记录下方出现「请填写有效的里程与加油量」，计算结果区仍列着上次的三项读数。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: new Date(PINNED.getTime() - 1000) });
  await page.clock.pauseAt(PINNED);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(`${base}${TOOL}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'astro-dev-toolbar, header.site-header { display: none !important; }' });

  const workspace = page.locator('.tool-workspace');
  const status = workspace.locator('#fuelStatus');
  const rows = workspace.locator('#fuelResult > div');
  const button = workspace.locator('#fuelBtn');
  await workspace.locator('#fuelKm').fill('500');
  await workspace.locator('#fuelAmount').fill('40');
  await workspace.locator('#fuelPrice').fill('7.50');
  await button.click();
  await status.getByText('计算完成', { exact: true }).waitFor();
  const expected = ['百公里油耗：8.00 L/100km', '本次油费：300.00 元', '每公里成本：0.600 元/km'];
  async function verifyRows() {
    const actual = await rows.allTextContents();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`油耗结果不符：${JSON.stringify(actual)}`);
    }
  }
  await verifyRows();
  await shot(workspace, 'filled-result.jpg', {
    alt: ALT_FILLED, caption: CAPTION_FILLED, source: TOOL,
    purpose: '核对表单输入及对应的三项计算结果。',
  });

  await workspace.locator('#fuelKm').fill('0');
  await button.click();
  await status.getByText('请填写有效的里程与加油量', { exact: true }).waitFor();
  await verifyRows();
  await shot(workspace, 'zero-distance.jpg', {
    alt: ALT_ZERO, caption: CAPTION_ZERO, source: TOOL,
    purpose: '核对零里程报错和仍保留的上次结果。',
  });
}
