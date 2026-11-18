// URL 编码指南（slug: url-encoding-guide）的截图用例，恰好两个场景，都取站内 URL 编码工具：
//   1) url-encode-component-result：模式选「编码（encodeURIComponent）」→ 输入 a&b=c 杭州市 → 点「转换」，
//      展示输入框文本、下拉框选中项、绿色「转换完成」、输出框里 39 个字符的编码结果与「复制」按钮。
//   2) url-encode-decode-error：模式切到「解码（decodeURIComponent）」→ 输入不完整的 %E4 → 点「转换」，
//      展示被清空的输出框（空状态文案）与红色「转换失败：URI malformed」状态条。
// 页面只有两个 .tool-card-panel；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM，不改页面源文件。时钟固定为 2026-11-18T00:00:00Z，install/pauseAt 在 goto 之前；
// context 由 capture-tool 提供，本文件不启动服务器、不做构建。Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-18T00:00:00Z');
const INPUT_TEXT = 'a&b=c 杭州市';
const ENCODED = 'a%26b%3Dc%20%E6%9D%AD%E5%B7%9E%E5%B8%82';
const BAD_INPUT = '%E4';

const ALT_ENCODE =
  'URL 编码工具两个面板并排：左侧输入框是 a&b=c 杭州市，下方模式下拉框显示「编码（encodeURIComponent）」，再下方是深色「转换」按钮与浅绿色状态条「转换完成」；右侧「转换结果」输出框里是 a%26b%3Dc%20%E6%9D%AD%E5%B7%9E%E5%B8%82，右上角有「复制」按钮。';
const CAPTION_ENCODE =
  '选「编码（encodeURIComponent）」后输入 a&b=c 杭州市 点「转换」：右侧输出框得到 a%26b%3Dc%20%E6%9D%AD%E5%B7%9E%E5%B8%82，& 和 = 变成 %26 与 %3D、空格是 %20、中文是 9 组 %XX；左侧面板下方是绿色状态条「转换完成」。';
const ALT_ERROR =
  'URL 编码工具两个面板并排：左侧输入框是 %E4，模式下拉框显示「解码（decodeURIComponent）」，面板下方是红色状态条，文字以「转换失败：URI malformed」开头；右侧输出框回到空状态，只显示「结果将显示在这里」。';
const CAPTION_ERROR =
  '把模式换成「解码（decodeURIComponent）」并输入不完整的 %E4 后点「转换」：左侧面板下方出现红色状态条，开头是「转换失败：URI malformed」；右侧输出框被清空，只剩空状态文案「结果将显示在这里」。';

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
  await page.goto(`${base}/tools/dev/url-encode/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#urlInput') && document.querySelector('#urlBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让输入与结果同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'url-shot-pair';
    wrap.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'url-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#url-shot-pair');
  // 两个文本框在桌面上默认很高，截图里留白太多；临时压到 96px，只影响这张截图。
  await page.evaluate(() => {
    for (const id of ['urlInput', 'urlOutput']) {
      const el = document.getElementById(id);
      el.style.height = '96px';
      el.style.minHeight = '96px';
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
      input: document.querySelector('#urlInput').value,
      output: document.querySelector('#urlOutput').value,
      outputPlaceholder: document.querySelector('#urlOutput').getAttribute('placeholder'),
      mode: document.querySelector('#urlMode').value,
      modeLabel: document.querySelector('#urlMode').selectedOptions[0].textContent.trim(),
      status: document.querySelector('#urlStatus').textContent,
      statusClass: document.querySelector('#urlStatus').className,
      copyLabel: document.querySelector('#urlCopy').textContent.trim(),
      panelTitles: [...document.querySelectorAll('.tool-card-panel .panel-title')].map((el) =>
        el.textContent.trim(),
      ),
    }));

  // ── 场景 1：encodeURIComponent 模式下的编码 ──
  await page.selectOption('#urlMode', 'encodeComponent');
  await page.fill('#urlInput', INPUT_TEXT);
  await page.click('#urlBtn');
  await page.waitForFunction(() => document.querySelector('#urlStatus').textContent === '转换完成');
  const encoded = await read();
  eq(encoded.panelTitles, ['输入 URL 或文本', '转换结果'], '面板标题');
  eq(encoded.input, INPUT_TEXT, '输入文本');
  eq(encoded.mode, 'encodeComponent', '模式值');
  eq(encoded.modeLabel, '编码（encodeURIComponent）', '模式文案');
  eq(encoded.output, ENCODED, '编码输出');
  eq(encoded.output.length, 39, '输出字符数');
  eq(encoded.status, '转换完成', '状态条文案');
  eq(encoded.statusClass, 'status-msg show success', '状态条类名');
  eq(encoded.copyLabel, '复制', '复制按钮文案');
  eq(encoded.outputPlaceholder, '结果将显示在这里', '输出框空状态文案');

  await shot(pair, 'url-encode-component-result.jpg', {
    alt: ALT_ENCODE,
    caption: CAPTION_ENCODE,
    source: '/tools/dev/url-encode/',
    purpose: '支撑正文“encodeURIComponent 把 & = 空格与中文分别变成 %26 %3D %20 与 9 组 %XX”的断言。',
  });

  // ── 场景 2：解码失败态 ──
  await page.selectOption('#urlMode', 'decodeComponent');
  await page.fill('#urlInput', BAD_INPUT);
  await page.click('#urlBtn');
  await page.waitForFunction(() => document.querySelector('#urlStatus').className === 'status-msg show error');
  const failed = await read();
  eq(failed.input, BAD_INPUT, '失败输入');
  eq(failed.output, '', '失败时输出已清空');
  eq(failed.modeLabel, '解码（decodeURIComponent）', '失败时模式文案');
  eq(failed.statusClass, 'status-msg show error', '失败状态类名');
  eq(failed.status, '转换失败：URI malformed', '失败文案');
  eq(failed.panelTitles, ['输入 URL 或文本', '转换结果'], '失败时面板标题');

  await shot(pair, 'url-encode-decode-error.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/url-encode/',
    purpose: '支撑正文“序列被截断时状态条出现红色「转换失败：URI malformed」、输出框被清空”的断言。',
  });
}
