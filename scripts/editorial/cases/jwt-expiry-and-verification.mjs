// JWT 过期与验签文章（slug: jwt-expiry-and-verification）的截图用例，恰好两个场景：
//   1) jwt-decode-exp：点「示例」→「解码」，展示输入 token、绿色「解码成功」、
//      输出区的 Header/Payload/信息摘要（过期时间、签发时间、subject）。
//   2) jwt-verify-hs256：填入自算 HS256 token 与演示密钥 clover-demo-secret，
//      先「解码」再「校验 HS256 签名」，展示绿色「签名有效」与四行信息摘要。
// 页面只有两个 .tool-card-panel；脚本在 .tool-workspace 里插入临时 wrapper 把两块移进去，
// 只改截图用的 DOM（另把输出框临时拉高以完整显示摘要），不改页面源文件。
// 时钟固定为 2026-11-14T00:00:00Z，install/pauseAt 在 goto 之前；context 由 capture-tool 提供，
// 本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
import { createHmac } from 'node:crypto';

const PINNED = new Date('2026-11-14T00:00:00Z');
const SECRET = 'clover-demo-secret';

const b64url = (value) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const hs256 = (input, secret) => createHmac('sha256', secret).update(input).digest('base64url');

const PAYLOAD = { sub: 'clover-demo', iss: 'demo.clovertools.cn', iat: 1785000000, exp: 1816536000 };
const HEADER_B64 = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const PAYLOAD_B64 = b64url(JSON.stringify(PAYLOAD));
const SIGNING_INPUT = `${HEADER_B64}.${PAYLOAD_B64}`;
const TOKEN = `${SIGNING_INPUT}.${hs256(SIGNING_INPUT, SECRET)}`;

const SAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbG92ZXIiLCJpYXQiOjE3ODUwMDAwMDAsImV4cCI6MTgxNjUzNjAwMH0.QW5FeGFtcGxlU2lnbmF0dXJl';
const SAMPLE_EXP = '过期时间：2027/7/25 17:20:00（剩余 365360 分钟）';
const SAMPLE_IAT = '签发时间：2026/7/25 17:20:00';
const CUSTOM_EXP = '过期时间：2027/7/25 17:20:00（剩余 365360 分钟）';
const CUSTOM_IAT = '签发时间：2026/7/25 17:20:00';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  // capture-tool 的 context 没有 timezoneId；用 CDP 把时区钉成 UTC，保证图注里的钟点可复现。
  // 若 context 已经设置过时区，CDP 会报“already in effect”：此时只接受本来就是 UTC 的情况。
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }
  await page.goto(`${base}/tools/dev/jwt-decoder/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#jwtInput') && document.querySelector('#jwtBtn'));
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}' });

  // 两个面板没有共同外层，插入临时 wrapper 让输入与结果同框；不改页面源文件。
  const wrapperId = await page.evaluate(() => {
    const workspace = document.querySelector('.tool-workspace');
    const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
    if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
    const wrap = document.createElement('div');
    wrap.id = 'jwt-shot-pair';
    wrap.style.cssText = 'display:grid;gap:var(--workspace-gap);min-width:0;';
    workspace.insertBefore(wrap, panels[0]);
    wrap.append(panels[0], panels[1]);
    return wrap.id;
  });
  if (wrapperId !== 'jwt-shot-pair') throw new Error('wrapper 创建失败');
  const pair = page.locator('#jwt-shot-pair');

  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
  };
  const read = () =>
    page.evaluate(() => ({
      input: document.querySelector('#jwtInput').value,
      secret: document.querySelector('#jwtSecret').value,
      output: document.querySelector('#jwtOutput').value,
      status: document.querySelector('#jwtStatus').textContent,
      statusClass: document.querySelector('#jwtStatus').className,
      panelTitles: [...document.querySelectorAll('.tool-card-panel .panel-title')].map((el) =>
        el.textContent.trim(),
      ),
    }));
  const expandOutput = () =>
    page.evaluate(() => {
      const output = document.querySelector('#jwtOutput');
      output.style.height = `${output.scrollHeight + 10}px`;
    });

  // ── 场景 1：示例 token 解码与时间摘要 ──
  await page.click('#jwtSample');
  await page.click('#jwtBtn');
  await page.waitForFunction(() => document.querySelector('#jwtStatus').textContent === '解码成功');
  eq(await page.inputValue('#jwtInput'), SAMPLE_TOKEN, '示例输入');
  eq(await page.inputValue('#jwtSecret'), '', '示例密钥为空');
  const sample = await read();
  eq(sample.panelTitles, ['JWT Token', '解码结果'], '面板标题');
  eq(sample.statusClass, 'status-msg show success', '示例状态类名');
  eq(sample.input, SAMPLE_TOKEN, '输入框 token');
  eq(sample.output.includes(SAMPLE_EXP), true, '示例过期行');
  eq(sample.output.includes(SAMPLE_IAT), true, '示例签发时间行');
  eq(sample.output.includes('subject (sub)：clover'), true, '示例 subject 行');
  eq(sample.output.includes('═══ 信息摘要 ═══'), true, '示例摘要分区');
  if (sample.output.includes('issuer (iss)：')) throw new Error('示例没有 iss，不应出现 issuer 行');
  await expandOutput();

  await shot(pair, 'jwt-decode-exp.jpg', {
    alt: `JWT 解码器解码示例 token 后的两个面板：输入框为三段示例 token，密钥框为空，状态条「解码成功」，输出区显示 Header、Payload 与信息摘要的过期时间、签发时间与 subject 行。`,
    caption: `示例 token 解码后的两个面板：上方「JWT Token」输入框保留完整三段 token，下方绿色状态条写「解码成功」，输出区依次显示 Header、Payload 与「信息摘要」，其中「${SAMPLE_EXP}」「${SAMPLE_IAT}」「subject (sub)：clover」。截图为 UTC 时区、时钟固定为 2026-11-14T00:00:00Z。 点击图片可查看原图。`,
    source: '/tools/dev/jwt-decoder/',
    purpose: '支撑正文“示例 token 解码后的时间摘要”与“解码成功只代表解析成功”的断言。',
  });

  // ── 场景 2：自算 HS256 token 解码 + 验签 ──
  await page.click('#jwtClear');
  await page.fill('#jwtInput', TOKEN);
  await page.fill('#jwtSecret', SECRET);
  await page.click('#jwtBtn');
  await page.waitForFunction(() => document.querySelector('#jwtStatus').textContent === '解码成功');
  await page.click('#jwtVerify');
  await page.waitForFunction(() => document.querySelector('#jwtStatus').textContent === '签名有效');
  const verified = await read();
  eq(verified.input, TOKEN, '自算 token');
  eq(verified.secret, SECRET, '演示密钥');
  eq(verified.statusClass, 'status-msg show success', '验签状态类名');
  eq(verified.output.includes(CUSTOM_EXP), true, '自算过期行');
  eq(verified.output.includes(CUSTOM_IAT), true, '自算签发时间行');
  eq(verified.output.includes('subject (sub)：clover-demo'), true, '自算 subject 行');
  eq(verified.output.includes('issuer (iss)：demo.clovertools.cn'), true, '自算 issuer 行');
  await expandOutput();

  await shot(pair, 'jwt-verify-hs256.jpg', {
    alt: `JWT 解码器验签演示的两个面板：输入框为自算 HS256 token，密钥框填 ${SECRET}，状态条「签名有效」，输出区为解码得到的 Header、Payload 与四行信息摘要。`,
    caption: `先解码再点「校验 HS256 签名」：输入框为自算 HS256 token，密钥框填 ${SECRET}，绿色状态条写「签名有效」，输出区保留解码得到的 Header、Payload 与四行信息摘要（过期时间、签发时间、subject、issuer）。截图为 UTC 时区，时钟同图 1。 点击图片可查看原图。`,
    source: '/tools/dev/jwt-decoder/',
    purpose: '支撑正文“自算 HS256 签名可得到签名有效，且签名有效不等于过期/受众/撤销校验”的断言。',
  });
}
