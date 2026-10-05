/** Real HLS -> browser WASM -> playable video regression, using the site's production CSP. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, cpSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkStreaming } from './hls-stream-browser.mjs';
import { HLS_CONFIG } from '../config/hls.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/playwright/hls');
const dist = join(output, 'site');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
mkdirSync(output, { recursive: true });
// Other work may rebuild dist concurrently; serve a private snapshot for this regression.
cpSync(join(root, 'dist'), dist, { recursive: true });
const command = (program, args, cwd = root) => execFileSync(program, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1048576 });
for (const format of ['ts', 'fmp4', 'bframes']) {
  const directory = join(output, format); mkdirSync(directory, { recursive: true });
  command(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '12', '-c:v', 'libx264', '-preset', format === 'bframes' ? 'medium' : 'ultrafast', ...(format === 'bframes' ? ['-bf', '2'] : []), '-pix_fmt', 'yuv420p', '-g', '30', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '64k',
    '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0', '-hls_flags', 'independent_segments',
    ...(format === 'fmp4' ? ['-hls_segment_type', 'fmp4'] : []),
    '-hls_segment_filename', join(directory, format === 'fmp4' ? 'seg%d.m4s' : 'seg%d.ts'), join(directory, 'index.m3u8')], directory);
}
const counts = new Map();
const audioDirectory = join(output, 'aac'); mkdirSync(audioDirectory, { recursive: true });
command(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '12', '-c:a', 'aac', '-b:a', '64k', '-f', 'segment', '-segment_time', '2', '-segment_format', 'adts', join(audioDirectory, 'seg%d.aac')]);
const audioDuration = (data) => { let p = 0, frames = 0; while (p < data.length) { p += ((data[p + 3] & 3) << 11) | (data[p + 4] << 3) | (data[p + 5] >> 5); frames++; } return frames * 1024 / 48000; };
writeFileSync(join(audioDirectory, 'index.m3u8'), '#EXTM3U\n' + Array.from({ length: 6 }, (_, i) => `#EXTINF:${audioDuration(readFileSync(join(audioDirectory, `seg${i}.aac`))).toFixed(9)},\nseg${i}.aac`).join('\n') + '\n#EXT-X-ENDLIST');
let slow = false;
let recoverSkipped = false;
let coreLoadGate = null;
const largePacket = new Uint8Array(188).fill(255); largePacket.set([0x47, 0x1f, 0xff, 0x10]);
command(ffmpeg, ['-v', 'error', '-y', '-i', join(output, 'ts/seg0.ts'), '-map', '0:v:0', '-c', 'copy', '-muxdelay', '0', '-f', 'mpegts', join(output, 'large-video.ts')]);
const largeSource = readFileSync(join(output, 'large-video.ts'));
const largePadding = Buffer.alloc(Math.ceil((32 * 1048576 - largeSource.length) / 188) * 188);
for (let p = 0; p < largePadding.length; p += 188) largePadding.set(largePacket, p);
const largeFile = join(output, 'large.ts'); writeFileSync(largeFile, Buffer.concat([largeSource, largePadding]));
const largeCount = Math.ceil(HLS_CONFIG.limits.exportBytes / statSync(largeFile).size) + 2;
const csp = readFileSync(join(root, 'public/_headers'), 'utf8').match(/Content-Security-Policy: ([^\r\n]+)/)[1];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.mp4': 'video/mp4', '.m4s': 'video/mp4', '.bin': 'application/octet-stream' };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  counts.set(path, (counts.get(path) || 0) + 1);
  if (coreLoadGate && path === `${HLS_CONFIG.core.publicRoot}/${HLS_CONFIG.core.version}/manifest.json`) {
    const gate = coreLoadGate;
    gate.reached();
    await gate.released;
    if (response.destroyed) return;
  }
  if (path.startsWith('/media/')) {
    if (path.startsWith('/media/large/')) {
      if (path.endsWith('index.m3u8')) {
        response.setHeader('Content-Type', mime['.m3u8']);
        response.end('#EXTM3U\n' + Array.from({ length: largeCount }, (_, i) => `${i ? '#EXT-X-DISCONTINUITY\n' : ''}#EXTINF:2,\nseg${i}.ts`).join('\n') + '\n#EXT-X-ENDLIST');
      } else { response.setHeader('Content-Type', mime['.ts']); response.end(readFileSync(largeFile)); }
      return;
    }
    const format = path.includes('/fmp4/') ? 'fmp4' : path.includes('/aac/') ? 'aac' : path.includes('/bframes/') ? 'bframes' : 'ts';
    const name = path.split('/').at(-1);
    if (name === 'master.m3u8') {
      response.setHeader('Content-Type', mime['.m3u8']);
      response.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=160x90,CODECS="avc1.42c00b,mp4a.40.2"\nindex.m3u8\n'); return;
    }
    if (name === 'external.m3u8') {
      response.setHeader('Content-Type', mime['.m3u8']);
      response.end('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=200000,AUDIO="audio"\nindex.m3u8'); return;
    }
    if (name === 'index.m3u8') {
      let text = readFileSync(join(output, format, name), 'utf8');
      if (format === 'fmp4') text = text.replace('seg3.m4s', '#EXT-X-GAP\nseg3.m4s');
      response.setHeader('Content-Type', mime['.m3u8']); response.end(text); return;
    }
    if ((!recoverSkipped && name === 'seg1.ts') || name === 'seg1.m4s' || name === 'seg1.aac') { response.statusCode = 404; response.end(); return; }
    if (!recoverSkipped && name === 'seg3.ts') { response.statusCode = 410; response.end(); return; }
    if (name === 'seg2.ts' && counts.get(path) === 1) { response.statusCode = 503; response.end(); return; }
    if (slow) await new Promise((resolve) => setTimeout(resolve, 180));
    if (name === 'seg4.ts') {
      const corrupt = new Uint8Array(1880); for (let i = 0; i < corrupt.length; i += 188) corrupt[i] = 0x47;
      response.setHeader('Content-Type', mime['.ts']); response.end(corrupt); return;
    }
    const file = resolve(output, format, name);
    if (!file.startsWith(resolve(output, format) + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')) || !existsSync(file)) { response.statusCode = 404; response.end(); return; }
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream'); response.end(readFileSync(file)); return;
  }
  const file = resolve(dist, '.' + path, extname(path) ? '' : 'index.html');
  if (!file.startsWith(resolve(dist)) || !statSync(file, { throwIfNoEntry: false })?.isFile()) { response.statusCode = 404; response.end(); return; }
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const frames = (file) => command(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-']).split('\n').filter((line) => line && !line.startsWith('#')).map((line) => line.split(',').at(-1).trim());

function verify(file, format, retained, duration) {
  const info = JSON.parse(command(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type', '-of', 'json', file]));
  assert.ok(info.streams.some((stream) => stream.codec_name === 'h264'));
  assert.ok(info.streams.some((stream) => stream.codec_name === 'aac'));
  assert.ok(Math.abs(Number(info.format.duration) - duration) < 0.2, `duration: ${info.format.duration}, expected ${duration}`);
  command(ffmpeg, ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-']);
  let expected;
  const referenceFiles = [];
  if (format !== 'fmp4') expected = retained.flatMap((index) => { const reference = join(output, format, `seg${index}.ts`); referenceFiles.push(reference); return frames(reference); });
  else {
    expected = retained.flatMap((index) => {
      const reference = join(output, `reference-${index}.mp4`);
      writeFileSync(reference, Buffer.concat([readFileSync(join(output, 'fmp4/init.mp4')), readFileSync(join(output, 'fmp4', `seg${index}.m4s`))]));
      referenceFiles.push(reference);
      return frames(reference);
    });
  }
  assert.deepEqual(frames(file), expected, 'decoded video frames must match retained source segments');
  const audio = (file) => execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'copy', '-f', 'adts', '-'], { windowsHide: true, maxBuffer: 20 * 1048576 });
  assert.deepEqual(audio(file), Buffer.concat(referenceFiles.map(audio)), 'retained AAC audio must match byte-for-byte');
  const packets = JSON.parse(command(ffprobe, ['-v', 'error', '-show_packets', '-show_entries', 'packet=stream_index,dts_time', '-of', 'json', file])).packets;
  for (const index of [0, 1]) {
    const times = packets.filter((packet) => packet.stream_index === index).map((packet) => Number(packet.dts_time));
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] >= times[i - 1], 'decode timestamps must be monotonic');
      assert.ok(times[i] - times[i - 1] < 0.2, 'there must be no missing-segment timestamp hole');
    }
  }
  console.log(`PASS ${format}: ${duration}s, ${expected.length} unchanged video frames, identical AAC bytes, continuous timestamps and full decode`);
}

try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? undefined
      : process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true,
  });
  const context = await browser.newContext({ locale: 'zh-CN', acceptDownloads: true });
  await context.addInitScript(() => localStorage.setItem('clover-lang', 'zh'));
  await context.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && /Content Security Policy|WebAssembly|worker/i.test(message.text())) errors.push(message.text()); });
  const parse = async (path) => {
    await page.locator('#hlsUrl').fill(base + path); await page.locator('#hlsParse').click();
    await page.locator('#hlsTask').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.getElementById('hlsParse').disabled);
  };
  const finish = async () => {
    if (await page.locator('#hlsStart').isDisabled()) return;
    await page.locator('#hlsStart').click();
    await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('下载结束'));
  };
  const exportFile = async (id, name) => {
    await page.locator('#hlsFormat').selectOption(name.endsWith('.ts') ? 'ts' : 'mp4');
    const download = page.waitForEvent('download', { timeout: 240000 });
    await page.locator('#hlsExport').click();
    // Surface an engine failure quickly instead of waiting for a download that cannot happen.
    await page.waitForFunction(() => !document.getElementById('hlsCancelExport').hidden || document.getElementById('hlsExportStatus').dataset.kind === 'error');
    const result = await Promise.race([download, page.waitForFunction(() => document.getElementById('hlsExportStatus').dataset.kind === 'error', null, { timeout: 240000 }).then(async () => { throw new Error(await page.locator('#hlsExportStatus').textContent()); })]);
    const file = join(output, name); await result.saveAs(file);
    await page.waitForFunction(() => document.getElementById('hlsCancelExport').hidden);
    return file;
  };
  await page.goto(base + '/tools/daily/m3u8-downloader/');
  if (process.env.HLS_STREAM_ONLY !== '1') {
  await page.screenshot({ path: join(output, 'desktop-empty.png'), fullPage: true });
  await page.locator('#hlsUrl').fill(base + '/media/ts/master.m3u8'); await page.locator('#hlsParse').click();
  await page.locator('#hlsQuality').waitFor({ state: 'visible' }); await page.locator('#hlsLoadVariant').click();
  await page.locator('#hlsTask').waitFor({ state: 'visible' });
  await finish();
  assert.equal(await page.locator('#hlsDone').textContent(), '4');
  assert.equal(await page.locator('#hlsSkipped').textContent(), '2');
  assert.equal(counts.get('/media/ts/seg1.ts'), 1); assert.equal(counts.get('/media/ts/seg3.ts'), 1); assert.equal(counts.get('/media/ts/seg2.ts'), 2);
  console.log('PASS 404 / 410 skipped once; 503 recovers; subsequent media downloads');
  const before = new Map(counts);
  await page.reload(); await parse('/media/ts/index.m3u8');
  assert.equal(await page.locator('#hlsDone').textContent(), '4');
  await finish();
  for (const index of [0, 2, 4, 5]) assert.equal(counts.get(`/media/ts/seg${index}.ts`), before.get(`/media/ts/seg${index}.ts`));
  console.log('PASS reload restores cached segments without requesting them again');
  // Hold a real worker request so fast CI runners cannot finish before the native click.
  let releaseCore, requestTimeout;
  const released = new Promise((resolve) => { releaseCore = resolve; });
  const requested = new Promise((resolve, reject) => {
    requestTimeout = setTimeout(() => reject(new Error('Export worker did not request its core manifest')), 15000);
    coreLoadGate = { released, reached: resolve };
  });
  try {
    await page.locator('#hlsExport').click();
    await requested;
    await page.locator('#hlsCancelExport').click();
    await page.waitForFunction(() => document.getElementById('hlsExportStatus').textContent.includes('已取消'));
    assert.equal(await page.locator('#hlsDone').textContent(), '4', 'cancelling keeps downloaded segments');
    assert.equal(await page.locator('#hlsSkipped').textContent(), '2', 'cancelling does not skip cached segments');
    assert.equal(await page.locator('#hlsExport').isEnabled(), true, 'cancelled exports can be retried');
  } finally {
    clearTimeout(requestTimeout);
    coreLoadGate = null;
    releaseCore();
  }
  console.log('PASS export cancellation interrupts worker and keeps cache');
  const mp4 = await exportFile('#hlsMp4', 'missing-ts.mp4');
  assert.equal(await page.locator('#hlsSkipped').textContent(), '3');
  verify(mp4, 'ts', [0, 2, 5], 6);
  await page.waitForFunction(() => document.getElementById('hlsPreview').readyState >= 1);
  const previewDuration = await page.locator('#hlsPreview').evaluate((video) => video.duration);
  assert.ok(previewDuration > 5.9 && previewDuration < 6.2);
  const reportDownload = page.waitForEvent('download'); await page.locator('#hlsReport').click();
  const reportFile = join(output, 'gap-report.json'); await (await reportDownload).saveAs(reportFile);
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  assert.equal(report.totals.skipped, 3); assert.equal(report.segments[4].error, 'invalidMedia');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(output, 'desktop-complete.png'), fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: join(output, 'desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout must not overflow');
  await page.screenshot({ path: join(output, 'mobile-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  const tsFile = await exportFile('#hlsTs', 'missing-ts.ts'); verify(tsFile, 'ts', [0, 2, 5], 6);
  await parse('/media/fmp4/index.m3u8');
  slow = true; await page.locator('details.hls-settings').evaluate((node) => node.open = true);
  await page.locator('#hlsConcurrency').fill('1'); await page.locator('#hlsStart').click();
  await page.waitForFunction(() => Number(document.getElementById('hlsDone').textContent) >= 1);
  await page.locator('#hlsPause').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('已暂停'));
  const paused = Number(await page.locator('#hlsDone').textContent()); assert.ok(paused > 0 && paused < 4);
  await finish(); slow = false;
  assert.equal(await page.locator('#hlsDone').textContent(), '4');
  assert.equal(counts.has('/media/fmp4/seg3.m4s'), false, 'EXT-X-GAP must never be requested');
  console.log('PASS pause / resume and EXT-X-GAP');
  const fragmented = await exportFile('#hlsMp4', 'missing-fmp4.mp4'); verify(fragmented, 'fmp4', [0, 2, 4, 5], 8);
  await page.locator('#hlsClear').click(); await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('缓存已清除'));
  assert.equal(await page.locator('#hlsDone').textContent(), '0'); console.log('PASS task cache clearing');
  await page.locator('#hlsUrl').fill(base + '/media/ts/external.m3u8'); await page.locator('#hlsParse').click();
  await page.locator('#hlsQuality').waitFor({ state: 'visible' }); await page.locator('#hlsLoadVariant').click();
  assert.ok((await page.locator('#hlsStatus').textContent()).includes('独立音轨')); console.log('PASS external audio explicitly rejected');
  }
  await checkStreaming({ page, context, base, output, counts, verify, setSlow: (value) => slow = value, setRecoverSkipped: (value) => recoverSkipped = value, ffmpeg, ffprobe });
  for (const [prefix, lang, label] of [['/en', 'en', 'Parse URL'], ['/ko', 'ko', '링크 분석'], ['/ja', 'ja', 'リンクを解析'], ['/zh-hant', 'tw', '解析鏈接']]) {
    await page.evaluate((value) => localStorage.setItem('clover-lang', value), lang);
    await page.goto(base + prefix + '/tools/daily/m3u8-downloader/');
    assert.equal(await page.locator('#hlsParse').textContent(), label);
  }
  assert.deepEqual(errors, [], 'browser errors or production CSP violations');
  await context.close(); console.log('PASS five-language routes, local preview, mobile layout, dark mode and production CSP');
} catch (error) {
  writeFileSync(join(output, 'diagnostics.json'), JSON.stringify({ errors, counts: Object.fromEntries(counts), error: error.message }, null, 2));
  throw error;
} finally {
  await browser?.close(); await new Promise((resolve) => server.close(resolve));
}
