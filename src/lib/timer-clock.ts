export type CountdownState = "ready" | "running" | "paused" | "finished";

/** Deadlines make missed callbacks harmless: ticks only redraw the clock. */
export class CountdownClock {
  durationMs: number;
  state: CountdownState = "ready";
  private remainingMs: number;
  private deadline: number | null = null;
  constructor(durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs <= 0)
      throw new RangeError("duration");
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
  }
  remaining(now: number): number {
    if (this.deadline !== null) {
      this.remainingMs = Math.max(0, this.deadline - now);
      if (this.remainingMs === 0) {
        this.deadline = null;
        this.state = "finished";
      }
    }
    return this.remainingMs;
  }
  start(now: number): void {
    if (this.state === "running") return;
    if (this.remainingMs <= 0) this.remainingMs = this.durationMs;
    this.deadline = now + this.remainingMs;
    this.state = "running";
  }
  pause(now: number): void {
    if (this.state !== "running") return;
    const left = this.remaining(now);
    this.deadline = null;
    this.state = left === 0 ? "finished" : "paused";
  }
  reset(durationMs = this.durationMs): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0)
      throw new RangeError("duration");
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.deadline = null;
    this.state = "ready";
  }
}

export interface StopwatchLap {
  elapsed: number;
  split: number;
}
export class StopwatchClock {
  private accumulated = 0;
  private startedAt: number | null = null;
  laps: StopwatchLap[] = [];
  get running(): boolean {
    return this.startedAt !== null;
  }
  elapsed(now: number): number {
    return (
      this.accumulated +
      (this.startedAt === null ? 0 : Math.max(0, now - this.startedAt))
    );
  }
  start(now: number): void {
    if (!this.running) this.startedAt = now;
  }
  pause(now: number): void {
    this.accumulated = this.elapsed(now);
    this.startedAt = null;
  }
  lap(now: number): StopwatchLap | null {
    if (!this.running) return null;
    const elapsed = this.elapsed(now);
    const lap = { elapsed, split: elapsed - (this.laps.at(-1)?.elapsed ?? 0) };
    this.laps.push(lap);
    return lap;
  }
  reset(): void {
    this.accumulated = 0;
    this.startedAt = null;
    this.laps = [];
  }
}
