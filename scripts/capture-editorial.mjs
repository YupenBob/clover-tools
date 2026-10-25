/** Capture actual tool interactions for the Chinese guides. No mocked results or edited screenshots. */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { startRepro } from '../public/article-assets/http-repro.mjs';

const base = process.env.ARTICLE_BASE_URL || 'http://127.0.0.1:4321';
const only = new Set((process.env.ARTICLE_ONLY || '').split(',').filter(Boolean));
const selected = name => !only.size || only.has(name);
const images = 'public/article-images/2026-10';
const output = 'output/editorial';
await mkdir(images, { recursive: true });
await mkdir(output, { recursive: true });
const evidence = JSON.parse(await readFile(join(output, 'evidence.json'), 'utf8').catch(() => '{}'));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'zh-CN', colorScheme: 'light', acceptDownloads: true });
await context.addInitScript(() => { localStorage.setItem('clover-lang', 'zh'); localStorage.setItem('clover-theme', 'light'); localStorage.setItem('ct-sfx', 'off'); });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const records = [];
async function saveRecord(name, source, purpose) {
  const bytes = await readFile(join(images, name));
  const dimensions = await page.evaluate(async data => {
    const img = new Image(); img.src = data; await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  }, `data:image/${name.endsWith('.png') ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`);
  records.push({ file: name, ...dimensions, capturedAt: new Date().toISOString(), source, purpose, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
async function shot(target, name, source, purpose) {
  await page.evaluate(() => document.fonts.ready);
  await target.screenshot({ path: join(images, name), type: 'jpeg', quality: 88, animations: 'disabled' });
  await saveRecord(name, source, purpose);
}
async function download(button, name, source, publish = true) {
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click(button)]);
  assert.equal(await file.failure(), null);
  const path = join(publish ? images : output, name);
  await file.saveAs(path);
  if (publish) await saveRecord(name, source, '原始工具导出文件，未修改');
  return path;
}
async function done(name, data = {}) {
  evidence[name] = { checkedAt: new Date().toISOString(), ...data };
  await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PASS ${name}: ${JSON.stringify(data)}`);
}

let repro, media;
try {
  if (selected('http')) {
    repro = await startRepro();
    await page.goto('http://127.0.0.1:8765/');
    await page.click('#cors');
    await page.waitForFunction(() => document.querySelector('#out').textContent.includes('TypeError'));
    assert.match(await page.textContent('#out'), /Failed to fetch/);
    await shot(page.locator('main'), 'fetch-cors.jpg', 'http-repro.mjs / cors', '两个本地端口的真实跨源请求，未允许 CORS');
    await page.click('#html');
    await page.waitForFunction(() => document.querySelector('#out').textContent.includes('SyntaxError'));
    await shot(page.locator('main'), 'json-html.jpg', 'http-repro.mjs / html', '实际 HTTP 200 HTML 响应经过 JSON.parse 后的错误');
    await page.click('#rate');
    await page.waitForFunction(() => document.querySelector('#out').textContent.includes('Retry-After: 3'));
    await shot(page.locator('main'), 'http-429.jpg', 'http-repro.mjs / rate', '实际 429 响应与 Retry-After，未重写浏览器错误');
    await done('http', { cors: 'TypeError: Failed to fetch', html: '200 text/html → SyntaxError', rate: '429 Retry-After: 3' });
    await repro.close(); repro = null;
  }
  if (selected('beads')) {
    await page.setViewportSize({ width: 1280, height: 2200 });
    await page.goto(base + '/tools/fun/perler-beads/');
    await page.waitForFunction(() => !document.querySelector('#bpPng').disabled);
    await page.selectOption('#bpMode', 'custom');
    await page.fill('#bpCustom', '#254B39, #4C956C, #A8C88A, #F2C66D, #FFFCF5');
    await page.waitForFunction(() => !document.querySelector('#bpPng').disabled);
    const metrics = await page.locator('.bead-metrics').innerText();
    await shot(page.locator('.bead-studio'), 'beads-settings.jpg', '/tools/fun/perler-beads/', '站内四叶草演示，32 格、自定义五色，实际预览与设置');
    const png = await download('#bpPng', 'beads-chart.png', '/tools/fun/perler-beads/');
    const csv = await download('#bpCsv', 'beads-materials.csv', '/tools/fun/perler-beads/', false);
    await done('beads', { metrics, csv: await readFile(csv, 'utf8'), png });
  }
  if (selected('avatar')) {
    await page.goto(base + '/tools/fun/avatar-generator/');
    await page.fill('#avSeed', 'Clover-Workshop');
    await page.selectOption('#avSize', '512');
    await page.locator('#avTransparent').check();
    await page.waitForFunction(() => document.querySelector('#avImage').complete && document.querySelector('#avImage').naturalWidth > 0);
    const first = await page.getAttribute('#avImage', 'src');
    await shot(page.locator('.avatar-studio'), 'avatar-settings.jpg', '/tools/fun/avatar-generator/', 'Clover-Workshop 种子，机器人风格，512px 透明背景');
    await download('#avPng', 'avatar-transparent.png', '/tools/fun/avatar-generator/');
    const svg = await download('#avSvg', 'avatar-source.svg', '/tools/fun/avatar-generator/', false);
    await page.fill('#avSeed', 'Different'); await page.fill('#avSeed', 'Clover-Workshop');
    assert.equal(await page.getAttribute('#avImage', 'src'), first, 'same options should reproduce the same SVG');
    const bytes = await readFile(join(images, 'avatar-transparent.png'));
    assert.equal(bytes.readUInt32BE(16), 512); assert.equal(bytes.readUInt32BE(20), 512);
    await done('avatar', { seed: 'Clover-Workshop', style: 'orbit', size: 512, reproducible: true, svg });
  }
  if (selected('markdown')) {
    await page.setViewportSize({ width: 1280, height: 2200 });
    await page.goto(base + '/tools/dev/markdown/');
    const source = '# 周末骑行清单\n\n出发前先看天气，再决定走哪一条路线。\n\n## 随身物品\n\n- [x] 头盔\n- [ ] 备用内胎\n- [ ] 饮水\n\n## 两条备选路线\n\n| 路线 | 距离 | 路面 |\n| --- | --- | --- |\n| 河堤往返 | 18 km | 铺装路 |\n| 公园环线 | 9 km | 铺装路 |\n\n> 距离是演示数据，出发前请查实际路线。\n\n```js\nconst departure = "08:00";\n```\n';
    await page.fill('#mdSource', source);
    await page.waitForFunction(() => document.querySelectorAll('#mdPreview table tbody tr').length === 2);
    await page.locator('#mdSource').press('Control+Home');
    assert.equal(await page.locator('#mdPreview table tbody tr').count(), 2);
    await shot(page.locator('.tool-card-panel').first(), 'markdown-split.jpg', '/tools/dev/markdown/', '原创骑行清单演示的 Markdown 源码与实际渲染');
    await download('#mdDownloadMd', 'cycling-checklist.md', '/tools/dev/markdown/', false);
    const html = await download('#mdDownloadHtml', 'cycling-checklist.html', '/tools/dev/markdown/', false);
    assert.match(await readFile(html, 'utf8'), /周末骑行清单/);
    await done('markdown', { tableRows: 2, markdown: source, htmlExported: true });
  }
  if (selected('base')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/dev/base-converter/');
    await page.fill('#bcValue', '9007199254740993');
    await page.click('#bcBtn');
    const large = await page.inputValue('#bcOutput');
    assert.equal(large, '20000000000001');
    await shot(page.locator('.tool-workspace'), 'base-bigint.jpg', '/tools/dev/base-converter/', '十进制 9007199254740993 到十六进制的真实输出');
    await page.selectOption('#bcFrom', '2'); await page.fill('#bcValue', '102'); await page.click('#bcBtn');
    assert.match(await page.textContent('#bcStatus'), /不是 2 进制数字/);
    await done('base', { decimal: '9007199254740993', hex: large, invalidDigitRejected: true });
  }
  if (selected('keyboard')) {
    await page.goto(base + '/tools/daily/keyboard-test/');
    await page.locator('#ktBox').click();
    await page.keyboard.press('a'); await page.keyboard.press('Shift+a'); await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ControlLeft');
    assert.match(await page.textContent('#ktCode'), /ControlLeft/);
    await shot(page.locator('.tool-workspace'), 'keyboard-events.jpg', '/tools/daily/keyboard-test/', '浏览器实际接收 A、Shift+A、方向键和左 Ctrl 的键盘事件；自动化输入');
    await done('keyboard', { last: await page.textContent('#ktCode'), rows: await page.locator('.kt-row').count(), syntheticHardwareTest: false });
  }
  if (selected('flight')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/fun/focus-flight/');
    await page.fill('#ffTask', '把周末骑行清单写完'); await page.fill('#ffMinutes', '1');
    await page.uncheck('#ffBoardSound'); await page.click('#ffPrimary');
    await page.locator('#ffBoardingDialog[open]').waitFor();
    await page.waitForTimeout(600);
    await shot(page, 'flight-boarding.jpg', '/tools/fun/focus-flight/', '真实 1 分钟演示航程登机牌，未修改时钟');
    await page.click('#ffTear');
    await page.waitForFunction(() => document.querySelector('#ffRoot').dataset.state === 'flying');
    await page.waitForFunction(() => document.querySelector('#ffRoot').dataset.phase === 'cruise');
    await shot(page.locator('#ffStage'), 'flight-cabin.jpg', '/tools/fun/focus-flight/', '真实运行的专注航班客舱');
    for (let i = 0; i < 75 && !(await page.locator('#ffSave').isVisible()); i++) await page.waitForTimeout(1000);
    assert.equal(await page.locator('#ffSave').isVisible(), true, 'one actual minute must finish');
    const file = await download('#ffSave', 'flight-arrival.png', '/tools/fun/focus-flight/');
    const bytes = await readFile(file);
    assert.equal(bytes.readUInt32BE(16), 1080); assert.equal(bytes.readUInt32BE(20), 900);
    await done('flight', { actualMinuteCompleted: true, output: [1080, 900], log: await page.locator('#ffLogList').innerText() });
  }
  if (selected('hls')) {
    await page.setViewportSize({ width: 1280, height: 2200 });
    const directory = join(output, 'media'); await mkdir(directory, { recursive: true });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '8', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '30', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '64k', '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', '-hls_flags', 'independent_segments', '-hls_segment_filename', join(directory, 'seg%d.ts'), join(directory, 'index.m3u8')]);
    media = createServer(async (request, response) => {
      const file = request.url.slice(1);
      if (!/^(?:index\.m3u8|seg\d\.ts)$/.test(file)) { response.writeHead(404); response.end(); return; }
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Content-Type', file.endsWith('m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
      response.end(await readFile(join(directory, file)));
    });
    await new Promise(resolve => media.listen(8767, '127.0.0.1', resolve));
    await page.goto(base + '/tools/daily/m3u8-downloader/');
    await page.fill('#hlsUrl', 'http://127.0.0.1:8767/index.m3u8'); await page.click('#hlsParse');
    await page.locator('#hlsTask').waitFor();
    const [exported] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#hlsStart')]);
    await exported.saveAs(join(output, 'hls-8-seconds.mp4'));
    await page.waitForFunction(() => document.querySelector('#hlsPreview').readyState >= 1, null, { timeout: 180000 });
    const duration = await page.locator('#hlsPreview').evaluate(video => video.duration);
    assert.ok(Math.abs(duration - 8) < 0.2);
    await page.locator('#hlsPreview').evaluate(async video => { video.muted = true; await video.play(); });
    await page.waitForFunction(() => document.querySelector('#hlsPreview').currentTime >= 1 && document.querySelector('#hlsPreview').readyState === 4);
    await page.locator('#hlsPreview').evaluate(video => video.pause());
    await page.waitForTimeout(700);
    await shot(page.locator('#hlsDownloader'), 'hls-complete.jpg', '/tools/daily/m3u8-downloader/', 'FFmpeg 自行生成的 8 秒测试图，四段 TS 实际下载并封装 MP4');
    execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', join(output, 'hls-8-seconds.mp4'), '-f', 'null', '-']);
    await done('hls', { generatedMedia: true, segments: 4, duration, fullDecode: true });
    await new Promise(resolve => media.close(resolve)); media = null;
  }
  if (selected('fps')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/fun/fps-aim-trainer/');
    await page.waitForSelector('#fpsTrainer[data-ready=true]');
    await page.selectOption('[name=quality]', 'performance');
    await page.click('#fpsStart');
    await page.waitForFunction(() => document.querySelector('#fpsStage').dataset.phase === 'paused');
    await page.click('#fpsResume');
    await page.waitForFunction(() => document.querySelector('#fpsStage').dataset.phase === 'running');
    assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'fpsCanvas');
    await page.waitForTimeout(150);
    await shot(page.locator('#fpsStage'), 'fps-range.jpg', '/tools/fun/fps-aim-trainer/', '实际 WebGL Bot 热身靶场，原生 Pointer Lock，不伪造成绩');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#fpsStage').dataset.phase === 'paused');
    await done('fps', { pointerLock: true, escapedToPause: true, measuredSkillImprovement: false });
  }
  if (selected('quiz')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/fun/personality-test/');
    await page.click('#pqStart');
    await page.locator('#pqQuestionCard').waitFor();
    for (let i = 0; i < 4; i++) {
      await page.locator('.quiz-choice').nth(i < 12 ? 0 : 2).click();
      await page.click('#pqNext');
    }
    await shot(page.locator('#pqQuestionCard'), 'quiz-question.jpg', '/tools/fun/personality-test/', '第 5 题的作答界面，进度 04/24 与返回按钮为真实状态');
    for (let i = 4; i < 24; i++) {
      await page.locator('.quiz-choice').nth(i < 12 ? 0 : 2).click();
      await page.click('#pqNext');
    }
    await page.locator('#pqResult').waitFor();
    const quizCode = (await page.textContent('#pqCode')).trim();
    assert.match(quizCode, /^[EISNTFJP]{4}$/);
    assert.equal(quizCode, 'ENFJ');
    assert.equal(await page.locator('.quiz-axis').count(), 4);
    await page.waitForFunction(() => !document.querySelector('#pqSave').disabled);
    await shot(page.locator('#pqResult'), 'quiz-result.jpg', '/tools/fun/personality-test/', '24 题全部选择第一项后的真实四轴结果页');
    await done('quiz', { code: quizCode, axes: 4, questions: 24 });
  }
  if (selected('filter')) {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto(base + '/tools/fun/image-filter/');
    await page.setInputFiles('#flFile', 'public/og-image.jpg');
    await page.selectOption('#flType', 'sepia');
    await page.click('#flBtn');
    await page.waitForFunction(() => { const img = document.querySelector('#flPreview img'); return img && img.complete && img.naturalWidth > 0; });
    const previewWidth = await page.locator('#flPreview img').evaluate(img => img.naturalWidth);
    assert.equal(previewWidth, 1200);
    await shot(page.locator('.tool-card-panel').first(), 'filter-settings.jpg', '/tools/fun/image-filter/', '上传 1200×630 示例图并选择复古棕褐滤镜的实际设置区');
    await shot(page.locator('#flPreview'), 'filter-sepia.jpg', '/tools/fun/image-filter/', '复古棕褐滤镜的实际 canvas 输出预览，尺寸与原图一致');
    await done('filter', { source: 'public/og-image.jpg', filter: 'sepia', outputWidth: previewWidth, outputFormat: 'PNG' });
  }
  if (selected('lottery')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/fun/lottery/');
    await page.fill('#lotNames', '张三\n李四\n王五\n赵六\n钱七\n孙八');
    await page.fill('#lotCount', '2');
    assert.match(await page.textContent('#lotMeta'), /共 6 人/);
    await shot(page.locator('.tool-card-panel').first(), 'lottery-setup.jpg', '/tools/fun/lottery/', '六人名单、抽取两位，重复检查提示为实际状态');
    await page.click('#lotBtn');
    await page.waitForSelector('#lotteryOverlay.open');
    await page.waitForFunction(() => document.querySelectorAll('#lotWinners .winner-chip').length === 2, null, { timeout: 90000 });
    const winnerCount = await page.locator('#lotWinners .winner-chip').count();
    assert.equal(winnerCount, 2);
    const winnerText = (await page.locator('#lotWinners').innerText()).replace(/\s+/g, ' ').trim();
    await shot(page.locator('#lotteryOverlay'), 'lottery-winners.jpg', '/tools/fun/lottery/', '真实老虎机抽奖结束状态，两位中奖者由 Math.random 抽出');
    await done('lottery', { participants: 6, count: 2, winners: winnerText, cryptoRandom: false });
  }
  if (selected('bigjson')) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + '/tools/dev/json-formatter/');
    const big = await page.evaluate(() => JSON.stringify({
      generatedAt: '2026-10-25',
      items: Array.from({ length: 4000 }, (_, i) => ({ id: i, name: `item-${i}`, tags: ['alpha', 'beta'], nested: { ok: i % 2 === 0, index: i } })),
    }));
    const bytes = Buffer.byteLength(big);
    assert.ok(bytes > 300_000);
    const started = Date.now();
    await page.fill('#jsonInput', big);
    await page.click('#formatBtn', { timeout: 90000 });
    await page.locator('#statusMsg.show.success').waitFor({ timeout: 90000 });
    const elapsed = Date.now() - started;
    const formatted = await page.inputValue('#jsonOutput');
    assert.ok(formatted.length > big.length);
    await shot(page.locator('.tool-card-panel').first(), 'json-large-input.jpg', '/tools/dev/json-formatter/', '约 35 万字符的 JSON 实际粘贴并格式化后的字符统计与状态');
    await page.fill('#jsonInput', '{"name":"Clover","tools":99,}');
    await page.click('#formatBtn');
    const jsonError = await page.textContent('#statusMsg');
    assert.match(jsonError, /第 1 行/);
    await shot(page.locator('.tool-card-panel').first(), 'json-error-location.jpg', '/tools/dev/json-formatter/', '尾部逗号导致的实际报错定位，包含行号与列号');
    await done('bigjson', { inputBytes: bytes, formattedChars: formatted.length, elapsedMs: elapsed, error: jsonError.trim() });
  }
  if (selected('sql')) {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(base + '/tools/dev/sql-formatter/');
    const sql = "select u.id, u.name, count(o.id) as orders from users u left join orders o on u.id = o.user_id where u.status = 'active' and u.name like 'A%' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 10";
    await page.fill('#sqfInput', sql);
    await shot(page.locator('.tool-card-panel').first(), 'sql-before.jpg', '/tools/dev/sql-formatter/', '单行表单的实际 SQL 输入，含字符串字面量与聚合');
    await page.click('#sqfBtn');
    const formattedSql = await page.inputValue('#sqfOutput');
    assert.match(formattedSql, /^SELECT/);
    assert.match(formattedSql, /'active'/);
    await shot(page.locator('.tool-card-panel').nth(1), 'sql-after.jpg', '/tools/dev/sql-formatter/', '同一语句格式化后的实际输出，关键字大写、字符串未被改写');
    await done('sql', { inputChars: sql.length, outputChars: formattedSql.length, stringPreserved: formattedSql.includes("'active'") });
  }
  if (selected('jsonpath')) {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(base + '/tools/dev/jsonpath/');
    await page.click('#jpSample');
    await page.fill('#jpExpr', '$.store.book[?(@.price < 10)].title');
    await page.click('#jpBtn');
    await page.waitForFunction(() => document.querySelector('#jpOutput').value.length > 0);
    const titles = await page.inputValue('#jpOutput');
    assert.match(titles, /Sayings|Moby Dick/);
    await shot(page.locator('.tool-card-panel').first(), 'jsonpath-query.jpg', '/tools/dev/jsonpath/', '价格过滤表达式在示例数据上的实际结果');
    await page.fill('#jpExpr', 'book[0]');
    await page.click('#jpBtn');
    const jsonpathError = await page.textContent('#jpStatus');
    assert.match(jsonpathError, /\$/);
    await shot(page.locator('.tool-card-panel').first(), 'jsonpath-error.jpg', '/tools/dev/jsonpath/', '缺少根符号 $ 时的实际错误提示');
    await done('jsonpath', { expression: '$.store.book[?(@.price < 10)].title', result: titles.trim(), error: jsonpathError.trim() });
  }
  if (selected('salary')) {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(base + '/tools/daily/salary/');
    await page.fill('#salGross', '15000');
    await page.selectOption('#salFund', '0.07');
    await page.click('#salBtn');
    assert.match(await page.textContent('#salNet'), /11847\.50/);
    await shot(page.locator('.tool-card-panel').first(), 'salary-form.jpg', '/tools/daily/salary/', '税前 15000、公积金 7% 的实际输入');
    await shot(page.locator('.tool-card-panel').nth(1), 'salary-result.jpg', '/tools/daily/salary/', '五险一金与个税明细，税后 11847.50 元');
    await done('salary', { gross: 15000, housingFundRate: '7%', net: '11847.50', specialDeductions: false, cityAffectsResult: false });
  }
  if (selected('expiry')) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(base + '/tools/daily/expiry/');
    await page.fill('#expDate', '2026-09-25');
    await page.fill('#expDays', '45');
    await page.click('#expBtn');
    const expiryText = (await page.textContent('#expResult')).replace(/\s+/g, ' ').trim();
    assert.match(expiryText, /2026-11-09/);
    assert.match(expiryText, /即将到期/);
    await shot(page.locator('.tool-card-panel').first(), 'expiry-form.jpg', '/tools/daily/expiry/', '生产日期 2026-09-25、保质期 45 天的实际输入');
    await shot(page.locator('.tool-card-panel').nth(1), 'expiry-result.jpg', '/tools/daily/expiry/', '到期日 2026-11-09 与剩余 15 天的实际结果');
    await done('expiry', { productionDate: '2026-09-25', days: 45, result: expiryText });
  }
  if (selected('grid')) {
    await page.setViewportSize({ width: 700, height: 1400 });
    await page.goto(base + '/tools/daily/grid-splitter/');
    await page.setInputFiles('#gsFile', 'public/og-image.jpg');
    await page.click('#gsBtn');
    await page.waitForFunction(() => document.querySelectorAll('.gs-cell').length === 9);
    const cellWidth = await page.locator('.gs-cell canvas').first().evaluate(canvas => canvas.width);
    assert.equal(cellWidth, 210);
    const gridStatus = await page.textContent('#gsStatus');
    assert.match(gridStatus, /630×630/);
    await shot(page.locator('#gsGrid'), 'grid-preview.jpg', '/tools/daily/grid-splitter/', '1200×630 原图取中心 630×630 后的九格预览，编号为实际顺序');
    await page.click('#gsDownload');
    await page.waitForFunction(() => document.querySelector('#gsStatus').textContent.includes('9 张'));
    await shot(page.locator('.tool-card-panel').first(), 'grid-download.jpg', '/tools/daily/grid-splitter/', '点击下载全部后的实际状态提示');
    await done('grid', { source: 'public/og-image.jpg', center: '630×630', cell: cellWidth, downloads: 9, status: gridStatus.trim() });
  }
} finally {
  await repro?.close();
  if (media) await new Promise(resolve => media.close(resolve));
  const old = JSON.parse(await readFile(join(images, 'captures.json'), 'utf8').catch(() => '[]'));
  const merged = new Map(old.map(item => [item.file, item]));
  for (const record of records) merged.set(record.file, record);
  await writeFile(join(images, 'captures.json'), JSON.stringify([...merged.values()], null, 2) + '\n');
  await browser.close();
}
