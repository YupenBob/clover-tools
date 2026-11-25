const PINNED = new Date('2026-11-25T00:00:00Z');
const ROUTE = '/tools/fun/nickname-text/';

const ALT_SAMPLE = '输入文字面板显示 Clover 幸运草，下方是生成提示和全风格预览。';
const CAPTION_SAMPLE = '输入框显示 Clover 幸运草，下方是生成状态和全风格预览卡片。';
const ALT_MIXED = '输入框显示 Ab7，下方的全风格预览中有粗体和斜体卡片。';
const CAPTION_MIXED = '输入框显示 Ab7，预览中可见粗体、斜体和其他风格卡片。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (zone !== 'UTC') throw error;
  }

  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(base + ROUTE, { waitUntil: 'domcontentloaded' });
  await page.locator('#nnGrid .nn-card').first().waitFor();
  await page.addStyleTag({
    content: 'astro-dev-toolbar, header.site-header { display: none !important; }',
  });
  await page.evaluate(() => document.fonts.ready);

  const input = page.locator('#nnInput');
  const workspace = page.locator('.tool-workspace').filter({ has: input });
  const bold = page.locator('#nnGrid [data-style="粗体"] .value');

  await page.locator('#nnSample').click();
  await bold.waitFor();
  if (await input.inputValue() !== 'Clover 幸运草' || await bold.textContent() !== '𝐂𝐥𝐨𝐯𝐞𝐫 幸运草') {
    throw new Error('示例输入或粗体预览与截图场景不符');
  }
  await shot(workspace, 'sample-preview.jpg', {
    alt: ALT_SAMPLE,
    caption: CAPTION_SAMPLE,
    source: ROUTE,
    purpose: '展示示例输入和实时预览。',
  });

  await input.fill('Ab7');
  await input.blur();
  if (await input.inputValue() !== 'Ab7' || await bold.textContent() !== '𝐀𝐛𝟕') {
    throw new Error('混排输入或粗体预览与截图场景不符');
  }
  await shot(workspace, 'mixed-preview.jpg', {
    alt: ALT_MIXED,
    caption: CAPTION_MIXED,
    source: ROUTE,
    purpose: '展示同一份混排输入在不同卡片里的结果。',
  });
}
