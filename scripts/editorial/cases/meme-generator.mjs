const ROUTE = '/tools/fun/meme-generator/';
const PINNED = new Date('2026-11-28T12:00:00Z');
const CAPTION_SETTINGS = '图片与文字面板显示上下台词、字号比例、颜色和生成及下载按钮。';
const ALT_SETTINGS = CAPTION_SETTINGS;
const CAPTION_PREVIEW = '预览面板显示上方的“准备开工”和下方的“先歇会儿”。';
const ALT_PREVIEW = CAPTION_PREVIEW;

export const sample = {
  name: 'sleepy-cat.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <path fill="#36556a" d="M0 0h640v480H0z"/>
    <path fill="#775346" d="M0 335h640v145H0z"/>
    <ellipse cx="328" cy="340" rx="183" ry="25" fill="#56392e"/>
    <ellipse cx="357" cy="293" rx="146" ry="49" fill="#de9c65"/>
    <path fill="#de9c65" d="m180 258 15-76 52 46 63-20 13 53z"/>
    <ellipse cx="250" cy="280" rx="82" ry="58" fill="#de9c65"/>
    <ellipse cx="281" cy="324" rx="55" ry="14" fill="#f3bf89"/>
    <path d="M200 280q14 17 28 0m35 0q14 17 28 0" stroke="#392927" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="m237 298 15 0-7 7z" fill="#674234"/>
  </svg>`),
};

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.setFixedTime(PINNED);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    if (await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone) !== 'UTC') throw error;
  } finally {
    await cdp.detach();
  }

  await page.goto(new URL(ROUTE, base).href, { waitUntil: 'load' });
  await page.locator('#mgFile').setInputFiles(sample);
  await page.locator('#mgTop').fill('准备开工');
  await page.locator('#mgBottom').fill('先歇会儿');
  const settings = page.locator('.tool-card-panel').filter({ has: page.locator('#mgFile') });
  const preview = page.locator('.tool-card-panel').filter({ has: page.locator('#mgPreview') });

  await shot(settings, 'settings.jpg', {
    alt: ALT_SETTINGS, caption: CAPTION_SETTINGS, source: ROUTE,
    purpose: '展示台词输入和生成、下载入口。',
  });

  await page.locator('#mgBtn').click();
  await page.locator('#mgStatus.show.success').waitFor();
  await page.locator('#mgPreview img').evaluate(img => img.decode());
  await shot(preview, 'preview.jpg', {
    alt: ALT_PREVIEW, caption: CAPTION_PREVIEW, source: ROUTE,
    purpose: '展示同一张底图的顶部和底部文字。',
  });
}
