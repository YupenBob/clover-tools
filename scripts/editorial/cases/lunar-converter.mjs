// 公历农历互转工具文章（slug: lunar-converter）的截图用例。
// 只做真实页面操作 + 真实截图：用 Playwright 的假时钟把「今天」固定在同一个瞬间，
// 这样截图里的默认日期与正文引用的日期一致，可复跑、可对照。
// 注意：截图环境的浏览器时区是 UTC（timezoneId 未设置），locale zh-CN、colorScheme light。
export default async function ({ page, base, shot }) {
  // 固定到 2026-11-10T03:00:00Z（UTC 浏览器下就是 11 月 10 日）：
  // 页面顶层 `const now = new Date()` 只在加载时求值，两栏的默认值都来自这个瞬间。
  await page.clock.install({ time: new Date('2026-11-10T03:00:00Z') });
  await page.goto(`${base}/tools/daily/lunar-converter/`);
  await page.waitForSelector('#lcLunarResult div');
  // astro dev 会往页面注入开发工具栏，固定在视口底部，会出现在工作区截图的底边；
  // 截图只应该记录站点自身 UI，所以先把它隐藏掉。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.tool-workspace');

  // 1) 默认状态：公历栏已填 2026-11-10 并转换，农历栏被反填成 2026 年 10 月 2 日
  await shot(workspace, 'default.jpg', {
    alt: '公历农历互转工具的默认状态：左栏公历日期输入框显示 11/10/2026，转换结果是农历二〇二六年十月初二、干支：丙午年 · 己亥月 · 戊子日、生肖马，状态行显示转换完成；右栏农历年 2026、月 10 月、日初二、闰月未勾选，结果是公历 2026-11-10（周二）',
    caption: '页面加载后的默认状态（假时钟固定在 2026-11-10T03:00:00Z、浏览器时区 UTC）：左栏公历日期显示 11/10/2026，转出「农历：二〇二六年 十月初二」；右栏被反填成 2026 年 10 月 初二 并转回「公历：2026-11-10（周二）」，两栏状态行都是「转换完成」',
    source: '/tools/daily/lunar-converter/',
    purpose: '说明两栏在加载时都已经各自转换过一次，互为反填结果，不需要用户先点按钮',
  });

  // 2) 闰月：左栏输入闰六月初一对应的公历日，右栏勾上「闰月」把同一个农历月转回去
  await page.fill('#lcSolar', '2025-07-25');
  await page.click('#lcToLunar');
  await page.waitForFunction(() => document.querySelector('#lcLunarResult').textContent.includes('闰月'));
  await page.selectOption('#lcYear', '2025');
  await page.selectOption('#lcMonth', '6');
  await page.selectOption('#lcDay', '1');
  await page.check('#lcLeap');
  await page.click('#lcToSolar');
  await page.waitForFunction(() => document.querySelector('#lcSolarResult').textContent.includes('2025-07-25'));
  await shot(workspace, 'leap.jpg', {
    alt: '在公历农历互转工具里演示闰月：左栏公历日期输入框显示 07/25/2025，转换结果是农历二〇二五年闰六月初一、干支：乙巳年 · 癸未月 · 乙未日、生肖蛇 · 闰月；右栏农历年 2025、月 6 月、日初一，勾上闰月复选框，结果是公历 2025-07-25（周五）',
    caption: '闰月演示（同一瞬间，假时钟固定在 2026-11-10T03:00:00Z）：左栏公历日期显示 07/25/2025，转出「农历：二〇二五年 闰六月初一」，生肖行带「· 闰月」；右栏勾上「闰月」后 2025 年 6 月初一转回「公历：2025-07-25（周五）」',
    source: '/tools/daily/lunar-converter/',
    purpose: '展示闰月靠勾选复选框而不是单独月份选项，以及转换成功时闰月标注出现在生肖行',
  });
}
