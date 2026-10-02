import test from 'node:test';
import assert from 'node:assert/strict';
import { DownloadTask, requestBytes } from '../../src/lib/hls/downloader.ts';
import { parsePlaylist, HlsError } from '../../src/lib/hls/playlist.ts';
import { StreamingTask } from '../../src/lib/hls/stream.ts';
import { DiskSink } from '../../src/lib/hls/file.ts';
import { FragmentTimeline, boxes, codecSignature } from '../../src/lib/hls/timeline.ts';
import { HLS_CONFIG } from '../../config/hls.mjs';

const settings = { concurrency: 3, retries: 0, timeout: 2000, credentials: 'omit' };
const playlist = (count) => parsePlaylist('#EXTM3U\n' + Array.from({ length: count }, (_, i) => `#EXTINF:2,\n${i}.aac`).join('\n') + '\n#EXT-X-ENDLIST', 'https://media.example/test.m3u8');
const frame = (tag = 1) => new Uint8Array([255, 241, 76, 128, 1, 63, 252, 0, tag]);
const info = { format: 'aac', signature: 'AAC/48000/2', streams: [{ codec_type: 'audio', codec_name: 'aac', index: 0, time_base: '1/48000', firstDts: 0 }] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function store() {
  const chunks = new Map(), states = new Map();
  return { chunks, states, get: async (id) => chunks.get(id), put: async (id, bytes) => chunks.set(id, new Blob([bytes])), remove: async (id) => chunks.delete(id),
    getState: async (id) => states.get(id), putState: async (id, state) => states.set(id, structuredClone(state)) };
}
function engine(overrides = {}) {
  return { inspect: async () => info, fragment: async (bytes) => ({ bytes, info, format: 'aac', heapBytes: 0 }), stop() {}, ...overrides };
}
function writer(overrides = {}) {
  const pieces = []; let closed = false, aborted = false;
  return { pieces, get closed() { return closed; }, get aborted() { return aborted; },
    write: async (data) => pieces.push(data.slice()), close: async () => { closed = true; }, abort: async () => { aborted = true; }, ...overrides };
}

test('ordered consumption applies backpressure and skips gaps despite out-of-order completion', async () => {
  const calls = [], consumed = [], p = playlist(8); let release;
  const blocked = new Promise((resolve) => release = resolve);
  const task = new DownloadTask(p, 'ordered', store(), { ...settings, fetcher: async (url) => {
    const i = Number(url.split('/').at(-1).split('.')[0]); calls.push(i);
    if (!i) await sleep(10);
    return i === 1 || i === 2 ? new Response('', { status: 404 }) : new Response(frame(i));
  } }, () => {});
  const running = task.run({ window: 3, consume: async (segment) => { consumed.push(segment.index); if (!segment.index) await blocked; } });
  await sleep(35); assert.deepEqual([...calls].sort(), [0, 1, 2]);
  assert.deepEqual(consumed, [0]); release(); await running;
  assert.deepEqual(consumed, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(task.results.map((r) => r.state), ['done', 'skipped', 'skipped', 'done', 'done', 'done', 'done', 'done']);
});

test('streaming preflight skips an invalid first segment and waits for each native write', async () => {
  const cache = store(), p = playlist(4); let active = 0, peak = 0;
  const task = new DownloadTask(p, 'stream', cache, { ...settings, fetcher: async (url) => new Response(frame(Number(url.split('/').at(-1).split('.')[0]))) }, () => {});
  const core = engine({ inspect: async (bytes) => { if (!new Uint8Array(bytes).at(-1)) throw new HlsError('invalidMedia'); return info; } });
  const stream = new StreamingTask(task, 'original', () => core, () => {});
  await stream.prepare(); assert.equal(task.results[0].state, 'skipped'); assert.equal(stream.output, 'aac');
  const file = writer({ write: async (data) => { active++; peak = Math.max(peak, active); await sleep(2); file.pieces.push(data.slice()); active--; } });
  stream.attach(new DiskSink(file)); await stream.run();
  assert.equal(peak, 1); assert.equal(stream.segments, 3); assert.equal(file.closed, true);
  assert.deepEqual(file.pieces.map((piece) => piece.at(-1)), [1, 2, 3]);
});

test('paused writes commit complete segments and recovery reuses cache and skipped states', async () => {
  const cache = store(), calls = [], p = playlist(6);
  const fetcher = async (url) => { const i = Number(url.split('/').at(-1).split('.')[0]); calls.push(i); return i === 0 ? new Response('', { status: 410 }) : new Response(frame(i)); };
  const task = new DownloadTask(p, 'resume', cache, { ...settings, fetcher }, () => {});
  let stream; stream = new StreamingTask(task, 'original', () => engine(), (progress) => { if (progress.segments === 2) stream.pause(); });
  await stream.prepare(); const partial = writer(); stream.attach(new DiskSink(partial)); await stream.run();
  assert.equal(stream.segments, 2); assert.equal(partial.closed, false); await stream.finish(); assert.equal(partial.closed, true);
  const before = [...calls]; const restored = new DownloadTask(p, 'resume', cache, { ...settings, fetcher }, () => {});
  assert.ok(await restored.restore() >= 2); assert.equal(restored.results[0].state, 'skipped');
  const rebuilt = new StreamingTask(restored, 'original', () => engine(), () => {}); await rebuilt.prepare();
  const file = writer(); rebuilt.attach(new DiskSink(file)); await rebuilt.run();
  for (const i of before) assert.equal(calls.filter((n) => n === i).length, before.filter((n) => n === i).length);
  assert.deepEqual(file.pieces.map((piece) => piece.at(-1)), [1, 2, 3, 4, 5]);
});

test('disk failure aborts output and retains completed chunks for a new writer', async () => {
  const cache = store(), task = new DownloadTask(playlist(3), 'disk', cache, { ...settings, fetcher: async () => new Response(frame()) }, () => {});
  const stream = new StreamingTask(task, 'original', () => engine(), () => {}); await stream.prepare();
  const file = writer({ write: async () => { throw new DOMException('Disk full', 'QuotaExceededError'); } });
  stream.attach(new DiskSink(file)); await assert.rejects(stream.run(), { code: 'fileWriteError' });
  assert.equal(file.aborted, true); assert.ok(await cache.get('disk:segment:0')); assert.equal(task.results[0].state, 'done');
});

test('unknown-length responses and oversized cached media stop with a recoverable size error', async () => {
  await assert.rejects(requestBytes('https://media.example/large', undefined, new AbortController().signal,
    { ...settings, maxBytes: 4, fetcher: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3)); controller.enqueue(new Uint8Array(3)); controller.close(); } })) }), { code: 'segmentTooLarge' });
  const task = new DownloadTask(playlist(1), 'too-big', store(), { ...settings, maxBytes: 4, fetcher: async () => new Response(frame()) }, () => {});
  await task.run(); assert.equal(task.fatal.code, 'segmentTooLarge'); assert.equal(task.results[0].state, 'pending');
});

const box = (type, body) => { const bytes = new Uint8Array(body.length + 8); new DataView(bytes.buffer).setUint32(0, bytes.length); bytes.set(Buffer.from(type), 4); bytes.set(body, 8); return bytes; };
const concat = (...pieces) => new Uint8Array(Buffer.concat(pieces));
function mp4() {
  const mvhd = new Uint8Array(100); new DataView(mvhd.buffer).setUint32(12, 1000);
  const tkhd = new Uint8Array(84); new DataView(tkhd.buffer).setUint32(12, 1);
  const mdhd = new Uint8Array(24); new DataView(mdhd.buffer).setUint32(12, 90000);
  const moov = box('moov', concat(box('mvhd', mvhd), box('trak', concat(box('tkhd', tkhd), box('edts', box('elst', new Uint8Array(8))), box('mdia', box('mdhd', mdhd))))));
  const mfhd = new Uint8Array(8), tfhd = new Uint8Array(12), tfdt = new Uint8Array(12), trun = new Uint8Array(12);
  new DataView(tfhd.buffer).setUint32(0, 0x020008); new DataView(tfhd.buffer).setUint32(4, 1); new DataView(tfhd.buffer).setUint32(8, 180000);
  tfdt[0] = 1; new DataView(trun.buffer).setUint32(4, 1);
  return concat(box('ftyp', new Uint8Array(8)), moov, box('moof', concat(box('mfhd', mfhd), box('traf', concat(box('tfhd', tfhd), box('tfdt', tfdt), box('trun', trun))))), box('mdat', new Uint8Array([1, 2, 3])));
}
function find(data, path) { let start = 0, end = data.length, found; for (const type of path) { found = boxes(data, start, end).find((b) => b.type === type); assert.ok(found); start = found.start + found.header; end = found.start + found.size; } return found; }
test('MP4 fragments have one initialization, monotonic sequence/tfdt and correct final duration', () => {
  const timeline = new FragmentTimeline(), p = playlist(3), makeInfo = (dts) => ({ format: 'ts', signature: 'video', streams: [{ codec_type: 'video', codec_name: 'h264', index: 0, time_base: '1/90000', firstDts: dts }] });
  const first = timeline.append(mp4(), makeInfo(126000), p.segments[0], 'mp4');
  const last = timeline.append(mp4(), makeInfo(486000), p.segments[2], 'mp4');
  assert.equal(first.length, 3); assert.equal(last.length, 2);
  const tfdt = find(last[0], ['moof', 'traf', 'tfdt']); assert.equal(new DataView(last[0].buffer).getBigUint64(tfdt.start + 12), 180000n);
  const mfhd = find(last[0], ['moof', 'mfhd']); assert.equal(new DataView(last[0].buffer).getUint32(mfhd.start + 12), 2);
  assert.ok(!Buffer.from(first[0]).includes(Buffer.from('edts')));
  const final = timeline.finish(), mvhd = find(final, ['moov', 'mvhd']); assert.equal(new DataView(final.buffer).getUint32(mvhd.start + 24), 4000);
  assert.throws(() => timeline.append(mp4(), { ...makeInfo(666000), signature: 'different-codec' }, p.segments[2], 'mp4'), { code: 'streamChanged' });
});

test('invalid MP4 rolls back initialization and sequence before the next good segment', () => {
  const timeline = new FragmentTimeline(), p = playlist(2), data = mp4();
  const bad = data.slice(0, data.length - 11);
  const metadata = { ...info, format: 'mp4', streams: [{ ...info.streams[0], time_base: '1/90000' }] };
  assert.throws(() => timeline.append(bad, metadata, p.segments[0], 'mp4'), { code: 'invalidMedia' });
  assert.equal(timeline.append(data, metadata, p.segments[1], 'mp4').length, 3);
});

test('codec comparison ignores legal trailing padding and still detects changed parameter sets', () => {
  const stream = { codec_type: 'video', codec_name: 'h264', extradata: '\n00000000: 0000 0167 4200 0100 0000 0168 ce0f c8    example\n' };
  const padded = { ...stream, extradata: '\n00000000: 0000 0167 4200 0100 0000 0168 ce0f c800  example\n' };
  assert.equal(codecSignature([stream]), codecSignature([padded]));
  assert.notEqual(codecSignature([stream]), codecSignature([{ ...stream, extradata: stream.extradata.replace('4200', '4300') }]));
});

test('TS PTS/DTS/PCR and continuity counters shift across gaps and 33-bit wrap', () => {
  const timestamp = (value, prefix) => new Uint8Array([(prefix << 4) | (Math.floor(value / 2 ** 30) << 1) | 1, Math.floor(value / 2 ** 22) & 255, ((Math.floor(value / 2 ** 15) & 127) << 1) | 1, Math.floor(value / 128) & 255, ((value & 127) << 1) | 1]);
  const packet = (dts) => {
    const data = new Uint8Array(188).fill(255); data.set([0x47, 0x41, 0, 0x30, 7, 0x10], 0);
    const pcr = dts - 10000; data[6] = Math.floor(pcr / 2 ** 25); data[7] = Math.floor(pcr / 2 ** 17) & 255;
    data[8] = Math.floor(pcr / 512) & 255; data[9] = Math.floor(pcr / 2) & 255; data[10] = ((pcr & 1) << 7) | 0x7e; data[11] = 0;
    data.set([0, 0, 1, 0xe0, 0, 0, 0x80, 0xc0, 10], 12); data.set(timestamp(dts + 900, 3), 21); data.set(timestamp(dts, 1), 26); return data;
  };
  const read = (data, p) => ((data[p] >> 1) & 7) * 2 ** 30 + data[p + 1] * 2 ** 22 + (data[p + 2] >> 1) * 2 ** 15 + data[p + 3] * 128 + (data[p + 4] >> 1);
  const timeline = new FragmentTimeline(), p = playlist(3), meta = (dts) => ({ format: 'ts', signature: 'ts', streams: [{ codec_type: 'video', codec_name: 'h264', index: 0, time_base: '1/90000', firstDts: dts }] });
  const first = timeline.append(packet(900000), meta(900000), p.segments[0], 'ts')[0];
  const last = timeline.append(packet(1260000), meta(1260000), p.segments[2], 'ts')[0];
  assert.equal(read(first, 26), 0); assert.equal(read(first, 21), 900); assert.equal(read(last, 26), 180000);
  assert.equal(first[3] & 15, 0); assert.equal(last[3] & 15, 1);
  const pcr = first[6] * 2 ** 25 + first[7] * 2 ** 17 + first[8] * 512 + first[9] * 2 + (first[10] >> 7);
  assert.equal(pcr, 2 ** 33 - 10000); assert.deepEqual(first.slice(31), packet(900000).slice(31));
});

test('B-frame composition offsets contribute to final MP4 duration', () => {
  const data = mp4(), run = find(data, ['moof', 'traf', 'trun']), view = new DataView(data.buffer);
  view.setUint32(run.start + 8, 0x800); view.setUint32(run.start + 16, 9000);
  const timeline = new FragmentTimeline(); timeline.append(data, { format: 'ts', signature: 'bframes', streams: [{ codec_type: 'video', codec_name: 'h264', index: 0, time_base: '1/90000', firstDts: 0 }] }, playlist(1).segments[0], 'mp4');
  const header = timeline.finish(), mvhd = find(header, ['moov', 'mvhd']); assert.equal(new DataView(header.buffer).getUint32(mvhd.start + 24), 2100);
});

test('streaming recycles worker heaps while preserving the ordered output', async () => {
  let created = 0, stopped = 0;
  const task = new DownloadTask(playlist(5), 'recycle', store(), { ...settings, fetcher: async () => new Response(frame()) }, () => {});
  const stream = new StreamingTask(task, 'original', () => { created++; return engine({ fragment: async (bytes) => ({ bytes, info, format: 'aac', heapBytes: HLS_CONFIG.stream.heapBytes + 1 }), stop: () => stopped++ }); }, () => {});
  await stream.prepare(); const file = writer(); stream.attach(new DiskSink(file)); await stream.run();
  assert.equal(created, 5); assert.equal(stopped, 5); assert.equal(file.pieces.length, 5);
});

test('a missing AES key pauses rather than classifying protected media as missing', async () => {
  const p = parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="missing-key"\n#EXTINF:2,\n0.ts\n#EXTINF:2,\n1.ts', 'https://media.example/index.m3u8');
  const task = new DownloadTask(p, 'key', store(), { ...settings, concurrency: 1, fetcher: async (url) => url.endsWith('missing-key') ? new Response('', { status: 404 }) : new Response(frame()) }, () => {});
  await task.run(); assert.equal(task.fatal.code, 'keyRequestError'); assert.ok(task.results.every((result) => result.state === 'pending'));
});

test('temporary key failures retry without repeatedly downloading the encrypted media', async () => {
  const p = parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x1\n#EXTINF:2,\n0.aac', 'https://media.example/index.m3u8');
  const raw = new Uint8Array(16).fill(9), key = await crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: p.segments[0].key.iv }, key, frame());
  let keys = 0, media = 0;
  const task = new DownloadTask(p, 'key-retry', store(), { ...settings, retries: 1, retryDelay: 1, fetcher: async (url) => {
    if (url.endsWith('/key')) return ++keys === 1 ? new Response('', { status: 503 }) : new Response(raw);
    media++; return new Response(encrypted);
  } }, () => {});
  await task.run(); assert.equal(task.results[0].state, 'done'); assert.equal(keys, 2); assert.equal(media, 1);
});

test('unavailable initialization pauses without skipping media and can resume when restored', async () => {
  const p = parsePlaylist('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2,\n0.m4s\n#EXTINF:2,\n1.m4s', 'https://media.example/index.m3u8');
  let available = false, init = 0, media = 0;
  const task = new DownloadTask(p, 'init', store(), { ...settings, concurrency: 1, retries: 1, retryDelay: 1, fetcher: async (url) => {
    if (url.endsWith('init.mp4')) {
      init++; return available ? new Response(new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112])) : new Response('', { status: init === 1 ? 503 : 404 });
    }
    media++; return new Response(new Uint8Array([0, 0, 0, 8, 109, 111, 111, 102]));
  } }, () => {});
  await task.run(); assert.equal(task.fatal.code, 'initError'); assert.ok(task.results.every((result) => result.state === 'pending'));
  assert.equal(init, 2); assert.equal(media, 0);
  available = true; await task.run(); assert.equal(task.fatal, undefined);
  assert.ok(task.results.every((result) => result.state === 'done')); assert.equal(init, 3); assert.equal(media, 2);
});
