import { DownloadTask, type SegmentResult } from './downloader.ts';
import { HlsError, type Segment } from './playlist.ts';
import { FragmentTimeline, type MediaInfo } from './timeline.ts';
import type { MediaSink, StreamFormat, MediaFormat } from './file.ts';
import { HLS_CONFIG } from '../../../config/hls.mjs';

export interface FragmentEngine {
  inspect(bytes: ArrayBuffer): Promise<MediaInfo>;
  fragment(bytes: ArrayBuffer, format: StreamFormat): Promise<{ bytes: ArrayBuffer; info: MediaInfo; format: MediaFormat; heapBytes: number }>;
  stop(): void;
}
export interface StreamProgress { bytes: number; segments: number; cursor: number; heapBytes: number }

/** Source chunks remain on disk for recovery; only the current media unit enters WASM. */
export class StreamingTask {
  readonly task: DownloadTask;
  readonly format: StreamFormat;
  info?: MediaInfo;
  output?: MediaFormat;
  bytes = 0;
  segments = 0;
  cursor = 0;
  private engine?: FragmentEngine;
  private factory: () => FragmentEngine;
  private processed = 0;
  private heapBytes = 0;
  private timeline = new FragmentTimeline();
  private sink?: MediaSink;
  private update: (progress: StreamProgress) => void;
  private closed = false;
  constructor(task: DownloadTask, format: StreamFormat, factory: () => FragmentEngine, update: (progress: StreamProgress) => void) {
    this.task = task; this.format = format; this.factory = factory; this.update = update;
  }
  private core(): FragmentEngine { return this.engine ||= this.factory(); }
  private limitDownloads(): void {
    this.task.options.maxBytes = HLS_CONFIG.stream.segmentBytes;
    // Reserve both response chunks and their assembled byte array per request.
    this.task.options.concurrency = Math.max(1, Math.min(this.task.options.concurrency,
      Math.floor(HLS_CONFIG.stream.bufferBytes / (2 * HLS_CONFIG.stream.segmentBytes))));
  }
  private async read(segment: Segment): Promise<ArrayBuffer> {
    const blob = await this.task.cache.get(this.task.chunkId(segment));
    const init = segment.init && await this.task.cache.get(this.task.initId(segment.init));
    if (!blob || (segment.init && !init)) throw new HlsError('cacheError');
    if (blob.size > HLS_CONFIG.stream.segmentBytes || (init && init.size > HLS_CONFIG.stream.segmentBytes)) throw new HlsError('segmentTooLarge');
    return new Blob(init ? [init, blob] : [blob]).arrayBuffer();
  }
  async prepare(): Promise<void> {
    if (this.info) return;
    this.limitDownloads();
    await this.task.run({ window: 1, consume: async (segment, result) => {
      if (result.state !== 'done') return;
      try { this.info = await this.core().inspect(await this.read(segment)); }
      catch (error) { if (error instanceof HlsError && error.code === 'invalidMedia') { await this.task.skip(segment, error.code); return; } throw error; }
      this.output = this.format === 'original' ? this.info.format : 'mp4'; this.task.pause();
    } });
    if (this.task.fatal) throw this.task.fatal;
    if (!this.info) throw new HlsError(this.task.results.some((result) => result.state === 'pending') ? 'streamPaused' : 'noSegments');
  }
  attach(sink: MediaSink): void { this.sink = sink; }
  get writable(): boolean { return !!this.sink && !this.closed; }
  get finished(): boolean { return this.cursor >= this.task.results.length; }
  private async consume(segment: Segment, result: SegmentResult): Promise<void> {
    if (result.state === 'done') {
      try {
        const fragment = await this.core().fragment(await this.read(segment), this.format);
        this.heapBytes = fragment.heapBytes;
        const parts = this.timeline.append(new Uint8Array(fragment.bytes), fragment.info, segment, fragment.format);
        for (const part of parts) await this.sink!.write(part);
        this.bytes = this.sink!.bytes; this.segments++; this.processed++;
        if (this.processed >= HLS_CONFIG.stream.recycleSegments || fragment.heapBytes > HLS_CONFIG.stream.heapBytes) {
          this.engine?.stop(); this.engine = undefined; this.processed = 0;
        }
      } catch (error) {
        if (error instanceof HlsError && error.code === 'invalidMedia') await this.task.skip(segment, error.code);
        else throw error;
      }
    }
    this.cursor = segment.index + 1; this.update({ bytes: this.bytes, segments: this.segments, cursor: this.cursor, heapBytes: this.heapBytes });
  }
  async run(): Promise<void> {
    if (!this.writable) throw new HlsError('fileWriteError');
    this.limitDownloads();
    await this.task.run({ start: this.cursor, window: HLS_CONFIG.stream.prefetch, consume: (segment, result) => this.consume(segment, result) });
    if (this.task.fatal) {
      await this.sink!.abort(); this.closed = true; this.engine?.stop(); this.engine = undefined; throw this.task.fatal;
    }
    if (this.finished) await this.finish();
  }
  pause(): void { this.task.pause(); }
  async finish(): Promise<void> {
    if (!this.writable) return;
    if (!this.segments) { await this.sink!.abort(); this.closed = true; throw new HlsError('noSegments'); }
    try {
      const header = this.timeline.finish(); if (header) await this.sink!.writeAt(0, header);
      await this.sink!.close(); this.closed = true;
    } finally { this.engine?.stop(); this.engine = undefined; }
  }
  async dispose(): Promise<void> {
    this.pause(); this.engine?.stop(); this.engine = undefined; this.closed = true;
    await this.sink?.abort();
  }
}
