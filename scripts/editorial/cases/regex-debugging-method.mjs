// 正则表达式调试方法（slug: regex-debugging-method）的截图用例，恰好两个场景：
//   1) regex-sample：点「示例」→ 邮箱模式 + 三个地址，高亮 3 处，结果区 3 行。
//   2) regex-error：未闭合括号 → 状态条红色错误文案，高亮区与结果区清空。
// 时钟固定为 2026-11-19T06:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-19T06:00:00Z');

const ALT_SAMPLE =
  '正则表达式工具工作区：顶部输入框显示邮箱模式，下方五个胶囊「g 全局」「i 忽略大小写」「m 多行」「s 点匹配换行」「u Unicode」只有 g 勾选；测试文本为「联系 york@example.com 或 admin@tools.cn 获取支持，备用邮箱 dev@clover.io」，三个邮箱地址带高亮底色；「匹配高亮」面板重复同一段带高亮文本，「匹配结果」框三行，第一行是「[1] 位置 3：york@example.com」，状态条显示「找到 3 处匹配」。';
const CAPTION_SAMPLE =
  '点「示例」后，三个邮箱地址在测试文本里被高亮，匹配结果区按位置逐行列出匹配文本。';

const ALT_ERROR =
  '正则表达式工具工作区：模式输入框显示一个左括号，测试文本为 abc；下方状态条红色文字以「正则语法错误：」开头，后接 Invalid regular expression 与 Unterminated group；「匹配高亮」面板为空，「匹配结果」框也为空。';
const CAPTION_ERROR =
  '未闭合括号触发错误态：状态条以「正则语法错误：」开头，高亮区与结果区都是空的。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  // capture-tool 的 context 没有 timezoneId；用 CDP 把时区钉成 UTC。本页不显示日期时间，钉住只为可复现。
  // 若 context 已经设置过时区，CDP 会报“already in effect”：此时只接受本来就是 UTC 的情况。
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }

  await page.goto(`${base}/tools/dev/regex-tester/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rePattern') && document.querySelector('#reSample'));
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');

  // 1) 示例：邮箱模式 + 三个地址 → 3 处高亮、结果区 3 行
  await page.click('#reSample');
  await page.waitForFunction(() => document.querySelector('#reStatus')?.textContent?.includes('找到 3 处匹配'));
  await shot(workspace, 'regex-sample.jpg', {
    alt: ALT_SAMPLE,
    caption: CAPTION_SAMPLE,
    source: '/tools/dev/regex-tester/',
    purpose: '展示示例输入下的高亮与逐行匹配结果，以及五个 flag 中默认只勾选 g',
  });

  // 2) 未闭合括号：错误态文案 + 两个区域清空
  await page.fill('#reText', 'abc');
  await page.fill('#rePattern', '(');
  await page.waitForFunction(() => {
    const el = document.querySelector('#reStatus');
    return el && el.className.includes('error') && el.textContent.includes('Unterminated group');
  });
  await shot(workspace, 'regex-error.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/regex-tester/',
    purpose: '展示编译失败的红色错误态：状态条带 V8 具体原因，高亮与结果区清空',
  });
}
