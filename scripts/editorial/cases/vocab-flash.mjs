const ROUTE = '/tools/daily/vocab-flash/';
const ALT_MEANING = '单词卡片中央显示英文单词和音标，展开区依次显示中文释义、英文例句和中文译文，下面有「下一个」按钮。';
const CAPTION_MEANING = '单词卡片展开后显示释义、英文例句和中文译文，下方是「下一个」按钮';
const ALT_RESULTS = '结果页顶部是圆环和标题，中间显示「认识」「待复习」「本书已掌握」和生词列表，底部是「再刷错词」等按钮。';
const CAPTION_RESULTS = '结果页显示「认识」「待复习」「本书已掌握」和本轮生词，下方是「再刷错词」按钮';

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto(new URL(ROUTE, base).href);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await page.locator('#vbStart').click();

  const study = page.locator('[data-view="study"]');
  const total = Number(await study.locator('[data-total]').textContent());
  if (!Number.isSafeInteger(total) || total < 2) throw new Error('未能读取本轮卡片数量');
  await page.locator('#vbUnknown').click();
  await page.locator('#vbReveal').waitFor({ state: 'visible' });
  await page.locator('#vbNext').waitFor({ state: 'visible' });
  await shot(study, 'flash-meaning.jpg', {
    alt: ALT_MEANING, caption: CAPTION_MEANING, source: ROUTE, purpose: '展示自评不认识后的卡面。',
  });

  await page.locator('#vbNext').click();
  for (let index = 1; index < total; index += 1) {
    await page.locator('#vbKnown').click();
  }
  const result = page.locator('[data-view="result"]');
  await result.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#vbRing')?.style.getPropertyValue('--p') !== '0');
  await shot(result, 'flash-results.jpg', {
    alt: ALT_RESULTS, caption: CAPTION_RESULTS, source: ROUTE, purpose: '展示本轮结果和错词入口。',
  });
}
