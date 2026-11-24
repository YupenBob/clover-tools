const SOURCE = '/tools/daily/rmb-uppercase/';
const ALT_YUAN_FEN = '上方金额栏的数字金额为 325.04，下方中文大写栏显示叁佰贰拾伍元零肆分。';
const CAPTION_YUAN_FEN = '金额栏为 325.04，中文大写栏显示「叁佰贰拾伍元零肆分」。';
const ALT_OVER_LIMIT = '上方金额栏显示金额过大（超过万亿），下方中文大写栏显示叁佰贰拾伍元零肆分。';
const CAPTION_OVER_LIMIT = '金额栏显示「金额过大（超过万亿）」，中文大写栏仍显示「叁佰贰拾伍元零肆分」。';

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.setFixedTime(new Date('2026-11-25T06:00:00Z'));
  await page.goto(new URL(SOURCE, base).href);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.tool-workspace').filter({ has: page.locator('#rmbInput') });
  const input = page.locator('#rmbInput');
  const convert = page.locator('#rmbBtn');

  await input.fill('325.04');
  await convert.click();
  await page.locator('#rmbStatus.success').waitFor({ state: 'visible' });
  await convert.blur();
  await shot(workspace, 'yuan-fen.jpg', {
    alt: ALT_YUAN_FEN, caption: CAPTION_YUAN_FEN, source: SOURCE, purpose: '展示无角有分的输入和输出',
  });

  await input.fill('1000000000001');
  await convert.click();
  await page.locator('#rmbStatus.error').waitFor({ state: 'visible' });
  await convert.blur();
  await shot(workspace, 'over-limit.jpg', {
    alt: ALT_OVER_LIMIT, caption: CAPTION_OVER_LIMIT, source: SOURCE, purpose: '展示超限状态与保留的结果',
  });
}
