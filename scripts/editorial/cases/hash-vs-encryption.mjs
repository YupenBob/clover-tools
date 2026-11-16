// 哈希与加密文章（slug: hash-vs-encryption）的截图用例，恰好两个场景：
//   1) sha256-result：哈希工具填入 CloverTools、算法选 SHA-256、点「计算哈希」，
//      展示算法下拉、64 个十六进制字符的结果框与绿色「哈希计算完成」。
//   2) bcrypt-verify：bcrypt 工具生成 cost 12 的哈希，再用同一密码与这段哈希点「校验」，
//      展示 $2b$12$ 开头的 60 字符哈希、绿色「密码匹配（cost 12）」。
// 两个页面各只有 2 个用于截图的面板；脚本插入临时 wrapper 让输入与结果同框，只改截图用的 DOM，不改页面源文件。
// 时钟固定为 2026-11-16T10:00:00Z，install/pauseAt 在 goto 之前；时区用 CDP 钉成 UTC。
// context 由 capture-tool 提供，本文件不启动服务器、不做构建。本 Writer 未运行 capture-tool，只交付用例。
const PINNED = new Date('2026-11-16T10:00:00Z');
const PASSWORD = 'CloverTools#2026';

const ALT_HASH =
  '哈希计算工具左右两个面板：左侧「输入内容」面板里文本框填着 CloverTools，下方「算法」下拉显示 SHA-256，「文本或文件」是未选文件的文件选择框，底部是「计算哈希」按钮与绿色状态条「哈希计算完成」；右侧「哈希结果」面板顶部是「复制」按钮，结果框内是一串 64 个字符的十六进制摘要。';

const CAPTION_HASH =
  '输入 CloverTools、算法选默认的 SHA-256 后点「计算哈希」：右侧结果框回显 64 个十六进制字符，左侧状态条是绿色「哈希计算完成」；换算法或改一个字符，这串值会整体变化。';

const ALT_BCRYPT =
  'bcrypt 工具左右两个面板：左侧「生成 Bcrypt 哈希」面板里密码框显示为圆点，成本因子下拉显示 12（慢），其下是「生成哈希」按钮与绿色状态条「生成完成（cost 12）」，再往下是 $2b$12$ 开头的 60 字符哈希框与「复制哈希」按钮；右侧「校验密码」面板里待校验密码框显示为圆点，下方「已知哈希」框里是同一条哈希，再往下是「校验」按钮与绿色状态条「密码匹配（cost 12）」。';

const CAPTION_BCRYPT =
  '成本因子选 12 生成哈希，再用同一段密码与哈希点「校验」：左侧哈希框以 $2b$12$ 开头，右侧状态条是绿色「密码匹配（cost 12）」；同一密码重新生成一次，这串哈希会换成另一个盐。';

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

  // 把前两个 .tool-card-panel 并排放进临时 wrapper；返回 wrapper 容器。
  const pairUp = async (id) => {
    await page.evaluate((wrapperId) => {
      const workspace = document.querySelector('.tool-workspace');
      if (!workspace) throw new Error('找不到 .tool-workspace');
      const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
      if (panels.length < 2) throw new Error(`面板数应至少为 2，实际 ${panels.length}`);
      const wrap = document.createElement('div');
      wrap.id = wrapperId;
      wrap.style.cssText =
        'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;align-items:start;';
      workspace.insertBefore(wrap, panels[0]);
      wrap.append(panels[0], panels[1]);
    }, id);
    return page.locator(`#${id}`);
  };

  // 1) 哈希工具：SHA-256 结果
  await page.goto(`${base}/tools/dev/hash/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hashAlgo') && document.querySelector('#hashBtn'));
  await hideChrome();
  const hashPair = await pairUp('hash-shot-pair');
  await page.evaluate(() => {
    for (const id of ['hashInput', 'hashOutput']) {
      const el = document.getElementById(id);
      el.style.height = '132px';
      el.style.minHeight = '132px';
    }
  });
  await page.selectOption('#hashAlgo', 'sha256');
  await page.fill('#hashInput', 'CloverTools');
  await page.click('#hashBtn');
  await page.waitForFunction(
    () =>
      /^[0-9a-f]{64}$/.test(document.getElementById('hashOutput').value) &&
      document.getElementById('hashStatus').textContent.trim() === '哈希计算完成',
  );
  await shot(hashPair, 'sha256-result.jpg', {
    alt: ALT_HASH,
    caption: CAPTION_HASH,
    source: '/tools/dev/hash/',
    purpose: '说明 SHA-256 摘要定长回显，以及算法下拉与结果框的位置',
  });

  // 2) bcrypt 工具：生成 cost 12 并校验通过
  await page.goto(`${base}/tools/dev/bcrypt/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#bcPwd') && document.querySelector('#bcGen'));
  await hideChrome();
  const bcryptPair = await pairUp('bcrypt-shot-pair');
  await page.evaluate(() => {
    for (const id of ['bcHash', 'bcCheckHash']) {
      const el = document.getElementById(id);
      el.style.height = '88px';
      el.style.minHeight = '88px';
    }
  });
  await page.fill('#bcPwd', PASSWORD);
  await page.selectOption('#bcRounds', '12');
  await page.click('#bcGen');
  await page.waitForFunction(
    () =>
      document.getElementById('bcHash').value.startsWith('$2b$12$') &&
      document.getElementById('bcGenStatus').textContent.trim() === '生成完成（cost 12）',
    null,
    { timeout: 15000 },
  );
  const hash = await page.inputValue('#bcHash');
  await page.fill('#bcCheckPwd', PASSWORD);
  await page.fill('#bcCheckHash', hash);
  await page.click('#bcVerify');
  await page.waitForFunction(
    () => document.getElementById('bcVerifyStatus').textContent.trim() === '密码匹配（cost 12）',
    null,
    { timeout: 15000 },
  );
  await shot(bcryptPair, 'bcrypt-verify.jpg', {
    alt: ALT_BCRYPT,
    caption: CAPTION_BCRYPT,
    source: '/tools/dev/bcrypt/',
    purpose: '展示哈希串里的 $2b$12$ 前缀、60 字符长度与校验通过的绿色状态条',
  });
}
