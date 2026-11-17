// BMI 指南（slug: bmi-reference-not-diagnosis）的截图用例，两个场景：
//   1) bmi-metric-175-70：/tools/daily/bmi/ 打开即默认「公制 · cm / kg」、身高 175、体重 70、
//      「成人参考标准」为「中国标准 · 18.5 / 24 / 28」，结果区读数 22.9 与「参考区间」标签。
//   2) bmi-standard-who-168：同一页面把「成人参考标准」切到「WHO 标准 · 18.5 / 25 / 30」，
//      身高 168、体重 70，结果区读数 24.8，标签仍是「参考区间」，刻度为 18.5 / 25 / 30。
// 页面左右两栏本来就在同一个 .daily-composition 里，直接整块截图，不改 DOM。
// 时钟固定 2026-11-17T10:00:00Z，clock.install/pauseAt 在 goto 之前；时区用 CDP 钉成 UTC。
// context 由 capture-tool 提供，本文件不启动服务器、不做构建、不写 captures.json。
const PINNED = new Date('2026-11-17T10:00:00Z');

const ALT_METRIC =
  'BMI 计算器页面，左栏「输入参数」下计量单位为「公制 · cm / kg」，身高 175 cm、体重 70 kg，成人参考标准为「中国标准 · 18.5 / 24 / 28」，左下有「计算」按钮；右栏标题「BODY MASS INDEX」，大号读数 22.9，旁边标签「参考区间」，下方刻度为 12、18.5、24、28、40，再下方是「BMI 18.5–<24 对应体重」与「56.7–<73.5 kg」，底部「复制结果」按钮。';
const CAPTION_METRIC =
  '默认输入 175 cm / 70 kg、中国标准：右栏第一行标题「BODY MASS INDEX」，大号数字 22.9，旁边标签「参考区间」，下方刻度 12、18.5、24、28、40，再下方「BMI 18.5–<24 对应体重」与「56.7–<73.5 kg」，底部是「复制结果」按钮。';

const ALT_WHO =
  'BMI 计算器页面，左栏「输入参数」下计量单位为「公制 · cm / kg」，身高 168 cm、体重 70 kg，成人参考标准已切到「WHO 标准 · 18.5 / 25 / 30」，左下有「计算」按钮；右栏标题「BODY MASS INDEX」，大号读数 24.8，旁边标签仍为「参考区间」，下方刻度为 12、18.5、25、30、40，再下方是「BMI 18.5–<25 对应体重」与「52.2–<70.6 kg」，底部「复制结果」按钮。';
const CAPTION_WHO =
  '切到 WHO 标准、输入 168 cm / 70 kg：右栏大号数字 24.8，旁边标签仍是「参考区间」，刻度变为 18.5、25、30，下方「BMI 18.5–<25 对应体重」显示「52.2–<70.6 kg」。';

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
  await page.goto(`${base}/tools/daily/bmi/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#bmiNumber'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };
  const read = () =>
    page.evaluate(() => ({
      units: document.querySelector('#bmiUnits').value,
      standard: document.querySelector('#bmiStandard').value,
      height: document.querySelector('#bmiHeight').value,
      weight: document.querySelector('#bmiWeight').value,
      number: document.querySelector('#bmiNumber').textContent.trim(),
      category: document.querySelector('#bmiCategory').textContent.trim(),
      referenceLabel: document.querySelector('#bmiReferenceLabel').textContent.trim(),
      reference: document.querySelector('#bmiReference').textContent.trim(),
      ticks: [...document.querySelectorAll('#bmiTicks span')].map((s) => s.textContent),
    }));

  // ── 场景 1：默认公制 + 中国标准 ──
  const metric = await read();
  eq(metric.units, 'metric', '计量单位');
  eq(metric.standard, 'cn', '成人参考标准');
  eq(metric.height, '175', '身高');
  eq(metric.weight, '70', '体重');
  eq(metric.number, '22.9', '读数');
  eq(metric.category, '参考区间', '分类标签');
  eq(metric.referenceLabel, 'BMI 18.5–<24 对应体重', '对应体重标题');
  eq(metric.reference, '56.7–<73.5 kg', '对应体重');
  eq(metric.ticks, ['12', '18.5', '24', '28', '40'], '刻度');

  await shot(page.locator('.daily-composition'), 'bmi-metric-175-70.jpg', {
    alt: ALT_METRIC,
    caption: CAPTION_METRIC,
    source: '/tools/daily/bmi/',
    purpose: '支撑正文「默认身高 175、体重 70、中国标准，读数 22.9 与参考区间标签」的断言。',
  });

  // ── 场景 2：切到 WHO 标准 + 168 cm / 70 kg（同一读数在两套标准下分类不同） ──
  await page.selectOption('#bmiStandard', 'who');
  await page.fill('#bmiHeight', '168');
  await page.fill('#bmiWeight', '70');
  await page.evaluate(() => document.activeElement?.blur());
  const who = await read();
  eq(who.standard, 'who', '成人参考标准');
  eq(who.height, '168', '身高');
  eq(who.weight, '70', '体重');
  eq(who.number, '24.8', '读数');
  eq(who.category, '参考区间', 'WHO 分类标签');
  eq(who.referenceLabel, 'BMI 18.5–<25 对应体重', '对应体重标题');
  eq(who.reference, '52.2–<70.6 kg', '对应体重');
  eq(who.ticks, ['12', '18.5', '25', '30', '40'], '刻度');

  await shot(page.locator('.daily-composition'), 'bmi-standard-who-168.jpg', {
    alt: ALT_WHO,
    caption: CAPTION_WHO,
    source: '/tools/daily/bmi/',
    purpose: '支撑正文「168 cm / 70 kg 在 WHO 标准下读数 24.8、标签仍为参考区间」的断言。',
  });
}
