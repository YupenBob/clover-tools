const ALT_BEFORE_BIRTHDAY =
  '年龄计算器结果区，标题「周岁」，大号数字 24，右侧单位「岁」，下方显示年月日拆分。下一次生日栏显示 2025-02-28，底部有「复制结果」按钮。';
const CAPTION_BEFORE_BIRTHDAY =
  '结果区显示周岁 24 岁，下一次生日栏显示 2025-02-28。';
const ALT_ON_BIRTHDAY =
  '年龄计算器结果区，标题「周岁」，大号数字 25，右侧单位「岁」。下一次生日栏右侧写着「今天生日」，下方有填满的进度条和日期 2025-02-28。';
const CAPTION_ON_BIRTHDAY =
  '结果区显示周岁 25 岁，下一次生日栏显示「今天生日」和 2025-02-28。';

export default async function ({ page, base, shot }) {
  const source = '/tools/daily/age-calculator/';
  await page.clock.install({ time: new Date('2025-02-28T12:00:00Z') });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(`${base}${source}`);
  await page.waitForFunction(() => document.querySelector('#ageAt')?.value === '2025-02-28');
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const result = page.locator('#ageResult');
  await page.locator('#ageBirth').fill('2000-02-29');
  await page.locator('#ageAt').fill('2025-02-27');
  await page.waitForFunction(() =>
    document.querySelector('#ageYears')?.textContent === '24' &&
    document.querySelector('#ageBirthdayDate')?.textContent === '2025-02-28',
  );
  await shot(result, 'before-birthday.jpg', {
    alt: ALT_BEFORE_BIRTHDAY,
    caption: CAPTION_BEFORE_BIRTHDAY,
    source,
    purpose: '展示平年生日的前一天的周岁与生日日期',
  });

  await page.locator('#ageAt').fill('2025-02-28');
  await page.waitForFunction(() =>
    document.querySelector('#ageYears')?.textContent === '25' &&
    document.querySelector('#ageBirthdayLabel')?.textContent === '今天生日' &&
    document.querySelector('#ageBirthdayDate')?.textContent === '2025-02-28',
  );
  await shot(result, 'on-birthday.jpg', {
    alt: ALT_ON_BIRTHDAY,
    caption: CAPTION_ON_BIRTHDAY,
    source,
    purpose: '展示平年生日当天的周岁与今天生日提示',
  });
}
