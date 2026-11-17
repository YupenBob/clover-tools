import {
  STORAGE_KEY,
  restore,
  serialize,
  acceptRevision,
  defaults,
  type Snapshot,
} from "../lib/focus-timer";
export type StorageMode =
  | "loading"
  | "writer"
  | "readonly"
  | "temporary"
  | "corrupt"
  | "version"
  | "lockUnavailable";
/** A lock is held until page exit. A protected value is never overwritten. */
export class FocusStorage {
  mode: StorageMode = "loading";
  private releaseLock: (() => void) | null = null;
  private generation = 0;
  private disposed = false;
  private pending = false;
  private protectedValue = false;
  private issue: "corrupt" | "version" | null = null;
  /** Read permission failed: writes are not trusted, but deletion is still attempted. */
  private readFailed = false;
  private highestRevision = 0;
  private listener = (event: StorageEvent) => {
    if ((event.key !== STORAGE_KEY && event.key !== null) || this.disposed)
      return;
    // Ignore queued events whose value has already been superseded or cleared.
    try {
      if (localStorage.getItem(STORAGE_KEY) !== event.newValue) return;
    } catch {
      if (this.mode !== "readonly") this.mode = "temporary";
      this.onMode(this.mode);
      return;
    }
    if (event.newValue === null) {
      this.highestRevision = 0;
      this.onExternal(defaults(), true);
      return;
    }
    const result = restore(event.newValue);
    if (!result.ok) {
      this.protectedValue = true;
      this.issue = result.error;
      if (this.mode !== "readonly") this.mode = result.error;
      this.onMode(this.mode);
      this.onExternal(defaults(), true, result.error);
      return;
    }
    if (acceptRevision(this.highestRevision, result.value.revision)) {
      this.highestRevision = result.value.revision;
      this.onExternal(result.value, false);
    }
  };
  constructor(
    private onMode: (mode: StorageMode) => void,
    private onExternal: (
      s: Snapshot,
      cleared: boolean,
      problem?: "corrupt" | "version",
    ) => void,
  ) {
    window.addEventListener("storage", this.listener);
  }
  private read(): Snapshot {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.readFailed = false;
      if (!raw) return defaults();
      const result = restore(raw);
      if (!result.ok) {
        this.protectedValue = true;
        this.issue = result.error;
        if (this.mode !== "readonly") this.mode = result.error;
        return defaults();
      }
      this.highestRevision = result.value.revision;
      return result.value;
    } catch {
      this.readFailed = true;
      if (this.mode !== "readonly") this.mode = "temporary";
      return defaults();
    }
  }
  async init(): Promise<Snapshot> {
    const value = this.read();
    // Even without read permission, keep trying the writer lock so that an
    // explicit “clear all” can really delete the stored value instead of
    // reporting success while the unreadable data stays behind.
    await this.acquire();
    const current = this.mode === "temporary" ? value : this.read();
    this.onMode(this.mode);
    return current;
  }
  async acquire(): Promise<boolean> {
    if (this.disposed || this.pending || this.releaseLock) return false;
    if (!navigator.locks?.request) {
      this.mode = this.protectedValue ? this.mode : "lockUnavailable";
      this.onMode(this.mode);
      return false;
    }
    this.pending = true;
    const generation = this.generation;
    return new Promise((resolve) => {
      navigator.locks
        .request(
          "clover-focus-timer:writer",
          { ifAvailable: true },
          async (lock) => {
            this.pending = false;
            if (this.disposed || generation !== this.generation) {
              resolve(false);
              return;
            }
            if (!lock) {
              this.mode = "readonly";
              this.onMode(this.mode);
              resolve(false);
              return;
            }
            await new Promise<void>((release) => {
              this.releaseLock = release;
              this.mode = this.issue ?? (this.readFailed ? "temporary" : "writer");
              this.onMode(this.mode);
              resolve(true);
            });
            this.releaseLock = null;
          },
        )
        .catch(() => {
          this.pending = false;
          if (!this.disposed) {
            this.mode = "lockUnavailable";
            this.onMode(this.mode);
          }
          resolve(false);
        });
    });
  }
  async takeover(): Promise<Snapshot | null> {
    if (this.mode !== "readonly") return null;
    if (!(await this.acquire())) return null;
    const value = this.read();
    this.onMode(this.mode);
    return value;
  }
  save(state: Snapshot): boolean {
    if (
      this.mode !== "writer" ||
      !this.releaseLock ||
      this.protectedValue ||
      this.disposed
    )
      return false;
    try {
      const revision = Math.max(this.highestRevision, state.revision) + 1;
      if (!Number.isSafeInteger(revision)) throw new Error("revision-overflow");
      const next = { ...state, revision };
      localStorage.setItem(STORAGE_KEY, serialize(next));
      state.revision = revision;
      this.highestRevision = revision;
      return true;
    } catch {
      this.mode = "temporary";
      this.onMode(this.mode);
      return false;
    }
  }
  clear(): boolean {
    // 持久化删除同样只能由持锁页面执行：没有 Web Locks 或锁申请失败时，
    // 只在内存里清空，由调用方提示“本机数据可能仍存在”。
    if (!this.releaseLock) return false;
    if (this.mode === "readonly" || this.mode === "loading") return false;
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.highestRevision = 0;
      this.protectedValue = false;
      this.issue = null;
      // Probe a read to learn whether the earlier failure has gone away.
      try {
        localStorage.getItem(STORAGE_KEY);
        this.readFailed = false;
        this.mode = "writer";
      } catch {
        this.readFailed = true;
        this.mode = "temporary";
      }
      this.onMode(this.mode);
      return true;
    } catch {
      this.mode = "temporary";
      this.onMode(this.mode);
      return false;
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.releaseLock?.();
    window.removeEventListener("storage", this.listener);
  }
}
