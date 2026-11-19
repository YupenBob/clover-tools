// 强密码做法文章（slug: strong-password-practices）的截图用例，恰好两个场景：
//   1) password-generator-settings：长度 20、勾选特殊符号与排除易混淆字符、数量 5，生成后展示
//      左侧配置、绿色状态条「已生成 5 个密码」与右侧 5 行结果。
//   2) password-strength-score：在检测页输入一条 16 位混合密码，展示四格全亮的「非常强（4/4）」、
//      六项检查与底部熵值/破解时间估算。
// 为了截图可复现：两个页面都在 goto 前把 Crypto.prototype.getRandomValues 换成固定种子的 LCG，
// 只影响截图进程，不改页面源文件；时钟固定为 2026-11-19T10:00:00Z，时区用 CDP 钉成 UTC。
// context 由 capture-tool 提供，本文件不启动服务器、不做构建。
const PINNED = new Date('2026-11-19T10:00:00Z');

const ALT_GENERATOR =
  '随机密码生成工具左右两个面板：左侧「生成配置」面板里「密码长度：20」，下方五个圆角标签中「大写字母」「小写字母」「数字」「特殊符号」「排除易混淆字符」都已勾选，「生成数量」下拉框是「5 个」，底部是「生成密码」按钮与绿色状态条「已生成 5 个密码」；右侧「生成结果」面板顶部是「复制」按钮，结果框内 5 行等宽字符。';

const CAPTION_GENERATOR =
  '长度设为 20、勾选四类字符与「排除易混淆字符」、数量选 5 个后点「生成密码」：左侧状态条显示绿色「已生成 5 个密码」，右侧结果框逐行列出 5 条 20 位密码，可直接点「复制」。';

const ALT_STRENGTH =
  '密码强度检测工具左右两个面板：左侧「输入密码」面板里密码框显示一串圆点，下方四格指示条全部填满为绿色，标签是「非常强（4/4）」；右侧「检测明细」面板列出六行带绿色对勾的检查项，从「长度不少于 8 位」到「无连续顺序字符」，底部灰字是「估算熵值约 105 bit，理想环境离线破解时间约 极长（超过数百年）」。';

const CAPTION_STRENGTH =
  '输入一条 16 位混合密码后：四格指示条全部填满，标签显示「非常强（4/4）」，右侧六项检查依次为长度、大小写、数字、符号、常见弱口令与连续字符，底部显示「估算熵值约 105 bit」。';

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
    let state = 0x9e3779b9;
    Object.defineProperty(Crypto.prototype, 'getRandomValues', {
      configurable: true,
      value(array) {
        for (let i = 0; i < array.length; i += 1) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          array[i] = state;
        }
        return array;
      },
    });
  });

  const hideChrome = () =>
    page.addStyleTag({
      content: 'astro-dev-toolbar{display:none!important} header.site-header{display:none!important}',
    });

  const pairPanels = async (id) => {
    await page.evaluate((wrapperId) => {
      const workspace = document.querySelector('.tool-workspace');
      const panels = [...workspace.querySelectorAll(':scope > .tool-card-panel')];
      if (panels.length !== 2) throw new Error(`面板数应为 2，实际 ${panels.length}`);
      const wrap = document.createElement('div');
      wrap.id = wrapperId;
      wrap.style.cssText =
        'display:grid;grid-template-columns:1fr 1fr;gap:var(--workspace-gap);min-width:0;grid-column:1/-1;align-items:start;';
      workspace.insertBefore(wrap, panels[0]);
      wrap.append(panels[0], panels[1]);
    }, id);
    return page.locator(`#${id}`);
  };

  // ── 场景 1：生成器配置与 5 条结果 ──
  await page.goto(`${base}/tools/dev/password-generator/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pgBtn');
  await hideChrome();
  const genPair = await pairPanels('sp-generator-pair');

  await page.evaluate(() => {
    const slider = document.querySelector('#pgLength');
    slider.value = '20';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.check('#pgSymbols');
  await page.check('#pgAmbiguous');
  await page.selectOption('#pgCount', '5');
  await page.click('#pgBtn');
  await page.waitForFunction(() => document.querySelector('#pgStatus').textContent === '已生成 5 个密码');

  const generated = await page.evaluate(() => {
    const values = document.querySelector('#pgOutput').value.split('\n');
    return {
      values,
      count: values.length,
      lengths: [...new Set(values.map((value) => value.length))],
      lengthLabel: document.querySelector('#pgLenLabel').textContent,
      status: document.querySelector('#pgStatus').textContent,
      statusClass: document.querySelector('#pgStatus').className,
      hasSymbol: values.every((value) => /[^A-Za-z0-9]/.test(value)),
      hasAmbiguous: values.some((value) => [...value].some((char) => 'O0Il1|`\'"'.includes(char))),
    };
  });
  if (generated.lengthLabel !== '20') throw new Error(`长度标签应为 20，实际 ${generated.lengthLabel}`);
  if (generated.count !== 5 || generated.lengths.length !== 1 || generated.lengths[0] !== 20) {
    throw new Error(`应生成 5 条 20 位密码，实际 ${generated.count} 条 / 长度 ${generated.lengths}`);
  }
  if (!generated.hasSymbol) throw new Error('勾选特殊符号后结果应含符号');
  if (generated.hasAmbiguous) throw new Error('勾选排除易混淆字符后不应出现易混淆字符');
  if (generated.statusClass !== 'status-msg show success') throw new Error(`状态条类名不符：${generated.statusClass}`);

  await shot(genPair, 'password-generator-settings.jpg', {
    alt: ALT_GENERATOR,
    caption: CAPTION_GENERATOR,
    source: '/tools/dev/password-generator/',
    purpose: '支撑正文“长度 20、四类字符加排除易混淆、数量 5 的配置与生成结果、状态条文案”的描述。',
  });

  // ── 场景 2：检测页的四格全亮 ──
  await page.goto(`${base}/tools/dev/password-strength/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#psInput');
  await hideChrome();
  const strPair = await pairPanels('sp-strength-pair');
  await page.fill('#psInput', 'Kx7#mQ2vR9pLw4Zt');
  await page.waitForFunction(() => document.querySelector('#psLabel').textContent === '非常强（4/4）');

  const scored = await page.evaluate(() => ({
    label: document.querySelector('#psLabel').textContent,
    filled: document.querySelectorAll('#psBars .bar.filled').length,
    detail: document.querySelector('#psDetail').textContent,
    checks: [...document.querySelectorAll('#psChecks li')].map((li) => ({ text: li.textContent.trim(), cls: li.className })),
  }));
  if (scored.label !== '非常强（4/4）' || scored.filled !== 4) throw new Error(`档位不符：${scored.label} / ${scored.filled} 格`);
  if (scored.checks.length !== 6 || !scored.checks.every((check) => check.cls === 'ok')) throw new Error('六项检查应全部通过');
  if (!scored.detail.startsWith('估算熵值约 105 bit')) throw new Error(`熵值文案不符：${scored.detail}`);

  await shot(strPair, 'password-strength-score.jpg', {
    alt: ALT_STRENGTH,
    caption: CAPTION_STRENGTH,
    source: '/tools/dev/password-strength/',
    purpose: '支撑正文“检测页四格全亮时显示非常强（4/4）、六项检查与 105 bit 熵回显”的描述。',
  });
}
