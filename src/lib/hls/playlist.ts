/** HLS parsing is kept independent from the UI and downloader (RFC 8216). */
export class HlsError extends Error {
  code: string;
  constructor(code: string, detail = '') { super(detail || code); this.code = code; }
}

export interface ByteRange { offset: number; length: number }
export interface Encryption { url: string; iv?: Uint8Array }
export interface InitSegment { url: string; range?: ByteRange; key?: Encryption }
export interface Segment {
  index: number; sequence: string; url: string; duration: number; start: number;
  gap: boolean; discontinuity: number; range?: ByteRange; key?: Encryption; init?: InitSegment;
}
export interface Variant {
  url: string; bandwidth: number; resolution: string; codecs: string; audioGroup?: string;
  externalAudio: boolean;
}
export interface Playlist {
  url: string; segments: Segment[]; variants: Variant[]; duration: number; live: boolean;
}

export function httpUrl(value: string, base?: string): string {
  try {
    const url = new URL(value, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw 0;
    return url.href;
  } catch { throw new HlsError('invalidUrl'); }
}

export function attributes(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /(?:^|,)\s*([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  for (const match of value.matchAll(pattern)) result[match[1]] = match[2].replace(/^"|"$/g, '');
  return result;
}

export function sequenceIV(sequence: string): Uint8Array {
  let number = BigInt(sequence);
  if (number < 0n || number >= (1n << 128n)) throw new HlsError('invalidPlaylist');
  const iv = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) { iv[i] = Number(number & 255n); number >>= 8n; }
  return iv;
}

function parseIV(value: string): Uint8Array {
  if (!/^0x[\da-f]{1,32}$/i.test(value)) throw new HlsError('invalidPlaylist', 'Invalid AES IV');
  const hex = value.slice(2).padStart(32, '0');
  return Uint8Array.from(hex.match(/../g)!, (part) => parseInt(part, 16));
}

function byteRange(value: string, url: string, previous?: { url: string; range?: ByteRange }): ByteRange {
  const match = /^(\d+)(?:@(\d+))?$/.exec(value);
  if (!match) throw new HlsError('invalidPlaylist', 'Invalid byte range');
  const length = Number(match[1]);
  const offset = match[2] === undefined
    ? previous?.url === url && previous.range ? previous.range.offset + previous.range.length : NaN
    : Number(match[2]);
  if (!Number.isSafeInteger(length) || length <= 0 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + length))
    throw new HlsError('invalidPlaylist', 'Invalid implicit byte range');
  return { offset, length };
}

export function parsePlaylist(text: string, source: string): Playlist {
  const url = httpUrl(source);
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U') throw new HlsError('invalidPlaylist');
  const segments: Segment[] = [], variants: Variant[] = [];
  const externalAudio = new Set<string>();
  let sequence = 0n, duration = 0, pendingDuration: number | undefined;
  let key: Encryption | undefined, init: InitSegment | undefined;
  let pendingRange: string | undefined, gap = false, discontinuity = 0, end = false;
  let pendingVariant: Record<string, string> | undefined;
  for (const line of lines.slice(1)) {
    if (line.startsWith('#EXT-X-DEFINE:')) throw new HlsError('unsupportedPlaylist');
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = attributes(line.slice(13));
      if (attrs.TYPE === 'AUDIO' && attrs.URI && attrs['GROUP-ID']) externalAudio.add(attrs['GROUP-ID']);
    } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
      pendingVariant = attributes(line.slice(18));
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      const value = line.slice(22);
      if (!/^\d+$/.test(value) || segments.length) throw new HlsError('invalidPlaylist');
      sequence = BigInt(value);
    } else if (line.startsWith('#EXTINF:')) {
      pendingDuration = Number(line.slice(8).split(',')[0]);
      if (!Number.isFinite(pendingDuration) || pendingDuration <= 0) throw new HlsError('invalidPlaylist');
    } else if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = attributes(line.slice(11));
      if (attrs.METHOD === 'NONE') key = undefined;
      else {
        if (attrs.METHOD !== 'AES-128' || (attrs.KEYFORMAT && attrs.KEYFORMAT !== 'identity'))
          throw new HlsError('unsupportedEncryption');
        if (!attrs.URI) throw new HlsError('invalidPlaylist');
        key = { url: httpUrl(attrs.URI, url), iv: attrs.IV ? parseIV(attrs.IV) : undefined };
      }
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = attributes(line.slice(11));
      if (!attrs.URI) throw new HlsError('invalidPlaylist');
      if (key && !key.iv) throw new HlsError('invalidPlaylist', 'Encrypted init requires an explicit IV');
      const mapUrl = httpUrl(attrs.URI, url);
      init = { url: mapUrl, range: attrs.BYTERANGE ? byteRange(attrs.BYTERANGE, mapUrl, init) : undefined, key };
    } else if (line.startsWith('#EXT-X-BYTERANGE:')) pendingRange = line.slice(17);
    else if (line === '#EXT-X-GAP') gap = true;
    else if (line === '#EXT-X-DISCONTINUITY') discontinuity++;
    else if (line === '#EXT-X-ENDLIST') end = true;
    else if (!line.startsWith('#')) {
      const segmentUrl = httpUrl(line, url);
      if (pendingVariant) {
        variants.push({ url: segmentUrl, bandwidth: Number(pendingVariant.BANDWIDTH) || 0,
          resolution: pendingVariant.RESOLUTION || '', codecs: pendingVariant.CODECS || '',
          audioGroup: pendingVariant.AUDIO, externalAudio: false });
        pendingVariant = undefined;
      } else {
        if (pendingDuration === undefined) throw new HlsError('invalidPlaylist');
        segments.push({ index: segments.length, sequence: String(sequence++), url: segmentUrl,
          duration: pendingDuration, start: duration, gap, discontinuity, key, init,
          range: pendingRange ? byteRange(pendingRange, segmentUrl, segments.at(-1)) : undefined });
        duration += pendingDuration;
        pendingDuration = undefined; pendingRange = undefined; gap = false;
      }
    }
  }
  if (pendingVariant || pendingDuration !== undefined || (!segments.length && !variants.length) || (segments.length && variants.length))
    throw new HlsError('invalidPlaylist');
  for (const variant of variants) variant.externalAudio = !!variant.audioGroup && externalAudio.has(variant.audioGroup);
  return { url, segments, variants, duration, live: !end && !variants.length };
}

/** Fingerprint the actual media identity, including rotating keys and initialization data. */
export async function playlistId(playlist: Playlist): Promise<string> {
  const data = JSON.stringify(playlist.segments, (_key, value) => value instanceof Uint8Array ? Array.from(value) : value);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}

/** ffconcat adjusts each input's timestamps to follow the previous successful input. */
export function concatManifest(files: { name: string; duration: number }[]): string {
  return 'ffconcat version 1.0\n' + files.map(({ name, duration }) => {
    if (!/^[a-z\d._-]+$/i.test(name) || !Number.isFinite(duration) || duration <= 0) throw new HlsError('invalidPlaylist');
    return `file '${name}'\nduration ${duration.toFixed(9)}\n`;
  }).join('');
}

export function remuxArgs(format: 'mp4' | 'ts'): string[] {
  return ['-fflags', '+genpts+discardcorrupt', '-f', 'concat', '-safe', '1', '-i', 'input.ffconcat',
    '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero',
    ...(format === 'mp4' ? ['-movflags', '+faststart'] : ['-f', 'mpegts', '-mpegts_flags', '+resend_headers']),
    `output.${format}`];
}
