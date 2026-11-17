// JSON 格式化与校验文章（slug: json-formatting-validation）的截图用例，恰好两个场景：
//   1) error-locate：输入带对象尾逗号的 JSON → 点「格式化」→ 状态栏给出行列与英文原文，输出框清空。
//   2) format-result：输入 115 字符的示例数据 → 缩进选 2 空格 → 点「格式化」→ 输出多行缩进结果。
// 时钟固定为 2026-11-18T06:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-18T06:00:00Z');

const SAMPLE =
  '{"name":"CloverTools","version":"3.0","features":["格式化","压缩","校验"],"free":true,"stats":{"tools":67,"categories":3}}';
const BAD = '{"name":"clover","free":true,}';

const ALT_ERROR =
  'JSON 格式化工具工作区：输入框第一行是「{"name":"clover","free":true,}」，下方状态栏一段红色文字以「第 1 行，第 30 列：」开头，后面接「Expected double-quoted property name in JSON at position 29」，输出框为空，框下统计为「0 字符」。';
const CAPTION_ERROR =
  '粘贴末尾多一个逗号的对象后点「格式化」：状态栏显示「第 1 行，第 30 列：Expected double-quoted property name in JSON at position 29 (line 1 column 30)」，下方输出框被清空、统计回到「0 字符」，错误位置指向右花括号。';
const ALT_FORMAT =
  'JSON 格式化工具工作区：输入框是 115 字符的紧凑 JSON，缩进下拉框显示「2 空格」；输出区第一行是「{」，第二行是「  "name": "CloverTools",」，数组元素与嵌套对象逐层缩进，状态栏显示「格式化完成」，输出框下统计为「115 字符」。';
const CAPTION_FORMAT =
  '把同一份示例数据按 2 空格缩进格式化：输出区第一行是「{」，第二行缩进两个空格显示「"name": "CloverTools",」，features 数组每个元素一行、stats 对象再缩进一层；状态栏显示「格式化完成」，底部统计为「115 字符」。';

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

  await page.goto(`${base}/tools/dev/json-formatter/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#jsonInput') && document.querySelector('#formatBtn'));
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');

  // 1) 尾逗号：状态栏给出行列，输出框清空
  await page.fill('#jsonInput', BAD);
  await page.click('#formatBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#statusMsg')?.textContent?.includes('第 1 行，第 30 列') &&
      document.querySelector('#jsonOutput')?.value === '',
  );
  await shot(workspace, 'error-locate.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/json-formatter/',
    purpose: '展示报错状态栏同时给出中文行列与英文原文，且格式化失败时输出框被清空',
  });

  // 2) 2 空格格式化：输出逐层缩进
  await page.selectOption('#indentSelect', '2');
  await page.fill('#jsonInput', SAMPLE);
  await page.click('#formatBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#statusMsg')?.textContent?.includes('格式化完成') &&
      document.querySelector('#jsonOutput')?.value?.startsWith('{\n  "name": "CloverTools",') &&
      document.querySelector('#outputStats')?.textContent?.includes('115'),
  );
  await shot(workspace, 'format-result.jpg', {
    alt: ALT_FORMAT,
    caption: CAPTION_FORMAT,
    source: '/tools/dev/json-formatter/',
    purpose: '展示 2 空格缩进下的多行输出与字符数统计，供读者对照自己的格式化结果',
  });
}
