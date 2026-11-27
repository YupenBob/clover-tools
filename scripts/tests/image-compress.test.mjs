import assert from 'node:assert/strict';
import test from 'node:test';
import { OUTPUT_LIMIT } from '../../src/lib/image-convert.ts';
import {
  compressedName, DEFAULT_SETTINGS, detailedBytes, encodingTiers, retainCandidate,
  sizeChange, targetOutcome, validateSettings,
} from '../../src/lib/image-compress.ts';

const source = { width: 4000, height: 3000 };
const check = (options = {}, format = 'jpg', input = source) => validateSettings({ ...DEFAULT_SETTINGS, ...options }, input, format);
function settings(options, format, input) {
  const result = check(options, format, input);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
function rejects(options, field, format) {
  assert.deepEqual(check(options, format), { ok: false, fields: [field] });
}

test('按较紧边缩小且不放大', () => {
  assert.deepEqual(settings({ maxWidth: ' 1600 ', maxHeight: '01000' }).first, { width: 1333, height: 1000 });
  assert.deepEqual(settings({ maxWidth: '8192', maxHeight: '8192' }).first, source);
  assert.deepEqual(settings({ maxWidth: '1' }, 'png', { width: 8192, height: 3 }).first, { width: 1, height: 1 });
  assert.deepEqual(settings({ maxHeight: ' ' }).first, source);
  for (const maxWidth of ['0', '-1', '1.5', '1e2', '8,000', '８０００', '8193', 'Infinity', ' '.repeat(33)]) {
    rejects({ maxWidth }, 'maxWidth');
  }
});

test('质量包括两个端点', () => {
  for (const [quality, normalized] of [['0', 0], ['85', 0.85], ['100', 1]]) {
    assert.equal(encodingTiers(settings({ quality }), 'jpg')[0].quality, normalized);
  }
  for (const quality of ['', '0.85', '1e2', '101', '-1', 'NaN', '0'.repeat(33)]) rejects({ quality }, 'quality');
  assert.deepEqual(encodingTiers(settings({ quality: 'ignored' }, 'png'), 'png'), [{ ...source, format: 'png' }]);
});

test('目标单位与数值边界', () => {
  const target = options => settings({ mode: 'target', ...options }).targetBytes;
  assert.equal(target({ target: ' 1 ', unit: 'KiB' }), 1024);
  assert.equal(target({ target: '1', unit: 'B' }), 1);
  assert.equal(target({ target: '65536' }), OUTPUT_LIMIT);
  assert.equal(target({ target: '67108864', unit: 'B' }), OUTPUT_LIMIT);
  assert.equal(settings({ target: 'ignored' }).targetBytes, undefined);
  for (const value of ['', '0', '65537', '65,536', '1e2', '-1', '+1', '1.5', '9'.repeat(33)]) {
    rejects({ mode: 'target', target: value }, 'target');
  }
  rejects({ mode: 'target', unit: 'B', target: '67108865' }, 'target');
});

test('尺寸和质量候选有序且去重', () => {
  const target = { mode: 'target', target: '1' };
  const tiers = encodingTiers(settings(target), 'jpg');
  assert.equal(tiers.length, 24);
  assert.deepEqual(tiers.slice(0, 6).map(tier => Math.round(tier.quality * 100)), [85, 68, 51, 34, 17, 0]);
  assert.deepEqual(tiers.filter((_, index) => index % 6 === 0).map(tier => [tier.width, tier.height]), [
    [4000, 3000], [3000, 2250], [2000, 1500], [1000, 750],
  ]);
  assert.deepEqual(encodingTiers(settings({ ...target, quality: '1' }, 'webp', { width: 2, height: 1 }), 'webp')
    .map(tier => [tier.width, tier.height, tier.quality]), [[2, 1, 0.01], [2, 1, 0], [1, 1, 0.01], [1, 1, 0]]);
  const png = encodingTiers(settings(target, 'png'), 'png');
  assert.equal(png.length, 4);
  assert.ok(png.every(tier => !('quality' in tier)));
  assert.ok(encodingTiers(settings({ ...target, allowResize: false, maxWidth: '1200' }), 'jpg')
    .every(tier => tier.width === 1200 && tier.height === 900));
});

function trySizes(measured, limit) {
  const tiers = encodingTiers(settings({ mode: 'target', target: String(limit), unit: 'B' }), 'jpg');
  let best = null;
  for (const [index, bytes] of measured.entries()) {
    const selection = retainCandidate(best, { tier: tiers[index], bytes }, limit);
    best = selection.best;
    if (selection.stop) break;
  }
  return best;
}

test('达标优先更大尺寸和更高质量', () => {
  const best = trySizes([140, 155, 100, 70, 1, 1, 1], 100);
  assert.equal(best.bytes, 100);
  assert.equal(best.tier.quality, 0.51);
  assert.equal(best.tier.width, 4000);
  assert.deepEqual(targetOutcome(100, 100, 100), { state: 'met', targetBytes: 100, excess: 0, originalFits: true });
});

test('未达标返回最小有效候选', () => {
  const best = trySizes([OUTPUT_LIMIT + 1, 9, 9, 20, 19, 11, 9, 9], 1);
  assert.equal(best.bytes, 9);
  assert.equal(best.tier.width, 4000);
  assert.equal(best.tier.quality, 0.68);
  assert.deepEqual(targetOutcome(1, best.bytes, 1), { state: 'missed', targetBytes: 1, excess: 8, originalFits: true });
  assert.deepEqual(targetOutcome(1, best.bytes), { state: 'off' });
  assert.equal(trySizes([OUTPUT_LIMIT + 1, 0, NaN], 1), null);
});

test('体积变化与格式化', () => {
  assert.deepEqual(sizeChange(2048, 1024, 'en'), { direction: 'smaller', saved: 1024, rate: 0.5, percent: '50%', bytes: '1,024 B' });
  assert.equal(sizeChange(1, 2, 'en').direction, 'larger');
  assert.equal(sizeChange(20, 20, 'en').direction, 'same');
  assert.equal(sizeChange(0, 10, 'en'), null);
  assert.equal(detailedBytes(1024, 'en'), '1 KiB (1,024 B)');
  assert.equal(detailedBytes(17, 'en'), '17 B');
  const tiny = sizeChange(100_000, 100_001, 'en');
  assert.equal(tiny.direction, 'larger');
  assert.equal(tiny.percent, '0%');
  assert.equal(tiny.bytes, '1 B');
});

test('下载名与真实格式一致', () => {
  assert.equal(compressedName('something/dir\\clip\u0001\u202e.PNG', 'jpg'), 'clip-compressed.jpg');
  assert.equal(compressedName('NUL.png', 'png'), 'image-compressed.png');
  assert.equal(compressedName('..', 'webp'), 'image-compressed.webp');
  assert.equal(compressedName('图'.repeat(90) + '.jpeg', 'webp'), '图'.repeat(40) + '-compressed.webp');
});
