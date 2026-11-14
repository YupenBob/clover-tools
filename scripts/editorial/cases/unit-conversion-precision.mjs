// 单位换算精度文章（slug: unit-conversion-precision）的截图用例，恰好两个场景：
//   1) unit-convert-temperature-37c：类别「温度」，从「摄氏度 (°C)」到「华氏度 (°F)」，数值 37，
//      点「换算」，展示设置区下拉与数值、结果区「37 摄氏度 (°C) =」/98.6/「华氏度 (°F)」。
//   2) unit-convert-area-3mu：类别「面积」，从「亩」到「平方米」，数值 3，点「换算」，
//      结果区显示「3 亩 =」/2000.0001/「平方米」。
// 页面只有两个 .tool-card-panel；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM，不改页面源文件。时钟固定为 2026-11-14T00:00:00Z，clock.install/pauseAt
// 在 goto 之前；context 由 capture-tool 提供，本文件不启动服务器、不做构建、不写 captures.json。
const PINNED = new Date('2026-11-14T00:00:00Z');

const ALT_TEMP =
  '单位换算页面，类别显示「温度」，从「摄氏度 (°C)」到「华氏度 (°F)」，数值为 37，结果区自上而下为「37 摄氏度 (°C) =」「98.6」「华氏度 (°F)」，底部有「复制结果」按钮。';
const CAPTION_TEMP =
  '类别「温度」、从「摄氏度 (°C)」到「华氏度 (°F)」、数值 37：结果区第一行「37 摄氏度 (°C) =」，下方大号数字 98.6，再下一行是单位「华氏度 (°F)」，底部是「复制结果」按钮。';
const ALT_AREA =
  '单位换算页面，类别显示「面积」，从「亩」到「平方米」，数值为 3，结果区自上而下为「3 亩 =」「2000.0001」「平方米」，底部有「复制结果」按钮。';
const CAPTION_AREA =
  '类别「面积」、从「亩」到「平方米」、数值 3：结果区第一行「3 亩 =」，下方大号数字 2000.0001，再下一行是单位「平方米」，底部是「复制结果」按钮。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  // capture-tool 的 context 没有 timezoneId；用 CDP 把时区钉成 UTC，保证口径可复现。
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }
  await page.goto(`${base}/tools/daily/unit-converter/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#ucValue') && document.querySelector('#ucBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让设置与结果同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'uc-shot-pair';
    wrap.style.cssText = 'display:grid;gap:var(--workspace-gap);min-width:0;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'uc-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#uc-shot-pair');

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };
  const read = () =>
    page.evaluate(() => ({
      category: document.querySelector('#ucCat').value,
      categoryLabel: document.querySelector('#ucCat').selectedOptions[0]?.textContent,
      from: document.querySelector('#ucFrom').value,
      fromLabel: document.querySelector('#ucFrom').selectedOptions[0]?.textContent,
      to: document.querySelector('#ucTo').value,
      toLabel: document.querySelector('#ucTo').selectedOptions[0]?.textContent,
      value: document.querySelector('#ucValue').value,
      source: document.querySelector('#ucSource').textContent,
      number: document.querySelector('#ucNumber').textContent,
      unit: document.querySelector('#ucUnit').textContent,
      status: document.querySelector('#ucStatus').textContent,
      statusClass: document.querySelector('#ucStatus').className,
      copyDisabled: document.querySelector('#ucCopy').disabled,
    }));

  // ── 场景 1：37 °C → °F ──
  await page.selectOption('#ucCat', 'temperature');
  await page.selectOption('#ucFrom', 'c');
  await page.selectOption('#ucTo', 'f');
  await page.fill('#ucValue', '37');
  await page.click('#ucBtn');
  const temperature = await read();
  eq(temperature.category, 'temperature', '类别');
  eq(temperature.categoryLabel, '温度', '类别文案');
  eq(temperature.fromLabel, '摄氏度 (°C)', '源单位文案');
  eq(temperature.toLabel, '华氏度 (°F)', '目标单位文案');
  eq(temperature.value, '37', '输入值');
  eq(temperature.source, '37 摄氏度 (°C) =', '结果区第一行');
  eq(temperature.number, '98.6', '结果数字');
  eq(temperature.unit, '华氏度 (°F)', '结果单位');
  eq(temperature.status, '', '状态行应为空');
  eq(temperature.statusClass, 'status-msg', '状态行应隐藏（hideStatus）');
  eq(temperature.copyDisabled, false, '复制应可用');

  await shot(pair, 'unit-convert-temperature-37c.jpg', {
    alt: ALT_TEMP,
    caption: CAPTION_TEMP,
    source: '/tools/daily/unit-converter/',
    purpose: '支撑正文「37 °C 的原始浮点结果是 98.60000000000001，经 12 位有效数字显示为 98.6」的断言。',
  });

  // ── 场景 2：3 亩 → 平方米 ──
  await page.selectOption('#ucCat', 'area');
  await page.selectOption('#ucFrom', 'mu');
  await page.selectOption('#ucTo', 'm2');
  await page.fill('#ucValue', '3');
  await page.click('#ucBtn');
  const area = await read();
  eq(area.category, 'area', '类别');
  eq(area.categoryLabel, '面积', '类别文案');
  eq(area.fromLabel, '亩', '源单位文案');
  eq(area.toLabel, '平方米', '目标单位文案');
  eq(area.value, '3', '输入值');
  eq(area.source, '3 亩 =', '结果区第一行');
  eq(area.number, '2000.0001', '结果数字');
  eq(area.unit, '平方米', '结果单位');
  eq(area.status, '', '状态行应为空');
  eq(area.statusClass, 'status-msg', '状态行应隐藏（hideStatus）');
  eq(area.copyDisabled, false, '复制应可用');

  await shot(pair, 'unit-convert-area-3mu.jpg', {
    alt: ALT_AREA,
    caption: CAPTION_AREA,
    source: '/tools/daily/unit-converter/',
    purpose: '支撑正文「亩的 factor 是 666.6667 近似值，3 亩显示 2000.0001 而不是 2000」的断言。',
  });
}
