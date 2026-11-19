// Cron 表达式文章（slug: cron-expression-basics）的截图用例。
// 两个场景都先把假时钟钉在 2026-11-19T04:00:00Z，再用 CDP 把浏览器时区强制成 UTC，
// 然后才 goto——这样「下一次执行时间」与正文引用的日期、时刻一致，可复跑、可对照。
// 截图环境（capture-tool）：astro dev server 在 4399，context viewport 1280×1000、locale zh-CN、colorScheme light。
// alt / caption 只描述可见像素：哪个面板、输入框里是什么、状态栏第一行文字、结果区首行内容。

const ALT_RESULT =
  'Cron 表达式工具页上下两块面板：上面一块标题是「Cron 表达式」，标题右侧按钮写「示例」；「表达式」输入框里是 0 9 * * 1-5，「预演次数」下拉显示「10 次」，再往下是「预览执行时间」按钮和一行状态文字「表达式合法，已生成 10 次执行时间」；下面一块标题是「未来执行时间」，标题右侧按钮写「复制」，只读文本框里是多行时间，第一行先是「2026/11/19 17:00:00」，紧接着全角括号里是「2026-11-19T09:00:00.000Z」';

const CAPTION_RESULT =
  '预览工作日表达式 0 9 * * 1-5 之后：状态栏写「表达式合法，已生成 10 次执行时间」，结果区每行都是上海钟面时间在前、括号里的 UTC 时间在后';

const ALT_ERROR =
  'Cron 表达式工具页的两块面板，表达式换成段数不足的写法：上面「表达式」输入框里是「* * * *」，「预演次数」仍是「10 次」；「预览执行时间」按钮下面的一行状态文字以「表达式无效：」开头，后面跟着英文原文「CronPattern: invalid configuration format (\'* * * *\'), exactly five, six, or seven space separated parts are required.」；下面「未来执行时间」的只读文本框是空的，只有占位文字「点击预览后显示执行时间」';

const CAPTION_ERROR =
  '段数不足时状态栏给出的英文原文：先中文「表达式无效：」，再是解析库的字段数报错，同时结果区被清空';

export default async function ({ page, base, shot }) {
  await page.clock.install({ time: new Date('2026-11-19T04:00:00Z') });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(`${base}/tools/dev/cron/`);
  await page.waitForSelector('#cronExpr');
  // astro dev 会往页面注入开发工具栏，固定在视口底部；截图只记录站点自身 UI，先隐藏。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.tool-workspace');

  // 1) 合法表达式：填工作日表达式，状态栏报合法，结果区首行是上海时间 + 括号里的 UTC
  await page.fill('#cronExpr', '0 9 * * 1-5');
  await page.click('#cronBtn');
  await page.waitForFunction(
    () =>
      document.getElementById('cronStatus').textContent.includes('表达式合法') &&
      document.getElementById('cronOutput').value.trim() !== '',
  );
  await shot(workspace, 'cron-result.jpg', {
    alt: ALT_RESULT,
    caption: CAPTION_RESULT,
    source: '/tools/dev/cron/',
    purpose: '说明结果区每行的写法：上海钟面时间在前，括号内是同一时刻的 UTC ISO',
  });

  // 2) 非法表达式：段数不足，状态栏给英文原文，结果区清空
  await page.fill('#cronExpr', '* * * *');
  await page.click('#cronBtn');
  await page.waitForFunction(
    () =>
      document.getElementById('cronStatus').textContent.startsWith('表达式无效：') &&
      document.getElementById('cronOutput').value === '',
  );
  await shot(workspace, 'cron-error.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/cron/',
    purpose: '展示报错文案的位置与格式，便于把英文关键词对应回段位',
  });
}
