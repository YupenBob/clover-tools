import type { FocusText } from "../lib/focus-timer-i18n";
type Wake = {
  release(): Promise<void>;
  addEventListener(type: string, fn: () => void): void;
};
export class FocusPlatform {
  private originalTitle = document.title;
  private generation = 0;
  private notifyGeneration = 0;
  private desired = false;
  private wakePending = false;
  private sentinel: Wake | null = null;
  private notified = new Set<string>();
  private permissionPending = false;
  constructor(
    private t: FocusText,
    private reportWake: (s: string) => void,
    private reportNotification: (s: string, pending: boolean) => void,
  ) {
    this.notificationStatus(false);
  }
  notificationStatus(enabled: boolean) {
    this.reportNotification(
      !("Notification" in window)
        ? this.t.notificationUnsupported
        : Notification.permission === "denied"
          ? this.t.notificationDenied
          : enabled && Notification.permission === "granted"
            ? this.t.notificationOn
            : this.t.notificationOff,
      this.permissionPending,
    );
  }
  async requestNotification(): Promise<boolean> {
    if (this.permissionPending || !("Notification" in window)) return false;
    if (Notification.permission === "denied") {
      this.notificationStatus(false);
      return false;
    }
    const generation = this.notifyGeneration;
    this.permissionPending = true;
    this.reportNotification(this.t.notificationPending, true);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (generation !== this.notifyGeneration) return false;
      return permission === "granted";
    } catch {
      return false;
    } finally {
      if (generation === this.notifyGeneration) {
        this.permissionPending = false;
        this.notificationStatus(false);
      }
    }
  }
  notify(id: string, phase: string, enabled: boolean) {
    if (this.notified.has(id)) return;
    this.notified.add(id);
    if (
      !enabled ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    try {
      const n = new Notification(this.t.title, {
        body: `${phase} · ${this.t.finished}`,
        tag: `focus-${id}`,
      });
      setTimeout(() => n.close(), 10000);
    } catch {
      this.notificationStatus(false);
    }
  }
  title(time: string | null, phase: string, paused: boolean) {
    document.title = time
      ? `${paused ? this.t.paused + " · " : ""}${time} · ${phase} - CloverTools`
      : this.originalTitle;
  }
  async wake(
    enabled: boolean,
    running: boolean,
    visible: boolean,
    retry = false,
  ) {
    const desired = enabled && running && visible;
    if (retry && this.wakePending && desired === this.desired) return;
    if (desired === this.desired && !retry) {
      if (!enabled) this.reportWake(this.t.wakeOff);
      return;
    }
    this.desired = desired;
    this.wakePending = false;
    const generation = ++this.generation;
    const old = this.sentinel;
    this.sentinel = null;
    if (old) void old.release().catch(() => {});
    if (!desired) {
      this.reportWake(enabled ? this.t.wakeReleased : this.t.wakeOff);
      return;
    }
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request(type: "screen"): Promise<Wake> };
      }
    ).wakeLock;
    if (!wakeLock?.request) {
      this.reportWake(this.t.wakeUnsupported);
      return;
    }
    this.wakePending = true;
    this.reportWake(this.t.wakePending);
    try {
      const sentinel = await wakeLock.request("screen");
      if (generation !== this.generation || !this.desired) {
        await sentinel.release().catch(() => {});
        return;
      }
      this.wakePending = false;
      this.sentinel = sentinel;
      this.reportWake(this.t.wakeOn);
      sentinel.addEventListener("release", () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
          this.reportWake(this.t.wakeReleased);
        }
      });
    } catch {
      if (generation === this.generation) {
        this.wakePending = false;
        this.reportWake(this.t.wakeFailed);
      }
    }
  }
  reset() {
    this.notifyGeneration++;
    this.permissionPending = false;
    this.desired = false;
    this.wakePending = false;
    this.generation++;
    const lock = this.sentinel;
    this.sentinel = null;
    if (lock) void lock.release().catch(() => {});
    document.title = this.originalTitle;
    this.reportWake(this.t.wakeOff);
    this.notificationStatus(false);
  }
  dispose() {
    this.reset();
  }
}
