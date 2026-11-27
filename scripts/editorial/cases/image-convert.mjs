const ROUTE = '/tools/daily/image-convert/';
const PINNED = new Date('2026-11-27T12:00:00Z');
const CAPTION_SETTINGS = '设置面板显示编码质量、最大宽高和 JPG 背景，下方显示预计尺寸。';
const ALT_SETTINGS = CAPTION_SETTINGS;
const CAPTION_RESULT = '原图栏显示 PNG，结果栏显示 JPG，下面有体积对照和下载图片按钮。';
const ALT_RESULT = CAPTION_RESULT;

export default async function ({ page, base, shot }) {
  const ic = name => page.locator('#ic' + name);
  const workspace = page.locator('#imageConvert');
  const waitProcess = state => page.waitForFunction(
    state => document.querySelector('#imageConvert').dataset.process === state, state,
  );

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

  await page.goto(base + ROUTE, { waitUntil: 'load' });
  if (!await ic('Sample').isVisible()) await ic('Exit').click();
  await ic('Sample').click();
  await waitProcess('ready');
  await ic('Format').selectOption('jpg');
  await ic('SettingsToggle').click();
  await ic('MaxWidth').fill('160');
  await ic('Background').selectOption('custom');
  await ic('Color').fill('#E8EEF5');
  await shot(ic('Settings'), 'jpg-settings.jpg', {
    alt: ALT_SETTINGS, caption: CAPTION_SETTINGS, source: ROUTE,
    purpose: '展示 JPG 的质量、尺寸上限和底色设置。',
  });

  await ic('SettingsClose').click();
  if (!await ic('Convert').isVisible()) await ic('Exit').click();
  await ic('Convert').click();
  await waitProcess('success');
  await ic('Download').waitFor({ state: 'visible' });
  await shot(workspace, 'jpg-result.jpg', {
    alt: ALT_RESULT, caption: CAPTION_RESULT, source: ROUTE,
    purpose: '展示原图、转换结果以及下载入口。',
  });
}
