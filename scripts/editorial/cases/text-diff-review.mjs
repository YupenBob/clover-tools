// 文本差异对比文章（slug: text-diff-review）的截图用例，恰好两个场景：
//   1) diff-sample：点「示例」「示例」→ 点「对比」，展示结果区 7 行（1 行上下文 + 3 个「+ 」+ 3 个「- 」）
//      与底部统计「7 行 · +3 / -3」。
//   2) diff-trailing-space：A 第一行末尾多一个空格、B 不带 → 结果区两行前缀不同但文字相同，
//      底部统计「3 行 · +1 / -1」。
// 时钟固定为 2026-11-17T12:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-17T12:00:00Z');

const ALT_SAMPLE =
  '文本对比工具工作区：标题为「原始文本（A）」与「对比文本（B）」的两个输入面板各显示 4 行 JavaScript 代码，A 第二行是「const b = 2;」，B 第二行是「const b = 3;」；结果框第一行是「  const a = 1;」，随后三行以「+ 」开头、三行以「- 」开头，框下统计为「7 行 · +3 / -3」。';
const CAPTION_SAMPLE =
  '分别点两个面板里的「示例」再点「对比」后，结果框显示 7 行：第一行是两边相同的上下文「  const a = 1;」，接着三行以「+ 」开头，再往下三行以「- 」开头，只在新文本里的「console.log("done");」也在其中；结果框下方统计为「7 行 · +3 / -3」。';
const ALT_SPACE =
  '文本对比工具工作区：两个输入面板各显示两行配置文本，A 第一行末尾带一个空格；结果框只有两行，第一行以「+ 」开头、第二行以「- 」开头，去掉前缀后两行文字相同，框下统计为「3 行 · +1 / -1」。';
const CAPTION_SPACE =
  'A 第一行「name = clover」末尾多一个空格、B 不带时点「对比」：结果框出现两行，前缀分别是「+ 」与「- 」，两行文字在屏幕上看起来一样；框下统计为「3 行 · +1 / -1」，这个行数包含末尾空行。';

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

  await page.goto(`${base}/tools/dev/diff/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#diffOut') && document.querySelector('#diffBtn'));
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');

  // 1) 示例 A / 示例 B → 对比：结果区 7 行，+ 行排在 - 行之前
  await page.click('#diffSampleA');
  await page.click('#diffSampleB');
  await page.click('#diffBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#diffStatus')?.textContent?.includes('对比完成') &&
      document.querySelector('#diffStats')?.textContent?.includes('7 行'),
  );
  await shot(workspace, 'diff-sample.jpg', {
    alt: ALT_SAMPLE,
    caption: CAPTION_SAMPLE,
    source: '/tools/dev/diff/',
    purpose: '展示示例输入下的行级对比结果：1 行上下文、3 行新增、3 行删除，以及含上下文行的统计文案',
  });

  // 2) 行尾一个空格：两行前缀不同、文字相同；统计 3 行 · +1 / -1
  await page.fill('#diffA', 'name = clover \nversion = 1.0');
  await page.fill('#diffB', 'name = clover\nversion = 1.0');
  await page.click('#diffBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#diffStatus')?.textContent?.includes('对比完成') &&
      document.querySelector('#diffStats')?.textContent?.includes('+1 / -1'),
  );
  await shot(workspace, 'diff-trailing-space.jpg', {
    alt: ALT_SPACE,
    caption: CAPTION_SPACE,
    source: '/tools/dev/diff/',
    purpose: '展示肉眼几乎不可见的行尾空格会整行标成一对增删，统计行数含末尾空行',
  });
}
