// 文本处理工具指南（slug: text-toolbox）的截图用例，恰好两个场景：
//   1) text-toolbox-dedupe：点「示例」→ 点「处理」→ 结果框 5 行（apple / banana / 空行 / cherry / date），
//      底部统计「5 行（原 8 行）」。
//   2) text-toolbox-trim-order：先去重、把结果贴回输入框、再「去除首尾空格」→ 结果框 3 行
//      （apple / apple / almond），底部统计「3 行（原 3 行）」。
// 时钟固定为 2026-11-20T12:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-20T12:00:00Z');

const ALT_DEDUPE =
  '文本处理工具工作区：上方是「输入文本」面板，文本框可见 6 行（原数据 8 行）（apple、banana、apple、空行、cherry、apple、date、末尾空行），下方「操作」下拉框显示「去重」；下方「处理结果」面板的只读结果框显示 5 行，第一行「apple」、第二行「banana」、第三行是空行、第四行「cherry」、第五行「date」；结果框下方统计为「5 行（原 8 行）」。';
const CAPTION_DEDUPE =
  '点「示例」再点「处理」后，「处理结果」框显示 5 行：apple、banana、一个空行、cherry、date；框下统计为「5 行（原 8 行）」，输入框仍是那 8 行原始数据。';

const ALT_TRIM =
  '文本处理工具工作区：上方输入框显示 3 行（「 apple」带行首空格、「apple 」带行尾空格、almond），「操作」下拉框显示「去除首尾空格」；下方结果框显示 3 行，第一行「apple」、第二行「apple」、第三行「almond」；结果框下方统计为「3 行（原 3 行）」。';
const CAPTION_TRIM =
  '先把「去重」的结果复制回输入框，再把操作切到「去除首尾空格」点「处理」：结果框显示 3 行，前两行都是「apple」、第三行「almond」，框下统计为「3 行（原 3 行）」——行首行尾空格被去掉后，两行 apple 的重复仍在。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  // capture-tool 的 context 没有 timezoneId；用 CDP 把时区钉成 UTC。本页不显示日期时间，钉住只为可复现。
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }

  await page.goto(`${base}/tools/dev/text-toolbox/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#ttbInput') && document.querySelector('#ttbBtn'));
  await page.addStyleTag({
    content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
  });
  const workspace = page.locator('.tool-workspace');

  const setInput = async (text) => {
    await page.$eval(
      '#ttbInput',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      text,
    );
  };
  const runOp = async (op, statsText, outText) => {
    await page.selectOption('#ttbOp', op);
    await page.click('#ttbBtn');
    await page.waitForFunction(
      ({ expectedStats, expectedOut }) =>
        document.querySelector('#ttbStatus')?.textContent?.includes('处理完成') &&
        document.querySelector('#ttbStats')?.textContent?.trim() === expectedStats &&
        document.querySelector('#ttbOutput')?.value === expectedOut,
      { expectedStats: statsText, expectedOut: outText },
    );
  };

  // 1) 示例 → 处理：8 行输入去重成 5 行
  await page.click('#ttbSample');
  await runOp('dedupe', '5 行（原 8 行）', 'apple\nbanana\n\ncherry\ndate');
  await shot(workspace, 'dedupe.jpg', {
    alt: ALT_DEDUPE,
    caption: CAPTION_DEDUPE,
    source: '/tools/dev/text-toolbox/',
    purpose: '展示示例数据的行级去重结果：8 行输入剩 5 行，空行参与去重并与末尾空行合并',
  });

  // 2) 去重 → 结果贴回输入框 → 去除首尾空格：3 行输入仍是 3 行
  await setInput(' apple\napple \nalmond');
  await runOp('dedupe', '3 行（原 3 行）', ' apple\napple \nalmond');
  const deduped = await page.$eval('#ttbInput', (el) => el.value);
  await setInput(deduped);
  await runOp('trim', '3 行（原 3 行）', 'apple\napple\nalmond');
  await shot(workspace, 'trim-order.jpg', {
    alt: ALT_TRIM,
    caption: CAPTION_TRIM,
    source: '/tools/dev/text-toolbox/',
    purpose: '展示「先去重再 trim」的顺序后果：两行只差首尾空白的 apple 在 trim 后变成一样的文本，重复仍然保留',
  });
}
