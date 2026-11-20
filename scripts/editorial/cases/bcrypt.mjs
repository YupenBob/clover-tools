// bcrypt 指南（slug: bcrypt）的截图用例，恰好两个场景：
//   1) bcrypt-generate-cost12：生成面板填入密码、成本因子选 12，点「生成哈希」，
//      等状态条变「生成完成（cost 12）」，拍生成面板（含只读哈希框与「复制哈希」按钮）。
//   2) bcrypt-verify-nan：校验面板的「已知哈希」里放一段不是 bcrypt 的普通文本，
//      点「校验」，等状态条变「密码不匹配（哈希 cost NaN）」，拍校验面板。
// 只改截图用的 DOM 样式（拉高只读框），不改页面源文件；时钟固定 2026-11-20T10:00:00Z，时区用 CDP 钉成 UTC。
// context 由 capture-tool 提供，本文件不启动服务器、不做构建；本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-20T10:00:00Z');
const PASSWORD = 'CloverTools#2026';
const NOT_A_HASH = 'CloverTools-plain-text';

const ALT_GENERATE =
  '「生成 Bcrypt 哈希」面板：顶部密码框里是圆点；「成本因子（cost）」下拉显示 12（慢）；下方是「生成哈希」按钮，按钮下方状态条为绿色文字「生成完成（cost 12）」；再往下是只读文本框，内容以 $2b$12$ 开头、共 60 个字符；面板底部是「复制哈希」按钮。';

const CAPTION_GENERATE =
  '成本因子下拉选 12（慢）并点「生成哈希」，状态条显示「生成完成（cost 12）」，下方只读框里是 $2b$12$ 开头的 60 字符哈希，底部是「复制哈希」按钮。';

const ALT_VERIFY =
  '「校验密码」面板：顶部「待校验密码」框里是圆点；「已知哈希」多行框里是普通文本 CloverTools-plain-text；下方是「校验」按钮，按钮下方状态条为红色文字「密码不匹配（哈希 cost NaN）」。';

const CAPTION_VERIFY =
  '把一段不是 bcrypt 的字符串粘进「已知哈希」再点「校验」，状态条显示「密码不匹配（哈希 cost NaN）」，而不是格式错误。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  } catch (error) {
    const current = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (current !== 'UTC') throw new Error(`无法把截图时区钉成 UTC（当前 ${current}）：${error.message}`);
  }

  const hideChrome = () =>
    page.addStyleTag({
      content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
    });

  // 1) 生成面板：cost 12
  await page.goto(`${base}/tools/dev/bcrypt/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#bcPwd') && document.querySelector('#bcGen'));
  await hideChrome();
  await page.evaluate(() => {
    const el = document.getElementById('bcHash');
    el.style.height = '88px';
    el.style.minHeight = '88px';
  });
  const generatePanel = page.locator('.tool-card-panel').first();
  await page.fill('#bcPwd', PASSWORD);
  await page.selectOption('#bcRounds', '12');
  await page.click('#bcGen');
  await page.waitForFunction(
    () =>
      document.getElementById('bcHash').value.startsWith('$2b$12$') &&
      document.getElementById('bcGenStatus').textContent.trim() === '生成完成（cost 12）',
    null,
    { timeout: 20000 },
  );
  const hash = await page.inputValue('#bcHash');
  if (hash.length !== 60) throw new Error(`哈希长度应为 60，实际 ${hash.length}`);
  await shot(generatePanel, 'bcrypt-generate-cost12.jpg', {
    alt: ALT_GENERATE,
    caption: CAPTION_GENERATE,
    source: '/tools/dev/bcrypt/',
    purpose: '展示成本因子下拉、生成后的 60 字符哈希与「生成完成（cost 12）」状态条',
  });

  // 2) 校验面板：非 bcrypt 字符串 → cost NaN
  await page.fill('#bcCheckPwd', PASSWORD);
  await page.fill('#bcCheckHash', NOT_A_HASH);
  await page.click('#bcVerify');
  await page.waitForFunction(
    () => document.getElementById('bcVerifyStatus').textContent.trim() === '密码不匹配（哈希 cost NaN）',
    null,
    { timeout: 20000 },
  );
  const verifyPanel = page.locator('.tool-card-panel').nth(1);
  await shot(verifyPanel, 'bcrypt-verify-nan.jpg', {
    alt: ALT_VERIFY,
    caption: CAPTION_VERIFY,
    source: '/tools/dev/bcrypt/',
    purpose: '展示非 bcrypt 字符串校验时的 cost NaN 状态文案，与格式错误提示区分',
  });
}
