// 倒计时 / 秒表文章（slug: timer）的截图用例。
// 两幕都在 page.goto 之前用 page.clock 把假时钟钉在 2026-11-11T04:00:00Z，
// 并用 pauseAt 冻结，保证 fastForward 的起点严格一致；capture-tool 自己起 astro dev
// server（locale zh-CN、viewport 1280×1000、colorScheme light，未设 timezoneId）。
//
// 实际 DOM 已在静态构建 http://127.0.0.1:4398 上用独立 Playwright 脚本复跑核对：
//   countdown-paused：#cdDisplay = 00:37，#cdState / #cdStatus = 已暂停，#cdStart = 继续，
//     分钟/秒输入框 = 1 / 0，1 分钟预设 aria-pressed="true"；与 guide.json 图注一致。
//   stopwatch-laps：#swDisplay = 00:05.8，#swState = 已暂停，#swLaps li 文本依次为
//     03 / 00:01.2 / 00:05.8、02 / 00:01.2 / 00:04.6、01 / 00:03.4 / 00:03.4；
//     与 guide.json 图注「累计 3.4、4.6、5.8 秒，分段 3.4、1.2、1.2 秒」一致。
export default async function ({ page, base, shot }) {
  const pinned = new Date('2026-11-11T04:00:00Z');
  await page.clock.install({ time: pinned });
  await page.clock.pauseAt(pinned);
  await page.goto(`${base}/tools/daily/timer/`);
  await page.waitForSelector('#cdDisplay');
  // astro dev 的开发工具栏固定在视口底部，截图只记录站点自身 UI。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  // 1) 1 分钟预设 → 开始 → 假时钟一次跳 23 秒 → 暂停
  const countdownPanel = page.locator('.countdown-panel');
  await page.click('[data-minutes="1"]');
  await page.click('#cdStart');
  await page.clock.fastForward(23000);
  await page.click('#cdPause');
  await page.waitForFunction(
    () => document.querySelector('#cdState')?.textContent?.trim() === '已暂停',
  );
  await shot(countdownPanel, 'countdown-paused.jpg', {
    alt: '倒计时面板：右上角灰色「已暂停」状态徽标；表盘中央大字读数 00:37，外圈棕色进度弧未走满；表盘下方从左到右是「1 分钟」「5 分钟」「15 分钟」「25 分钟」四个预设，其中「1 分钟」带浅色按下态；分钟输入框 1、秒输入框 0；下一行深色主按钮「继续」、半透明禁用的「暂停」，以及可用的「重置」；再下方是未勾选的「结束时声音提醒」；浅蓝状态条写「已暂停」；底部提示「计时期间请保持页面打开。」',
    caption: '用「1 分钟」预设开始，把假时钟一次跳 23 秒后暂停：读数停在 00:37，状态「已暂停」，主按钮「继续」',
    source: '/tools/daily/timer/',
    purpose: '用假时钟复现 1 分钟倒计时跳到第 23 秒后暂停的画面，展示暂停读数、状态条与主按钮文案。',
  });

  // 2) 秒表：开始 → 3.4 s 计次 → 4.6 s 计次 → 5.8 s 计次 → 暂停
  const stopwatchPanel = page.locator('.stopwatch-panel');
  await page.click('#swStart');
  await page.clock.fastForward(3400);
  await page.click('#swLap');
  await page.clock.fastForward(1200);
  await page.click('#swLap');
  await page.clock.fastForward(1200);
  await page.click('#swLap');
  await page.click('#swPause');
  await page.waitForFunction(() => document.querySelectorAll('#swLaps li').length === 3);
  await page.waitForFunction(
    () => document.querySelector('#swState')?.textContent?.trim() === '已暂停',
  );
  await shot(stopwatchPanel, 'stopwatch-laps.jpg', {
    alt: '秒表面板：右上角灰色「已暂停」状态徽标；米色读数框里大字 00:05.8；下方深色主按钮「继续」、半透明禁用的「暂停」与「计次」，以及可用的「重置」；计次表头从左到右「计次」「分段用时」「累计用时」；三行记录按新到旧排列：03 00:01.2 00:05.8、02 00:01.2 00:04.6、01 00:03.4 00:03.4，累计列加粗；底部浅蓝状态条写「已暂停」。',
    caption: '秒表在累计 3.4、4.6、5.8 秒时各记一次计次后暂停：三条记录按新到旧排列，分段分别是 3.4、1.2、1.2 秒',
    source: '/tools/daily/timer/',
    purpose: '复现秒表在 3.4、4.6、5.8 秒三次计次后暂停的画面，展示最新在上的计次列表与分段/累计两列。',
  });
}
