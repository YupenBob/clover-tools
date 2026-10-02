import { HlsError, type Segment } from './playlist.ts';
import type { MediaFormat } from './file.ts';
import { HLS_CONFIG } from '../../../config/hls.mjs';

export interface MediaStream {
  codec_type: string; codec_name: string; time_base: string; firstDts: number;
  index: number; [key: string]: unknown;
}
export interface MediaInfo { format: MediaFormat; streams: MediaStream[]; signature: string }
/** Normalize legal Annex-B padding, while retaining the actual codec parameter sets. */
export function codecSignature(streams: MediaStream[]): string {
  const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return JSON.stringify(streams.map((stream) => {
    const dump = String(stream.extradata || '').split('\n').map((line) => line.includes(': ') ? line.split(': ')[1].split('  ')[0].replace(/\s/g, '') : '').join('');
    const bytes = Uint8Array.from(dump.match(/[a-f0-9]{2}/gi) || [], (byte) => parseInt(byte, 16));
    let config = hex(bytes);
    if (['h264', 'hevc'].includes(stream.codec_name) && bytes.length) {
      const nals: Uint8Array[] = [];
      if (bytes[0] === 1 && stream.codec_name === 'h264') {
        let p = 6; const read = (count: number) => {
          for (let i = 0; i < count; i++) { const length = bytes[p] * 256 + bytes[p + 1]; p += 2;
            if (!length || p + length > bytes.length) throw new HlsError('invalidMedia'); nals.push(bytes.slice(p, p + length)); p += length; }
        };
        read(bytes[5] & 31); read(bytes[p++]);
      } else if (bytes[0] === 1 && stream.codec_name === 'hevc') {
        let p = 23;
        for (let array = 0; array < bytes[22]; array++) {
          p++; const count = bytes[p] * 256 + bytes[p + 1]; p += 2;
          for (let i = 0; i < count; i++) { const length = bytes[p] * 256 + bytes[p + 1]; p += 2;
            if (!length || p + length > bytes.length) throw new HlsError('invalidMedia'); nals.push(bytes.slice(p, p + length)); p += length; }
        }
      } else {
        let start = -1;
        for (let p = 0; p + 2 < bytes.length; p++) if (!bytes[p] && !bytes[p + 1] && bytes[p + 2] === 1) {
          if (start >= 0) nals.push(bytes.slice(start, p)); start = p + 3; p += 2;
        }
        if (start >= 0) nals.push(bytes.slice(start));
      }
      config = nals.map((nal) => { let end = nal.length; while (end && !nal[end - 1]) end--; return hex(nal.subarray(0, end)); }).sort().join('/');
      if (!config) throw new HlsError('invalidMedia');
    }
    return { codec: stream.codec_name, type: stream.codec_type, profile: stream.profile, width: stream.width, height: stream.height,
      pixel: stream.pix_fmt, rate: stream.sample_rate, channels: stream.channels, layout: stream.channel_layout, config };
  }));
}
const WRAP = 2 ** 33;
const modulo = (n: number) => ((n % WRAP) + WRAP) % WRAP;
const text = (data: Uint8Array, start: number, end: number) => String.fromCharCode(...data.subarray(start, end));

export interface Box { type: string; start: number; size: number; header: number }
export function boxes(data: Uint8Array, start = 0, end = data.length): Box[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength); const result: Box[] = [];
  for (let p = start; p < end;) {
    if (p + 8 > end) throw new HlsError('invalidMedia');
    let size = view.getUint32(p), header = 8;
    if (size === 1) { if (p + 16 > end) throw new HlsError('invalidMedia'); size = Number(view.getBigUint64(p + 8)); header = 16; }
    if (!size) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) throw new HlsError('invalidMedia');
    result.push({ type: text(data, p + 4, p + 8), start: p, size, header }); p += size;
  }
  return result;
}
const children = (data: Uint8Array, box: Box) => boxes(data, box.start + box.header, box.start + box.size);
const join = (parts: Uint8Array[]) => { const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let p = 0; for (const part of parts) { result.set(part, p); p += part.length; } return result; };
const sliceBox = (data: Uint8Array, box: Box) => data.slice(box.start, box.start + box.size);

// edit lists from independent remux calls describe local offsets. The global tfdt values
// below carry those offsets instead, so subsequent fragments share one clock.
function cleanMoov(data: Uint8Array, box: Box): Uint8Array {
  const rewrite = (item: Box): Uint8Array => {
    if (!['moov', 'trak'].includes(item.type)) return sliceBox(data, item);
    const body = join(children(data, item).filter((child) => child.type !== 'edts').map(rewrite));
    const result = join([data.slice(item.start, item.start + item.header), body]);
    const view = new DataView(result.buffer);
    if (item.header === 16) view.setBigUint64(8, BigInt(result.length)); else view.setUint32(0, result.length);
    return result;
  };
  return rewrite(box);
}

interface Track { id: number; timescale: number; source: number }
export class FragmentTimeline {
  private signature?: string;
  private format?: MediaFormat;
  private origin = 0;
  private discontinuity?: number;
  private duration = 0;
  private sequence = 0;
  private counters = new Map<number, number>();
  private header?: Uint8Array;
  private tracks: Track[] = [];
  private durations = new Map<number, bigint>();
  get retainedDuration(): number { return this.duration; }

  append(data: Uint8Array, info: MediaInfo, segment: Segment, target: MediaFormat): Uint8Array[] {
    const snapshot = { signature: this.signature, format: this.format, origin: this.origin, discontinuity: this.discontinuity,
      duration: this.duration, sequence: this.sequence, counters: new Map(this.counters), header: this.header,
      tracks: this.tracks, durations: new Map(this.durations) };
    try { return this.transform(data, info, segment, target); }
    catch (error) { Object.assign(this, snapshot); throw error; }
  }
  private transform(data: Uint8Array, info: MediaInfo, segment: Segment, target: MediaFormat): Uint8Array[] {
    if (this.signature && (this.signature !== info.signature || this.format !== target)) throw new HlsError('streamChanged');
    this.signature = info.signature; this.format = target;
    const time = (stream: MediaStream) => {
      const [n, d] = stream.time_base.split('/').map(Number);
      if (!n || !d || !Number.isFinite(stream.firstDts)) throw new HlsError('invalidMedia');
      let value = stream.firstDts * n / d;
      if (info.format === 'ts' && this.discontinuity === segment.discontinuity)
        value += Math.round((this.origin + segment.start - value) / (WRAP / 90000)) * (WRAP / 90000);
      return value;
    };
    const starts = info.streams.map(time), first = Math.min(...starts);
    if (this.discontinuity !== segment.discontinuity || info.format === 'aac') this.origin = first - segment.start;
    this.discontinuity = segment.discontinuity;
    const bases = starts.map((start) => start - this.origin - segment.start + this.duration);
    if (bases.some((base) => base < -HLS_CONFIG.stream.clockToleranceSeconds)) throw new HlsError('streamChanged');
    let output: Uint8Array[];
    if (target === 'mp4') output = this.mp4(data, bases);
    else if (target === 'ts') output = [this.ts(data, Math.round((this.duration - segment.start - this.origin) * 90000))];
    else output = [this.aac(data)];
    this.duration += segment.duration;
    return output;
  }

  private mp4(data: Uint8Array, bases: number[]): Uint8Array[] {
    const all = boxes(data), moov = all.find((box) => box.type === 'moov');
    if (!moov) throw new HlsError('invalidMedia');
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tracks: Track[] = [];
    for (const track of children(data, moov).filter((box) => box.type === 'trak')) {
      const parts = children(data, track), tkhd = parts.find((box) => box.type === 'tkhd'), mdia = parts.find((box) => box.type === 'mdia');
      const mdhd = mdia && children(data, mdia).find((box) => box.type === 'mdhd');
      if (!tkhd || !mdhd) throw new HlsError('invalidMedia');
      const tp = tkhd.start + tkhd.header, mp = mdhd.start + mdhd.header;
      tracks.push({ id: view.getUint32(tp + (data[tp] === 1 ? 20 : 12)), timescale: view.getUint32(mp + (data[mp] === 1 ? 20 : 12)), source: tracks.length });
    }
    if (tracks.length !== bases.length || tracks.some((track) => !track.timescale)) throw new HlsError('streamChanged');
    if (this.tracks.length && JSON.stringify(tracks) !== JSON.stringify(this.tracks)) throw new HlsError('streamChanged');
    this.tracks = tracks;
    const result: Uint8Array[] = [];
    if (!this.header) {
      const ftyp = all.find((box) => box.type === 'ftyp'); if (!ftyp) throw new HlsError('invalidMedia');
      this.header = join([sliceBox(data, ftyp), cleanMoov(data, moov)]); result.push(this.header.slice());
    }
    const localBases = new Map<number, bigint>();
    for (const box of all) {
      if (box.type === 'moof') {
        const fragment = sliceBox(data, box), fv = new DataView(fragment.buffer, fragment.byteOffset, fragment.byteLength);
        const root = boxes(fragment)[0];
        for (const part of children(fragment, root)) {
          if (part.type === 'mfhd') { fv.setUint32(part.start + part.header + 4, ++this.sequence); continue; }
          if (part.type !== 'traf') continue;
          const parts = children(fragment, part), tfhd = parts.find((box) => box.type === 'tfhd'), tfdt = parts.find((box) => box.type === 'tfdt');
          if (!tfhd || !tfdt) throw new HlsError('invalidMedia');
          const hp = tfhd.start + tfhd.header, dp = tfdt.start + tfdt.header;
          // Canonical remux output must use moof-relative addressing before it is relocated.
          const flags = fv.getUint32(hp) & 0xffffff;
          if (!(flags & 0x020000) || flags & 1) throw new HlsError('invalidMedia');
          const trackId = fv.getUint32(hp + 4), track = tracks.find((track) => track.id === trackId);
          if (!track) throw new HlsError('streamChanged');
          const old = fragment[dp] === 1 ? fv.getBigUint64(dp + 4) : BigInt(fv.getUint32(dp + 4));
          if (!localBases.has(trackId)) localBases.set(trackId, old);
          const base = BigInt(Math.max(0, Math.round(bases[track.source] * track.timescale))) + old - localBases.get(trackId)!;
          if (fragment[dp] === 1) fv.setBigUint64(dp + 4, base);
          else { if (base > 0xffffffffn) throw new HlsError('streamChanged'); fv.setUint32(dp + 4, Number(base)); }
          let defaultDuration = 0, position = hp + 8;
          if (flags & 2) position += 4;
          if (flags & 8) { defaultDuration = fv.getUint32(position); position += 4; }
          let duration = 0n, presentationEnd = base;
          for (const run of parts.filter((box) => box.type === 'trun')) {
            const rp = run.start + run.header, flags = fv.getUint32(rp) & 0xffffff, count = fv.getUint32(rp + 4);
            let p = rp + 8 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0);
            for (let i = 0; i < count; i++) {
              const sampleDuration = BigInt(flags & 0x100 ? fv.getUint32(p) : defaultDuration);
              p += (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0);
              const composition = flags & 0x800 ? BigInt(fragment[rp] === 1 ? fv.getInt32(p) : fv.getUint32(p)) : 0n;
              if (flags & 0x800) p += 4;
              const end = base + duration + composition + sampleDuration;
              if (end > presentationEnd) presentationEnd = end;
              duration += sampleDuration;
            }
          }
          const end = presentationEnd > base + duration ? presentationEnd : base + duration;
          this.durations.set(trackId, end > (this.durations.get(trackId) || 0n) ? end : this.durations.get(trackId)!);
        }
        result.push(fragment);
      } else if (box.type === 'mdat') result.push(sliceBox(data, box));
    }
    if (!result.some((part) => text(part, 4, 8) === 'moof') || !result.some((part) => text(part, 4, 8) === 'mdat' && part.length > 8)) throw new HlsError('invalidMedia');
    return result;
  }

  /** Patch only the small initialization header once the final track durations are known. */
  finish(): Uint8Array | undefined {
    if (!this.header) return;
    const header = this.header.slice(), view = new DataView(header.buffer);
    const moov = boxes(header).find((box) => box.type === 'moov')!;
    const movie = children(header, moov).find((box) => box.type === 'mvhd')!;
    const mp = movie.start + movie.header, movieScale = view.getUint32(mp + (header[mp] === 1 ? 20 : 12));
    const set = (box: Box, duration: bigint) => {
      const p = box.start + box.header;
      if (header[p] === 1) view.setBigUint64(p + 24, duration);
      else view.setUint32(p + 16, duration > 0xffffffffn ? 0 : Number(duration));
    };
    let movieDuration = 0n;
    for (const trak of children(header, moov).filter((box) => box.type === 'trak')) {
      const parts = children(header, trak), tkhd = parts.find((box) => box.type === 'tkhd')!;
      const tp = tkhd.start + tkhd.header, id = view.getUint32(tp + (header[tp] === 1 ? 20 : 12));
      const track = this.tracks.find((track) => track.id === id)!, duration = this.durations.get(id) || 0n;
      const movieTicks = duration * BigInt(movieScale) / BigInt(track.timescale);
      movieDuration = movieTicks > movieDuration ? movieTicks : movieDuration;
      if (header[tp] === 1) view.setBigUint64(tp + 28, movieTicks);
      else view.setUint32(tp + 20, movieTicks > 0xffffffffn ? 0 : Number(movieTicks));
      const mdia = parts.find((box) => box.type === 'mdia')!, mdhd = children(header, mdia).find((box) => box.type === 'mdhd')!;
      set(mdhd, duration);
    }
    set(movie, movieDuration); return header;
  }

  private ts(data: Uint8Array, offset: number): Uint8Array {
    const output = data.slice();
    if (output.length % 188) throw new HlsError('invalidMedia');
    const payload = (p: number) => {
      const control = (output[p + 3] >> 4) & 3;
      return control & 1 ? p + 4 + (control & 2 ? 1 + output[p + 4] : 0) : p + 188;
    };
    const readTimestamp = (positions: number[]) => ((output[positions[0]] >> 1) & 7) * 2 ** 30 + output[positions[1]] * 2 ** 22 + (output[positions[2]] >> 1) * 2 ** 15 + output[positions[3]] * 128 + (output[positions[4]] >> 1);
    const shiftTimestamp = (positions: number[]) => {
      const value = modulo(readTimestamp(positions) + offset);
      output[positions[0]] = (output[positions[0]] & 0xf1) | (Math.floor(value / 2 ** 30) << 1);
      output[positions[1]] = Math.floor(value / 2 ** 22) & 255;
      output[positions[2]] = ((Math.floor(value / 2 ** 15) & 127) << 1) | 1;
      output[positions[3]] = Math.floor(value / 128) & 255; output[positions[4]] = ((value & 127) << 1) | 1;
    };
    for (let p = 0; p < output.length; p += 188) {
      if (output[p] !== 0x47 || output[p + 1] & 0x80) throw new HlsError('invalidMedia');
      const pid = ((output[p + 1] & 31) << 8) | output[p + 2], control = (output[p + 3] >> 4) & 3;
      if (!control || (control & 2 && output[p + 4] > 183)) throw new HlsError('invalidMedia');
      let counter = this.counters.get(pid);
      if (counter === undefined) counter = output[p + 3] & 15;
      else if (control & 1) counter = (counter + 1) & 15;
      this.counters.set(pid, counter); output[p + 3] = (output[p + 3] & 0xf0) | counter;
      if (control & 2 && output[p + 4]) {
        const flags = output[p + 5]; let cp = p + 6;
        for (const flag of [0x10, 0x08]) {
          if (!(flags & flag)) continue;
          if (cp + 6 > p + 5 + output[p + 4]) throw new HlsError('invalidMedia');
          const clock = output[cp] * 2 ** 25 + output[cp + 1] * 2 ** 17 + output[cp + 2] * 512 + output[cp + 3] * 2 + (output[cp + 4] >> 7);
          const shifted = modulo(clock + offset);
          output[cp] = Math.floor(shifted / 2 ** 25); output[cp + 1] = Math.floor(shifted / 2 ** 17) & 255;
          output[cp + 2] = Math.floor(shifted / 512) & 255; output[cp + 3] = Math.floor(shifted / 2) & 255;
          output[cp + 4] = (output[cp + 4] & 127) | ((shifted & 1) << 7); cp += 6;
        }
      }
      const start = payload(p);
      if (!(output[p + 1] & 0x40) || start + 3 > p + 188 || output[start] || output[start + 1] || output[start + 2] !== 1) continue;
      const positions: number[] = [];
      for (let q = p; q < output.length && positions.length < 19; q += 188) {
        if ((((output[q + 1] & 31) << 8) | output[q + 2]) !== pid) continue;
        if (q !== p && output[q + 1] & 0x40) break;
        for (let i = payload(q); i < q + 188 && positions.length < 19; i++) positions.push(i);
      }
      if (positions.length < 9 || (output[positions[6]] & 0xc0) !== 0x80) continue;
      const flags = output[positions[7]] & 0xc0, required = flags === 0xc0 ? 19 : flags === 0x80 ? 14 : 9;
      if (positions.length < required) throw new HlsError('invalidMedia');
      if (flags & 0x80) shiftTimestamp(positions.slice(9, 14));
      if (flags === 0xc0) shiftTimestamp(positions.slice(14, 19));
    }
    return output;
  }
  private aac(data: Uint8Array): Uint8Array {
    let start = 0;
    while (text(data, start, start + 3) === 'ID3') {
      if (start + 10 > data.length) throw new HlsError('invalidMedia');
      const size = data.subarray(start + 6, start + 10).reduce((n, b) => n * 128 + (b & 127), 0);
      start += 10 + size + (data[start + 5] & 0x10 ? 10 : 0);
    }
    let p = start;
    while (p < data.length) {
      if (p + 7 > data.length || data[p] !== 255 || (data[p + 1] & 0xf6) !== 0xf0) throw new HlsError('invalidMedia');
      const length = ((data[p + 3] & 3) << 11) | (data[p + 4] << 3) | (data[p + 5] >> 5);
      if (length < 7 || p + length > data.length) throw new HlsError('invalidMedia'); p += length;
    }
    return data.slice(start);
  }
}
