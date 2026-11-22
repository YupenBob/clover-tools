const PINNED = new Date('2026-11-23T06:00:00Z');
const ROUTE = '/tools/dev/pinyin/';
const ALT_TONE = '汉语拼音工具：输入框显示「汉语拼音」，输出模式是「全拼（带声调）」，分隔符是「空格」，结果框显示「hàn yǔ pīn yīn」。';
const CAPTION_TONE = '输入框显示「汉语拼音」，分隔符为「空格」，结果框显示「hàn yǔ pīn yīn」。';
const ALT_FIRST = '汉语拼音工具：输入框显示「长大」，输出模式是「首字母」，分隔符是「连字符」，结果框显示「z-d」。';
const CAPTION_FIRST = '输入框显示「长大」，输出模式为「首字母」，结果框显示「z-d」。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (timezone !== 'UTC') throw error;
  }

  await page.goto(new URL(ROUTE, base).href, { waitUntil: 'load' });
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');
  const scenes = [
    { input: '汉语拼音', mode: 'tone', sep: ' ', output: 'hàn yǔ pīn yīn',
      file: 'tone-space.jpg', alt: ALT_TONE, caption: CAPTION_TONE, purpose: '显示带声调全拼的空格分隔效果' },
    { input: '长大', mode: 'first', sep: '-', output: 'z-d',
      file: 'first-hyphen.jpg', alt: ALT_FIRST, caption: CAPTION_FIRST, purpose: '显示首字母和连字符' },
  ];

  for (const { input, mode, sep, output, file, alt, caption, purpose } of scenes) {
    await page.locator('#pyInput').fill(input);
    await page.locator('#pyMode').selectOption(mode);
    await page.locator('#pySep').selectOption(sep);
    await page.locator('#pyBtn').click();
    await page.waitForFunction(value =>
      document.querySelector('#pyOutput')?.value === value &&
      document.querySelector('#pyStatus')?.textContent === '转换完成',
    output);
    await shot(workspace, file, { alt, caption, source: ROUTE, purpose });
  }
}
