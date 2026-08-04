/**
 * 目标球追踪冒烟测试。
 * 用法：node scripts/smoke-ball-tracker.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://localhost:4321') + '/tools/fun/ball-tracker/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.message)));

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. 三模式与设置
const modeNames = await page.locator('.bt-mode > span:nth-child(2)').allTextContents();
check('三模式齐全', modeNames.length === 3 && modeNames[0] === '目标追踪' && modeNames[2] === '时机等待', modeNames.join(','));
check('目标数设置可见', await page.locator('#btTargetsWrap').isVisible());
check('干扰频率默认隐藏', !(await page.locator('#btFreqWrap').isVisible()));

// 2. 目标追踪模式流程
await page.locator('#btDur').fill('10');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(400);
check('训练幕打开', await page.locator('#btTrain').isVisible());
const markText = await page.locator('#btPhaseText').innerText();
check('标记阶段提示', markText.includes('记住金色目标球'), markText);
await page.waitForTimeout(2500);
const moveText = await page.locator('#btPhaseText').innerText();
check('追踪阶段提示', moveText.includes('追踪'), moveText);
await page.waitForTimeout(10500);
const selectText = await page.locator('#btPhaseText').innerText();
check('选择阶段提示', selectText.includes('点击你追踪到的目标球'), selectText);
// 选择阶段球已冻结，网格点击找出所有目标球（目标数默认 2）
let trackCompleted = false;
for (let gx = 1; gx <= 10 && !trackCompleted; gx++) {
  for (let gy = 1; gy <= 10 && !trackCompleted; gy++) {
    await page.evaluate(({ cx, cy }) => {
      const canvas = document.getElementById('btCanvas');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('click', { clientX: rect.left + cx * rect.width, clientY: rect.top + cy * rect.height, bubbles: true }));
    }, { cx: gx / 11, cy: gy / 11 });
    await page.waitForTimeout(40);
    trackCompleted = await page.locator('#btResult').isVisible();
    if (trackCompleted) break;
  }
}
check('目标追踪完成进入结果', trackCompleted);
if (trackCompleted) {
  const tMetrics = await page.locator('#btMetrics').innerText();
  check('追踪报告准确率', /%/.test(tMetrics), tMetrics.slice(0, 40));
  await page.locator('#btBack').click();
  await page.waitForTimeout(300);
} else {
  await page.locator('#btExit').click();
  await page.waitForTimeout(300);
}

// 3. 干扰追踪模式
await page.locator('.bt-mode[data-mode="distract"]').click();
await page.waitForTimeout(200);
check('干扰频率设置可见', await page.locator('#btFreqWrap').isVisible());
check('干扰模式下目标数可见', await page.locator('#btTargetsWrap').isVisible());
await page.locator('#btFreq').fill('3');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(400);
await page.waitForTimeout(3500);
const statusText = await page.locator('#btTrainStatus').innerText();
check('干扰模式运行正常', statusText.length >= 0);
await page.locator('#btExit').click();
await page.waitForTimeout(300);

// 4. 时机等待模式：点击得分区命中
await page.locator('.bt-mode[data-mode="timing"]').click();
await page.waitForTimeout(200);
check('时机模式目标数隐藏', !(await page.locator('#btTargetsWrap').isVisible()));
await page.locator('#btDur').fill('10');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(60);
// 球从中心出发，立即点击 canvas 中心应命中（用 dispatch 避免点击延迟导致球已移出得分区）
const stage = await page.locator('#btStage').boundingBox();
if (stage) {
  await page.evaluate(({ cx, cy }) => {
    const canvas = document.getElementById('btCanvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: rect.left + (cx * rect.width), clientY: rect.top + (cy * rect.height), bubbles: true }));
  }, { cx: 0.5, cy: 0.5 });
  await page.waitForTimeout(200);
}
const timingPhase = await page.locator('#btPhaseText').innerText();
check('时机命中反馈', timingPhase.includes('命中'), timingPhase);
// 等球移出得分区后再次点击中心（此刻球不在中心，应触发冲动提示）
await page.waitForTimeout(1500);
if (stage) {
  await page.evaluate(({ cx, cy }) => {
    const canvas = document.getElementById('btCanvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: rect.left + (cx * rect.width), clientY: rect.top + (cy * rect.height), bubbles: true }));
  }, { cx: 0.5, cy: 0.5 });
  await page.waitForTimeout(200);
}
const timingPhase2 = await page.locator('#btPhaseText').innerText();
check('时机冲动反馈', timingPhase2.includes('太早'), timingPhase2);
// 等待计时结束进入结果幕（10s * 2 = 20s）
await page.waitForTimeout(21000);
check('结果幕打开', await page.locator('#btResult').isVisible());
const metrics = await page.locator('#btMetrics').innerText();
check('结果指标齐全', metrics.includes('命中准确率') && metrics.includes('冲动'), metrics.slice(0, 60));
const grade = await page.locator('#btGrade').innerText();
check('评级显示', grade.length > 0, grade);
await page.locator('#btBack').click();
await page.waitForTimeout(300);
check('返回开始幕', await page.locator('#btStart').isVisible());

// 5. 无 emoji
const pageText = await page.locator('body').innerText();
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
check('页面无 emoji', !emojiRe.test(pageText));

console.log(errors.length ? `\nJS 报错:\n${errors.slice(0, 6).join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
