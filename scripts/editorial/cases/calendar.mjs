// 在线万年历文章（slug: calendar）的截图用例。
// 两个场景都先把假时钟钉在 2026-11-10T03:00:00Z 再加载页面（页面顶层的
// `let viewYear = new Date().getFullYear()` / `let selected = new Date()` 只在加载时求值），
// 这样截图里的「今天」、默认视图与正文引用的日期一致，可复跑、可对照。
// 截图环境的浏览器时区是 UTC（context 未设置 timezoneId），locale zh-CN、colorScheme light、viewport 1280×1000。
// 两张图的 alt / caption 已用 verify-shots.mjs 按真实渲染核对（.editorial/drafts/calendar/images/preview-*.png）。
export default async function ({ page, base, shot }) {
  // 固定到 2026-11-10T03:00:00Z（UTC 浏览器下就是 11 月 10 日）
  await page.clock.install({ time: new Date('2026-11-10T03:00:00Z') });
  await page.goto(`${base}/tools/daily/calendar/`);
  await page.waitForSelector('#calGrid .cal-cell');
  // astro dev 会往页面注入开发工具栏，固定在视口底部；截图只记录站点自身 UI，先隐藏。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.cal-wrap');

  // 1) 默认视图：2026 年 11 月，选中 11 月 10 日（= 加载瞬间的「今天」）
  await shot(workspace, 'default.jpg', {
    alt: '在线万年历工具的 2026 年 11 月视图：表头两行是「2026 年 11 月」与「农历二〇二六年 · 丙午马年」，右上角为上一月、今天、下一月三个按钮；星期行从「一」到「日」；42 个格子铺满 6 行，第一行左侧 6 个是浅色灰格（10 月 26 日至 31 日，不显示农历日），11 月 1 日从「日」列开始；10 日带深色渐变圆底与描边、下方农历「初二」，7 日下方有「立冬」徽标、22 日下方有「小雪」徽标；底部「本月节气」后是两个 chip「7 日 立冬」「22 日 小雪」；右侧面板自上而下是「11 月 10 日」「星期二」「农历十月初二 · 戊子日」，没有假期或节气标签，宜 17 个 chip 以「嫁娶」「开光」「出行」开头，忌两个 chip「置产」「安床」，四格「生肖 马」「星座 天蝎」「年干支 丙午年」「五行 火」，底部提示「点击日历中的日期查看当日黄历」',
    caption: '页面加载后的默认视图（假时钟固定在 2026-11-10T03:00:00Z、浏览器时区 UTC）：10 日既是「今天」也是选中日，所以数字同时带渐变圆底与描边；11 月只有立冬、小雪两个节气，徽标与底部 chip 一一对应；右侧面板没有标签行，因为 11 月 10 日既不是假期也不是节气',
    source: '/tools/daily/calendar/',
    purpose: '说明打开页面时的默认组成：两行表头、42 格月历、本月节气行与右侧黄历面板',
  });

  // 2) 月份边界：导航到 2026 年 2 月并选中 2 月 17 日（正月初一）
  for (let step = 0; step < 24; step += 1) {
    const month = (await page.locator('#calMonth').innerText()).trim();
    if (month === '2026 年 2 月') break;
    await page.click('#calPrev');
  }
  await page.waitForFunction(() => document.querySelector('#calMonth').textContent.trim() === '2026 年 2 月');
  await page.click('#calGrid .cal-cell[data-y="2026"][data-m="2"][data-d="17"]');
  await page.waitForFunction(() => document.querySelector('#alLunar').textContent.includes('正月初一'));

  await shot(workspace, 'month-boundary.jpg', {
    alt: '在线万年历工具的 2026 年 2 月视图：表头两行是「2026 年 2 月」与「农历二〇二五年 · 乙巳蛇年」；2 月 17 日格子里的数字带描边、下方农历「初一」；14 日至 23 日与 28 日的格子下方有红色「春节」徽标，4 日下方是「立春」徽标，末尾灰格（3 月 1 日至 8 日）里 5 日下方仍有灰色的「惊蛰」徽标；底部「本月节气」是两个 chip「4 日 立春」「18 日 雨水」；右侧面板是「2 月 17 日」「星期二」「农历正月初一 · 壬戌日」，下面一个红色标签「春节（放假）」，宜 10 个 chip「祭祀」「塞穴」「结网」「破土」「谢土」「安葬」「移柩」「除服」「成服」「馀事勿取」，忌两个 chip「嫁娶」「入宅」，四格「生肖 马」「星座 水瓶」「年干支 丙午年」「五行 火」',
    caption: '月份边界（同一瞬间，假时钟仍是 2026-11-10T03:00:00Z）：视图停在 2026 年 2 月，表头的农历年取当月 1 日，所以写「乙巳蛇年」；选中的 2 月 17 日已是正月初一，右侧面板的生肖与年干支变成「马」与「丙午年」——同一屏里两套年份口径并存',
    source: '/tools/daily/calendar/',
    purpose: '展示表头农历年取自当月 1 日、右侧面板按选中日取值，以及假期徽标盖过节气徽标的那个月',
  });
}
