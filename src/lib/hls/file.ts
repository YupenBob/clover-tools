import { HlsError } from './playlist.ts';
import { HLS_CONFIG } from '../../../config/hls.mjs';

export type MediaFormat = 'mp4' | 'ts' | 'aac';
export type StreamFormat = 'original' | 'mp4';
export interface FileWriter {
  write(data: Uint8Array | { type: 'write'; position: number; data: Uint8Array }): Promise<void>;
  close(): Promise<void>; abort(): Promise<void>;
}
export interface SaveFileHandle {
  name: string; kind: 'file';
  createWritable(): Promise<FileWriter>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
type PickerWindow = Window & { showSaveFilePicker?: (options: unknown) => Promise<SaveFileHandle> };
export function supportsFileSaving(): boolean { return window.isSecureContext && typeof (window as PickerWindow).showSaveFilePicker === 'function'; }

/** Called directly from the click handler, before any asynchronous preparation. */
export async function chooseFile(name: string, format: MediaFormat, previous?: SaveFileHandle): Promise<SaveFileHandle> {
  if (!supportsFileSaving()) throw new HlsError('streamUnsupported');
  try {
    if (previous) {
      if (await previous.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new HlsError('filePermissionError');
      return previous;
    }
    const type = HLS_CONFIG.formats[format];
    return await (window as PickerWindow).showSaveFilePicker!({ suggestedName: name,
      types: [{ description: format.toUpperCase(), accept: { [type.mime]: ['.' + type.extension] } }] });
  } catch (error) {
    if (error instanceof HlsError) throw error;
    throw new HlsError((error as Error).name === 'AbortError' ? 'fileCancelled' : 'filePermissionError');
  }
}

export interface MediaSink {
  readonly bytes: number;
  write(data: Uint8Array): Promise<void>;
  writeAt(position: number, data: Uint8Array): Promise<void>;
  close(): Promise<void>; abort(): Promise<void>;
}
export class DiskSink implements MediaSink {
  bytes = 0;
  private closed = false;
  private writer: FileWriter;
  constructor(writer: FileWriter) { this.writer = writer; }
  static async open(handle: SaveFileHandle): Promise<DiskSink> {
    try { return new DiskSink(await handle.createWritable()); }
    catch { throw new HlsError('filePermissionError'); }
  }
  private async operation(action: () => Promise<void>): Promise<void> {
    if (this.closed) throw new HlsError('fileWriteError');
    try { await action(); } catch { throw new HlsError('fileWriteError'); }
  }
  async write(data: Uint8Array): Promise<void> { await this.operation(() => this.writer.write(data)); this.bytes += data.length; }
  async writeAt(position: number, data: Uint8Array): Promise<void> {
    await this.operation(() => this.writer.write({ type: 'write', position, data }));
  }
  async close(): Promise<void> { await this.operation(() => this.writer.close()); this.closed = true; }
  async abort(): Promise<void> { if (!this.closed) { this.closed = true; try { await this.writer.abort(); } catch { /* A failed native stream may already be aborted. */ } } }
}
