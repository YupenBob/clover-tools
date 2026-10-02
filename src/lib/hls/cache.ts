import { HlsError } from './playlist';
import { HLS_CONFIG } from '../../../config/hls.mjs';
import type { SegmentResult } from './downloader';
import type { Playlist } from './playlist';
import type { SaveFileHandle } from './file';

export interface SavedTask {
  id: string; playlist: Playlist; indices: number[]; source: string; filename: string;
  format: 'original' | 'mp4'; rangeStart: string; rangeEnd: string; handle?: SaveFileHandle;
  options?: { concurrency: number; retries: number; timeout: number; credentials: RequestCredentials };
}

/** Persist chunks rather than keeping an entire video in the page's JavaScript heap. */
export class SegmentCache {
  private database: Promise<IDBDatabase>;
  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(HLS_CONFIG.cache.database, HLS_CONFIG.cache.version);
      request.onupgradeneeded = () => {
        for (const name of [HLS_CONFIG.cache.store, HLS_CONFIG.cache.tasks])
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onblocked = () => reject(new HlsError('cacheBlocked'));
      request.onerror = () => reject(new HlsError('cacheError'));
    });
    // The actual failure is presented when a task attempts to use storage.
    this.database.catch(() => {});
  }
  private async request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, name = HLS_CONFIG.cache.store): Promise<T> {
    const db = await this.database;
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(name, mode);
      const request = action(transaction.objectStore(name));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new HlsError('cacheError'));
    }).catch(() => { throw new HlsError('cacheError'); });
  }
  get(id: string): Promise<Blob | undefined> { return this.request('readonly', (store) => store.get(id)); }
  getState(id: string): Promise<SegmentResult | undefined> { return this.request('readonly', (store) => store.get(id), HLS_CONFIG.cache.tasks); }
  putState(id: string, result: SegmentResult): Promise<IDBValidKey> { return this.request('readwrite', (store) => store.put({ ...result }, id), HLS_CONFIG.cache.tasks); }
  active(): Promise<SavedTask | undefined> { return this.request('readonly', (store) => store.get(HLS_CONFIG.cache.activeTask), HLS_CONFIG.cache.tasks); }
  remember(task: SavedTask): Promise<IDBValidKey> { return this.request('readwrite', (store) => store.put(task, HLS_CONFIG.cache.activeTask), HLS_CONFIG.cache.tasks); }
  remove(id: string): Promise<undefined> { return this.request('readwrite', (store) => store.delete(id)); }
  put(id: string, bytes: Uint8Array): Promise<IDBValidKey> {
    return this.request('readwrite', (store) => store.put(new Blob([bytes as Uint8Array<ArrayBuffer>]), id));
  }
  async clear(task: string): Promise<void> {
    const db = await this.database;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([HLS_CONFIG.cache.store, HLS_CONFIG.cache.tasks], 'readwrite');
      for (const name of [HLS_CONFIG.cache.store, HLS_CONFIG.cache.tasks]) {
        const request = tx.objectStore(name).openCursor(IDBKeyRange.bound(task + ':', task + ':\uffff'));
        request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
      }
      const active = tx.objectStore(HLS_CONFIG.cache.tasks).get(HLS_CONFIG.cache.activeTask);
      active.onsuccess = () => { if (active.result?.id === task) tx.objectStore(HLS_CONFIG.cache.tasks).delete(HLS_CONFIG.cache.activeTask); };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new HlsError('cacheError'));
    });
  }
}
