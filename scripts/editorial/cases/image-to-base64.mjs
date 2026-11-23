const ROUTE = '/tools/dev/image-to-base64/';
const PINNED = new Date('2026-11-23T12:00:00Z');
const CAPTION_ORIGINAL = '选择图片面板显示最大宽度为 0、输出格式为 JPEG，结果框以 data:image/png;base64, 开头，下方有图片预览。';
const ALT_ORIGINAL = CAPTION_ORIGINAL;
const CAPTION_RESIZED = '选择图片面板显示正值的最大宽度与 PNG 格式，结果框以 data:image/png;base64, 开头，下方有图片预览。';
const ALT_RESIZED = CAPTION_RESIZED;

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: new Date(PINNED.getTime() - 5000) });
  await page.clock.pauseAt(PINNED);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    if (await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone) !== 'UTC') throw error;
  }
  await page.goto(base + ROUTE, { waitUntil: 'load' });
  await page.addStyleTag({ content: '#i2bOutput { min-height: 112px; height: 112px; }' });

  const sourceUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const paint = canvas.getContext('2d');
    paint.fillStyle = '#1e40af';
    paint.fillRect(0, 0, 160, 80);
    paint.fillStyle = '#facc15';
    paint.fillRect(20, 20, 60, 40);
    return canvas.toDataURL('image/png');
  });
  const upload = page.locator('#i2bFile');
  const width = page.locator('#i2bWidth');
  const format = page.locator('#i2bFmt');
  const convert = page.locator('#i2bBtn');
  const workspace = page.locator('.tool-workspace');
  const output = page.locator('#i2bOutput');
  const pngPrefix = 'data:image/png;base64,';
  const preview = page.locator(`#i2bPreview img[src^="${pngPrefix}"]`);

  await upload.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(sourceUrl.split(',')[1], 'base64') });
  if (await width.inputValue() !== '0' || await format.inputValue() !== 'image/jpeg') {
    throw new Error('原图场景的宽度或格式默认值已变化');
  }
  await convert.click();
  await preview.waitFor();
  if (await output.inputValue() !== sourceUrl) throw new Error('原图场景的输出与样图不一致');
  await preview.evaluate((image) => image.decode());
  await shot(workspace, 'original-png.jpg', {
    alt: ALT_ORIGINAL, caption: CAPTION_ORIGINAL, source: ROUTE,
    purpose: '展示最大宽度为 0 时，PNG 原文件得到 PNG Data URL。',
  });

  await width.fill('80');
  await format.selectOption('image/png');
  await convert.click();
  const resizedPreview = page.locator(`#i2bPreview img[src^="${pngPrefix}"]:not([src="${sourceUrl}"])`);
  await resizedPreview.waitFor();
  const resizedWidth = await resizedPreview.evaluate(async (image) => {
    await image.decode();
    return image.naturalWidth;
  });
  if (resizedWidth !== 80) throw new Error('缩放场景的图片宽度应为 80');
  await shot(workspace, 'resized-png.jpg', {
    alt: ALT_RESIZED, caption: CAPTION_RESIZED, source: ROUTE,
    purpose: '展示设置正的最大宽度后，用 PNG 格式输出缩放图。',
  });
}
