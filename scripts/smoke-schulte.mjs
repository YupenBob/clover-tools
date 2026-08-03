/**
 * 舒尔特训练专区冒烟测试。
 * 用法：node scripts/smoke-schulte.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://localhost:4321') + '/tools/fun/schulte-trainer/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.message)));

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
}

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

// 1. 七个模式标签齐全
const modeNames = await page.locator('.st-mode span').allTextContents();
check('七种模式齐全', modeNames.length === 7, modeNames.join(','));
check('模式顺序正确', modeNames[0] === '经典方格' && modeNames[5] === '倒计时挑战' && modeNames[6] === '双任务干扰');

// 2. 经典方格：从 1 按序点击到完成
await page.locator('#stStart').click();
await page.waitForTimeout(300);
const cellCount = await page.locator('.st-cell').count();
check('经典方格 5×5 生成', cellCount === 25, `cells=${cellCount}`);

// 逐个数点击：找到数字 n 的格子并点击
let completed = true;
for (let n = 1; n <= 25; n++) {
  const clicked = await page.evaluate((num) => {
    const btns = Array.from(document.querySelectorAll('.st-cell'));
    const target = btns.find((b) => !b.classList.contains('done') && b.textContent.trim() === String(num));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, n);
  if (!clicked) {
    completed = false;
    break;
  }
  await page.waitForTimeout(15);
}
check('经典方格 1-25 全点完成', completed);
const classicStatus = await page.locator('#stStatus').innerText();
check('经典方格完成反馈', /完成/.test(classicStatus), classicStatus);
check('报告面板显示', await page.locator('#stReport').isVisible());
const metrics = await page.locator('#stMetrics').innerText();
check('报告指标齐全', /完成用时/.test(metrics) && /错点/.test(metrics) && /评级/.test(metrics), metrics.slice(0, 60));
const trendBars = await page.locator('.st-bar').count();
check('趋势图渲染', trendBars >= 1, `bars=${trendBars}`);

// 3. 错点检测：点错数字应提示且计数
await page.locator('#stReset').click();
await page.locator('#stStart').click();
await page.waitForTimeout(200);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.st-cell'));
  const wrong = btns.find((b) => b.textContent.trim() === '3');
  if (wrong) wrong.click();
});
await page.waitForTimeout(60);
const errStatus = await page.locator('#stStatus').innerText();
check('错点提示', /点错了/.test(errStatus), errStatus);
const wrongBtn = await page.locator('.st-cell.wrong').count();
check('错点红闪', wrongBtn >= 1, `wrong=${wrongBtn}`);
await page.waitForTimeout(400);

// 4. 间隔变换模式
await page.locator('.st-mode[data-mode="interval"]').click();
await page.waitForTimeout(200);
check('间隔变换设置可见', await page.locator('#stIntervalWrap').isVisible());
await page.locator('#stStart').click();
await page.waitForTimeout(300);
const intervalCells = await page.locator('.st-cell').count();
check('间隔变换生成 25 格', intervalCells === 25);

// 5. 旋转圆盘模式
await page.locator('.st-mode[data-mode="disc"]').click();
await page.waitForTimeout(200);
check('圆盘速度设置可见', await page.locator('#stSpeedWrap').isVisible());
const discHint = await page.locator('#stSizeHint').innerText();
check('圆盘总数 80（N=5）', /80/.test(discHint), discHint);
await page.locator('#stStart').click();
await page.waitForTimeout(400);
const dnums = await page.locator('.st-dnum').count();
check('圆盘数字渲染', dnums === 80, `dnums=${dnums}`);
const rings = await page.locator('.st-disc > .st-ring').count();
check('五环渲染', rings === 5, `rings=${rings}`);

// 6. 双圆盘模式
await page.locator('.st-mode[data-mode="dual"]').click();
await page.waitForTimeout(200);
const dualHint = await page.locator('#stSizeHint').innerText();
check('双盘总数 56（N=5）', /56/.test(dualHint), dualHint);
await page.locator('#stStart').click();
await page.waitForTimeout(400);
const discAcount = await page.locator('#stDiscA .st-dnum').count();
const discBcount = await page.locator('#stDiscB .st-dnum').count();
check('双盘分配 36/20', discAcount === 36 && discBcount === 20, `A=${discAcount}, B=${discBcount}`);
check('圆盘标签显示', await page.locator('#stTargetSide').isVisible());

// 7. 记忆方格模式
await page.locator('.st-mode[data-mode="memory"]').click();
await page.waitForTimeout(200);
check('记忆时间设置可见', await page.locator('#stPeekWrap').isVisible());
await page.locator('#stPeek').fill('3');
await page.locator('#stStart').click();
await page.waitForTimeout(300);
check('记忆展示遮罩', await page.locator('#stVeil').isVisible());
await page.waitForTimeout(3400);
check('记忆隐藏完成', !(await page.locator('#stVeil').isVisible()));
const hiddenCells = await page.locator('.st-cell.hidden').count();
check('数字已隐藏', hiddenCells === 25, `hidden=${hiddenCells}`);

// 8. 倒计时挑战模式
await page.locator('.st-mode[data-mode="countdown"]').click();
await page.waitForTimeout(200);
check('倒计时设置可见', await page.locator('#stTimeWrap').isVisible());
await page.locator('#stTime').fill('30');
await page.locator('#stStart').click();
await page.waitForTimeout(300);
check('倒计时显示', await page.locator('#stTimer').isVisible());
const timerText = await page.locator('#stTimer').innerText();
check('倒计时数值', /30/.test(timerText), timerText);
// 点击 1-8
for (let n = 1; n <= 8; n++) {
  await page.evaluate((num) => {
    const btns = Array.from(document.querySelectorAll('.st-cell'));
    const target = btns.find((b) => !b.classList.contains('done') && b.textContent.trim() === String(num));
    if (target) target.click();
  }, n);
  await page.waitForTimeout(10);
}
const countScore = await page.locator('#stCount').innerText();
check('倒计时得分计数', /8 \/ 25/.test(countScore), countScore);
await page.locator('#stReset').click();

// 9. 双任务干扰模式
await page.locator('.st-mode[data-mode="dual-task"]').click();
await page.waitForTimeout(200);
await page.locator('#stStart').click();
await page.waitForTimeout(300);
// 点 1,2,3 触发 Stroop
for (let n = 1; n <= 4; n++) {
  await page.evaluate((num) => {
    const btns = Array.from(document.querySelectorAll('.st-cell'));
    const target = btns.find((b) => !b.classList.contains('done') && b.textContent.trim() === String(num));
    if (target) target.click();
  }, n);
  await page.waitForTimeout(50);
}
const veilVisible = await page.locator('#stVeil').isVisible();
const qCount = await page.locator('.st-question').count();
check('Stroop 弹题触发', veilVisible && qCount >= 1, `veil=${veilVisible}, q=${qCount}`);
if (veilVisible) {
  const answerCount = await page.locator('.st-answer').count();
  check('四个颜色选项', answerCount === 4, `answers=${answerCount}`);
  const rightColor = await page.locator('#stVeilInner').getAttribute('data-correct');
  if (rightColor) {
    await page.locator(`.st-answer[data-color="${rightColor}"]`).click();
    await page.waitForTimeout(300);
  }
}

// 10. 全屏按钮与音效开关
await page.locator('#stReset').click();
await page.waitForTimeout(300);
check('全屏按钮存在', (await page.locator('#stFull').count()) === 1);
const mutePressed = await page.locator('#stMute').getAttribute('aria-pressed');
check('音效开关存在', mutePressed === 'false');
await page.locator('#stMute').click();
const mutePressed2 = await page.locator('#stMute').getAttribute('aria-pressed');
check('音效开关切换', mutePressed2 === 'true');

// 11. 历史记录持久化
const history = await page.evaluate(() => JSON.parse(localStorage.getItem('ct-schulte-history') || '[]'));
check('历史记录保存', Array.isArray(history) && history.length >= 1, `sessions=${history.length}`);

// 12. 无 emoji 检查（页面内不允许 emoji 字符）
const pageText = await page.locator('body').innerText();
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
check('页面无 emoji', !emojiRe.test(pageText));

console.log(errors.length ? `\nJS 报错:\n${errors.join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
