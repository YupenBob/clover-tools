// Base64 不是加密文章（slug: base64-not-encryption）的截图用例，恰好两个场景：
//   1) base64-encode-urlsafe：点「示例」→ 勾选「URL 安全模式」→ 点「编码」，
//      展示输入框与其统计（18 字符 · 30 字节）、复选框、输出框的 40 个字符与统计、绿色「编码完成」。
//   2) base64-decode-error：填入不能解码的内容 → 点「解码」，
//      展示被清空的输出框、红色「解码失败：…」状态条，以及仍保留上一次结果的统计行。
// 页面只有两个 .tool-card-panel；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM，不改页面源文件。时钟固定为 2026-11-15T00:00:00Z，install/pauseAt 在 goto 之前；
// context 由 capture-tool 提供，本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-15T00:00:00Z');
const SAMPLE = 'CloverTools 开发者工具箱';
const SAMPLE_B64URL = 'Q2xvdmVyVG9vbHMg5byA5Y-R6ICF5bel5YW3566x';
const BAD_INPUT = '这不是 base64!!';

const ALT_ENCODE =
  'Base64 编解码工具两个面板并排：左侧输入示例文本（18 字符 · 30 字节）且已勾选 URL 安全模式，右侧输出 40 个字符；左下绿色状态条「编码完成」。';
const CAPTION_ENCODE =
  '勾选「URL 安全模式」后点「编码」，左右两个面板并排：左侧输入框保留示例文本，框下统计为 18 字符 · 30 字节，复选框已勾选，面板底部是绿色状态条「编码完成」；右侧输出框里是 40 个字符的 Base64，框下统计为 40 字符 · 30 字节。';
const ALT_ERROR =
  'Base64 编解码工具两个面板并排：左侧输入 12 字符非法内容（18 字节），右侧输出框回到空状态；左下红色状态条以「解码失败：内容不是有效的 Base64 / UTF-8」开头，右下统计仍显示 2 字符 · 6 字节。';
const CAPTION_ERROR =
  '输入一串不是 Base64 的内容后点「解码」：左侧输入框是这段非法内容，面板底部是红色状态条，文字以「解码失败：内容不是有效的 Base64 / UTF-8」开头；右侧输出框回到空状态，只显示空状态文案「结果将显示在这里」，框下统计仍保留上一次解码留下的 2 字符 · 6 字节。';

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
  await page.goto(`${base}/tools/dev/base64/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#b64Input') && document.querySelector('#encodeBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让输入与结果同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'b64-shot-pair';
    wrap.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'b64-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#b64-shot-pair');
  // 两个文本框在桌面上默认很高，截图里留白太多；临时压到 112px，只影响这张截图。
  await page.evaluate(() => {
    for (const id of ['b64Input', 'b64Output']) {
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
      input: document.querySelector('#b64Input').value,
      output: document.querySelector('#b64Output').value,
      inStats: document.querySelector('#b64InStats').textContent,
      outStats: document.querySelector('#b64OutStats').textContent,
      status: document.querySelector('#b64Status').textContent,
      statusClass: document.querySelector('#b64Status').className,
      urlSafe: document.querySelector('#urlSafe').checked,
      panelTitles: [...document.querySelectorAll('.tool-card-panel .panel-title')].map((el) =>
        el.textContent.trim(),
      ),
    }));

  // ── 场景 1：URL 安全模式下的编码 ──
  await page.click('#b64Sample');
  await page.check('#urlSafe');
  await page.click('#encodeBtn');
  await page.waitForFunction(() => document.querySelector('#b64Status').textContent === '编码完成');
  const encoded = await read();
  eq(encoded.panelTitles, ['输入内容', '输出结果'], '面板标题');
  eq(encoded.input, SAMPLE, '示例输入');
  eq(encoded.urlSafe, true, 'URL 安全模式已勾选');
  eq(encoded.inStats, '18 字符 · 30 字节', '输入统计');
  eq(encoded.output, SAMPLE_B64URL, 'URL 安全输出');
  eq(encoded.output.length, 40, '输出字符数');
  eq(encoded.outStats, '40 字符 · 30 字节', '输出统计');
  eq(encoded.status, '编码完成', '状态条文案');
  eq(encoded.statusClass, 'status-msg show success', '状态条类名');

  await shot(pair, 'base64-encode-urlsafe.jpg', {
    alt: ALT_ENCODE,
    caption: CAPTION_ENCODE,
    source: '/tools/dev/base64/',
    purpose: '支撑正文“示例文本 18 字符 · 30 字节编码后是 40 个字符，URL 安全模式把 + 换成 -”的断言。',
  });

  // ── 场景 2：解码失败态（先关掉 URL 安全模式，回到默认状态） ──
  await page.uncheck('#urlSafe');
  await page.click('#b64Clear');
  await page.fill('#b64Input', '5L2g5aW9');
  await page.click('#decodeBtn');
  await page.waitForFunction(() => document.querySelector('#b64Status').textContent === '解码完成');
  const beforeError = await read();
  eq(beforeError.outStats, '2 字符 · 6 字节', '上一次解码的输出统计');

  await page.click('#b64Clear');
  await page.fill('#b64Input', BAD_INPUT);
  await page.click('#decodeBtn');
  await page.waitForFunction(() => document.querySelector('#b64Status').className === 'status-msg show error');
  const failed = await read();
  eq(failed.input, BAD_INPUT, '失败输入');
  eq(failed.output, '', '失败时输出已清空');
  eq(failed.statusClass, 'status-msg show error', '失败状态类名');
  eq(failed.status.startsWith('解码失败：内容不是有效的 Base64 / UTF-8'), true, '失败文案前缀');
  eq(failed.outStats, '2 字符 · 6 字节', '统计未刷新，仍是上一次的值');
  eq(failed.urlSafe, false, 'URL 安全模式未勾选');

  await shot(pair, 'base64-decode-error.jpg', {
    alt: ALT_ERROR,
    caption: CAPTION_ERROR,
    source: '/tools/dev/base64/',
    purpose: '支撑正文“解码失败时输出被清空，但下方统计仍保留上一次的值”的断言。',
  });
}
