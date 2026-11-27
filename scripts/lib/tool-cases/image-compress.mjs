import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { localizedPath } from '../../../config/routes.mjs';
import { snapshotInPage } from '../presentation-check.mjs';

const slug = 'image-compress';
const labels = {
  zh: ['zh-CN', '图片压缩', '原图 · 未选择', '结果 · 尚未压缩'],
  tw: ['zh-Hant', '圖片壓縮', '原圖 · 未選擇', '結果 · 尚未壓縮'],
  en: ['en', 'Image Compressor', 'Original · No file selected', 'Result · Not compressed yet'],
  ko: ['ko', '이미지 압축', '원본 · 선택한 파일 없음', '결과 · 압축 전'],
  ja: ['ja', '画像圧縮', '元画像 · ファイル未選択', '圧縮結果 · 未圧縮'],
};
const path = lang => localizedPath('/tools/daily/image-compress/', lang);
const csp = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8')
  .match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
const el = (page, id) => page.locator('#imgComp' + id);
const root = page => page.locator('#imageCompress');
const shot = (page, artifacts, name) => page.screenshot({ path: join(artifacts, slug + '-' + name + '.png') });

function pngChunk(name, data) {
  const bytes = Buffer.concat([Buffer.from(name), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const chunk = Buffer.alloc(8 + bytes.length);
  chunk.writeUInt32BE(data.length);
  bytes.copy(chunk, 4);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 4 + bytes.length);
  return chunk;
}

function makePng(width, height, animated = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = 4 * width + 1;
  const raw = Buffer.alloc(stride * height);
  let random = 0x357a143b;
  for (let y = 4; y < height; y++) {
    for (let x = 4; x < width; x++) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      raw.writeUInt32LE((random | 0xff000000) >>> 0, y * stride + 1 + 4 * x);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    ...(animated ? [pngChunk('acTL', Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]))] : []),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pixels = makePng(320, 200);
const fixture = (buffer = pixels, name = 'detail.png', mimeType = 'image/png') => ({ buffer, name, mimeType });
const mobile = { viewport: { width: 360, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true };

async function monitor(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    errors.push(dialog.type());
    await dialog.dismiss();
  });
  await page.addInitScript(() => {
    window.imgCompUnexpected = [];
    window.imgCompBlobs = new Map();
    const createURL = URL.createObjectURL;
    const revokeURL = URL.revokeObjectURL;
    URL.createObjectURL = blob => {
      const url = createURL(blob);
      window.imgCompBlobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = url => {
      window.imgCompBlobs.delete(url);
      revokeURL(url);
    };
    document.addEventListener('securitypolicyviolation', event => window.imgCompUnexpected.push(event.violatedDirective));
    window.addEventListener('unhandledrejection', () => window.imgCompUnexpected.push('unhandledrejection'));
  });
  return async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.imgCompUnexpected), []);
  };
}

async function open(page, base, lang = 'en', expected = 'primary') {
  const url = base + path(lang);
  await page.route(url, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  const response = await page.goto(url, { waitUntil: 'load' });
  assert.equal(response?.status(), 200);
  assert.equal(response.headers()['content-security-policy'], csp);
  await waitView(page, expected);
}

const waitView = (page, state) =>
  page.waitForFunction(state => document.querySelector('#imageCompress').dataset.presentationState === state, state);
const waitProcess = (page, state) =>
  page.waitForFunction(state => document.querySelector('#imageCompress').dataset.process === state, state);
const choose = (page, file = fixture()) => el(page, 'File').setInputFiles(file);

async function reveal(page) {
  await el(page, 'Exit').click();
  await waitView(page, 'reveal');
}

async function settings(page, change) {
  await el(page, 'SettingsToggle').click();
  await waitView(page, 'settingsOpen');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'imgCompMode');
  assert.equal(await el(page, 'OriginalPreview').isVisible(), false);
  assert.equal(await el(page, 'ResultPreview').isVisible(), false);
  await change();
  await el(page, 'SettingsClose').click();
  await waitView(page, 'reveal');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'imgCompSettingsToggle');
}

async function encode(page, action = () => el(page, 'Compress').click()) {
  await action();
  await waitProcess(page, 'done');
  await page.waitForFunction(() => document.querySelector('#imgCompResultPreview')?.naturalWidth > 0);
}

async function quiet(page, expected) {
  const snapshot = await page.evaluate(snapshotInPage);
  assert.deepEqual(snapshot.texts.map(item => item.text), expected);
  assert.deepEqual(snapshot.interactives.map(item => item.selector), ['a#imgCompExit']);
  assert.deepEqual(snapshot.surfaces, []);
}

async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const control of ['Exit', 'Pick', 'Compress', 'SettingsToggle', 'Fullscreen', 'Download']) {
    const locator = el(page, control);
    if (!await locator.isVisible()) continue;
    const bounds = await locator.boundingBox();
    assert.ok(bounds.width >= 44 && bounds.height >= 44, control + ' hit area');
  }
}

async function metadata(page, lang) {
  const [locale, name] = labels[lang];
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('h1').textContent(), name);
  assert.equal(await page.locator('h1').isHidden(), true);
  assert.ok((await page.title()).endsWith(' - CloverTools'));
  assert.ok(await page.locator('meta[name="description"]').getAttribute('content'));
  assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute('href')).pathname, path(lang));
  const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll(links =>
    Object.fromEntries(links.map(link => [link.hreflang, new URL(link.href).pathname])));
  assert.deepEqual(alternates, { ...Object.fromEntries(Object.entries(labels).map(([key, [locale]]) => [locale, path(key)])), 'x-default': path('zh') });
}

async function drop(page, files) {
  await page.evaluate(files => {
    const transfer = new DataTransfer();
    for (const { bytes, name } of files) transfer.items.add(new File([Uint8Array.from(bytes)], name));
    document.querySelector('#imageCompress').dispatchEvent(new DragEvent('drop', {
      dataTransfer: transfer, bubbles: true, cancelable: true,
    }));
  }, files.map(({ buffer, name }) => ({ name, bytes: [...buffer] })));
}

async function output(page) {
  const match = (await el(page, 'Result').textContent()).match(/ · (JPG|PNG|WebP) · ([0-9]+) × ([0-9]+) px · ([0-9]+) B$/);
  assert.ok(match, 'verified result summary');
  const [, format, width, height, bytes] = match;
  return { format, width: Number(width), height: Number(height), bytes: Number(bytes) };
}

async function verifyDownload(page, expectedName, transparent = true) {
  const info = await output(page);
  const event = page.waitForEvent('download');
  await el(page, 'Download').click();
  const download = await event;
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), expectedName);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.length, info.bytes);
  if (info.format === 'JPG') assert.equal(bytes.readUInt16BE(0), 0xffd8);
  else if (info.format === 'WebP') assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  else assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const checks = await el(page, 'ResultPreview').evaluate(async (image, { encoded, type }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(encoded)], { type }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const alpha = context.getImageData(0, 0, 1, 1).data[3];
    const dimensions = [bitmap.width, bitmap.height];
    bitmap.close();
    const preview = new Uint8Array(await window.imgCompBlobs.get(image.src).arrayBuffer());
    return {
      alpha, dimensions, previewDimensions: [image.naturalWidth, image.naturalHeight],
      matches: preview.length === encoded.length && preview.every((byte, index) => byte === encoded[index]),
    };
  }, { encoded: [...bytes], type: { JPG: 'image/jpeg', PNG: 'image/png', WebP: 'image/webp' }[info.format] });
  assert.deepEqual(checks, {
    alpha: transparent ? 0 : 255, dimensions: [info.width, info.height],
    previewDimensions: [info.width, info.height], matches: true,
  });
  return bytes;
}

async function canvasFixture(page, width, height, mimeType) {
  const bytes = await page.evaluate(async ({ width, height, mimeType }) => {
    const source = document.querySelector('#imgCompOriginalPreview');
    const bitmap = await createImageBitmap(window.imgCompBlobs.get(source.src), { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.97));
    if (blob?.type !== mimeType) throw new Error('Fixture format unavailable');
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, { width, height, mimeType });
  return Buffer.from(bytes);
}

async function assertError(page, code) {
  await waitProcess(page, 'error');
  assert.equal(await root(page).getAttribute('data-error-code'), code);
  assert.equal(await el(page, 'Download').getAttribute('href'), null);
  assert.equal(await el(page, 'Copy').isDisabled(), true);
  assert.equal(await el(page, 'ResultPreview').count(), 0);
  assert.ok(await el(page, 'Live').textContent());
}

export async function run({ run, remember, base, artifacts }) {
  for (const [lang, [locale, , original, result]] of Object.entries(labels)) {
    await run(slug + '-desktop-' + lang, { locale }, async (page, context) => {
      await remember(context, lang);
      const clean = await monitor(page);
      await open(page, base, lang);
      await metadata(page, lang);
      await quiet(page, [original, result]);
      if (lang === 'en') await page.keyboard.press('Tab');
      else await page.mouse.move(20, 20);
      await waitView(page, 'reveal');
      if (lang === 'en') assert.equal(await page.evaluate(() => document.activeElement.id), 'imgCompExit');
      await choose(page, fixture(pixels, 'detail.webp', 'application/octet-stream'));
      await waitProcess(page, 'ready');
      assert.equal(await el(page, 'Source').textContent(), `${original.split(' · ')[0]} · PNG · 320 × 200 px · ${pixels.length} B`);
      await page.waitForFunction(() => document.querySelector('#imgCompOriginalPreview')?.naturalWidth === 320);
      await settings(page, async () => {
        assert.equal(await el(page, 'Quality').isDisabled(), true);
        assert.equal(await el(page, 'PngQuality').isVisible(), true);
        await el(page, 'MaxWidth').fill('160');
        assert.match(await el(page, 'Estimate').textContent(), /160 × 100 px/);
      });
      await encode(page, () => page.keyboard.press(lang === 'ja' ? 'Meta+Enter' : 'Control+Enter'));
      const info = await output(page);
      assert.deepEqual([info.format, info.width, info.height], ['PNG', 160, 100]);
      assert.ok(info.bytes < pixels.length);
      const frames = await page.locator('.img-comp-frame').evaluateAll(frames => frames.map(frame => frame.clientHeight));
      assert.equal(frames[0], frames[1]);
      await verifyDownload(page, 'detail-compressed.png');
      await layout(page);
      if (lang === 'en') {
        await el(page, 'Compare').scrollIntoViewIfNeeded();
        await shot(page, artifacts, 'desktop-result');
      }
      const summaries = await page.locator('.img-comp-slot').allTextContents();
      await page.keyboard.press('Escape');
      await waitView(page, 'primary');
      await quiet(page, summaries);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'imgCompExit');
      await page.keyboard.press('Enter');
      await waitView(page, 'reveal');
      assert.deepEqual(await output(page), info);
      await el(page, 'Clear').click();
      await waitProcess(page, 'empty');
      await choose(page, fixture(pixels, 'detail.webp', ''));
      await waitProcess(page, 'ready');
      await clean();
    });

    await run(slug + '-360-dark-' + lang, { ...mobile, locale }, async (page, context) => {
      await remember(context, lang);
      const clean = await monitor(page);
      await open(page, base, lang);
      await quiet(page, [original, result]);
      await layout(page);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      if (lang === 'en') await shot(page, artifacts, '360-dark-empty');
      await el(page, 'Exit').tap();
      await waitView(page, 'reveal');
      await layout(page);
      const longName = 'portrait_' + '𠮷'.repeat(60) + '_long.png';
      await choose(page, fixture(pixels, longName));
      await waitProcess(page, 'ready');
      await settings(page, async () => {
        await el(page, 'MaxWidth').fill('1e2');
        assert.equal(await el(page, 'MaxWidth').getAttribute('aria-invalid'), 'true');
        await layout(page);
        if (lang === 'en') await shot(page, artifacts, '360-dark-settings');
        await page.keyboard.press('Control+Enter');
        await assertError(page, 'invalidOptions');
        await el(page, 'MaxWidth').fill('160');
      });
      await encode(page);
      assert.equal(await el(page, 'SourceName').textContent(), longName);
      const boxes = await page.locator('.img-comp-frame').evaluateAll(frames => frames.map(frame => frame.getBoundingClientRect().top));
      assert.ok(boxes[0] < boxes[1]);
      await layout(page);
      if (lang === 'en') {
        await el(page, 'Compare').scrollIntoViewIfNeeded();
        await shot(page, artifacts, '360-dark-result');
      }
      await choose(page, fixture(Buffer.from('not PNG')));
      await assertError(page, 'unsupported');
      assert.equal(await el(page, 'OriginalPreview').count(), 0);
      await layout(page);
      if (lang === 'en') await shot(page, artifacts, '360-dark-error');
      await clean();
    });
  }

  await run(slug + '-no-script', { javaScriptEnabled: false }, async (page, context) => {
    await remember(context, 'en');
    await open(page, base, 'en', 'firstLoad');
    await quiet(page, labels.en.slice(2));
    await el(page, 'Exit').click();
    await el(page, 'StaticHelp').waitFor({ state: 'visible' });
    assert.match(await el(page, 'StaticHelp').textContent(), /Enable JavaScript/);
    assert.equal(await el(page, 'Pick').isHidden(), true);
    await el(page, 'StaticHelp').getByRole('link', { name: 'Hide controls' }).click();
    assert.equal(await el(page, 'StaticHelp').isHidden(), true);
  });

  await run(slug + '-targets-and-codecs', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await open(page, base);
    await reveal(page);
    await el(page, 'Sample').click();
    await waitProcess(page, 'ready');
    assert.equal(await el(page, 'SourceName').textContent(), 'transparent-sample.png');
    await choose(page);
    await waitProcess(page, 'ready');
    const full = (await canvasFixture(page, 320, 200, 'image/png')).length;
    const medium = (await canvasFixture(page, 240, 150, 'image/png')).length;
    const half = (await canvasFixture(page, 160, 100, 'image/png')).length;
    assert.ok(full > medium && medium > half);
    const budget = Math.floor((medium + half) / 2);
    await settings(page, async () => {
      await el(page, 'Mode').selectOption('target');
      await el(page, 'Unit').selectOption('B');
      await el(page, 'Target').fill(String(budget));
    });
    await encode(page);
    assert.deepEqual(await output(page), { format: 'PNG', width: 160, height: 100, bytes: half });
    assert.equal(await root(page).getAttribute('data-target-outcome'), 'met');
    assert.match(await el(page, 'Attempts').textContent(), /3$/);
    await settings(page, async () => {
      await el(page, 'AllowResize').uncheck();
      assert.equal(await el(page, 'Download').getAttribute('href'), null);
    });
    await encode(page);
    assert.deepEqual(await output(page), { format: 'PNG', width: 320, height: 200, bytes: full });
    assert.equal(await root(page).getAttribute('data-target-outcome'), 'missed');
    await settings(page, async () => {
      await el(page, 'AllowResize').check();
      await el(page, 'Target').fill('1');
    });
    await encode(page);
    const smallest = await output(page);
    assert.deepEqual([smallest.width, smallest.height], [80, 50]);
    assert.equal(await root(page).getAttribute('data-target-outcome'), 'missed');
    assert.ok((await el(page, 'TargetOutcome').textContent()).endsWith('Over by ' + (smallest.bytes - 1).toLocaleString('en') + ' B'));
    assert.match(await el(page, 'Attempts').textContent(), /4$/);

    await settings(page, () => el(page, 'Mode').selectOption('quality'));
    await choose(page, fixture(await canvasFixture(page, 320, 200, 'image/png'), 'same.png'));
    await waitProcess(page, 'ready');
    await encode(page);
    assert.match(await el(page, 'Difference').textContent(), /^Same size \(0 B, 0%\)$/);

    const tiny = makePng(1, 1);
    await choose(page, fixture(tiny, 'tiny.png'));
    await waitProcess(page, 'ready');
    await encode(page);
    assert.ok((await output(page)).bytes > tiny.length);
    assert.match(await el(page, 'Difference').textContent(), /^Increased by /);

    await choose(page, fixture());
    await waitProcess(page, 'ready');
    const jpg = await canvasFixture(page, 320, 200, 'image/jpeg');
    const webp = await canvasFixture(page, 320, 200, 'image/webp');
    await choose(page, fixture(jpg, 'detail.jpg', 'image/jpeg'));
    await waitProcess(page, 'ready');
    await settings(page, async () => {
      await el(page, 'Mode').selectOption('quality');
      await el(page, 'Quality').focus();
      await page.keyboard.press('Home');
      assert.equal(await el(page, 'Quality').inputValue(), '0');
    });
    await encode(page);
    assert.match(await el(page, 'EncodedQuality').textContent(), / · 0$/);
    const lossier = await verifyDownload(page, 'detail-compressed.jpg', false);
    assert.ok(lossier.length < jpg.length);

    await choose(page, fixture(webp, 'detail.webp', 'image/webp'));
    await waitProcess(page, 'ready');
    await page.evaluate(() => {
      const encode = HTMLCanvasElement.prototype.toBlob;
      window.imgCompForcePng = true;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        return encode.call(this, callback, type === 'image/webp' && window.imgCompForcePng ? 'image/png' : type, quality);
      };
    });
    await el(page, 'Compress').click();
    await assertError(page, 'codecUnavailable');
    assert.equal(await el(page, 'OriginalPreview').isVisible(), true);
    await page.evaluate(() => { window.imgCompForcePng = false; });
    await settings(page, () => el(page, 'MaxWidth').fill('160'));
    await encode(page);
    assert.equal((await output(page)).format, 'WebP');
    await verifyDownload(page, 'detail-compressed.webp');
    await clean();
  });

  await run(slug + '-file-validation', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await open(page, base);
    await drop(page, [fixture()]);
    await waitView(page, 'reveal');
    await waitProcess(page, 'ready');
    const dropped = await el(page, 'Source').textContent();
    await choose(page);
    await waitProcess(page, 'ready');
    assert.equal(await el(page, 'Source').textContent(), dropped);
    await encode(page);
    await el(page, 'File').dispatchEvent('cancel');
    assert.equal(await root(page).getAttribute('data-process'), 'done');
    assert.equal(await el(page, 'Download').isVisible(), true);

    const oversized = Buffer.from(pixels);
    oversized.writeUInt32BE(8193, 16);
    for (const [buffer, issue] of [
      [Buffer.alloc(0), 'empty'],
      [Buffer.from('pretend PNG'), 'unsupported'],
      [pixels.subarray(0, -1), 'damaged'],
      [makePng(2, 2, true), 'animated'],
      [oversized, 'headerLimit'],
      [Buffer.alloc(16 * 1024 ** 2 + 1), 'inputLimit'],
    ]) {
      await choose(page, fixture(buffer));
      await assertError(page, issue);
      assert.equal(await el(page, 'OriginalPreview').count(), 0);
    }
    await drop(page, [fixture(makePng(4, 4), 'a.png'), fixture(makePng(4, 4), 'b.png')]);
    await assertError(page, 'manyFiles');
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.setData('text/uri-list', 'https://example.invalid/image.png');
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, cancelable: true }));
    });
    await assertError(page, 'remoteDrop');
    await clean();
  });

  await run(slug + '-races-and-permissions', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await page.addInitScript(() => {
      const nativeEncode = HTMLCanvasElement.prototype.toBlob;
      const nativeDecode = window.createImageBitmap;
      window.imgCompMode = '';
      window.imgCompCalls = 0;
      window.imgCompWidths = [];
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (window.imgCompMode !== 'encode' || this.width <= 2) return nativeEncode.call(this, callback, type, quality);
        window.imgCompCalls++;
        window.imgCompWidths.push(this.width);
        return nativeEncode.call(this, blob => {
          window.imgCompRelease = () => { delete window.imgCompRelease; callback(blob); };
        }, type, quality);
      };
      window.createImageBitmap = async (...args) => {
        if (window.imgCompMode === 'decode') {
          await new Promise(resolve => {
            window.imgCompRelease = () => { delete window.imgCompRelease; resolve(); };
          });
        }
        return nativeDecode(...args);
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true, value: { writeText: async () => { throw new Error('denied'); } },
      });
      Element.prototype.requestFullscreen = async () => { throw new Error('denied'); };
    });
    await open(page, base);
    await reveal(page);
    const mode = value => page.evaluate(value => { window.imgCompMode = value; }, value);
    const parked = () => page.waitForFunction(() => typeof window.imgCompRelease === 'function');
    const release = () => page.evaluate(() => window.imgCompRelease());
    await mode('decode');
    await choose(page, fixture(makePng(180, 90), 'stale.png'));
    await parked();
    assert.equal(await el(page, 'Source').getAttribute('aria-busy'), 'true');
    await choose(page, fixture(makePng(200, 100), 'latest.png'));
    await mode('');
    await release();
    await waitProcess(page, 'ready');
    assert.equal(await el(page, 'SourceName').textContent(), 'latest.png');

    await mode('encode');
    await el(page, 'Compress').click();
    await parked();
    assert.equal(await el(page, 'Result').getAttribute('aria-busy'), 'true');
    await page.keyboard.press('Control+Enter');
    assert.equal(await page.evaluate(() => window.imgCompCalls), 1);
    // Submit two new snapshots while the first encoder is parked.
    await el(page, 'SettingsToggle').click();
    await el(page, 'MaxWidth').fill('140');
    await page.keyboard.press('Control+Enter');
    await el(page, 'MaxWidth').fill('100');
    await page.keyboard.press('Control+Enter');
    assert.equal(await el(page, 'Download').getAttribute('href'), null);
    await release();
    await parked();
    assert.deepEqual(await page.evaluate(() => window.imgCompWidths), [200, 100]);
    await release();
    await waitProcess(page, 'done');
    await el(page, 'SettingsClose').click();
    assert.equal((await output(page)).width, 100);

    await el(page, 'Compress').click();
    await parked();
    await choose(page, fixture(makePng(120, 90), 'replacement.png'));
    await release();
    await waitProcess(page, 'ready');
    assert.equal(await el(page, 'SourceName').textContent(), 'replacement.png');
    assert.equal(await el(page, 'Download').getAttribute('href'), null);
    await el(page, 'Compress').click();
    await parked();
    await el(page, 'Clear').click();
    await release();
    await page.waitForFunction(() => document.querySelector('#imageCompress').dataset.process === 'empty');
    assert.deepEqual(await page.locator('.img-comp-slot').allTextContents(), labels.en.slice(2));
    assert.equal(await el(page, 'Download').getAttribute('href'), null);

    await mode('');
    await choose(page, fixture(makePng(120, 90), 'replacement.png'));
    await waitProcess(page, 'ready');
    await encode(page);
    await el(page, 'Copy').click();
    await el(page, 'Manual').waitFor({ state: 'visible' });
    const summary = await el(page, 'Manual').inputValue();
    assert.match(summary, /Result · PNG · 120 × 90 px/);
    assert.deepEqual(await el(page, 'Manual').evaluate(input => [input.selectionStart, input.selectionEnd]), [0, summary.length]);

    await el(page, 'Download').evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once: true }));
    await el(page, 'Download').click();
    await el(page, 'OpenResult').waitFor({ state: 'visible' });
    assert.equal(await root(page).getAttribute('data-error-code'), 'errorDownload');
    assert.equal(await el(page, 'OpenResult').getAttribute('href'), await el(page, 'ResultPreview').getAttribute('src'));
    const summaries = await page.locator('.img-comp-slot').allTextContents();
    await el(page, 'Fullscreen').click();
    await waitView(page, 'fullscreen');
    assert.equal(await root(page).getAttribute('data-presentation-mode'), 'fallback');
    await page.waitForFunction(() => document.querySelector('#imgCompLive').textContent.includes('Fullscreen is unavailable'));
    await quiet(page, summaries);
    await page.keyboard.press('Escape');
    await waitView(page, 'primary');
    await quiet(page, summaries);
    await reveal(page);
    assert.deepEqual(await page.locator('.img-comp-slot').allTextContents(), summaries);
    assert.equal(await el(page, 'ResultPreview').isVisible(), true);
    await clean();
  });

  await run(slug + '-canvas-unavailable', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await open(page, base, 'en', 'degraded');
    await quiet(page, labels.en.slice(2));
    assert.equal(await root(page).getAttribute('data-presentation-degraded'), 'true');
    assert.match(await el(page, 'Live').textContent(), /Canvas 2D is unavailable/);
    await reveal(page);
    await choose(page);
    await assertError(page, 'errorCanvas');
    assert.equal(await el(page, 'OriginalPreview').isVisible(), true);
    assert.equal(await el(page, 'Compress').isDisabled(), true);
    await clean();
  });

  let offlineSlots;
  for (const timezoneId of ['Asia/Tokyo', 'America/Los_Angeles']) {
    await run(slug + '-offline-' + timezoneId.split('/')[1], { timezoneId }, async (page, context) => {
      await remember(context, 'en');
      const clean = await monitor(page);
      await page.addInitScript(() => {
        window.imgCompStorageWrites = [];
        window.imgCompClipboard = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true, value: { writeText: async text => { window.imgCompClipboard = text; } },
        });
      });
      const midnight = timezoneId === 'Asia/Tokyo' ? '2026-11-27T15:00:00Z' : '2026-11-28T08:00:00Z';
      await page.clock.setFixedTime(new Date(Date.parse(midnight) - 1000));
      await open(page, base);
      const storage = await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          window.imgCompStorageWrites.push(key);
          return original.call(this, key, value);
        };
        return [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()];
      });
      const requests = [];
      context.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await context.setOffline(true);
      await drop(page, [fixture(makePng(160, 100), 'offline.png')]);
      await waitView(page, 'reveal');
      await waitProcess(page, 'ready');
      await encode(page);
      const slots = await page.locator('.img-comp-slot').allTextContents();
      const first = await verifyDownload(page, 'offline-compressed.png');
      await el(page, 'Copy').click();
      assert.match(await page.evaluate(() => window.imgCompClipboard), /Original · PNG · 160 × 100 px/);
      await page.clock.setFixedTime(new Date(Date.parse(midnight) + 1000));
      await encode(page);
      assert.deepEqual(await verifyDownload(page, 'offline-compressed.png'), first);
      assert.deepEqual(await page.locator('.img-comp-slot').allTextContents(), slots);
      if (offlineSlots) assert.deepEqual(slots, offlineSlots);
      offlineSlots = slots;
      assert.deepEqual(requests, []);
      assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]), storage);
      assert.deepEqual(await page.evaluate(() => window.imgCompStorageWrites), []);
      await clean();
    });
  }
}
