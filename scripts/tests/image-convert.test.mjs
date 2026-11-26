import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATS, DEFAULT_OPTIONS, inspectImage, verifyOutput, validateOptions, withinImageLimits,
  inputSizeError, INPUT_LIMIT, OUTPUT_LIMIT, downloadName, formatBytes, compareBytes,
} from '../../src/lib/image-convert.ts';

const be = (value) => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
const le = (value) => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
const str = (value) => Buffer.from(value);
const join = (...parts) => Buffer.concat(parts);
const pngChunk = (name, bytes = Buffer.alloc(0)) => join(be(bytes.length), str(name), bytes, be(0));
const png = (width = 320, height = 200, chunks = []) => join(
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', join(be(width), be(height), Buffer.from([8, 6, 0, 0, 0]))),
  ...chunks, pngChunk('IDAT', Buffer.from([1])), pngChunk('IEND'),
);
const jpg = (app = Buffer.alloc(0)) => join(
  Buffer.from([255, 216]), app,
  Buffer.from([255, 192, 0, 11, 8, 0, 200, 1, 64, 1, 1, 17, 0]),
  Buffer.from([255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 0, 255, 217]),
);
const riffChunk = (name, data) => join(str(name), le(data.length), data, Buffer.alloc(data.length % 2));
const lossless = riffChunk('VP8L', join(Buffer.from([0x2f]), le(319 + (199 << 14))));
const lossy = riffChunk('VP8 ', Buffer.from([0, 0, 0, 0x9d, 1, 0x2a, 64, 1, 200, 0]));
const extended = (flags = 0) => riffChunk('VP8X', Buffer.from([flags, 0, 0, 0, 63, 1, 0, 199, 0, 0]));
const webp = (...chunks) => {
  const payload = join(str('WEBP'), ...chunks);
  return join(str('RIFF'), le(payload.length), payload);
};
const box = (name, ...parts) => {
  const data = join(...parts);
  return join(be(data.length + 8), str(name), data);
};
const ispe = (w, h) => box('ispe', be(0), be(w), be(h));
const avif = (main = 'mif1', compatible = 'avif', properties = [ispe(320, 200)], extra = []) => join(
  box('ftyp', str(main), be(0), str(compatible)),
  box('meta', be(0), box('iprp', box('ipco', ...properties))),
  ...extra,
);
const error = (bytes, code) => assert.deepEqual(inspectImage(bytes), { ok: false, code });
const opts = (raw, width = 320, height = 200) =>
  validateOptions({ format: 'jpg', ...DEFAULT_OPTIONS, ...raw }, { width, height });
const good = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };

test('识别四种静态格式并拒绝冒名文件', () => {
  for (const [format, bytes, mime, extension] of [
    ['jpg', jpg(Buffer.from([255, 225, 0, 6, 255, 192, 255, 218])), 'image/jpeg', '.jpg'],
    ['png', png(), 'image/png', '.png'],
    ['webp', webp(lossless), 'image/webp', '.webp'],
    ['webp', webp(extended(), lossy), 'image/webp', '.webp'],
    ['avif', avif(), 'image/avif', '.avif'],
    ['avif', avif('avif', 'mif1'), 'image/avif', '.avif'],
  ]) {
    assert.deepEqual(good(inspectImage(bytes)), { format, width: 320, height: 200 });
    assert.equal(FORMATS[format].mime, mime);
    assert.equal(FORMATS[format].extension, extension);
  }
  error(str('https://example.invalid/fake.png'), 'unsupported');
  error(avif('heic', 'mif1'), 'unsupported');
});

test('拒绝动画、截断和危险块长度', () => {
  for (const type of ['acTL', 'fcTL', 'fdAT']) error(png(320, 200, [pngChunk(type)]), 'animated');
  error(webp(extended(2), lossy), 'animated');
  for (const type of ['ANIM', 'ANMF']) error(webp(riffChunk(type, Buffer.alloc(0)), lossless), 'animated');
  error(avif('avis'), 'animated');
  error(avif('avif', 'avis'), 'animated');
  error(avif('avif', 'mif1', [ispe(320, 200)], [box('moov')]), 'animated');
  error(str('GIF89a'), 'animated');
  for (const bytes of [jpg(), png(), webp(lossless), avif()]) error(bytes.subarray(0, -1), 'damaged');
  const oversized = png();
  oversized.writeUInt32BE(0xffffffff, 33);
  error(oversized, 'damaged');
  error(avif('avif', 'mif1', []), 'damaged');
  error(avif('avif', 'mif1', [ispe(1, 1), ispe(8193, 1)]), 'headerLimit');
  const badPadding = webp(lossless);
  badPadding[badPadding.length - 1] = 1;
  error(badPadding, 'damaged');
  const filler = pngChunk('tEXt');
  assert.equal(inspectImage(png(1, 1, Array(4093).fill(filler))).ok, true);
  error(png(1, 1, Array(4094).fill(filler)), 'complex');
  const app = Buffer.from([255, 225, 0, 2]);
  error(jpg(join(...Array(4096).fill(app))), 'complex');
  error(Buffer.alloc(0), 'empty');
});

test('质量接受两端并拒绝非法参数', () => {
  for (const [raw, value] of [[0, 0], ['85', 0.85], [100, 1]]) assert.equal(good(opts({ quality: raw })).quality, value);
  for (const quality of [-1, 101, 0.2, Infinity, NaN, '', '1e2']) {
    assert.deepEqual(opts({ quality }), { ok: false, fields: ['quality'] });
  }
  assert.equal('quality' in good(opts({ format: 'png', quality: NaN })), false);
});

test('按两边约束选较小比例', () => {
  assert.deepEqual(good(opts({ format: 'png', maxWidth: '1600', maxHeight: '1000' }, 4000, 3000)),
    { format: 'png', width: 1333, height: 1000 });
  assert.deepEqual(good(opts({ format: 'png', maxWidth: ' 160 ' })), { format: 'png', width: 160, height: 100 });
  for (const raw of [{}, { maxWidth: '4000', maxHeight: '3000' }]) {
    assert.deepEqual(good(opts({ format: 'png', ...raw })), { format: 'png', width: 320, height: 200 });
  }
});

test('尺寸和像素上限包含边界', () => {
  for (const [width, height, valid] of [[4000, 4000, true], [4000, 4001, false], [8192, 1, true], [8193, 1, false], [1, 1, true]]) {
    assert.equal(withinImageLimits({ width, height }), valid);
    assert.equal(inspectImage(png(width, height)).ok, valid);
  }
  assert.equal(good(opts({ maxHeight: '1' }, 1, 8192)).width, 1);
  for (const maxWidth of ['0', '-1', '1.1', '1e3', 'Infinity', '１', '00001', '8193']) {
    assert.deepEqual(opts({ maxWidth }), { ok: false, fields: ['maxWidth'] });
  }
  assert.equal(inputSizeError(INPUT_LIMIT), null);
  assert.equal(inputSizeError(INPUT_LIMIT + 1), 'inputLimit');
});

test('按字节与 MIME 共同确认输出', () => {
  assert.equal(good(verifyOutput('jpg', 'image/jpeg', jpg())).format, 'jpg');
  for (const [format, mime, bytes] of [
    ['jpg', 'image/png', png()], ['webp', 'image/webp', png()], ['png', 'image/png', Buffer.alloc(0)],
  ]) assert.deepEqual(verifyOutput(format, mime, bytes), { ok: false, code: 'outputFormat' });
  assert.equal(verifyOutput('png', 'image/png', new Uint8Array(OUTPUT_LIMIT + 1)).code, 'outputLimit');
});

test('清理文件名并使用目标后缀', () => {
  assert.equal(downloadName('照片.JPEG', 'webp'), '照片-converted.webp');
  assert.equal(downloadName('dir\\inner/  a\u0000\u0080\u202e?b.png. ', 'avif'), 'a_b-converted.avif');
  for (const input of ['CON.jpg', 'LPT².extra.PNG', '\u2066.jpeg', '...']) assert.equal(downloadName(input, 'jpg'), 'image-converted.jpg');
  assert.equal(downloadName('a' + '𠮷'.repeat(40) + '.png', 'png'), 'a' + '𠮷'.repeat(29) + '-converted.png');
});

test('格式化实际体积和变化方向', () => {
  assert.equal(formatBytes(1023, 'en'), '1,023 B');
  assert.equal(formatBytes(1024, 'en'), '1 KiB');
  assert.equal(formatBytes(1536, 'en'), '1.5 KiB');
  assert.deepEqual(good(compareBytes(2048, 1024, 'en')),
    { difference: -1024, direction: 'smaller', bytes: '−1 KiB', exactBytes: '−1,024 B', percent: '−50%' });
  assert.equal(good(compareBytes(1024, 2048, 'en')).percent, '+100%');
  assert.equal(good(compareBytes(1024, 2048, 'en')).direction, 'larger');
  assert.equal(good(compareBytes(1024, 1024, 'en')).direction, 'same');
  assert.deepEqual(compareBytes(0, 100, 'en'), { ok: false, code: 'invalidSize' });
});

test('背景只接受不透明六位 HEX', () => {
  assert.equal(good(opts({ background: 'custom', color: '#e8eef5' })).background, '#E8EEF5');
  assert.equal(good(opts({ color: 'transparent' })).background, '#FFFFFF');
  assert.equal('background' in good(opts({ format: 'avif', background: 'custom', color: 'transparent' })), false);
  for (const color of ['transparent', '#fff', '#123456ff', '#gg1122']) {
    assert.deepEqual(opts({ background: 'custom', color }), { ok: false, fields: ['color'] });
  }
});
