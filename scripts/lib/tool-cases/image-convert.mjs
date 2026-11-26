import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { localizedPath } from '../../../config/routes.mjs';
import { snapshotInPage } from '../presentation-check.mjs';

const slug = 'image-convert';
const path = lang => localizedPath('/tools/daily/image-convert/', lang);
const csp = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8')
  .match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
const labels = {
  zh: ['zh-CN', '图片格式转换', '原图', '未选择', '结果', '尚未转换', '转换', '下载图片', '最大宽度须留空或填写 1–8192 的整数。'],
  tw: ['zh-Hant', '圖片格式轉換', '原圖', '未選擇', '結果', '尚未轉換', '轉換', '下載圖片', '最大寬度須留空或填寫 1–8192 的整數。'],
  en: ['en', 'Image Converter', 'Source', 'No file', 'Result', 'Not converted', 'Convert', 'Download image', 'Leave maximum width blank or enter a whole number from 1 to 8192.'],
  ko: ['ko', '이미지 형식 변환', '원본', '선택 안 함', '결과', '변환 전', '변환', '이미지 다운로드', '최대 너비를 비워 두거나 1–8192 사이의 정수를 입력하세요.'],
  ja: ['ja', '画像形式変換', '元画像', '未選択', '変換後', '未変換', '変換', '画像をダウンロード', '最大幅は空欄にするか、1–8192 の整数を入力してください。'],
};
const ic = (page, name) => page.locator('#ic' + name);
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
  const pixels = Buffer.alloc(stride * height);
  for (let y = Math.floor(height / 4); y < height * 3 / 4; y++) {
    for (let x = Math.floor(width / 4); x < width * 3 / 4; x++) {
      pixels.set([50, 110, 70, 255], y * stride + x * 4 + 1);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    ...(animated ? [pngChunk('acTL', Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]))] : []),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pixels = makePng(320, 200);
const fixture = (buffer = pixels, name = 'fixture.png', mimeType = 'image/png') => ({ buffer, name, mimeType });
const oriented = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4QBWRXhpZgAATU0AKgAAAAgAAgEOAAIAAAAnAAAAJgESAAMAAAABAAYAAAAAAABPcmlnaW5hbCBzeW50aGV0aWMgb3JpZW50YXRpb24gZml4dHVyZQAA/9sAQwACAQEBAQECAQEBAgICAgIEAwICAgIFBAQDBAYFBgYGBQYGBgcJCAYHCQcGBggLCAkKCgoKCgYICwwLCgwJCgoK/9sAQwECAgICAgIFAwMFCgcGBwoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK/8AAEQgAGAAoAwEiAAIRAQMRAf/EABYAAQEBAAAAAAAAAAAAAAAAAAAGB//EABgQAQADAQAAAAAAAAAAAAAAAAAHRIPC/8QAFwEBAQEBAAAAAAAAAAAAAAAACQcICv/EABsRAAEFAQEAAAAAAAAAAAAAAAADBQg3tIOE/9oADAMBAAIRAxEAPwDEwEHFgJmRaenKZU0i09OUyUGO1ONnbQqDnKm+njz5UAAtZns0wAKZ0IEzItPTlMgUGO1ONnbQqDnKm+njz5UAAtZns//Z', 'base64');
const avif = Buffer.from('AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAALwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAABgAAAAQAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAN21kYXQSAAoIGAhu0QENBoQyIRTHh4ZlAgggnlAAAAhIWupgG8wnYJN4/9GAE8NvjZKwIA==', 'base64');
const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

async function monitor(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    errors.push(dialog.type());
    await dialog.dismiss();
  });
  await page.addInitScript(() => {
    window.icUnexpected = [];
    document.addEventListener('securitypolicyviolation', event => window.icUnexpected.push(event.violatedDirective));
    window.addEventListener('unhandledrejection', () => window.icUnexpected.push('unhandledrejection'));
  });
  return async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.icUnexpected), []);
  };
}

async function open(page, base, lang = 'en', expectedView = 'primary') {
  const url = base + path(lang);
  await page.route(url, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  const response = await page.goto(url, { waitUntil: 'load' });
  assert.equal(response?.status(), 200);
  assert.equal(response.headers()['content-security-policy'], csp);
  await waitView(page, expectedView);
}

const waitView = (page, state) =>
  page.waitForFunction(state => document.querySelector('#imageConvert').dataset.presentationState === state, state);
const waitProcess = (page, state) =>
  page.waitForFunction(state => document.querySelector('#imageConvert').dataset.process === state, state);
const waitConvert = page =>
  page.waitForFunction(() => !document.querySelector('#icConvert').disabled);
const reveal = async page => {
  await ic(page, 'Exit').click();
  await waitView(page, 'reveal');
};
const choose = (page, file = fixture()) => ic(page, 'File').setInputFiles(file);
const runConversion = async page => {
  await waitConvert(page);
  await ic(page, 'Convert').click();
  await waitProcess(page, 'success');
};

async function checkLayout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const name of ['Exit', 'Pick', 'Convert', 'SettingsToggle', 'Fullscreen', 'Download']) {
    const element = ic(page, name);
    if (!(await element.isVisible())) continue;
    const { width, height } = await element.boundingBox();
    assert.ok(width >= 44 && height >= 44, name + ' hit area');
  }
}

async function checkMetadata(page, lang) {
  assert.equal(await page.locator('html').getAttribute('lang'), labels[lang][0]);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('h1').textContent(), labels[lang][1]);
  assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute('href')).pathname, path(lang));
  const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll(links =>
    Object.fromEntries(links.map(link => [link.hreflang, new URL(link.href).pathname])));
  assert.deepEqual(alternates, { ...Object.fromEntries(Object.entries(labels).map(([locale, [html]]) => [html, path(locale)])), 'x-default': path('zh') });
}

async function preview(context, link, width, height) {
  const opened = context.waitForEvent('page');
  await link.click();
  const tab = await opened;
  try {
    await tab.waitForFunction(() => document.images[0]?.naturalWidth > 0);
    assert.match(tab.url(), /^blob:/);
    assert.deepEqual(await tab.evaluate(() => [document.images[0].naturalWidth, document.images[0].naturalHeight, window.opener]), [width, height, null]);
  } finally {
    await tab.close();
  }
}

async function readDownload(page, format, expectedName) {
  const event = page.waitForEvent('download');
  await ic(page, 'Download').click();
  const download = await event;
  assert.equal(await download.failure(), null);
  assert.match(download.suggestedFilename(), new RegExp('-converted\\.' + format + '$'));
  if (expectedName) assert.equal(download.suggestedFilename(), expectedName);
  const bytes = await readFile(await download.path());
  if (format === 'jpg') assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
  if (format === 'png') assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  if (format === 'webp') {
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  if (format === 'avif') {
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    assert.match(bytes.toString('ascii', 8, bytes.readUInt32BE()), /avif/);
  }
  return bytes;
}

async function readPixels(page, buffer, format, points) {
  return page.evaluate(async ({ bytes, type, points }) => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const result = {
      width: image.width, height: image.height,
      values: points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]),
    };
    image.close();
    return result;
  }, { bytes: [...buffer], type: mime[format], points });
}

async function checkOutput(page, format, width, height, points, rgba, tolerance = 0, expectedName) {
  const bytes = await readDownload(page, format, expectedName);
  const actual = await readPixels(page, bytes, format, points);
  assert.equal(actual.width, width);
  assert.equal(actual.height, height);
  for (let i = 0; i < rgba.length; i++) {
    for (let channel = 0; channel < 4; channel++) {
      if (rgba[i][channel] === null) continue;
      assert.ok(Math.abs(actual.values[i][channel] - rgba[i][channel]) <= tolerance,
        `pixel ${points[i]} in ${format}: ${actual.values[i]} vs ${rgba[i]}`);
    }
  }
  return bytes;
}

async function selectTarget(page, format) {
  await page.waitForFunction(() => !document.querySelector('#icFormat').disabled);
  await ic(page, 'Format').selectOption(format);
}

async function assertError(page, code) {
  await waitProcess(page, 'error');
  assert.equal(await page.locator('#imageConvert').getAttribute('data-error-code'), code);
  assert.equal(await ic(page, 'Download').isHidden(), true);
  assert.equal(await ic(page, 'ResultPreview').getAttribute('href'), null);
  assert.equal(await ic(page, 'Copy').isDisabled(), true);
  assert.ok((await ic(page, 'Live').textContent()).trim());
}

async function drop(page, files) {
  await page.locator('#imageConvert').evaluate((element, files) => {
    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(new File([Uint8Array.from(file.bytes)], file.name, { type: 'image/png' }));
    }
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, files);
}

export async function run({ run, remember, base, artifacts }) {
  for (const [lang, [html, title, source, sourceEmpty, result, resultEmpty, convert, download, widthError]] of Object.entries(labels)) {
    await run(`${slug}-${lang}-core`, { viewport: { width: 1440, height: 900 }, locale: html }, async (page, context) => {
      await remember(context, lang);
      const clean = await monitor(page);
      await open(page, base, lang);
      await checkMetadata(page, lang);
      assert.equal(await page.locator('h1').isHidden(), true);
      const initial = await page.evaluate(snapshotInPage);
      assert.deepEqual(initial.texts.map(entry => entry.text), [source + ' · ' + sourceEmpty, result + ' · ' + resultEmpty]);
      assert.deepEqual(initial.interactives.map(entry => entry.selector), ['a#icExit']);
      assert.deepEqual(initial.surfaces, []);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'icExit');
      assert.equal(await ic(page, 'Exit').evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineWidth === '3px'), true);
      await page.keyboard.press('Enter');
      await waitView(page, 'reveal');
      assert.equal(await page.locator('h1').isVisible(), true, title);
      assert.equal(await page.locator('#langSelect').isVisible(), true);
      assert.equal(await page.locator('.brand-logo').isHidden(), true);
      assert.deepEqual((await page.evaluate(snapshotInPage)).surfaces, []);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'icPick');

      await choose(page, fixture(pixels, 'fixture.png', 'application/octet-stream'));
      await waitProcess(page, 'ready');
      assert.equal(await ic(page, 'Source').textContent(), source + ' · PNG · 320 × 200 px');
      const sourceSize = new Intl.NumberFormat(html, { maximumFractionDigits: 2 });
      const expectedSize = pixels.length < 1024 ? sourceSize.format(pixels.length) + ' B' : sourceSize.format(pixels.length / 1024) + ' KiB';
      assert.equal(await ic(page, 'SourceSize').textContent(), expectedSize);
      await preview(context, ic(page, 'SourcePreview'), 320, 200);

      await selectTarget(page, 'jpg');
      await ic(page, 'SettingsToggle').click();
      await waitView(page, 'settingsOpen');
      await ic(page, 'MaxWidth').fill('0');
      await assertError(page, 'invalidOptions');
      assert.equal(await ic(page, 'MaxWidthError').textContent(), widthError);
      assert.equal(await ic(page, 'MaxWidth').getAttribute('aria-invalid'), 'true');
      assert.equal(await ic(page, 'Convert').isDisabled(), true);
      await ic(page, 'MaxWidth').fill('160');
      await ic(page, 'Background').selectOption('custom');
      await ic(page, 'Color').fill('#E8EEF5');
      assert.match(await ic(page, 'Estimate').textContent(), /160 × 100 px/);
      if (lang === 'zh') await shot(page, artifacts, 'desktop-settings');
      await ic(page, 'SettingsClose').click();
      await waitView(page, 'primary');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'icExit');
      await reveal(page);
      assert.equal(await ic(page, 'Convert').textContent(), convert);
      await waitConvert(page);
      await page.keyboard.press('Control+Enter');
      await waitProcess(page, 'success');
      assert.equal(await ic(page, 'Result').textContent(), result + ' · JPG · 160 × 100 px');
      assert.match(await ic(page, 'ResultSize').textContent(), / (?:B|KiB)$/);
      assert.match(await ic(page, 'Difference').textContent(), /%/);
      assert.equal(await ic(page, 'Download').textContent(), download);
      await preview(context, ic(page, 'ResultPreview'), 160, 100);
      await checkOutput(page, 'jpg', 160, 100, [[8, 8], [80, 50]], [[232, 238, 245, 255], [50, 110, 70, 255]], 10, 'fixture-converted.jpg');
      await ic(page, 'ResultPreview').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'icDownload');
      assert.equal(await ic(page, 'Download').evaluate(el => el.matches(':focus-visible')), true);
      await checkLayout(page);
      if (lang === 'zh') await shot(page, artifacts, 'desktop-result');
      await ic(page, 'File').dispatchEvent('cancel');
      assert.equal(await ic(page, 'Download').isVisible(), true);
      await page.keyboard.press('Escape');
      await waitView(page, 'primary');
      assert.equal(await ic(page, 'Source').textContent(), source + ' · PNG · 320 × 200 px');
      await reveal(page);
      await ic(page, 'Clear').click();
      await waitProcess(page, 'empty');
      assert.equal(await ic(page, 'Source').textContent(), source + ' · ' + sourceEmpty);
      assert.equal(await ic(page, 'Result').textContent(), result + ' · ' + resultEmpty);
      assert.equal(await ic(page, 'Quality').inputValue(), '85');
      assert.equal(await ic(page, 'MaxWidth').inputValue(), '');
      await clean();
    });
  }

  await run(slug + '-no-script', { javaScriptEnabled: false }, async (page, context) => {
    await remember(context, 'en');
    await open(page, base, 'en', 'firstLoad');
    assert.deepEqual((await page.evaluate(snapshotInPage)).texts.map(entry => entry.text), ['Source · No file', 'Result · Not converted']);
    await ic(page, 'Exit').click();
    assert.equal(await page.getByText('Enable JavaScript to convert images in your browser.', { exact: true }).isVisible(), true);
    assert.equal(await ic(page, 'Pick').isHidden(), true);
    await page.getByRole('link', { name: 'Hide controls' }).click();
    assert.equal(await ic(page, 'Help').isHidden(), true);
  });

  await run(slug + '-actual-codecs', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await open(page, base);
    await reveal(page);
    await ic(page, 'Sample').click();
    await waitProcess(page, 'ready');
    assert.equal(await ic(page, 'SourceName').textContent(), 'transparent-sample.png');
    assert.equal(await ic(page, 'Source').textContent(), 'Source · PNG · 320 × 200 px');
    await preview(context, ic(page, 'SourcePreview'), 320, 200);
    await runConversion(page);
    await checkOutput(page, 'jpg', 320, 200, [[12, 12]], [[255, 255, 255, 255]], 5, 'transparent-sample-converted.jpg');
    for (const quality of ['0', '100']) {
      await page.keyboard.press('F2');
      await ic(page, 'Quality').fill(quality);
      await page.keyboard.press('F2');
      await waitView(page, 'primary');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'icExit');
      await reveal(page);
      await runConversion(page);
    }

    await choose(page);
    await waitProcess(page, 'ready');
    for (const format of ['png', 'webp']) {
      await selectTarget(page, format);
      if (format === 'png') {
        await page.keyboard.press('F2');
        assert.equal(await ic(page, 'Quality').isHidden(), true);
        await page.keyboard.press('F2');
        await reveal(page);
      }
      await runConversion(page);
      await checkOutput(page, format, 320, 200, [[8, 8], [160, 100]], [[null, null, null, 0], [50, 110, 70, 255]], 8);
    }
    const avifOption = ic(page, 'Format').locator('option[value="avif"]');
    // isDisabled() follows the wrapping label to the select instead of checking the option.
    if (!(await avifOption.evaluate(option => option.matches(':disabled')))) {
      await selectTarget(page, 'avif');
      await runConversion(page);
      await checkOutput(page, 'avif', 320, 200, [[8, 8]], [[null, null, null, 0]], 0);
    } else {
      assert.match(await avifOption.textContent(), /Encoding unavailable|Transparency unavailable/);
    }
    await selectTarget(page, 'jpg');

    await choose(page, fixture(avif, 'source.avif', mime.avif));
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('#imageConvert').dataset.process));
    if (await page.locator('#imageConvert').getAttribute('data-process') === 'ready') {
      assert.equal(await ic(page, 'Source').textContent(), 'Source · AVIF · 6 × 4 px');
      await runConversion(page);
      await checkOutput(page, 'jpg', 6, 4, [], []);
    } else {
      assert.equal(await page.locator('#imageConvert').getAttribute('data-error-code'), 'decoderUnavailable');
      assert.equal(await page.evaluate(async bytes => {
        try {
          const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/avif' }));
          bitmap.close();
          return true;
        } catch { return false; }
      }, [...avif]), false);
    }

    assert.equal(oriented.includes(Buffer.from('Exif\0\0')), true);
    for (const htmlImageFallback of [false, true]) {
      if (htmlImageFallback) {
        await page.evaluate(() => {
          window.icBitmap = window.createImageBitmap;
          window.createImageBitmap = async () => { throw new Error('ImageBitmap unavailable'); };
        });
      }
      await choose(page, fixture(oriented, 'source.jpeg', mime.jpg));
      await waitProcess(page, 'ready');
      assert.equal(await ic(page, 'Source').textContent(), 'Source · JPG · 24 × 40 px');
      await runConversion(page);
      if (htmlImageFallback) await page.evaluate(() => { window.createImageBitmap = window.icBitmap; });
      const jpg = await checkOutput(page, 'jpg', 24, 40, [[12, 8], [12, 32]], [[224, 48, 48, 255], [20, 87, 219, 255]], 16);
      assert.equal(jpg.includes(Buffer.from('Exif\0\0')), false);
    }
    await clean();
  });

  await run(slug + '-inputs-mobile-dark', { viewport: { width: 360, height: 800 }, colorScheme: 'dark', isMobile: true, hasTouch: true }, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await open(page, base);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await checkLayout(page);
    await shot(page, artifacts, '360-dark-empty');
    await reveal(page);

    const oversizedHeader = Buffer.from(pixels);
    oversizedHeader.writeUInt32BE(8193, 16);
    for (const [file, code] of [
      [fixture(Buffer.from('pretend PNG')), 'unsupported'],
      [fixture(pixels.subarray(0, -1)), 'damaged'],
      [fixture(Buffer.alloc(0)), 'empty'],
      [fixture(makePng(2, 2, true)), 'animated'],
      [fixture(oversizedHeader), 'headerLimit'],
      [fixture(Buffer.alloc(16 * 1024 ** 2 + 1)), 'inputLimit'],
    ]) {
      await choose(page, file);
      await assertError(page, code);
      await checkLayout(page);
    }
    await shot(page, artifacts, '360-dark-error');
    await drop(page, [{ bytes: [...pixels], name: 'a.png' }, { bytes: [...pixels], name: 'b.png' }]);
    await assertError(page, 'manyFiles');
    const longName = 'portrait_' + '𠮷'.repeat(60) + '_long.png';
    await choose(page, fixture(pixels, longName));
    await waitProcess(page, 'ready');
    await selectTarget(page, 'jpg');
    await ic(page, 'SettingsToggle').click();
    await ic(page, 'Background').selectOption('custom');
    await ic(page, 'Color').fill('#fff');
    await assertError(page, 'invalidOptions');
    assert.equal(await ic(page, 'ColorError').isVisible(), true);
    assert.equal(await ic(page, 'Color').getAttribute('aria-invalid'), 'true');
    await checkLayout(page);
    await shot(page, artifacts, '360-dark-settings');
    await ic(page, 'Color').fill('#E8EEF5');
    await ic(page, 'SettingsClose').click();
    await reveal(page);
    await runConversion(page);
    assert.equal(await ic(page, 'SourceName').textContent(), longName);
    await checkLayout(page);
    await checkOutput(page, 'jpg', 320, 200, [[8, 8]], [[232, 238, 245, 255]], 6);
    await shot(page, artifacts, '360-dark-result');
    await clean();
  });

  await run(slug + '-races-and-permissions', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      window.icMode = 'real';
      window.icCalls = 0;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (this.width <= 2 || window.icMode === 'real') return original.apply(this, arguments);
        window.icCalls++;
        if (window.icMode === 'null') return queueMicrotask(() => callback(null));
        if (window.icMode === 'png') return original.call(this, callback, 'image/png');
        if (window.icMode === 'dimensions') {
          const other = document.createElement('canvas');
          other.width = other.height = 1;
          return original.call(other, callback, type, quality);
        }
        original.call(this, blob => { window.icRelease = () => { window.icRelease = null; callback(blob); }; }, type, quality);
      };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
      Element.prototype.requestFullscreen = async () => { throw new Error('denied'); };
    });
    await open(page, base);
    await reveal(page);
    await choose(page);
    await waitProcess(page, 'ready');
    for (const [mode, code] of [['null', 'errorEncode'], ['png', 'outputFormat'], ['png', 'outputFormat'], ['dimensions', 'outputDimensions']]) {
      await page.evaluate(mode => { window.icMode = mode; }, mode);
      await waitConvert(page);
      await ic(page, 'Convert').click();
      await assertError(page, code);
      assert.equal(await ic(page, 'SourcePreview').isVisible(), true);
    }
    await page.evaluate(() => { window.icMode = 'delay'; });
    const startDeferred = async () => {
      const baseline = await page.evaluate(() => window.icCalls);
      await waitConvert(page);
      await ic(page, 'Convert').click();
      await waitProcess(page, 'converting');
      assert.equal(await ic(page, 'Result').getAttribute('aria-busy'), 'true');
      assert.equal(await ic(page, 'Download').isHidden(), true);
      await page.keyboard.press('Control+Enter');
      await page.waitForFunction(() => typeof window.icRelease === 'function');
      assert.equal(await page.evaluate(() => window.icCalls), baseline + 1);
    };
    const release = () => page.evaluate(() => window.icRelease());
    await startDeferred();
    await page.keyboard.press('F2');
    await ic(page, 'MaxHeight').fill('70');
    await page.keyboard.press('F2');
    await reveal(page);
    await release();
    await waitConvert(page);
    assert.equal(await ic(page, 'Download').getAttribute('href'), null);

    await startDeferred();
    await choose(page, fixture(makePng(120, 99), 'old.png'));
    await choose(page, fixture(makePng(140, 90), 'latest.png'));
    await waitProcess(page, 'decoding');
    assert.equal(await ic(page, 'SourcePreview').getAttribute('href'), null);
    await release();
    await waitProcess(page, 'ready');
    assert.equal(await ic(page, 'SourceName').textContent(), 'latest.png');
    assert.equal(await ic(page, 'Download').getAttribute('href'), null);

    await startDeferred();
    await ic(page, 'Clear').click();
    await release();
    await page.waitForTimeout(150);
    assert.equal(await ic(page, 'Source').textContent(), 'Source · No file');
    assert.equal(await ic(page, 'Download').getAttribute('href'), null);
    assert.equal(await ic(page, 'ResultPreview').getAttribute('href'), null);
    await page.evaluate(() => { window.icMode = 'real'; });
    await choose(page, fixture(makePng(140, 90), 'latest.png'));
    await runConversion(page);
    await ic(page, 'Copy').click();
    await ic(page, 'Manual').waitFor({ state: 'visible' });
    assert.match(await ic(page, 'Manual').inputValue(), /Result · JPG · 140 × 90 px/);
    assert.deepEqual(await ic(page, 'Manual').evaluate(el => [el.selectionStart, el.selectionEnd]), [0, (await ic(page, 'Manual').inputValue()).length]);

    await ic(page, 'Download').evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once: true }));
    await ic(page, 'Download').click();
    await waitProcess(page, 'error');
    assert.equal(await page.locator('#imageConvert').getAttribute('data-error-code'), 'errorDownload');
    assert.equal(await ic(page, 'ResultPreview').isVisible(), true);
    await ic(page, 'Fullscreen').click();
    await waitView(page, 'fullscreen');
    assert.equal(await page.locator('#imageConvert').getAttribute('data-presentation-mode'), 'fallback');
    await page.keyboard.press('Escape');
    await waitView(page, 'primary');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'icExit');
    await clean();
  });

  await run(slug + '-canvas-unavailable', {}, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await open(page, base, 'en', 'degraded');
    const view = await page.evaluate(snapshotInPage);
    assert.equal(view.texts.length, 2);
    assert.deepEqual(view.interactives.map(control => control.selector), ['a#icExit']);
    assert.equal(await page.locator('#imageConvert').getAttribute('data-presentation-degraded'), 'true');
    assert.match(await ic(page, 'Live').textContent(), /Canvas 2D is unavailable/);
    await reveal(page);
    assert.match(await ic(page, 'Status').textContent(), /Canvas 2D is unavailable/);
    assert.equal(await ic(page, 'Convert').isDisabled(), true);
    await clean();
  });

  await run(slug + '-offline-midnight', { timezoneId: 'Asia/Tokyo' }, async (page, context) => {
    await remember(context, 'en');
    const clean = await monitor(page);
    await page.clock.setFixedTime(new Date('2026-11-27T14:59:59Z'));
    await open(page, base);
    await page.waitForFunction(() => !document.querySelector('#icFormat').disabled);
    const requests = [];
    context.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
    await context.setOffline(true);
    await drop(page, [{ bytes: [...pixels], name: 'offline.png' }]);
    await waitProcess(page, 'ready');
    assert.equal(await ic(page, 'Source').textContent(), 'Source · PNG · 320 × 200 px');
    await page.mouse.move(15, 15);
    await waitView(page, 'reveal');
    await preview(context, ic(page, 'SourcePreview'), 320, 200);
    await runConversion(page);
    const before = await readDownload(page, 'jpg', 'offline-converted.jpg');
    const slots = [await ic(page, 'Source').textContent(), await ic(page, 'Result').textContent(), await ic(page, 'Difference').textContent()];
    await page.clock.setFixedTime(new Date('2026-11-27T15:00:01Z'));
    assert.deepEqual([await ic(page, 'Source').textContent(), await ic(page, 'Result').textContent(), await ic(page, 'Difference').textContent()], slots);
    await runConversion(page);
    assert.deepEqual(await readDownload(page, 'jpg'), before);
    await preview(context, ic(page, 'ResultPreview'), 320, 200);
    assert.deepEqual(requests, []);
    await clean();
  });
}
