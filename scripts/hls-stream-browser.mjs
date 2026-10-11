import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { HLS_CONFIG } from '../config/hls.mjs';

/** Exercise the UI with real native writable streams; only the OS picker is replaced. */
export async function checkStreaming({ page, context, base, output, counts, verify, setSlow, setRecoverSkipped, ffmpeg, ffprobe }) {
  await context.addInitScript(() => {
    const state = window.__hlsFileTest = { cancel: false, deny: false, failWrite: false, samples: [], name: '', pickers: 0 };
    const nativePermission = FileSystemHandle.prototype.requestPermission;
    FileSystemHandle.prototype.requestPermission = function (options) { return state.deny ? Promise.resolve('denied') : nativePermission.call(this, options); };
    const nativeCreateWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      try { return await nativeCreateWritable.apply(this, args); }
      catch (error) { state.createWritableError = `${error.name}: ${error.message}`; throw error; }
    };
    const nativeWrite = FileSystemWritableFileStream.prototype.write;
    FileSystemWritableFileStream.prototype.write = async function (data) {
      if (state.failWrite) throw new DOMException('Disk full', 'QuotaExceededError');
      try { await nativeWrite.call(this, data); }
      catch (error) { state.writeError = { name: error.name, message: error.message, storage: await navigator.storage.estimate() }; throw error; }
      state.samples.push({ heap: performance.memory?.usedJSHeapSize || 0, worker: Number(document.getElementById('hlsDownloader')?.dataset.workerHeap || 0) });
    };
    window.showSaveFilePicker = async ({ suggestedName }) => {
      state.pickers++;
      if (state.cancel) throw new DOMException('Cancelled', 'AbortError');
      if (state.deny) throw new DOMException('Permission denied', 'NotAllowedError');
      state.name = suggestedName;
      try {
        return await (await navigator.storage.getDirectory()).getFileHandle(suggestedName, { create: true });
      } catch (error) {
        state.pickerError = `${error.name}: ${error.message}`;
        throw error;
      }
    };
  });
  await page.reload();
  const parse = async (path) => {
    await page.locator('#hlsUrl').fill(base + path); await page.locator('#hlsParse').click();
    await page.waitForFunction(() => !document.getElementById('hlsParse').disabled);
    await page.locator('#hlsTask').waitFor({ state: 'visible' });
    await page.locator('details.hls-settings').evaluate((node) => node.open = true);
  };
  const waitComplete = async () => {
    await page.waitForFunction(() => !document.getElementById('hlsStart').hidden && (document.getElementById('hlsStatus').textContent.includes('文件已保存') || document.getElementById('hlsStatus').dataset.kind === 'error'), null, { timeout: 240000 });
    const state = await page.evaluate(() => { const { samples, ...rest } = window.__hlsFileTest; return rest; });
    assert.ok((await page.locator('#hlsStatus').textContent()).includes('文件已保存'), `${await page.locator('#hlsStatus').textContent()} ${JSON.stringify(state)}`);
  };
  // One click now picks the destination, prepares and streams; only the OS picker is replaced.
  const complete = async () => { await page.locator('#hlsStart').click(); await waitComplete(); };
  const saved = async (name) => {
    const bytes = await page.evaluate(async (name) => {
      const file = await (await (await navigator.storage.getDirectory()).getFileHandle(name)).getFile();
      return Array.from(new Uint8Array(await file.arrayBuffer()));
    }, name);
    const file = join(output, name); writeFileSync(file, new Uint8Array(bytes)); return file;
  };

  if (process.env.HLS_LARGE_ONLY !== '1') {
  await parse('/media/ts/index.m3u8'); await page.locator('#hlsStream').check();
  // This phase shares the cache with the checks above, so compare against the restored count.
  const restored = await page.locator('#hlsDone').textContent();
  await page.evaluate(() => window.__hlsFileTest.cancel = true); await page.locator('#hlsStart').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('取消选择'));
  assert.equal(await page.locator('#hlsDone').textContent(), restored, 'choosing the destination comes before any download');
  await page.evaluate(() => { window.__hlsFileTest.cancel = false; window.__hlsFileTest.deny = true; });
  await page.locator('#hlsStart').click(); await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('写入权限'));
  await page.evaluate(() => window.__hlsFileTest.deny = false);
  await complete(); verify(await saved('clover-video.ts'), 'ts', [0, 2, 5], 6);
  console.log('PASS native streaming TS, picker cancellation and permission failure');

  for (const [source, format, retained, duration, name] of [
    ['ts', 'mp4', [0, 2, 5], 6, 'stream-ts.mp4'], ['fmp4', 'original', [0, 2, 4, 5], 8, 'stream-fmp4-original.mp4'], ['fmp4', 'mp4', [0, 2, 4, 5], 8, 'stream-fmp4.mp4'],
    ['bframes', 'mp4', [0, 2, 5], 6, 'stream-bframes.mp4'],
  ]) {
    await parse(`/media/${source}/index.m3u8`); await page.locator('#hlsFormat').selectOption(format);
    await page.locator('details.hls-settings').evaluate((node) => node.open = true); await page.locator('#hlsFilename').fill(name);
    await complete(); verify(await saved(name), source, retained, duration);
  }
  console.log('PASS lossless streaming MP4 from TS/fMP4 and fMP4 source format');

  const audio = (file) => execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-c:a', 'copy', '-f', 'adts', '-'], { windowsHide: true, maxBuffer: 20 * 1048576 });
  for (const format of ['original', 'mp4']) {
    await parse('/media/aac/index.m3u8'); await page.locator('#hlsFormat').selectOption(format);
    const name = `stream-audio.${format === 'original' ? 'aac' : 'mp4'}`; await page.locator('#hlsFilename').fill(name);
    await complete(); const file = await saved(name);
    execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], { windowsHide: true });
    assert.deepEqual(audio(file), Buffer.concat([0, 2, 3, 4, 5].map((i) => audio(join(output, 'aac', `seg${i}.aac`)))));
    const packets = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'packet=dts_time', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' })).packets;
    const times = packets.map((packet) => Number(packet.dts_time));
    for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1] && times[i] - times[i - 1] < 0.05);
  }
  console.log('PASS AAC source format and streaming MP4: unchanged audio and continuous timestamps');

  await parse('/media/fmp4/index.m3u8'); await page.locator('#hlsClear').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('缓存已清除'));
  await page.locator('#hlsFormat').selectOption('mp4'); await page.locator('#hlsFilename').fill('partial.mp4');
  const initUrl = base + '/media/fmp4/init.mp4';
  await page.route(initUrl, (route) => route.fulfill({ status: 404, body: '' }));
  await page.locator('#hlsStart').click();
  await page.waitForFunction(() => !document.getElementById('hlsStart').hidden && document.getElementById('hlsStatus').textContent.includes('初始化片段不可用'));
  assert.equal(await page.locator('#hlsDone').textContent(), '0');
  assert.equal(await page.locator('#hlsSkipped').textContent(), '1', 'only the declared playlist gap is skipped');
  await page.unroute(initUrl);
  console.log('PASS missing initialization pauses without converting media into gaps');
  setSlow(true); await page.locator('#hlsStart').click();
  await page.waitForFunction(() => Number(document.getElementById('hlsWritten').textContent.split(' ')[0]) > 0);
  await page.locator('#hlsPause').click(); await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('已暂停'));
  await page.locator('#hlsSavePartial').click(); await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('已保存完整分片'));
  const partial = await saved('partial.mp4'); execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', partial, '-f', 'null', '-'], { windowsHide: true });
  const terminal = await page.locator('#hlsSegmentGrid button').evaluateAll((nodes) => nodes.filter((node) => ['done', 'skipped'].includes(node.dataset.state)).map((node) => Number(node.dataset.index)));
  const before = new Map(counts); await page.reload(); await page.locator('#hlsRestore').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('不重复下载'));
  await page.evaluate(() => window.__hlsFileTest.deny = true); await page.locator('#hlsStart').click();
  await page.waitForFunction(() => !document.getElementById('hlsStart').hidden && document.getElementById('hlsStatus').textContent.includes('写入权限'));
  await page.evaluate(() => window.__hlsFileTest.deny = false);
  // Re-authorising the restored handle rebuilds the output into the remembered location.
  await complete();
  // Choosing another location must open exactly one fresh picker, whatever the handle did above.
  const beforePickers = await page.evaluate(() => window.__hlsFileTest.pickers);
  await page.locator('#hlsChangeFile').click(); await waitComplete(); setSlow(false);
  assert.equal(await page.evaluate(() => window.__hlsFileTest.pickers), beforePickers + 1, 'choosing a new location opens one picker after restoring a task');
  for (const index of terminal) assert.equal(counts.get(`/media/fmp4/seg${index}.m4s`), before.get(`/media/fmp4/seg${index}.m4s`), `restored terminal segment ${index} must not be requested again`);
  verify(await saved('partial.mp4'), 'fmp4', [0, 2, 4, 5], 8);
  console.log('PASS native partial commit, reload restores persisted handle/task/cache, output rebuild');

  await parse('/media/ts/index.m3u8'); await page.locator('#hlsFormat').selectOption('mp4'); await page.locator('#hlsFilename').fill('clover-video.mp4');
  await page.evaluate(() => window.__hlsFileTest.failWrite = true); await page.locator('#hlsStart').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('文件写入失败'));
  assert.equal(await page.locator('#hlsDone').textContent(), '3'); await page.evaluate(() => window.__hlsFileTest.failWrite = false);
  await complete(); console.log('PASS native write failure retains cache and can rebuild');
  const reused = new Map(counts); setRecoverSkipped(true); await page.locator('#hlsRetry').click();
  await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('重建文件'));
  await complete(); setRecoverSkipped(false);
  for (const index of [0, 2, 5]) assert.equal(counts.get(`/media/ts/seg${index}.ts`), reused.get(`/media/ts/seg${index}.ts`));
  verify(await saved('clover-video.mp4'), 'ts', [0, 1, 2, 3, 5], 10);
  console.log('PASS recovered gaps rebuild in original order without refetching retained segments');
  }
  const cdp = await context.newCDPSession(page);
  // The headless picker uses OPFS, whose sandbox quota also includes our output file.
  // Real user-picked files are outside this quota; keep the test cache/output budget explicit.
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: base, quotaSize: HLS_CONFIG.limits.exportBytes * 4 });
  await parse('/media/large/index.m3u8'); await page.locator('#hlsStream').check(); await page.locator('#hlsFormat').selectOption('original'); await page.locator('#hlsFilename').fill('large-source.ts');
  await cdp.send('HeapProfiler.collectGarbage');
  const baseline = await cdp.send('Runtime.getHeapUsage');
  await complete(); await cdp.send('HeapProfiler.collectGarbage'); const finalHeap = await cdp.send('Runtime.getHeapUsage');
  const large = await page.evaluate(async () => {
    const file = await (await (await navigator.storage.getDirectory()).getFileHandle('large-source.ts')).getFile();
    return { bytes: file.size, samples: window.__hlsFileTest.samples, workerHeap: Number(document.getElementById('hlsDownloader').dataset.workerHeap) };
  });
  assert.ok(large.bytes > HLS_CONFIG.limits.exportBytes, 'streaming must exceed the ordinary export limit');
  assert.ok(large.workerHeap > 0 && large.workerHeap <= HLS_CONFIG.stream.heapBytes, 'WASM filesystem must release each segment');
  const retainedBytes = finalHeap.usedSize + (finalHeap.backingStorageSize || 0) - baseline.usedSize - (baseline.backingStorageSize || 0);
  assert.ok(retainedBytes < HLS_CONFIG.stream.bufferBytes, 'the page must not retain an entire output video');
  writeFileSync(join(output, 'stream-memory.json'), JSON.stringify({ bytes: large.bytes, baseline, finalHeap, workerHeap: large.workerHeap, samples: large.samples }, null, 2));
  console.log(`PASS ${(large.bytes / 1048576).toFixed(1)} MiB native file; retained page buffers ${(retainedBytes / 1048576).toFixed(1)} MiB, WASM ${(large.workerHeap / 1048576).toFixed(1)} MiB`);
  const largeRequests = new Map(counts);
  await parse('/media/large/index.m3u8'); await page.locator('#hlsFormat').selectOption('mp4'); await page.locator('#hlsFilename').fill('large-video.mp4');
  await complete(); const largeMp4 = await saved('large-video.mp4');
  for (const [path, count] of largeRequests) if (path.startsWith('/media/large/')) assert.equal(counts.get(path), count + (path.endsWith('index.m3u8') ? 1 : 0));
  execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', largeMp4, '-f', 'null', '-'], { windowsHide: true });
  const hashes = (file) => execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-'], { windowsHide: true, encoding: 'utf8' }).split('\n').filter((line) => line && !line.startsWith('#')).map((line) => line.split(',').at(-1).trim());
  const copies = Number(await page.locator('#hlsDone').textContent());
  assert.deepEqual(hashes(largeMp4), Array.from({ length: copies }, () => hashes(join(output, 'large-video.ts'))).flat());
  console.log('PASS streaming MP4 reuses >384 MiB source cache and preserves all retained video frames');
  await page.locator('#hlsClear').click(); await page.waitForFunction(() => document.getElementById('hlsStatus').textContent.includes('缓存已清除'));
  await parse('/media/ts/index.m3u8'); await page.locator('#hlsFormat').selectOption('mp4'); await complete();
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: join(output, 'stream-desktop.png'), fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(output, 'stream-mobile-dark.png'), fullPage: true }); await page.setViewportSize({ width: 1280, height: 900 });
  const unsupported = await context.browser().newContext();
  await unsupported.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await unsupported.addInitScript(() => {
    localStorage.setItem('clover-lang', 'zh'); Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    const request = indexedDB.open('clover-hls-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('chunks');
    request.onsuccess = () => { const tx = request.result.transaction('chunks', 'readwrite'); tx.objectStore('chunks').put(new Blob(['retained legacy chunk']), 'legacy:segment:0'); tx.oncomplete = () => request.result.close(); };
  });
  const fallback = await unsupported.newPage(); await fallback.goto(base + '/tools/daily/m3u8-downloader/');
  assert.equal(await fallback.locator('#hlsStream').isDisabled(), true);
  assert.ok((await fallback.locator('#hlsStreamNote').textContent()).includes('不支持'));
  const migrated = await fallback.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('clover-hls-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('chunks', 'readonly'), chunk = tx.objectStore('chunks').get('legacy:segment:0');
      tx.oncomplete = async () => { resolve({ text: await chunk.result.text(), tasks: db.objectStoreNames.contains('tasks') }); db.close(); }; };
  }));
  assert.deepEqual(migrated, { text: 'retained legacy chunk', tasks: true }); await unsupported.close();
  console.log('PASS unsupported-browser fallback and v1 -> v2 migration retains existing media');
}
