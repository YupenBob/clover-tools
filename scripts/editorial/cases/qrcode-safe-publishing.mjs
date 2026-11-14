// 二维码安全发布文章（slug: qrcode-safe-publishing）的截图用例，恰好两个场景：
//   1) qrcode-generate-384-m：填入 https://clovertools.cn，尺寸 384px、级别 M，点「生成」，
//      展示设置区（尺寸/级别/状态「生成成功」）与下方预览（384×384 白底二维码、下载按钮可用）。
//   2) qrcode-over-capacity：填入 3000 个 a，点「生成」，展示「生成失败: The amount of data is
//      too big to be stored in a QR Code」与「等待生成」空态、下载按钮禁用。
// 页面只有两个 .tool-card-panel；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM（场景 2 另把输入框临时限高，避免 3000 字符把画面拉得过长），不改页面源文件。
// 时钟固定为 2026-11-14T00:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-14T00:00:00Z');
const URL22 = 'https://clovertools.cn';
const OVER_MESSAGE = 'The amount of data is too big to be stored in a QR Code';
const CAPTION_GENERATE =
  '填入 https://clovertools.cn 后生成：尺寸显示 384px、容错级别显示 M (15%)，状态条写「生成成功」，「下载 PNG」按钮已可用，下方预览是白底、深色模块的二维码。';
const CAPTION_OVER =
  '填入一长串字母 a 后生成：状态条写「生成失败: The amount of data is too big to be stored in a QR Code」，下方预览仍显示「等待生成」与「填写内容并生成，预览会显示在这里。」，「下载 PNG」按钮不可用。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  // capture-tool 的 context 没有 timezoneId；用 CDP 把时区钉成 UTC，保证图注口径可复现。
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }
  await page.goto(`${base}/tools/dev/qrcode/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#qrText') && document.querySelector('#qrBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让设置与预览同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'qr-shot-pair';
    wrap.style.cssText = 'display:grid;gap:var(--workspace-gap);min-width:0;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'qr-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#qr-shot-pair');

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };
  const read = () =>
    page.evaluate(() => ({
      type: document.querySelector('#qrType').value,
      size: document.querySelector('#qrSize').value,
      level: document.querySelector('#qrLevel').value,
      status: document.querySelector('#qrStatus').textContent,
      statusClass: document.querySelector('#qrStatus').className,
      ready: document.querySelector('#qrPreview').dataset.ready,
      canvas: {
        width: document.querySelector('#qrCanvas').width,
        height: document.querySelector('#qrCanvas').height,
        hidden: document.querySelector('#qrCanvas').hidden,
      },
      emptyHidden: document.querySelector('#qrEmpty').hidden,
      downloadDisabled: document.querySelector('#qrDownload').disabled,
    }));
  const waitSuccess = () =>
    page.waitForFunction(
      () => document.querySelector('#qrPreview')?.dataset.ready === 'true' && document.querySelector('#qrStatus')?.textContent === '生成成功',
    );
  const waitFailure = () =>
    page.waitForFunction(() => (document.querySelector('#qrStatus')?.textContent ?? '').startsWith('生成失败'));

  // ── 场景 1：384px、M 级、正常生成 ──
  await page.fill('#qrText', URL22);
  await page.selectOption('#qrSize', '384');
  await page.selectOption('#qrLevel', 'M');
  await page.click('#qrBtn');
  await waitSuccess();
  const generated = await read();
  eq(generated.type, 'qrcode', '类型');
  eq(generated.size, '384', '尺寸');
  eq(generated.level, 'M', '容错级别');
  eq(generated.status, '生成成功', '状态文案');
  eq(generated.statusClass, 'status-msg show success', '状态类名');
  eq(generated.ready, 'true', '预览就绪');
  eq(generated.canvas, { width: 384, height: 384, hidden: false }, '画布尺寸与可见性');
  eq(generated.emptyHidden, true, '空态应隐藏');
  eq(generated.downloadDisabled, false, '下载应启用');
  eq(await page.inputValue('#qrText'), URL22, '输入框内容');
  eq(await page.getAttribute('#qrDownload', 'type'), 'button', '下载按钮类型');

  await shot(pair, 'qrcode-generate-384-m.jpg', {
    alt: `二维码生成器填入 ${URL22} 后生成：尺寸 384px、容错级别 M (15%)、状态条「生成成功」，下方预览为白底、深色模块的方形二维码（canvas 尺寸 384×384），下载按钮可用。`,
    caption: CAPTION_GENERATE,
    source: '/tools/dev/qrcode/',
    purpose: '支撑正文“384px 下版本 2 的模块缩放与正常生成状态”的断言。',
  });

  // ── 场景 2：超出版本 40 容量 ──
  await page.fill('#qrText', 'a'.repeat(3000));
  await page.evaluate(() => {
    const textarea = document.querySelector('#qrText');
    textarea.style.height = '110px';
    textarea.scrollTop = 0;
  });
  await page.click('#qrBtn');
  await waitFailure();
  const failed = await read();
  eq(failed.status, `生成失败: ${OVER_MESSAGE}`, '失败文案');
  eq(failed.statusClass, 'status-msg show error', '失败状态类名');
  eq(failed.ready, 'false', '失败后预览未就绪');
  eq(failed.emptyHidden, false, '空态应可见');
  eq(failed.downloadDisabled, true, '失败后下载禁用');
  eq(failed.canvas.hidden, true, '失败后画布应隐藏');
  eq((await page.inputValue('#qrText')).length, 3000, '输入长度');

  await shot(pair, 'qrcode-over-capacity.jpg', {
    alt: `二维码生成器填入长串字母 a 后生成：状态条「生成失败: ${OVER_MESSAGE}」，下方预览仍为「等待生成」空态，下载按钮不可用。`,
    caption: CAPTION_OVER,
    source: '/tools/dev/qrcode/',
    purpose: '支撑正文“超过版本 40 容量时工具显示生成失败、保持空态并禁用下载”的断言。',
  });
}
