/**
 * 舒尔特训练专区冒烟测试（三幕式：开始 / 训练 / 结果）。
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

async function clickNum(n) {
  return page.evaluate((num) => {
    const btns = Array.from(document.querySelectorAll('.st-cell'));
    const target = btns.find((b) => !b.classList.contains('done') && b.textContent.trim() === String(num));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, n);
}

// 1. 七种模式齐全
const modeNames = await page.locator('.st-mode > span:nth-child(2)').allTextContents();
check('七种模式齐全', modeNames.length === 7, modeNames.join(','));
check('模式顺序正确', modeNames[0] === '经典方格' && modeNames[5] === '倒计时挑战' && modeNames[6] === '双任务干扰');

// 2. 经典方格完整流程
await page.locator('#stStart').click();
await page.waitForTimeout(400);
check('训练幕打开', await page.locator('#actTrain').isVisible());
check('经典方格 5×5 生成', (await page.locator('.st-cell').count()) === 25);
let completed = true;
for (let n = 1; n <= 25; n++) {
  if (!(await clickNum(n))) {
    completed = false;
    break;
  }
  await page.waitForTimeout(10);
}
check('经典方格 1-25 全点完成', completed);
await page.waitForTimeout(300);
check('结果幕打开', await page.locator('#actResult').isVisible());
const grade = await page.locator('#stGrade').innerText();
check('评级显示', grade.length > 0, grade);
const metrics = await page.locator('#stMetrics').innerText();
check('报告指标齐全', /完成用时/.test(metrics) && /错点/.test(metrics), metrics.slice(0, 50));
const trendBars = await page.locator('#stTrend .st-bar').count();
check('趋势图渲染', trendBars >= 1, `bars=${trendBars}`);
await page.locator('#stBack').click();
await page.waitForTimeout(300);
check('返回开始幕', await page.locator('#actStart').isVisible());

// 3. 错点检测
await page.locator('#stStart').click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.st-cell'));
  const wrong = btns.find((b) => b.textContent.trim() === '3');
  if (wrong) wrong.click();
});
await page.waitForTimeout(60);
const errStatus = await page.locator('#stTrainStatus').innerText();
check('错点提示', /点错了/.test(errStatus), errStatus);
check('错点红闪', (await page.locator('.st-cell.wrong').count()) >= 1);
await page.waitForTimeout(400);
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 4. 间隔变换
await page.locator('.st-mode[data-mode="interval"]').click();
await page.waitForTimeout(200);
check('间隔变换设置可见', await page.locator('#stIntervalWrap').isVisible());
await page.locator('#stStart').click();
await page.waitForTimeout(300);
check('间隔变换生成 25 格', (await page.locator('.st-cell').count()) === 25);
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 5. 旋转圆盘
await page.locator('.st-mode[data-mode="disc"]').click();
await page.waitForTimeout(200);
check('圆盘速度设置可见', await page.locator('#stSpeedWrap').isVisible());
const discHint = await page.locator('#stSizeHint').innerText();
check('圆盘总数 80（N=5）', /80/.test(discHint), discHint);
await page.locator('#stStart').click();
await page.waitForTimeout(500);
check('圆盘数字渲染', (await page.locator('.st-dnum').count()) === 80);
check('五环渲染', (await page.locator('#stDiscA .st-ring').count()) === 5);
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 6. 双圆盘
await page.locator('.st-mode[data-mode="dual"]').click();
await page.waitForTimeout(200);
const dualHint = await page.locator('#stSizeHint').innerText();
check('双盘总数 56（N=5）', /56/.test(dualHint), dualHint);
await page.locator('#stStart').click();
await page.waitForTimeout(500);
const discAcount = await page.locator('#stDiscA .st-dnum').count();
const discBcount = await page.locator('#stDiscB .st-dnum').count();
check('双盘分配 36/20', discAcount === 36 && discBcount === 20, `A=${discAcount}, B=${discBcount}`);
check('圆盘标签显示', await page.locator('#stTargetSide').isVisible());
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 7. 记忆方格
await page.locator('.st-mode[data-mode="memory"]').click();
await page.waitForTimeout(200);
check('记忆时间设置可见', await page.locator('#stPeekWrap').isVisible());
await page.locator('#stPeek').fill('3');
await page.locator('#stStart').click();
await page.waitForTimeout(300);
check('记忆展示遮罩', await page.locator('#stVeil').isVisible());
await page.waitForTimeout(3400);
check('记忆隐藏完成', !(await page.locator('#stVeil').isVisible()));
check('数字已隐藏', (await page.locator('.st-cell.hidden').count()) === 25);
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 8. 倒计时挑战
await page.locator('.st-mode[data-mode="countdown"]').click();
await page.waitForTimeout(200);
check('倒计时设置可见', await page.locator('#stTimeWrap').isVisible());
await page.locator('#stTime').fill('30');
await page.locator('#stStart').click();
await page.waitForTimeout(300);
check('倒计时显示', await page.locator('#stTimer').isVisible());
const timerText = await page.locator('#stTimer').innerText();
check('倒计时数值', /30/.test(timerText), timerText);
for (let n = 1; n <= 8; n++) {
  await clickNum(n);
  await page.waitForTimeout(10);
}
const countScore = await page.locator('#stCount').innerText();
check('倒计时得分计数', /8 \/ 25/.test(countScore), countScore);
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 9. 双任务干扰
await page.locator('.st-mode[data-mode="dual-task"]').click();
await page.waitForTimeout(200);
await page.locator('#stStart').click();
await page.waitForTimeout(300);
for (let n = 1; n <= 4; n++) {
  await clickNum(n);
  await page.waitForTimeout(50);
}
const veilVisible = await page.locator('#stVeil').isVisible();
const qCount = await page.locator('.st-question').count();
check('Stroop 弹题触发', veilVisible && qCount >= 1, `veil=${veilVisible}, q=${qCount}`);
if (veilVisible) {
  check('四个颜色选项', (await page.locator('.st-answer').count()) === 4);
  const rightColor = await page.locator('#stVeilInner').getAttribute('data-correct');
  if (rightColor) {
    await page.locator(`.st-answer[data-color="${rightColor}"]`).click();
    await page.waitForTimeout(300);
  }
}
await page.locator('#stExit').click();
await page.waitForTimeout(200);

// 10. 开始幕控件
check('全屏按钮存在', (await page.locator('#stFull').count()) === 1);
const mutePressed = await page.locator('#stMute').getAttribute('aria-pressed');
check('音效开关存在', mutePressed === 'false');
await page.locator('#stMute').click();
check('音效开关切换', (await page.locator('#stMute').getAttribute('aria-pressed')) === 'true');

// 11. 历史记录持久化
const history = await page.evaluate(() => JSON.parse(localStorage.getItem('ct-schulte-history') || '[]'));
check('历史记录保存', Array.isArray(history) && history.length >= 1, `sessions=${history.length}`);

// 12. 无 emoji
const pageText = await page.locator('body').innerText();
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
check('页面无 emoji', !emojiRe.test(pageText));

console.log(errors.length ? `\nJS 报错:\n${errors.join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
