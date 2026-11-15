import { HlsError, parsePlaylist, sequenceIV, type ByteRange, type Encryption, type InitSegment, type Playlist, type Segment } from './playlist.ts';
import { HLS_CONFIG } from '../../../config/hls.mjs';

export type SegmentState = 'pending' | 'fetching' | 'retrying' | 'done' | 'skipped';
export interface SegmentResult { state: SegmentState; attempts: number; bytes: number; error?: string }
export interface ChunkStore {
  get(id: string): Promise<Blob | undefined>;
  put(id: string, bytes: Uint8Array): Promise<unknown>;
  remove?(id: string): Promise<unknown>;
  getState?(id: string): Promise<SegmentResult | undefined>;
  putState?(id: string, result: SegmentResult): Promise<unknown>;
}
export interface DownloadOptions {
  concurrency: number; retries: number; timeout: number; credentials: RequestCredentials;
  fetcher?: typeof fetch; retryDelay?: number;
  maxBytes?: number;
}
export interface DownloadFlow {
  start?: number; window: number;
  consume(segment: Segment, result: SegmentResult): Promise<void>;
}

class HttpError extends HlsError {
  status: number;
  retryAfter: number;
  constructor(status: number, retryAfter: number) { super('httpError', `HTTP ${status}`); this.status = status; this.retryAfter = retryAfter; }
}

export async function requestBytes(url: string, range: ByteRange | undefined, signal: AbortSignal, options: DownloadOptions): Promise<{ bytes: Uint8Array; url: string; type: string }> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new HlsError('timeout')), options.timeout);
  try {
    const response = await (options.fetcher || fetch)(url, {
      signal: controller.signal, credentials: options.credentials,
      headers: range ? { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` } : undefined,
    });
    if (!response.ok) {
      const after = response.headers.get('Retry-After');
      const delay = after ? Number(after) * 1000 || Date.parse(after) - Date.now() : 0;
      throw new HttpError(response.status, Math.max(0, Math.min(HLS_CONFIG.retry.maxRetryAfterMs, delay || 0)));
    }
    // Read incrementally when bounded, including responses without Content-Length.
    const cap = options.maxBytes;
    if (cap && Number(response.headers.get('Content-Length')) > cap) { await response.body?.cancel(); throw new HlsError('segmentTooLarge'); }
    let bytes: Uint8Array;
    if (cap && response.body) {
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.length;
          if (length > cap) { await reader.cancel(); throw new HlsError('segmentTooLarge'); }
          chunks.push(part.value);
        }
        bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      } finally { reader.releaseLock(); }
    } else bytes = new Uint8Array(await response.arrayBuffer());
    if (range) {
      if (response.status === 206) {
        const expected = `bytes ${range.offset}-${range.offset + range.length - 1}/`;
        if (!response.headers.get('Content-Range')?.startsWith(expected) || bytes.length !== range.length)
          throw new HlsError('invalidRange');
      } else if (response.status === 200 && bytes.length >= range.offset + range.length) {
        bytes = bytes.slice(range.offset, range.offset + range.length);
      } else throw new HlsError('invalidRange');
    }
    if (!bytes.length) throw new HlsError('emptySegment');
    return { bytes, url: response.url || url, type: response.headers.get('Content-Type') || '' };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (controller.signal.aborted) throw new HlsError('timeout');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export async function loadPlaylist(url: string, signal: AbortSignal, options: DownloadOptions): Promise<Playlist> {
  const data = await requestBytes(url, undefined, signal, options);
  return parsePlaylist(new TextDecoder().decode(data.bytes), data.url);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Reject successful HTML/error responses instead of silently writing them into a video. */
export function validateMedia(bytes: Uint8Array, init = false): void {
  if (bytes.length < 8) throw new HlsError('invalidMedia');
  const signature = new TextDecoder().decode(bytes.subarray(0, 128)).trimStart();
  if (/^(?:<|\{|\[|#EXTM3U)/.test(signature)) throw new HlsError('invalidMedia');
  const box = String.fromCharCode(...bytes.subarray(4, 8));
  const mp4 = ['ftyp', 'styp', 'moof', 'moov', 'sidx', 'free', 'emsg'].includes(box);
  const ts = bytes[0] === 0x47 && bytes.length >= 188 && (bytes.length < 376 || bytes[188] === 0x47);
  const audio = (bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0) || signature.startsWith('ID3');
  if (init ? !mp4 : !mp4 && !ts && !audio) throw new HlsError('invalidMedia');
}

export class DownloadTask {
  readonly playlist: Playlist;
  readonly id: string;
  readonly cache: ChunkStore;
  readonly options: DownloadOptions;
  private update: () => void;
  readonly results: SegmentResult[];
  private controller?: AbortController;
  private keys = new Map<string, Uint8Array>();
  private running = false;
  fatal?: HlsError;
  constructor(playlist: Playlist, id: string, cache: ChunkStore, options: DownloadOptions, update: () => void) {
    this.playlist = playlist; this.id = id; this.cache = cache; this.options = options; this.update = update;
    this.results = playlist.segments.map((segment) => ({ state: segment.gap ? 'skipped' : 'pending', attempts: 0, bytes: 0,
      error: segment.gap ? 'playlistGap' : undefined }));
  }
  chunkId(segment: Segment): string { return `${this.id}:segment:${segment.index}`; }
  initId(init: InitSegment): string {
    return `${this.id}:init:${JSON.stringify(init, (_key, value) => value instanceof Uint8Array ? Array.from(value) : value)}`;
  }
  async restore(): Promise<number> {
    let restored = 0;
    for (const segment of this.playlist.segments) {
      if (segment.gap) continue;
      const saved = await this.cache.getState?.(this.chunkId(segment));
      if (saved?.state === 'skipped') { this.results[segment.index] = saved; continue; }
      const blob = await this.cache.get(this.chunkId(segment));
      const hasInit = !segment.init || !!await this.cache.get(this.initId(segment.init));
      if (blob?.size && hasInit) { this.results[segment.index] = { state: 'done', attempts: 0, bytes: blob.size }; restored++; }
    }
    this.update();
    return restored;
  }
  pause(): void { this.controller?.abort(new DOMException('Paused', 'AbortError')); }
  async retrySkipped(index?: number): Promise<void> {
    if (this.running) return;
    for (const segment of this.playlist.segments) {
      if (!segment.gap && (index === undefined || index === segment.index) && this.results[segment.index].state === 'skipped')
        { this.results[segment.index] = { state: 'pending', attempts: 0, bytes: 0 };
          await this.cache.putState?.(this.chunkId(segment), this.results[segment.index]); }
    }
    this.update();
  }
  async skip(segment: Segment, error: string): Promise<void> {
    const result = this.results[segment.index]; result.state = 'skipped'; result.bytes = 0; result.error = error;
    await this.cache.remove?.(this.chunkId(segment));
    await this.cache.putState?.(this.chunkId(segment), result); this.update();
  }
  private async dependency(url: string, range: ByteRange | undefined, signal: AbortSignal, code: string): Promise<Uint8Array> {
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try { return (await requestBytes(url, range, signal, this.options)).bytes; }
      catch (error) {
        if (signal.aborted) throw signal.reason;
        if (error instanceof HlsError && error.code === 'segmentTooLarge') throw error;
        if (attempt === this.options.retries || error instanceof HttpError && HLS_CONFIG.retry.missingStatuses.includes(error.status)) throw new HlsError(code);
        await delay(error instanceof HttpError && error.retryAfter || Math.min(HLS_CONFIG.retry.maxDelayMs, (this.options.retryDelay ?? HLS_CONFIG.retry.baseDelayMs) * 2 ** attempt), signal);
      }
    }
    throw new HlsError(code);
  }
  private async decrypt(bytes: Uint8Array, key: Encryption, sequence: string, signal: AbortSignal): Promise<Uint8Array> {
    let secret = this.keys.get(key.url);
    if (!secret) {
      secret = await this.dependency(key.url, undefined, signal, 'keyRequestError');
      if (secret.length !== 16) throw new HlsError('invalidKey');
      this.keys.set(key.url, secret);
    }
    try {
      const cryptoKey = await crypto.subtle.importKey('raw', secret as Uint8Array<ArrayBuffer>, 'AES-CBC', false, ['decrypt']);
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: (key.iv || sequenceIV(sequence)) as Uint8Array<ArrayBuffer> }, cryptoKey, bytes as Uint8Array<ArrayBuffer>));
    } catch { this.keys.delete(key.url); throw new HlsError('decryptError'); }
  }
  private async download(segment: Segment, signal: AbortSignal): Promise<number> {
    if (segment.init && !await this.cache.get(this.initId(segment.init))) {
      let bytes = await this.dependency(segment.init.url, segment.init.range, signal, 'initError');
      if (segment.init.key) bytes = await this.decrypt(bytes, segment.init.key, segment.sequence, signal);
      try { validateMedia(bytes, true); } catch { throw new HlsError('initError'); }
      signal.throwIfAborted();
      await this.cache.put(this.initId(segment.init), bytes);
    }
    const response = await requestBytes(segment.url, segment.range, signal, this.options);
    if (/text\/html|application\/(?:json|xml)/i.test(response.type)) throw new HlsError('invalidMedia');
    const bytes = segment.key ? await this.decrypt(response.bytes, segment.key, segment.sequence, signal) : response.bytes;
    validateMedia(bytes);
    signal.throwIfAborted();
    await this.cache.put(this.chunkId(segment), bytes);
    return bytes.length;
  }
  async run(flow?: DownloadFlow): Promise<void> {
    if (this.running) return;
    this.running = true; this.fatal = undefined; this.controller = new AbortController();
    const signal = this.controller.signal;
    let cursor = flow?.start || 0, consumed = cursor;
    const listeners = new Set<() => void>();
    const notify = () => { for (const wake of [...listeners]) wake(); };
    const wait = () => new Promise<void>((resolve) => { const wake = () => { listeners.delete(wake); resolve(); }; listeners.add(wake); });
    signal.addEventListener('abort', notify, { once: true });
    const worker = async () => {
      while (!signal.aborted && cursor < this.playlist.segments.length) {
        const segment = this.playlist.segments[cursor++];
        while (flow && segment.index >= consumed + flow.window && !signal.aborted) await wait();
        if (signal.aborted) break;
        const result = this.results[segment.index];
        if (result.state !== 'pending') continue;
        for (let attempt = 0; attempt <= this.options.retries && !signal.aborted; attempt++) {
          result.state = attempt ? 'retrying' : 'fetching'; result.attempts++;
          this.update();
          try {
            result.bytes = await this.download(segment, signal);
            result.state = 'done'; result.error = undefined;
            await this.cache.putState?.(this.chunkId(segment), result); this.update(); notify(); break;
          } catch (error) {
            if (signal.aborted) { result.state = 'pending'; this.update(); break; }
            const failure = error instanceof HlsError ? error : new HlsError('networkError');
            if (['cacheError', 'invalidKey', 'keyRequestError', 'initError', 'decryptError', 'segmentTooLarge'].includes(failure.code)) {
              // Systemic failures must never be mistaken for missing media.
              this.fatal = failure; result.state = 'pending'; this.controller!.abort(failure); this.update(); break;
            }
            result.error = failure instanceof HttpError ? failure.message : failure.code;
            if (attempt === this.options.retries || (failure instanceof HttpError && HLS_CONFIG.retry.missingStatuses.includes(failure.status))) {
              result.state = 'skipped';
              try { await this.cache.putState?.(this.chunkId(segment), result); }
              catch { this.fatal = new HlsError('cacheError'); this.controller!.abort(this.fatal); }
              this.update(); notify(); break;
            }
            try { await delay(failure instanceof HttpError && failure.retryAfter || Math.min(HLS_CONFIG.retry.maxDelayMs, (this.options.retryDelay ?? HLS_CONFIG.retry.baseDelayMs) * 2 ** attempt), signal); }
            catch { result.state = 'pending'; this.update(); break; }
          }
        }
      }
    };
    const consume = async () => {
      if (!flow) return;
      try {
        while (!signal.aborted && consumed < this.playlist.segments.length) {
          const segment = this.playlist.segments[consumed], result = this.results[consumed];
          if (result.state !== 'done' && result.state !== 'skipped') { await wait(); continue; }
          await flow.consume(segment, result); consumed++; notify();
        }
      } catch (error) {
        this.fatal = error instanceof HlsError ? error : new HlsError('remuxError'); this.controller!.abort(this.fatal);
      }
    };
    const concurrency = Math.max(HLS_CONFIG.limits.concurrency[0], Math.min(HLS_CONFIG.limits.concurrency[1], this.options.concurrency));
    try { await Promise.all([...Array.from({ length: concurrency }, worker), consume()]); }
    finally { signal.removeEventListener('abort', notify); this.running = false; this.update(); }
  }
}
