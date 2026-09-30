import workerUrl from '../../scripts/hls-remux.worker.ts?worker&url';
import { HlsError } from './playlist';
import type { DownloadTask } from './downloader';
import { HLS_CONFIG, hlsCorePath } from '../../../config/hls.mjs';

/** A disposable worker lets cancellation interrupt FFmpeg's synchronous WASM execution. */
export class Remuxer {
  private worker = new Worker(workerUrl, { type: 'module' });
  private serial = 0;
  private stopped?: Error;
  private loaded = false;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(update: (event: string, progress: number) => void) {
    this.worker.onmessage = ({ data }) => {
      if (data.event) { update(data.event, data.progress); return; }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(data.id);
      if (data.error) pending.reject(new HlsError(data.error.startsWith('coreLoadError') ? 'coreLoadError' : 'remuxError', data.error));
      else pending.resolve(data.result);
    };
    this.worker.onerror = (event) => { console.error('HLS worker failed:', event.message); this.stop(new HlsError(this.loaded ? 'remuxError' : 'coreLoadError', event.message)); };
  }
  private request(action: string, payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<any> {
    if (this.stopped) return Promise.reject(this.stopped);
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(new HlsError('remuxTimeout')), HLS_CONFIG.worker.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, action, ...payload }, transfer);
    });
  }
  stop(error: Error = new HlsError('exportCancelled')): void {
    this.stopped = error;
    this.worker.terminate();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  async export(task: DownloadTask, format: 'mp4' | 'ts', progress: (done: number, total: number) => void): Promise<Blob> {
    const segments = task.playlist.segments.filter((segment) => task.results[segment.index].state === 'done');
    if (!segments.length) throw new HlsError('noSegments');
    // WASM has a finite address space; refuse a doomed allocation and retain the disk cache.
    const size = segments.reduce((sum, segment) => sum + task.results[segment.index].bytes, 0);
    if (size > HLS_CONFIG.limits.exportBytes) throw new HlsError('exportTooLarge');
    await this.request('load', { base: new URL(hlsCorePath(), location.origin).href });
    this.loaded = true;
    const files: { name: string; duration: number }[] = [];
    for (const segment of segments) {
      const blob = await task.cache.get(task.chunkId(segment));
      if (!blob) throw new HlsError('cacheError');
      const init = segment.init ? await task.cache.get(task.initId(segment.init)) : undefined;
      if (segment.init && !init) throw new HlsError('cacheError');
      const bytes = await new Blob(init ? [init, blob] : [blob]).arrayBuffer();
      const name = `segment-${segment.index}.${segment.init ? 'mp4' : 'ts'}`;
      await this.request('write', { name, bytes }, [bytes]);
      if (!await this.request('probe', { name })) {
        task.results[segment.index] = { ...task.results[segment.index], state: 'skipped', bytes: 0, error: 'invalidMedia' };
        await task.cache.remove?.(task.chunkId(segment));
        progress(files.length, segments.length);
        continue;
      }
      files.push({ name, duration: segment.duration });
      progress(files.length, segments.length);
    }
    if (!files.length) throw new HlsError('noSegments');
    const output = await this.request('remux', { files, format });
    return new Blob([output], { type: HLS_CONFIG.formats[format].mime });
  }
}
