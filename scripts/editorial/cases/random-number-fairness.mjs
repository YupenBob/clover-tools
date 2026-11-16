// 随机数公平性文章（slug: random-number-fairness）的截图用例，恰好两个场景：
//   1) random-number-unique：默认 1–100、数量 5、勾选「不重复（需范围足够）」，
//      用一个固定字节序列让结果稳定为 1/97/98/99/100，展示输入、绿色状态条与升序结果。
//   2) lottery-two-winners：5 行名单、中奖人数 2，点「开始抽奖」后等两位幸运儿揭晓，
//      展示浮层标题「幸运时刻」、副标题「2 位幸运儿已揭晓」、中奖名单与底部三个按钮。
// 为了截图可复现：random-number 页在 goto 前把 Crypto.prototype.getRandomValues 固定为全 0，
// lottery 页把 Math.random 固定为 0（两名中奖者因此稳定为名单前两人）；只影响截图进程，不改页面源文件。
// 时钟固定为 2026-11-17T06:00:00Z，时区用 CDP 钉成 UTC；context 由 capture-tool 提供，本文件不启动服务器、不做构建。
const PINNED = new Date('2026-11-17T06:00:00Z');
const NAMES = ['张三', '李四', '王五', '赵六', '钱七'];

const ALT_UNIQUE =
  '随机数工具左右两个面板：左侧「随机数配置」面板里最小值 1、最大值 100、数量 5，已勾选「不重复（需范围足够）」，底部是「生成随机数」按钮与绿色状态条「已生成 5 个随机数」；右侧「生成结果」面板顶部是「复制」按钮，结果框内 5 行数字，从 1、97、98、99 到 100 依次向下排列。';

const CAPTION_UNIQUE =
  '范围 1–100、数量 5、勾选不重复后点「生成随机数」：左侧状态条是绿色「已生成 5 个随机数」，右侧结果框逐行列出 1、97、98、99、100 五个值；这组值没有重复且按升序排列。';

const ALT_LOTTERY =
  '抽签工具的全屏浮层：左上角标题「幸运时刻」，下方副标题「2 位幸运儿已揭晓」；中间三列老虎机滚轮停住；滚轮下方是「恭喜！」状态行，再往下两枚中奖标签依次为「1. 张三」「2. 李四」；浮层底部并排「复制结果」「再抽一次」「完成」三个按钮。';

const CAPTION_LOTTERY =
  '5 人名单、中奖人数 2，点「开始抽奖」并等两位幸运儿揭晓：浮层标题是「幸运时刻」，副标题变成「2 位幸运儿已揭晓」，状态行是「恭喜！」，下方两枚标签为「1. 张三」「2. 李四」，底部的「复制结果」「再抽一次」「完成」三个按钮同时出现。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'getRandomValues', {
      configurable: true,
      value(array) {
        array.fill(0);
        return array;
      },
    });
    Math.random = () => 0;
  });

  const hideChrome = () =>
    page.addStyleTag({
      content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
    });

  // ── 场景 1：不重复随机数 ──
  await page.goto(`${base}/tools/fun/random-number/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#rnBtn');
  await hideChrome();

  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'rnf-shot-pair';
    wrap.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;align-items:start;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'rnf-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#rnf-shot-pair');

  await page.click('#rnBtn');
  await page.waitForFunction(() => document.querySelector('#rnStatus').textContent === '已生成 5 个随机数');
  const result = await page.evaluate(() => ({
    output: document.querySelector('#rnOutput').value,
    status: document.querySelector('#rnStatus').textContent,
    statusClass: document.querySelector('#rnStatus').className,
    min: document.querySelector('#rnMin').value,
    max: document.querySelector('#rnMax').value,
    count: document.querySelector('#rnCount').value,
    unique: document.querySelector('#rnUnique').checked,
  }));
  const expected = '1\n97\n98\n99\n100';
  if (result.output !== expected) throw new Error(`随机数结果应为 ${JSON.stringify(expected)}，实际 ${JSON.stringify(result.output)}`);
  if (result.status !== '已生成 5 个随机数') throw new Error(`状态条文案不符：${result.status}`);
  if (result.statusClass !== 'status-msg show success') throw new Error(`状态条类名不符：${result.statusClass}`);
  if (!result.unique || result.min !== '1' || result.max !== '100' || result.count !== '5') {
    throw new Error('默认配置不符');
  }

  await shot(pair, 'random-number-unique.jpg', {
    alt: ALT_UNIQUE,
    caption: CAPTION_UNIQUE,
    source: '/tools/fun/random-number/',
    purpose: '支撑正文“不重复模式下结果不重复且按升序输出，范围两端 1 与 100 都可被取到”的断言。',
  });

  // ── 场景 2：抽签浮层两位中奖者 ──
  await page.goto(`${base}/tools/fun/lottery/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#lotBtn');
  await hideChrome();
  await page.fill('#lotNames', NAMES.join('\n'));
  await page.fill('#lotCount', '2');
  await page.click('#lotBtn');
  await page.waitForSelector('#lotteryOverlay.open');
  await page.waitForFunction(
    () =>
      document.querySelector('#lotStatusMsg').textContent === '恭喜！' &&
      document.querySelectorAll('#lotWinners .winner-chip').length === 2,
    null,
    { timeout: 60000 },
  );

  const draw = await page.evaluate(() => ({
    sub: document.querySelector('#lotSub').textContent,
    status: document.querySelector('#lotStatusMsg').textContent,
    chips: [...document.querySelectorAll('#lotWinners .winner-chip')].map((el) => el.textContent.trim()),
    copyVisible: !document.querySelector('#lotCopy').hidden,
    againVisible: !document.querySelector('#lotAgain').hidden,
    doneVisible: !document.querySelector('#lotDone').hidden,
  }));
  if (draw.sub !== '2 位幸运儿已揭晓') throw new Error(`副标题不符：${draw.sub}`);
  if (draw.chips.join('|') !== '1. 张三|2. 李四') throw new Error(`中奖标签不符：${draw.chips.join('|')}`);
  if (!draw.copyVisible || !draw.againVisible || !draw.doneVisible) throw new Error('结束后底部三个按钮应同时可见');

  await shot(page.locator('#lotteryOverlay'), 'lottery-two-winners.jpg', {
    alt: ALT_LOTTERY,
    caption: CAPTION_LOTTERY,
    source: '/tools/fun/lottery/',
    purpose: '支撑正文“无放回抽签时同一位参与者不会被重复抽中，揭晓后展示中奖名单与复制按钮”的断言。',
  });
}
