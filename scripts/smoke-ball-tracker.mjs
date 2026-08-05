/**
 * 目标球追踪冒烟测试（三种模式：目标追踪 / 数量增减 / 整体旋转）。
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

/** 在画布上按网格点击，直到结果幕出现（找出全部目标球） */
async function clickUntilDone(maxGrid = 14) {
  for (let gx = 1; gx <= maxGrid; gx++) {
    for (let gy = 1; gy <= maxGrid; gy++) {
      const done = await page.evaluate(({ cx, cy }) => {
        const canvas = document.getElementById('btCanvas');
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + cx * rect.width,
          clientY: rect.top + cy * rect.height,
          bubbles: true,
        }));
        return !document.getElementById('btResult').hidden;
      }, { cx: gx / (maxGrid + 1), cy: gy / (maxGrid + 1) });
      await page.waitForTimeout(35);
      if (done) return true;
    }
  }
  return false;
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. 三模式与设置
const modeNames = await page.locator('.bt-mode > span:nth-child(2)').allTextContents();
check('三模式齐全', modeNames.length === 3 && modeNames[0] === '目标追踪' && modeNames[1] === '数量增减' && modeNames[2] === '整体旋转', modeNames.join(','));
check('球数量上限 20', (await page.locator('#btSize').getAttribute('max')) === '20');
check('目标数上限 3', (await page.locator('#btTargets').getAttribute('max')) === '3');
check('速度上限 1000', (await page.locator('#btSpeed').getAttribute('max')) === '1000');
check('混入频率默认隐藏', !(await page.locator('#btFluxWrap').isVisible()));
check('旋转速度默认隐藏', !(await page.locator('#btRotateWrap').isVisible()));

// 2. 目标追踪模式完整流程
await page.locator('#btDur').fill('10');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(400);
check('训练幕打开', await page.locator('#btTrain').isVisible());
const markText = await page.locator('#btPhaseText').innerText();
check('标记阶段提示', markText.includes('记住金色目标球'), markText);
await page.waitForTimeout(2700);
const moveText = await page.locator('#btPhaseText').innerText();
check('追踪阶段提示', moveText.includes('追踪'), moveText);
await page.waitForTimeout(10500);
const selectText = await page.locator('#btPhaseText').innerText();
check('选择阶段提示', selectText.includes('点击你追踪到的目标球'), selectText);
const trackDone = await clickUntilDone();
check('目标追踪完成进入结果', trackDone);
if (trackDone) {
  const tMetrics = await page.locator('#btMetrics').innerText();
  check('追踪报告含准确率', tMetrics.includes('命中准确率'), tMetrics.slice(0, 40));
  await page.locator('#btBack').click();
  await page.waitForTimeout(300);
} else {
  await page.locator('#btExit').click();
  await page.waitForTimeout(300);
}

// 3. 数量增减模式
await page.locator('.bt-mode[data-mode="flux"]').click();
await page.waitForTimeout(200);
check('混入频率设置可见', await page.locator('#btFluxWrap').isVisible());
check('旋转速度仍隐藏', !(await page.locator('#btRotateWrap').isVisible()));
await page.locator('#btFlux').fill('3');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(2700);
const fluxMove = await page.locator('#btPhaseText').innerText();
check('数量增减进入追踪', fluxMove.includes('追踪'), fluxMove);
await page.waitForTimeout(10500);
await page.locator('#btExit').click();
await page.waitForTimeout(300);

// 4. 整体旋转模式
await page.locator('.bt-mode[data-mode="rotate"]').click();
await page.waitForTimeout(200);
check('旋转速度设置可见', await page.locator('#btRotateWrap').isVisible());
check('混入频率隐藏', !(await page.locator('#btFluxWrap').isVisible()));
await page.locator('#btDur').fill('10');
await page.locator('#btStartBtn').click();
await page.waitForTimeout(400);
await page.waitForTimeout(2700);
const rotMove = await page.locator('#btPhaseText').innerText();
check('整体旋转进入追踪', rotMove.includes('追踪'), rotMove);
await page.waitForTimeout(10500);
const rotSelect = await page.locator('#btPhaseText').innerText();
check('旋转模式选择阶段', rotSelect.includes('点击你追踪到的目标球'), rotSelect);
const rotDone = await clickUntilDone();
check('旋转模式完成（逆旋转命中）', rotDone);
if (rotDone) {
  await page.locator('#btBack').click();
  await page.waitForTimeout(300);
}

// 5. 无 emoji
const pageText = await page.locator('body').innerText();
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
check('页面无 emoji', !emojiRe.test(pageText));

console.log(errors.length ? `\nJS 报错:\n${errors.slice(0, 6).join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
