const SOURCE = '/tools/daily/workday/';
const CAPTION_HOLIDAY = '计算结果区依次显示工作日 4 天（含调休上班 1 天）、休息日 5 天和区间总天数 9 天。';
const ALT_HOLIDAY = '「计算结果」面板，工作日一行的数字 4 加粗，括号内是调休上班 1 天，下两行是休息日 5 天、区间总天数 9 天。';
const CAPTION_MAKEUP = '计算结果区依次显示工作日 1 天（含调休上班 1 天）、休息日 0 天和区间总天数 1 天。';
const ALT_MAKEUP = '「计算结果」面板，工作日一行的数字 1 加粗，括号内是调休上班 1 天，下两行是休息日 0 天、区间总天数 1 天。';

export default async function ({ page, base, shot }) {
  await page.clock.install({ time: new Date('2026-05-01T12:00:00Z') });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(`${base}${SOURCE}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#wdStart')?.value === '2026-05-01');

  const panel = page.locator('section.tool-card-panel').filter({ has: page.locator('#wdResult') });
  const scenes = [
    { file: 'holiday-range.jpg', start: '2026-05-01', days: [4, 5, 9], alt: ALT_HOLIDAY, caption: CAPTION_HOLIDAY, purpose: '展示含放假和补班的区间结果' },
    { file: 'makeup-day.jpg', start: '2026-05-09', days: [1, 0, 1], alt: ALT_MAKEUP, caption: CAPTION_MAKEUP, purpose: '展示调休上班日的单日结果' },
  ];
  for (const { file, start, days, ...metadata } of scenes) {
    await page.fill('#wdStart', start);
    await page.fill('#wdEnd', '2026-05-09');
    await page.click('#wdBtn');
    await page.waitForFunction(([workdays, rest, total]) => {
      const lines = [...document.querySelectorAll('#wdResult > div')].map((line) => line.textContent);
      return lines[0] === `工作日：${workdays} 天（含调休上班 1 天）` &&
        lines[1] === `休息日（含周末与已知假日）：${rest} 天` &&
        lines[2] === `区间总天数：${total} 天` &&
        document.querySelector('#wdStatus')?.textContent === '计算完成';
    }, days);
    await shot(panel, file, { ...metadata, source: SOURCE });
  }
}
