// Unix 时间戳文章（slug: unix-timestamp-seconds-milliseconds）的截图用例，恰好两个场景：
//   1) len-hint：页面顶部「当前时间」面板。固定时钟 2026-11-16T00:00:00Z，面板里
//      「本地时间」显示本地日期时间与星期，「秒级时间戳」「毫秒时间戳」并排显示两个数字。
//   2) tz-preview：在「时间戳转日期」输入 1794787200 点「转换」，结果框三行
//      （本地时间 / ISO 时间 / 单位），下方状态行显示「转换成功」。
// 时钟用 page.clock.install/pauseAt 钉在 goto 之前；时区用 CDP 钉成 UTC，保证「本地时间」
// 一栏等于 UTC。context 由 capture-tool 提供，本文件不启动服务器、不构建、不写 captures.json。
const PINNED = new Date('2026-11-16T00:00:00Z');
const SAMPLE_SECONDS = '1794787200';
const SAMPLE_MILLIS = '1794787200000';

const ALT_LEN =
  '时间戳转换页面顶部「当前时间」面板：右上角有「复制时间戳」按钮，下方三栏并排，左栏标题「本地时间」显示带星期的日期时间，中间标题「秒级时间戳」、右侧标题「毫秒时间戳」各显示一个等宽字体的数字。';
const CAPTION_LEN =
  '「当前时间」面板：左栏「本地时间」显示日期时间与星期，中间「秒级时间戳」与右侧「毫秒时间戳」并排显示两个数字，右上角是「复制时间戳」按钮。';
const ALT_TZ =
  '时间戳转换页面「时间戳转日期」面板：输入框内是十个数字，下方有「转换」与「用当前时间戳」按钮，结果框三行依次以「本地时间：」「ISO 时间：」「单位：」开头，下方状态行显示「转换成功」。';
const CAPTION_TZ =
  '「时间戳转日期」面板：输入框内为十个数字，点「转换」后结果框第一行「本地时间：」并附星期，第二行「ISO 时间：」以 Z 结尾，第三行「单位：」，框下状态行为「转换成功」。';

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
  await page.goto(`${base}/tools/daily/timestamp/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#nowSeconds') && document.querySelector('#tsToDateBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  const panels = page.locator('.tool-workspace .tool-card-panel');
  const count = await panels.count();
  if (count !== 3) throw new Error(`面板数应为 3，实际 ${count}`);
  const nowPanel = panels.nth(0);
  const tsPanel = panels.nth(1);

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };

  // ── 场景 1：当前时间三栏 ──
  const nowState = await page.evaluate(() => ({
    clock: document.querySelector('#nowClock').textContent,
    seconds: document.querySelector('#nowSeconds').textContent,
    millis: document.querySelector('#nowMillis').textContent,
    labels: [...document.querySelectorAll('.now-label')].map((el) => el.textContent.trim()),
    copy: document.querySelector('#copyNow').textContent.trim(),
  }));
  eq(nowState.labels, ['本地时间', '秒级时间戳', '毫秒时间戳'], '三栏标签');
  eq(nowState.seconds, SAMPLE_SECONDS, '秒级回显');
  eq(nowState.millis, SAMPLE_MILLIS, '毫秒回显');
  eq(nowState.clock, '2026-11-16 00:00:00 (周一)', '本地时间回显');
  if (nowState.copy !== '复制时间戳') throw new Error(`复制按钮文案异常：${nowState.copy}`);
  await shot(nowPanel, 'len-hint', { alt: ALT_LEN, caption: CAPTION_LEN });

  // ── 场景 2：10 位输入按秒解释 ──
  await page.fill('#tsInput', SAMPLE_SECONDS);
  await page.click('#tsToDateBtn');
  await page.waitForTimeout(80);
  const tsState = await page.evaluate(() => ({
    output: document.querySelector('#tsDateOutput').value,
    status: document.querySelector('#tsStatus').textContent,
    statusClass: document.querySelector('#tsStatus').className,
    input: document.querySelector('#tsInput').value,
    buttons: [...document.querySelectorAll('.btn-row button')].map((el) => el.textContent.trim()),
  }));
  eq(tsState.input, SAMPLE_SECONDS, '输入框内容');
  eq(tsState.output.split('\n'), [
    '本地时间：2026-11-16 00:00:00 (周一)',
    'ISO 时间：2026-11-16T00:00:00.000Z',
    '单位：秒级时间戳',
  ], '结果三行');
  eq(tsState.status, '转换成功', '状态行');
  eq(tsState.statusClass, 'status-msg show success', '状态类名');
  if (tsState.buttons[0] !== '转换') throw new Error(`按钮文案异常：${tsState.buttons.join('/')}`);
  await shot(tsPanel, 'tz-preview', { alt: ALT_TZ, caption: CAPTION_TZ });
}
