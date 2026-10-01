import { FPS_CONFIG } from '../../../config/fps.mjs';
import { ratio } from './math.ts';
import type { Shot, Target, TimelineEvent } from './types.ts';

const mean = (sum: number, count: number) => (count > 0 ? sum / count : null);

/** Consumes simulation observations; never moves targets, changes damage or advances time. */
export class SessionStatistics {
  impacts: Shot[] = [];
  timeline: TimelineEvent[] = [];
  private shots = 0;
  private hits = 0;
  private heads = 0;
  private moving = 0;
  private targets = 0;
  private firstAttempts = 0;
  private firstHits = 0;
  private hitTimeSum = 0;
  private hitTimeCount = 0;
  private switchSum = 0;
  private switchCount = 0;
  private stableSum = 0;
  private stableCount = 0;
  private placementSum = 0;
  private placementCount = 0;
  private coveredSeconds = 0;
  private recoilSum = 0;
  private completedAt: number | null = null;
  private completedId: number | null = null;

  exposure(angle: number) {
    this.placementSum += angle;
    this.placementCount++;
  }
  cover(seconds: number) {
    this.coveredSeconds += seconds;
  }
  event(kind: TimelineEvent['kind'], time: number, speed: number) {
    this.timeline.push({ kind, time, speed });
    this.timeline = this.timeline.slice(-FPS_CONFIG.simulation.timelineLimit);
  }
  complete(time: number, id: number) {
    this.targets++;
    this.completedAt = time;
    this.completedId = id;
  }
  shot(
    record: Shot,
    nearest: Target | undefined,
    hit: Target | undefined,
    headOnly: boolean,
    measureStableDelay: boolean,
  ) {
    this.shots++;
    this.hits += record.region ? 1 : 0;
    this.heads += record.region === 'head' ? 1 : 0;
    this.moving += record.moving ? 1 : 0;
    this.recoilSum += Math.hypot(record.recoilX, record.recoilY);
    if (record.stableDelay !== null && measureStableDelay) {
      this.stableSum += record.stableDelay;
      this.stableCount++;
    }
    if (nearest && !nearest.attempted && nearest.exposedAt !== null) {
      this.firstAttempts++;
      this.firstHits +=
        record.target === nearest.id && (!headOnly || record.region === 'head') ? 1 : 0;
      nearest.attempted = true;
    }
    if (hit && hit.firstHitAt === null && (!headOnly || record.region === 'head')) {
      hit.firstHitAt = record.time;
      if (hit.exposedAt !== null) {
        this.hitTimeSum += Math.max(0, record.time - hit.exposedAt);
        this.hitTimeCount++;
      }
      if (this.completedAt !== null && this.completedId !== hit.id) {
        this.switchSum += Math.max(0, record.time - this.completedAt);
        this.switchCount++;
      }
    }
    this.impacts.push(record);
    this.impacts = this.impacts.slice(-FPS_CONFIG.simulation.shotLimit);
  }
  score(elapsed: number) {
    return {
      shots: this.shots,
      hits: this.hits,
      heads: this.heads,
      targets: this.targets,
      accuracy: ratio(this.hits, this.shots),
      headRate: ratio(this.heads, this.hits),
      firstRate: ratio(this.firstHits, this.firstAttempts),
      movingRate: ratio(this.moving, this.shots),
      meanHitMs: mean(this.hitTimeSum * 1000, this.hitTimeCount),
      switchMs: mean(this.switchSum * 1000, this.switchCount),
      stableDelayMs: mean(this.stableSum * 1000, this.stableCount),
      placementDegrees: mean(this.placementSum, this.placementCount),
      recoilDegrees: mean(this.recoilSum, this.shots),
      coverage: ratio(this.coveredSeconds, elapsed),
    };
  }
}
