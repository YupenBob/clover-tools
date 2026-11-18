// JSON 转 CSV 文章（slug: json-to-csv-excel）的截图用例，恰好两个场景：
//   1) convert-result：填入五条混合记录 → 点「生成表格」→ 输出 8 列表头与跨行单元格，统计行 261 字符。
//   2) error-state：填入数字数组 [1,2] → 点「生成表格」→ 状态栏拒绝并清空输出。
// 时钟固定为 2026-11-18T12:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-18T12:00:00Z');

const MIXED = JSON.stringify([
  {
    id: 1,
    name: '杭州仓',
    profile: { city: '杭州', zip: '310000' },
    tags: ['加急', '易碎'],
    code: '000123',
    big: 110101199003072316,
    note: '请勿折叠, 谢谢',
    raw: '=1+1',
  },
  {
    id: 2,
    name: '宁波仓',
    profile: null,
    tags: [],
    code: '000045',
    big: 9007199254740993,
    note: null,
    raw: '+86 13800138000',
  },
  { id: 3, name: '苏州仓', raw: '-2+3' },
  { id: 4, name: '备注"引号"', note: '第一行\n第二行' },
  { id: 5, name: '@前缀', raw: '@SUM(A1:A2)' },
]);

const ALT_RESULT =
  'JSON 转 CSV 工具页：上方输入框里是一段 JSON 数组，第一行「[」，其后是 id、name、profile、tags、code、big、note、raw 八个键；下方输出框第一行是「id,name,profile,tags,code,big,note,raw」，第二行以「1,杭州仓,」开头，profile 列是一整段带双引号的 JSON 文本，note 列的值换行占了两行；状态栏是绿色「转换完成：5 行 × 8 列」，输出框下方统计为「261 字符 · 5 行数据 · 8 列」。';
const CAPTION_RESULT =
  '五条记录点「生成表格」后：输出框第一行是 8 列表头「id,name,profile,tags,code,big,note,raw」，profile 与 tags 两列是整段 JSON 文本，带换行的备注把一个单元格撑成两行；状态栏显示「转换完成：5 行 × 8 列」，统计行为「261 字符 · 5 行数据 · 8 列」。';
const ALT_ERROR =
  '同一工具页：输入框只有一行「[1,2]」，下方状态栏是一段红色文字「请输入非空的对象数组，如 [{ "a": 1 }]」，输出框为空，输出框下的统计行也是空的，右侧「生成表格」「下载文件」按钮保持可点状态。';
const CAPTION_ERROR =
  '输入数字数组 [1,2] 后点「生成表格」：状态栏给出一句中文提示「请输入非空的对象数组，如 [{ "a": 1 }]」，输出框与统计行都被清空，没有产生任何表格文本。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
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

  await page.goto(`${base}/tools/dev/json-convert/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#jsonInput') && document.querySelector('#convertBtn'));
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');

  // 1) 五条混合记录：8 列、7 个物理行、261 字符
  await page.fill('#jsonInput', MIXED);
  await page.click('#convertBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#statusMsg')?.textContent?.includes('5 行 × 8 列') &&
      document.querySelector('#csvStats')?.textContent?.includes('261 字符'),
  );
  await shot(workspace, 'convert-result.jpg', {
    alt: ALT_RESULT,
    caption: CAPTION_RESULT,
    source: '/tools/dev/json-convert/',
    purpose: '展示对象数组导出后的表头、嵌套字段的整段 JSON 文本、含换行单元格与统计行',
  });

  // 2) 数字数组被拒：状态栏提示，输出与统计清空
  await page.fill('#jsonInput', '[1,2]');
  await page.click('#convertBtn');
  await page.waitForFunction(
    () =>
      document.querySelector('#statusMsg')?.textContent?.includes('请输入非空的对象数组') &&
      document.querySelector('#csvOutput')?.value === '',
  );
  await shot(workspace, 'error-state.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/json-convert/',
    purpose: '展示只接受对象数组这一门槛：错误文案、空输出框与空统计行',
  });
}
