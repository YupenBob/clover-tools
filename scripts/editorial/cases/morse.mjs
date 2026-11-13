// 摩斯密码文章（slug: morse）的截图用例，恰好两个场景：
//   1) encode-sample：示例填入 SOS CLOVER → 点「转换」后的上两个面板（转换 + 结果 + 状态条）。
//      页面没有同时包住这两块的外层容器，所以脚本在 .tool-workspace 里插入一个 #morse-shot-pair
//      wrapper（display:grid; gap:var(--workspace-gap)），把前两个面板移进去后整块截图；
//      只改截图用的临时 DOM，不改页面源文件，也不动第三个面板。
//   2) alphabet-table：包含 #moTable 的「摩斯电码表」面板整体截图。
// 时钟固定在 2026-11-13T04:00:00Z（install 在 goto 之前），与 browser-evidence 一致。
// 本文件由 scripts/editorial/capture-tool.mjs 调用；脚本本身不启动服务器。
const PINNED = new Date('2026-11-13T04:00:00Z');
const SAMPLE_OUTPUT = '... --- ... / -.-. .-.. --- ...- . .-.';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.clock.install({ time: PINNED });
  await page.goto(`${base}/tools/fun/morse/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#moTable .mo-item');
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  // 对照表顺序是 0–9、A–Z、18 个符号；先确认页面没有漂移，再截图。
  const pairs = await page.$$eval('#moTable .mo-item', (els) =>
    els.map((el) => [...el.children].map((span) => span.textContent)),
  );
  if (pairs.length !== 54) throw new Error(`电码表应为 54 项，实际 ${pairs.length}`);
  if (pairs[0][0] !== '0' || pairs[0][1] !== '-----' || pairs[53][0] !== '@' || pairs[53][1] !== '.--.-.') {
    throw new Error(`电码表首尾项不符合预期：${JSON.stringify([pairs[0], pairs[53]])}`);
  }

  // 把前两个面板包进一个临时 wrapper，让一张图同时出现「摩斯密码转换」与「转换结果」。
  const pairId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 3) throw new Error(`面板数应为 3，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'morse-shot-pair';
    wrap.style.cssText = 'display:grid;gap:var(--workspace-gap);min-width:0;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (pairId !== 'morse-shot-pair') throw new Error('wrapper 创建失败');

  await page.click('#moSample');
  await page.waitForFunction(() => document.querySelector('#moInput').value === 'SOS CLOVER');
  await page.click('#moBtn');
  await page.waitForFunction(
    (expected) => document.querySelector('#moOutput').value === expected,
    SAMPLE_OUTPUT,
  );
  const statusText = (await page.locator('#moStatus').innerText()).trim();
  if (statusText !== '转换完成') throw new Error(`状态条应为「转换完成」，实际「${statusText}」`);

  await shot(page.locator('#morse-shot-pair'), 'encode-sample.jpg', {
    alt: '在线摩斯密码转换工具的上两个面板。第一个面板标题「摩斯密码转换」，右上角「示例」「清空」两个按钮，下面「方向」与下拉框「文字 → 摩斯电码」，多行输入框里是 SOS CLOVER，再下面深色按钮「转换」，底部浅绿色状态条「转换完成」。第二个面板标题「转换结果」，右上角「复制」按钮，只读框里是 ... --- ... / -.-. .-.. --- ...- . .-.。',
    caption:
      '示例 + 转换后的两个上方面板（假时钟 2026-11-13T04:00:00Z）：点「示例」只把输入框填成 SOS CLOVER，再点「转换」才出现结果 ... --- ... / -.-. .-.. --- ...- . .-. 与绿色「转换完成」；第三个「摩斯电码表」面板不在本图内。',
    source: '/tools/fun/morse/',
    purpose: '展示示例填入 SOS CLOVER 后，编码结果与成功状态条同时出现',
  });

  const tablePanel = page.locator('.tool-card-panel').filter({ has: page.locator('#moTable') });
  if ((await tablePanel.count()) !== 1) throw new Error('找不到唯一的摩斯电码表面板');
  await shot(tablePanel, 'alphabet-table.jpg', {
    alt: '「摩斯电码表」面板截图：标题「摩斯电码表」，下方 9 列 6 行共 54 项的纯文本网格，每格左侧是字符、右侧紧贴着电码，例如「0-----」「9----.」「A.-」「I..」「Z--..」「..-.-.-」「:---...」「@.--.-.」；每个条目没有底色与内边距，字体是页面默认字体。按阅读顺序依次是 0 到 9、A 到 Z、. , ? \' ! / ( ) & : ; = + - _ " $ @。',
    caption:
      '「摩斯电码表」面板（1280 宽视口）：54 项按对象键顺序渲染成 0–9、A–Z、18 个符号，1280 宽下是 9 列 6 行。条目由脚本事后插入，没有 Astro 的样式作用域属性，.mo-item 的底色、内边距与等宽字体未生效，所以字母与电码紧贴显示（如「0-----」「..-.-.-」）。',
    source: '/tools/fun/morse/',
    purpose: '展示 54 项对照表的真实 DOM 顺序与未套用 .mo-item 样式的 9 列网格',
  });
}
