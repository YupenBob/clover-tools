// Unicode/ASCII 转换（slug: unicode-converter）的截图用例，恰好两个场景，都取站内同一个工具页：
//   1) decode-zh-text：输入 \u4e2d\u6587 → 点「还原文本」→ 结果框显示「中文」，绿色「解码完成」。
//   2) encode-zh-escape：输入「中」→ 点「转 Unicode」→ 结果框显示 \u4E2D，绿色「编码完成」。
// 页面只有两个 .tool-card-panel（输入内容 / 结果）；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM，不改页面源文件。时钟固定为 2026-11-20T00:00:00Z，install/pauseAt 在 goto 之前；
// context 由 capture-tool 提供，本文件不启动服务器、不做构建。Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-20T00:00:00Z');
const DECODE_INPUT = '\\u4e2d\\u6587';
const DECODE_OUTPUT = '中文';
const ENCODE_INPUT = '中';
const ENCODE_OUTPUT = '\\u4E2D';

const ALT_DECODE =
  'Unicode 转换工具两个面板并排：左侧输入框里是 \\u4e2d\\u6587，下方一排三个按钮「转 Unicode」「还原文本」「逐字分析」，再下方是浅绿色状态条「解码完成」；右侧「结果」输出框里显示「中文」，右上角有「复制」按钮。';
const CAPTION_DECODE =
  '把 \\u4e2d\\u6587 粘进输入框点「还原文本」：两个转义序列还原成两个汉字，右侧结果框显示「中文」，左侧面板下方是绿色状态条「解码完成」。';
const ALT_ENCODE =
  'Unicode 转换工具两个面板并排：左侧输入框里是一个汉字「中」，下方一排三个按钮「转 Unicode」「还原文本」「逐字分析」，再下方是浅绿色状态条「编码完成」；右侧「结果」输出框里显示 \\u4E2D，右上角有「复制」按钮。';
const CAPTION_ENCODE =
  '输入一个汉字点「转 Unicode」：右侧结果框得到 \\u4E2D，一个汉字变成一个反斜杠加四个大写十六进制位，左侧面板下方是绿色状态条「编码完成」。';

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
  await page.goto(`${base}/tools/dev/unicode-converter/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#uc2Input') && document.querySelector('#uc2Enc'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让输入与结果同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'uc-shot-pair';
    wrap.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'uc-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#uc-shot-pair');
  // 两个文本框在桌面上默认很高，截图里留白太多；临时压到 112px，只影响这张截图。
  await page.evaluate(() => {
    for (const id of ['uc2Input', 'uc2Output']) {
      const el = document.getElementById(id);
      el.style.height = '112px';
      el.style.minHeight = '112px';
      el.style.resize = 'none';
    }
  });

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };
  const read = () =>
    page.evaluate(() => ({
      input: document.querySelector('#uc2Input').value,
      output: document.querySelector('#uc2Output').value,
      outputReadonly: document.querySelector('#uc2Output').readOnly,
      status: document.querySelector('#uc2Status').textContent,
      statusClass: document.querySelector('#uc2Status').className,
      inputPlaceholder: document.querySelector('#uc2Input').getAttribute('placeholder'),
      buttons: ['uc2Enc', 'uc2Dec', 'uc2Char'].map((id) => document.getElementById(id).textContent.trim()),
      panelTitles: [...document.querySelectorAll('.tool-card-panel .panel-title')].map((el) =>
        el.textContent.trim(),
      ),
    }));

  // ── 场景 1：把转义还原成中文 ──
  await page.fill('#uc2Input', DECODE_INPUT);
  await page.click('#uc2Dec');
  await page.waitForFunction(() => document.querySelector('#uc2Status').textContent === '解码完成');
  const decoded = await read();
  eq(decoded.panelTitles, ['输入内容', '结果'], '面板标题');
  eq(decoded.input, DECODE_INPUT, '输入文本');
  eq(decoded.output, DECODE_OUTPUT, '解码输出');
  eq(decoded.status, '解码完成', '状态条文案');
  eq(decoded.statusClass, 'status-msg show success', '状态条类名');
  eq(decoded.buttons, ['转 Unicode', '还原文本', '逐字分析'], '三个转换按钮文案');
  eq(decoded.outputReadonly, true, '输出框只读');
  eq(decoded.inputPlaceholder, '输入文本或 \\uXXXX 转义内容', '输入框占位文案');

  await shot(pair, 'decode-zh-text.jpg', {
    alt: ALT_DECODE,
    caption: CAPTION_DECODE,
    source: '/tools/dev/unicode-converter/',
    purpose: '支撑正文“把 \\u4e2d\\u6587 粘进去点还原文本，结果框显示中文、状态条变绿”的断言。',
  });

  // ── 场景 2：把中文变成转义 ──
  await page.fill('#uc2Input', ENCODE_INPUT);
  await page.click('#uc2Enc');
  await page.waitForFunction(() => document.querySelector('#uc2Status').textContent === '编码完成');
  const encoded = await read();
  eq(encoded.input, ENCODE_INPUT, '编码输入');
  eq(encoded.output, ENCODE_OUTPUT, '编码输出');
  eq(encoded.status, '编码完成', '编码状态条文案');
  eq(encoded.statusClass, 'status-msg show success', '编码状态条类名');
  eq(encoded.panelTitles, ['输入内容', '结果'], '编码时面板标题');

  await shot(pair, 'encode-zh-escape.jpg', {
    alt: ALT_ENCODE,
    caption: CAPTION_ENCODE,
    source: '/tools/dev/unicode-converter/',
    purpose: '支撑正文“输入汉字点转 Unicode，得到反斜杠加四位大写十六进制”的断言。',
  });
}
