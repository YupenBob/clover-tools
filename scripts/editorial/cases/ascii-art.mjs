// ASCII 艺术字文章（slug: ascii-art）的截图用例，恰好两个场景：
//   1) figlet-banner：英文艺术字模式，示例填入 CLOVER TOOLS，Standard + 默认字距 + 宽度 60；
//      截图包住「输入内容」与「终端输出」两个面板，让输入、状态条、终端输出与统计行同框。
//   2) cjk-pixel-canvas：中文像素画模式，示例填入「三叶草工具箱 / CloverTools」，
//      清晰度 8、灰阶、宽度 60；同样包住两个面板。
// 页面只有两个 .tool-card-panel，脚本在 .tool-workspace 里插入一个临时 wrapper 把两块移进去，
// 只改截图用的 DOM，不改页面源文件。时钟固定为 2026-11-13T10:00:00Z，install 在 goto 之前。
// 输出字符串（行数、首行、末行、统计）与 browser-evidence.mjs 的 DOM 读取一致。
// 本文件由 scripts/editorial/capture-tool.mjs 调用；脚本本身不启动服务器、不做构建。
const PINNED = new Date('2026-11-13T10:00:00Z');

const FIGLET_FIRST = '   ____ _     _____     _______ ____  ';
const FIGLET_SECOND = '  / ___| |   / _ \\ \\   / / ____|  _ \\ ';
const CJK_FIRST = ' =@@@@@@@@@@@@= .@%%%@-  +@+    -###@@###%@@###-';
const CJK_SECOND = '                .@* +@-  +@+      =#%@####@%#=';
const CJK_LAST = '   :--:     .---.   :=-   :---:';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.clock.install({ time: PINNED });
  await page.goto(`${base}/tools/fun/ascii-art/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#figletFont option').length === 22);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 页面没有同时包住输入与输出的外层容器，插入临时 wrapper 便于一张图说明完整流程。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'ascii-art-shot-pair';
    wrap.style.cssText = 'display:grid;gap:var(--workspace-gap);min-width:0;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'ascii-art-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#ascii-art-shot-pair');

  const read = () =>
    page.evaluate(() => {
      const pre = document.querySelector('#asciiOutput pre');
      return {
        pre: pre?.textContent ?? null,
        lines: pre ? pre.textContent.split('\n').length : 0,
        stats: document.querySelector('#asciiStats').textContent,
        meta: document.querySelector('#termMeta').textContent,
        status: document.querySelector('#asciiStatus').textContent,
        prompt: document.querySelector('#asciiOutput .term-cmd')?.textContent ?? null,
      };
    });
  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };

  // ── 场景 1：FIGlet 英文艺术字 ──
  if ((await page.locator('.seg-btn[data-mode="figlet"]').getAttribute('aria-pressed')) !== 'true') {
    throw new Error('初始应停在英文艺术字模式');
  }
  await page.waitForFunction(() => document.querySelector('#asciiStatus').textContent === '请输入英文或数字');
  await page.click('#figletSample');
  await page.waitForFunction(() => document.querySelector('#asciiStats').textContent === '10 行 · 389 字符 · 最大宽度 38');
  eq(await page.inputValue('#figletInput'), 'CLOVER TOOLS', '示例输入');
  eq(await page.inputValue('#figletFont'), 'Standard', '字体');
  eq(await page.inputValue('#figletLayout'), 'default', '字距');
  eq(await page.inputValue('#figletWidth'), '60', '每行宽度');
  const figlet = await read();
  eq(figlet.lines, 10, '输出行数');
  eq(figlet.stats, '10 行 · 389 字符 · 最大宽度 38', '统计行');
  eq(figlet.meta, '38×10', '终端右上角');
  eq(figlet.status, '生成完成', '状态条');
  eq(figlet.prompt, 'figlet -f Standard -l default -w 60 "CLOVER TOOLS"', '假命令行');
  const figletLines = figlet.pre.split('\n');
  eq(figletLines[0], FIGLET_FIRST, '首行');
  eq(figletLines[1], FIGLET_SECOND, '第二行');
  eq(figletLines.at(-1), ' '.repeat(38), '末行 38 个空格');
  if (figletLines.length !== 10 || new Set(figletLines.map((line) => line.length)).size !== 1) {
    throw new Error('FIGlet 输出应为 10 行且每行 38 字符');
  }

  await shot(pair, 'figlet-banner.jpg', {
    alt: `ASCII 艺术字工具的两个面板。上方「输入内容」面板里「英文艺术字」标签选中，输入框是 CLOVER TOOLS，字体「标准体（Standard）」、字距「默认（字体设计）」、每行宽度 60，底部绿色状态条「生成完成」。下方「终端输出」面板的假命令行是 clover@tools:~/ascii-figlet$ figlet -f Standard -l default -w 60 "CLOVER TOOLS"，随后是 10 行、每行 38 字符的块状大字：首行「${FIGLET_FIRST}」，第二行「${FIGLET_SECOND}」，末行是 38 个空格；统计行「10 行 · 389 字符 · 最大宽度 38」，终端右上角「38×10」。`,
    caption: `Standard、默认字距、宽度 60 下输入 CLOVER TOOLS 的完整结果（假时钟 2026-11-13T10:00:00Z）：终端输出 10 行、每行 38 字符，首行是「${FIGLET_FIRST}」，统计行「10 行 · 389 字符 · 最大宽度 38」，状态条「生成完成」。`,
    source: '/tools/fun/ascii-art/',
    purpose: '展示英文艺术字的默认字体、默认宽度与成功状态下的完整输入/输出链路',
  });

  // ── 场景 2：中文像素画 ──
  await page.click('.seg-btn[data-mode="cjk"]');
  await page.waitForFunction(() => document.querySelector('#asciiStatus').textContent === '请输入要转换的文字');
  await page.click('#cjkSample');
  await page.selectOption('#cjkRes', '8');
  await page.selectOption('#cjkCharset', 'gray');
  await page.selectOption('#cjkWidth', '60');
  await page.waitForFunction(() => document.querySelector('#asciiStats').textContent === '30 行 · 1373 字符 · 最大宽度 60');
  eq(await page.inputValue('#cjkInput'), '三叶草工具箱\nCloverTools', '示例输入');
  eq(await page.inputValue('#cjkRes'), '8', '清晰度');
  eq(await page.inputValue('#cjkCharset'), 'gray', '字符集');
  const cjk = await read();
  eq(cjk.lines, 30, '输出行数');
  eq(cjk.stats, '30 行 · 1373 字符 · 最大宽度 60', '统计行');
  eq(cjk.meta, '60×30', '终端右上角');
  eq(cjk.status, '生成完成', '状态条');
  eq(cjk.prompt, 'clover-ascii "三叶草工具箱\nCloverTools" -res 8 -charset gray -w 60', '假命令行');
  const cjkLines = cjk.pre.split('\n');
  eq(cjkLines[0], CJK_FIRST, '首行');
  eq(cjkLines[1], CJK_SECOND, '第二行');
  eq(cjkLines.at(-1), CJK_LAST, '末行');
  const cjkChars = [...new Set(cjk.pre)].filter((ch) => ch !== '\n');
  for (const ch of cjkChars) {
    if (!' .:-=+*#%@'.includes(ch)) throw new Error(`灰阶字符集出现表外字符：${JSON.stringify(ch)}`);
  }

  await shot(pair, 'cjk-pixel-canvas.jpg', {
    alt: `ASCII 艺术字工具的中文像素画结果。上方「输入内容」面板里「中文像素画」标签选中，输入框是两行「三叶草工具箱」和「CloverTools」，清晰度 8、字符集「细腻灰阶（纯 ASCII）」、每行宽度 60、反色未勾选，底部绿色状态条「生成完成」。下方「终端输出」面板的假命令行分两行显示：第一行 clover@tools:~/ascii-cjk$ clover-ascii "三叶草工具箱，第二行 CloverTools" -res 8 -charset gray -w 60，终端可滚动，图中可见输出开头：首行「${CJK_FIRST}」，第二行「${CJK_SECOND}」；统计行「30 行 · 1373 字符 · 最大宽度 60」，终端右上角「60×30」。`,
    caption: `中文像素画示例（8 行/字、灰阶、宽度 60，假时钟 2026-11-13T10:00:00Z）：输入「三叶草工具箱」换行「CloverTools」，输出统计 30 行、最大宽度 60，首行「${CJK_FIRST}」，第二行「${CJK_SECOND}」，状态条「生成完成」；终端可滚动，图中展示开头部分。`,
    source: '/tools/fun/ascii-art/',
    purpose: '展示中文像素画的默认清晰度、灰阶字符集与换行后的实际像素行数',
  });
}
