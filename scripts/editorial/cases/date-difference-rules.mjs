// 日期间隔文章（slug: date-difference-rules）的截图用例。
// 两个场景都先把假时钟钉在 2026-11-16T03:00:00Z，再用 CDP 把浏览器时区强制成 UTC，
// 然后才 goto——这样「今天」、默认值与正文引用的日期一致，可复跑、可对照。
// 截图环境（capture-tool）：astro dev server 在 4399，context viewport 1280×1000、locale zh-CN、colorScheme light。
// alt / caption 只描述可见像素：哪个区域、第一行文字、下方大号数字、再下一行单位、底部按钮。

const ALT_ELAPSED =
  '日期间隔计算工具「两个日期之间」一节：标题右侧是「输入即更新」；第一行两个日期输入框分别显示 08/01/2026 与 08/03/2026（MM/DD/YYYY 回显），下面一行是未勾选的「包含起止日」复选框，右侧是「计算」按钮；结果区第一行小字是「相差天数」，下方大号数字是 2，右侧单位「天」，再下一行是「2026-08-01 → 2026-08-03」；结果下方两格是「完整周数 0」与「日历间隔 0 年 · 0 个月 · 2 天」；再往下两行说明文字是「相差天数不计起始日；包含起止日时加一天。」与「整月按同日计算；目标月无此日期时取月末。」；底部「复制结果」按钮为可点状态';

const CAPTION_ELAPSED =
  '未勾选「包含起止日」时的结果区：标签写「相差天数」，大号数字是 2，日历间隔另算成「0 年 · 0 个月 · 2 天」；同一组日期在勾选复选框后会变成 3 个日历日';

const ALT_INCLUSIVE =
  '日期间隔计算工具「两个日期之间」一节，勾选「包含起止日」之后：两个日期输入框仍是 08/01/2026 与 08/03/2026，下方「包含起止日」复选框已打勾；结果区第一行小字变成「日历天数」，下方大号数字是 3，右侧单位「天」，再下一行仍是「2026-08-01 → 2026-08-03」；结果下方两格仍是「完整周数 0」与「日历间隔 0 年 · 0 个月 · 2 天」；再往下两行说明文字是「相差天数不计起始日；包含起止日时加一天。」与「整月按同日计算；目标月无此日期时取月末。」；底部「复制结果」按钮为可点状态';

const CAPTION_INCLUSIVE =
  '勾选「包含起止日」之后：标签换成「日历天数」，大号数字从 2 变成 3，完整周数与日历间隔两格保持不变——复选框只改天数口径，不改整月切法';

export default async function ({ page, base, shot }) {
  await page.clock.install({ time: new Date('2026-11-16T03:00:00Z') });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(`${base}/tools/daily/date-diff/`);
  await page.waitForSelector('#ddForm #ddStart');
  // astro dev 会往页面注入开发工具栏，固定在视口底部；截图只记录站点自身 UI，先隐藏。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const panel = page.locator('.date-interval');

  // 1) 只算间隔：开始 2026-08-01、结束 2026-08-03，包含起止日不勾，大号数字是 2
  await page.uncheck('#ddInclusive');
  await page.fill('#ddStart', '2026-08-01');
  await page.fill('#ddEnd', '2026-08-03');
  await page.waitForFunction(
    () =>
      document.querySelector('#ddNumber').textContent.trim() === '2' &&
      document.querySelector('#ddResultLabel').textContent.trim() === '相差天数',
  );
  await shot(panel, 'elapsed.jpg', {
    alt: ALT_ELAPSED,
    caption: CAPTION_ELAPSED,
    source: '/tools/daily/date-diff/',
    purpose: '说明「相差天数」不计起始日，以及结果区四个字段各自的读数位置',
  });

  // 2) 含首尾：同一组日期勾上复选框，标签切成「日历天数」、大号数字变成 3
  await page.check('#ddInclusive');
  await page.waitForFunction(
    () =>
      document.querySelector('#ddNumber').textContent.trim() === '3' &&
      document.querySelector('#ddResultLabel').textContent.trim() === '日历天数',
  );
  await shot(panel, 'inclusive.jpg', {
    alt: ALT_INCLUSIVE,
    caption: CAPTION_INCLUSIVE,
    source: '/tools/daily/date-diff/',
    purpose: '展示含首尾只加一天，完整周数与日历间隔两格不随之变化',
  });
}
