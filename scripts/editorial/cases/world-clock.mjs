// 世界时钟工具文章（slug: world-clock）的截图用例。
// 只做真实页面操作 + 真实截图：用 Playwright 的假时钟把时间固定在同一个瞬间，
// 这样截图里四/六张卡片的时间行保持完全相同，可复跑、可对照。
export default async function ({ page, base, shot }) {
  // 固定到 2026-01-15T03:00:00Z（冬令时）：上海/东京/伦敦是 1 月 15 日，纽约还是 1 月 14 日。
  await page.clock.install({ time: new Date('2026-01-15T03:00:00Z') });
  await page.goto(`${base}/tools/daily/world-clock/`);
  await page.waitForSelector('.wc-card');

  const workspace = page.locator('.tool-workspace');

  // 1) 默认四张卡片：时间行完全相同，日期行按各时区本地日期，差值徽章按本机时区计算
  await shot(workspace, 'grid.jpg', {
    alt: '世界时钟工具默认显示北京、东京、伦敦、纽约四张卡片，四张卡片的时间行都是同一个时刻；日期行出现跨日差异（上海、东京、伦敦是 2026/01/15，纽约是 2026/01/14），差值徽章各不相同',
    caption: '同一瞬间的四张卡片：时间行四张完全相同；日期行出现跨日差异，差值徽章按本机时区偏移计算',
    source: '/tools/daily/world-clock/',
    purpose: '说明卡片上的时间行并不随城市变化，变化的是日期行与差值徽章',
  });

  // 2) 添加悉尼与洛杉矶：卡片变成六张，差值徽章随城市变化，日期行出现跨日差异
  for (const zone of ['Australia/Sydney', 'America/Los_Angeles']) {
    await page.selectOption('#wcTz', zone);
    await page.click('#wcAdd');
    await page.waitForFunction(
      (tz) => document.querySelector(`.wc-card[data-tz="${tz}"]`) !== null,
      zone,
    );
  }
  await shot(workspace, 'diff.jpg', {
    alt: '在世界时钟工具里添加悉尼和洛杉矶后，六张卡片的时间行仍是同一个时刻，日期行有跨日差异，差值徽章分别显示 +11 和 -8 小时',
    caption: '添加悉尼与洛杉矶后共六张卡片：时间行依旧完全相同，日期行出现跨日差异，差值徽章按各城市与本机时区的差值变化',
    source: '/tools/daily/world-clock/',
    purpose: '展示添加时区的操作结果，以及日期行与差值徽章才是随时区变化的两行',
  });
}
