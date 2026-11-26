const ALT_COMPOUND = '复利收益面板，左侧有本金、年利率、投资年数和计算按钮。右侧到期总额下方是大号金额与元字，底部有复制按钮。';
const CAPTION_COMPOUND = '复利收益面板左侧显示本金、年利率和投资年数，右侧显示到期总额、本金、收益和累计增幅。';
const ALT_LOAN = '贷款月供面板，左侧有贷款总额、贷款年限、年利率和计算按钮。右侧每月还款下方是大号金额与元字，底部有复制按钮。';
const CAPTION_LOAN = '贷款月供面板左侧显示贷款总额、贷款年限和年利率，右侧显示每月还款、还款总额、支付利息和还款期数。';

export default async function ({ page, base, shot }) {
  const source = '/tools/daily/finance/';
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
    await page.clock.install({ time: new Date('2026-11-26T22:00:00Z') });
    await page.goto(new URL(source, base).href);
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
    await page.waitForFunction(() => {
      const copy = document.querySelector('#finLoanCopy');
      return copy && !copy.disabled;
    });

    await page.locator('#finTab-compound').click();
    await page.locator('#finP').fill('10000');
    await page.locator('#finRp').fill('5');
    await page.locator('#finN').fill('2');
    await page.locator('#finCompoundBtn').click();
    await page.waitForFunction(() => document.querySelector('#finFinal')?.textContent === '11,025.00');
    await page.evaluate(() => document.activeElement?.blur());
    await shot(page.locator('#finPanel-compound'), 'compound-result.jpg', {
      alt: ALT_COMPOUND,
      caption: CAPTION_COMPOUND,
      source,
      purpose: '展示复利练习的输入项和结果',
    });

    await page.locator('#finTab-loan').click();
    await page.locator('#finLoan').fill('12');
    await page.locator('#finYears').fill('1');
    await page.locator('#finRate').fill('12');
    await page.locator('#finLoanBtn').click();
    await page.waitForFunction(() => document.querySelector('#finMonthly')?.textContent === '10,661.85');
    await page.evaluate(() => document.activeElement?.blur());
    await shot(page.locator('#finPanel-loan'), 'loan-payment.jpg', {
      alt: ALT_LOAN,
      caption: CAPTION_LOAN,
      source,
      purpose: '展示等额本息练习的输入项和结果',
    });
  } finally {
    await cdp.detach();
  }
}
