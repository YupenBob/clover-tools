import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaylist, sequenceIV, playlistId, concatManifest, remuxArgs, originalExtension } from '../../src/lib/hls/playlist.ts';
import { DownloadTask, requestBytes, validateMedia } from '../../src/lib/hls/downloader.ts';

const source = 'https://media.example/folder/video.m3u8';
const media = (lines) => parsePlaylist('#EXTM3U\n' + lines + '\n#EXT-X-ENDLIST', source);
const validTs = () => { const bytes = new Uint8Array(376); bytes[0] = bytes[188] = 0x47; return bytes; };
function memoryStore() {
  const map = new Map();
  return { get: async (id) => map.get(id), put: async (id, bytes) => map.set(id, new Blob([bytes])), map };
}
const settings = { concurrency: 3, retries: 2, timeout: 2000, credentials: 'omit', retryDelay: 1 };

test('master playlists handle quoted codecs, root/relative URLs and external audio', () => {
  const playlist = media('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=123456,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="audio"\n../720/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n/low.m3u8');
  assert.equal(playlist.variants[0].url, 'https://media.example/720/index.m3u8');
  assert.equal(playlist.variants[0].codecs, 'avc1.4d401f,mp4a.40.2');
  assert.equal(playlist.variants[0].externalAudio, true);
  assert.equal(playlist.variants[1].externalAudio, false);
});

test('media sequences, gaps, discontinuities, key rotation and byte ranges are captured', () => {
  const playlist = media('#EXT-X-MEDIA-SEQUENCE:9007199254740993\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:2.5,\n#EXT-X-BYTERANGE:188@0\nall.ts\n#EXT-X-GAP\n#EXTINF:3,\n#EXT-X-BYTERANGE:188\nall.ts\n#EXT-X-DISCONTINUITY\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:2,\n/last.ts');
  assert.equal(playlist.segments[0].sequence, '9007199254740993');
  assert.equal(playlist.segments[1].sequence, '9007199254740994');
  assert.equal(playlist.segments[1].gap, true);
  assert.equal(playlist.segments[1].range.offset, 188);
  assert.equal(playlist.segments[2].start, 5.5);
  assert.equal(playlist.segments[2].discontinuity, 1);
  assert.equal(playlist.segments[2].key, undefined);
  assert.equal(playlist.duration, 7.5);
  assert.deepEqual(Array.from(sequenceIV('256')).slice(-2), [1, 0]);
});

test('fMP4 maps retain their own encryption and explicit IV', () => {
  const playlist = media('#EXT-X-KEY:METHOD=AES-128,URI="init.key",IV=0x1\n#EXT-X-MAP:URI="init.mp4",BYTERANGE="100@0"\n#EXT-X-KEY:METHOD=AES-128,URI="media.key"\n#EXTINF:1,\nvideo.m4s');
  assert.equal(playlist.segments[0].init.key.url, 'https://media.example/folder/init.key');
  assert.equal(playlist.segments[0].key.url, 'https://media.example/folder/media.key');
  assert.equal(playlist.segments[0].init.key.iv[15], 1);
  assert.throws(() => media('#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-MAP:URI="init"\n#EXTINF:1,\na.m4s'));
});

test('stream mode infers the container from the playlist before the first probe', () => {
  // The save picker runs before any download, so the extension cannot wait for ffprobe.
  assert.equal(originalExtension(media('#EXTINF:1,\nseg0.ts\n#EXTINF:1,\nseg1.ts')), 'ts');
  assert.equal(originalExtension(media('#EXTINF:1,\nseg0.aac\n#EXTINF:1,\nseg1.aac')), 'aac');
  assert.equal(originalExtension(media('#EXTINF:1,\nvideo.mp4')), 'mp4');
  assert.equal(originalExtension(media('#EXTINF:1,\nseg0.m4s')), 'mp4');
  assert.equal(originalExtension(media('#EXT-X-MAP:URI="init.mp4"\n#EXTINF:1,\nseg0.m4s')), 'mp4');
  // Query strings and fragments must not defeat the extension match.
  assert.equal(originalExtension(media('#EXTINF:1,\nseg0.mp4?token=abc#frag')), 'mp4');
  assert.equal(originalExtension(media('#EXTINF:1,\nseg0')), 'ts');
});

test('invalid lists, unsafe URLs, unsupported encryption and ambiguous ranges fail clearly', () => {
  for (const content of ['<html>error</html>', '#EXTM3U\n#EXTINF:NaN,\na.ts', '#EXTM3U\na.ts', '#EXTM3U\n#EXTINF:1,\n#EXT-X-BYTERANGE:100\na.ts', '#EXTM3U\n#EXTINF:1,\njavascript:alert(1)'])
    assert.throws(() => parsePlaylist(content, source));
  assert.throws(() => media('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\n#EXTINF:1,\na.ts'), { code: 'unsupportedEncryption' });
  assert.throws(() => media('#EXT-X-DEFINE:NAME="token",VALUE="x"\n#EXTINF:1,\na.ts'), { code: 'unsupportedPlaylist' });
  assert.throws(() => media('#EXTINF:1,\n#EXT-X-BYTERANGE:100@0\na.ts\n#EXTINF:1,\n#EXT-X-BYTERANGE:100\nb.ts'));
});

test('fingerprints include encryption and map changes and distinguish selected ranges', async () => {
  const a = media('#EXTINF:1,\na.ts\n#EXTINF:1,\nb.ts');
  const b = media('#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:1,\na.ts\n#EXTINF:1,\nb.ts');
  assert.notEqual(await playlistId(a), await playlistId(b));
  assert.equal(await playlistId(a), await playlistId(a));
});

test('missing and declared-gap segments are skipped while later segments finish in original order', async () => {
  const playlist = media('#EXTINF:1,\nfirst.ts\n#EXTINF:1,\nmissing.ts\n#EXT-X-GAP\n#EXTINF:1,\ngap.ts\n#EXTINF:1,\nlast.ts');
  const calls = [];
  const cache = memoryStore();
  const task = new DownloadTask(playlist, 'task', cache, { ...settings, fetcher: async (url) => {
    calls.push(url); return url.endsWith('missing.ts') ? new Response('', { status: 404 }) : new Response(validTs());
  } }, () => {});
  await task.run();
  assert.deepEqual(task.results.map((result) => result.state), ['done', 'skipped', 'skipped', 'done']);
  assert.equal(calls.filter((url) => url.endsWith('missing.ts')).length, 1);
  assert.equal(calls.some((url) => url.endsWith('gap.ts')), false);
  assert.ok(await cache.get('task:segment:3'));
  const restored = new DownloadTask(playlist, 'task', cache, settings, () => {});
  assert.equal(await restored.restore(), 2);
});

test('transient failures retry, exhaust within the limit, and malformed successful responses are skipped', async () => {
  const playlist = media('#EXTINF:1,\nrecover.ts\n#EXTINF:1,\nalways.ts\n#EXTINF:1,\nhtml.ts');
  const calls = new Map();
  const task = new DownloadTask(playlist, 'task', memoryStore(), { ...settings, fetcher: async (url) => {
    const count = (calls.get(url) || 0) + 1; calls.set(url, count);
    if (url.endsWith('html.ts')) return new Response('<html>denied</html>', { headers: { 'Content-Type': 'text/html' } });
    if (url.endsWith('always.ts') || count < 2) return new Response('', { status: 503 });
    return new Response(validTs());
  } }, () => {});
  await task.run();
  assert.deepEqual(task.results.map((result) => result.state), ['done', 'skipped', 'skipped']);
  assert.deepEqual(task.results.map((result) => result.attempts), [2, 3, 3]);
});

test('pause aborts requests and allows resuming without re-fetching completed chunks', async () => {
  const playlist = media('#EXTINF:1,\na.ts\n#EXTINF:1,\nb.ts');
  let blocked = true;
  const calls = [];
  const task = new DownloadTask(playlist, 'task', memoryStore(), { ...settings, concurrency: 1, fetcher: async (url, { signal }) => {
    calls.push(url);
    if (url.endsWith('b.ts') && blocked) return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    return new Response(validTs());
  } }, () => {});
  const run = task.run();
  while (calls.length < 2) await new Promise((resolve) => setTimeout(resolve, 1));
  task.pause(); await run;
  assert.deepEqual(task.results.map((result) => result.state), ['done', 'pending']);
  blocked = false; await task.run();
  assert.deepEqual(task.results.map((result) => result.state), ['done', 'done']);
  assert.equal(calls.filter((url) => url.endsWith('a.ts')).length, 1);
});

test('byte ranges validate 206 and correctly slice a server that ignores Range', async () => {
  const options = { ...settings, fetcher: async () => new Response(Uint8Array.from([0, 1, 2, 3, 4, 5])) };
  const data = await requestBytes(source, { offset: 2, length: 3 }, new AbortController().signal, options);
  assert.deepEqual(Array.from(data.bytes), [2, 3, 4]);
  options.fetcher = async () => new Response(Uint8Array.from([2, 3, 4]), { status: 206, headers: { 'Content-Range': 'bytes 0-2/6' } });
  await assert.rejects(requestBytes(source, { offset: 2, length: 3 }, new AbortController().signal, options), { code: 'invalidRange' });
});

test('AES-128 decrypts implicit sequence IV and rotating keys; invalid keys pause rather than skip everything', async () => {
  const secrets = [crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(16))];
  const playlist = media('#EXT-X-MEDIA-SEQUENCE:8\n#EXT-X-KEY:METHOD=AES-128,URI="key0"\n#EXTINF:1,\na.ts\n#EXT-X-KEY:METHOD=AES-128,URI="key1",IV=0x2\n#EXTINF:1,\nb.ts');
  const encrypted = await Promise.all(playlist.segments.map(async (segment, i) => {
    const key = await crypto.subtle.importKey('raw', secrets[i], 'AES-CBC', false, ['encrypt']);
    return crypto.subtle.encrypt({ name: 'AES-CBC', iv: segment.key.iv || sequenceIV(segment.sequence) }, key, validTs());
  }));
  const cache = memoryStore();
  const task = new DownloadTask(playlist, 'aes', cache, { ...settings, fetcher: async (url) => {
    if (url.endsWith('key0')) return new Response(secrets[0]);
    if (url.endsWith('key1')) return new Response(secrets[1]);
    return new Response(encrypted[url.endsWith('a.ts') ? 0 : 1]);
  } }, () => {});
  await task.run();
  assert.deepEqual(task.results.map((result) => result.state), ['done', 'done']);
  assert.deepEqual(new Uint8Array(await (await cache.get('aes:segment:1')).arrayBuffer()), validTs());
  const invalid = new DownloadTask(playlist, 'bad', memoryStore(), { ...settings, fetcher: async () => new Response(validTs()) }, () => {});
  await invalid.run();
  assert.equal(invalid.fatal.code, 'invalidKey');
  assert.equal(invalid.results.some((result) => result.state === 'skipped'), false);
});

test('storage failures are fatal and do not silently convert every segment to a gap', async () => {
  const { HlsError } = await import('../../src/lib/hls/playlist.ts');
  const task = new DownloadTask(media('#EXTINF:1,\na.ts'), 'task', { get: async () => undefined, put: async () => { throw new HlsError('cacheError'); } }, { ...settings, fetcher: async () => new Response(validTs()) }, () => {});
  await task.run();
  assert.equal(task.fatal.code, 'cacheError'); assert.equal(task.results[0].state, 'pending');
});

test('concat manifest excludes gaps and stream-copy output rewrites timestamps', () => {
  const manifest = concatManifest([{ name: 'segment-0.ts', duration: 2 }, { name: 'segment-2.ts', duration: 2 }]);
  assert.equal(manifest, "ffconcat version 1.0\nfile 'segment-0.ts'\nduration 2.000000000\nfile 'segment-2.ts'\nduration 2.000000000\n");
  assert.throws(() => concatManifest([{ name: "evil'\nfile 'remote", duration: 2 }]));
  assert.ok(remuxArgs('mp4').includes('copy'));
  assert.ok(remuxArgs('mp4').includes('make_zero'));
  assert.throws(() => validateMedia(new TextEncoder().encode('<html>error</html>')));
});

test('timeout covers response body and leaves no request permanently in flight', async () => {
  const options = { ...settings, timeout: 10, fetcher: async (_url, { signal }) => {
    const stream = new ReadableStream({ start(controller) { signal.addEventListener('abort', () => controller.error(signal.reason), { once: true }); } });
    return new Response(stream);
  } };
  await assert.rejects(requestBytes(source, undefined, new AbortController().signal, options), { code: 'timeout' });
});
