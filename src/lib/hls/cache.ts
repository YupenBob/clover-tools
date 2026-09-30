import { HlsError } from './playlist';
import { HLS_CONFIG } from '../../../config/hls.mjs';

/** Persist chunks rather than keeping an entire video in the page's JavaScript heap. */
export class SegmentCache {
  private database: Promise<IDBDatabase>;
  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(HLS_CONFIG.cache.database, HLS_CONFIG.cache.version);
      request.onupgradeneeded = () => request.result.createObjectStore(HLS_CONFIG.cache.store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new HlsError('cacheError'));
    });
    // The actual failure is presented when a task attempts to use storage.
    this.database.catch(() => {});
  }
  private async request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.database;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(HLS_CONFIG.cache.store, mode);
      const request = action(transaction.objectStore(HLS_CONFIG.cache.store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new HlsError('cacheError'));
    });
  }
  get(id: string): Promise<Blob | undefined> { return this.request('readonly', (store) => store.get(id)); }
  remove(id: string): Promise<undefined> { return this.request('readwrite', (store) => store.delete(id)); }
  put(id: string, bytes: Uint8Array): Promise<IDBValidKey> {
    return this.request('readwrite', (store) => store.put(new Blob([bytes as Uint8Array<ArrayBuffer>]), id));
  }
  async clear(task: string): Promise<void> {
    const db = await this.database;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HLS_CONFIG.cache.store, 'readwrite');
      const request = tx.objectStore(HLS_CONFIG.cache.store).openCursor(IDBKeyRange.bound(task + ':', task + ':\uffff'));
      request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new HlsError('cacheError'));
    });
  }
}
