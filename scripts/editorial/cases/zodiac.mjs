const CAPTION_EVE = '查询结果中，生肖显示蛇，农历显示腊月廿九，年干支显示乙巳年。';
const CAPTION_NEW_YEAR = '查询结果中，生肖显示马，农历显示正月初一，年干支显示丙午年。';
const ALT_EVE = '查询结果面板内，生肖、农历、年干支卡片的值分别为蛇、腊月廿九、乙巳年。';
const ALT_NEW_YEAR = '查询结果面板内，生肖、农历、年干支卡片的值分别为马、正月初一、丙午年。';

export default async function ({ page, base, shot }) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  try {
    const source = '/tools/daily/zodiac/';
    await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
    await page.goto(new URL(source, base).href);
    await page.waitForFunction(() => document.getElementById('zdDate').value === '2001-11-24');
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

    const workspace = page.locator('.tool-workspace');
    const scenes = [
      { date: '2026-02-16', zodiac: '蛇', name: 'eve.jpg', alt: ALT_EVE, caption: CAPTION_EVE },
      { date: '2026-02-17', zodiac: '马', name: 'new-year.jpg', alt: ALT_NEW_YEAR, caption: CAPTION_NEW_YEAR },
    ];
    for (const { date, zodiac, name, alt, caption } of scenes) {
      await page.locator('#zdDate').fill(date);
      await page.locator('#zdBtn').click();
      await page.locator('#zdGrid .zd-item').filter({ hasText: '生肖' + zodiac }).waitFor();
      await shot(workspace, name, { alt, caption, source });
    }
  } finally {
    await session.detach();
  }
}
