// 科学计算器文章（slug: calculator）的截图用例。
// 两个场景都在页面加载前把假时钟钉在 2026-11-13T03:00:00Z；计算器不读时间，钉时钟只为让复跑环境一致。
// 截图环境的浏览器时区是 UTC（context 未设置 timezoneId），locale zh-CN、colorScheme light、viewport 1280×1000。
// 每次提交后点一下「计算记录」标题让输入框失焦，再截图，避免焦点描边随复跑环境变化。
// 两张图的 alt / caption 已按真实渲染核对（/tmp 下按 capture 配置的临时渲染），
// 并与浏览器证据里的 DOM 读数一致：20! → 2432902008180000000、1e15+1 → 1000000000000000、
// 200+10% → 200.1、√9^2 → 9。
export default async function ({ page, base, shot }) {
  // 固定到 2026-11-13T03:00:00Z
  await page.clock.install({ time: new Date('2026-11-13T03:00:00Z') });
  await page.goto(`${base}/tools/daily/calculator/`);
  await page.waitForSelector('#calcExpr');
  // astro dev 会往页面注入开发工具栏，固定在视口底部；截图只记录站点自身 UI，先隐藏。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.calc-composition');
  const expression = page.locator('#calcExpr');

  const commit = async (value) => {
    await expression.fill(value);
    await expression.press('Enter');
  };
  const blur = async () => {
    await page.locator('#calcHistoryHeading').click();
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  };

  // 1) 浮点与 12 位有效数字：先 1e15+1（精确值 1000000000000001），再 20!（精确值 2432902008176640000）。
  //    两条记录同时留在右栏，输入框与结果区显示后一个表达式。
  await commit('1e15+1');
  await commit('20!');
  await blur();
  await shot(workspace, 'float-and-rounding.jpg', {
    alt: '科学计算器页面的计算区，左栏为「当前结果」面板：右上角是「复制结果」按钮，输入框右对齐显示「20!」，下方大号等宽数字分两行显示「24329020081800」与「00000」；其下是 4 列 6 行共 24 个按键，依次为 C、⌫、(、)、n!、√、xʸ、÷、7、8、9、×、4、5、6、−、1、2、3、+、±、0、.、深色底的 =，底部提示「输入表达式，或使用按键。Enter 计算，Escape 清空。」；右栏为「计算记录」面板：右上角是「清空」按钮，说明文字「点击记录可再次使用，仅保留本次访问的计算。」，下面两条右对齐记录，第一条上行「20!」下行粗体「= 2432902008180000000」，第二条上行「1e15+1」下行粗体「= 1000000000000000」。',
    caption: '同一屏里两个结果都被 formatArithmetic 压到 12 位有效数字：20! 的精确值 2432902008176640000 显示成 2432902008180000000，1e15+1 的精确值 1000000000000001 显示成 1000000000000000；键盘区没有 DEG/RAD、sin/cos、log、π 之类的按键，也没有角度制开关。',
    source: '/tools/daily/calculator/',
    purpose: '展示 12 位有效数字格式化如何改写阶乘与大整数加法的显示值，以及计算记录里并排保留的两个表达式',
  });

  // 2) 百分号与平方根：先 √9^2（= 9），再 200+10%（= 200.1）；清空上一步的记录，右栏只留这两条。
  await page.locator('#calcHistoryClear').click();
  await commit('√9^2');
  await commit('200+10%');
  await blur();
  await shot(workspace, 'percent-and-root.jpg', {
    alt: '科学计算器页面的计算区，左栏为「当前结果」面板：右上角是「复制结果」按钮，输入框右对齐显示「200+10%」，下方大号等宽数字一行显示「200.1」；其下是 4 列 6 行共 24 个按键，依次为 C、⌫、(、)、n!、√、xʸ、÷、7、8、9、×、4、5、6、−、1、2、3、+、±、0、.、深色底的 =，底部提示「输入表达式，或使用按键。Enter 计算，Escape 清空。」；右栏为「计算记录」面板：右上角是「清空」按钮，说明文字「点击记录可再次使用，仅保留本次访问的计算。」，下面两条右对齐记录，第一条上行「200+10%」下行粗体「= 200.1」，第二条上行「√9^2」下行粗体「= 9」。',
    caption: '200+10% 不是「200 加上 200 的 10%」：% 是后缀运算符，先把 10 除以 100，所以结果是 200.1；记录里的 √9^2 得 9，因为 √ 的右操作数是整个一元表达式，先算 9 的平方再开方。',
    source: '/tools/daily/calculator/',
    purpose: '用两条记录对照百分号的后缀语义与平方根的右操作数范围，说明它们和常见「百分比相加」「先开方再平方」的习惯不一致',
  });
}
