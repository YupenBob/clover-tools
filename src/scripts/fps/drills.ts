import { FPS_CONFIG } from '../../../config/fps.mjs';
import { clamp, radians, ratio } from './math.ts';
import type { DrillAttempt, DrillResult, Settings, Shot, Vec3 } from './types.ts';

export interface DrillObservation {
  time: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  stable: boolean;
}

/** Round rules only. Receives physical observations; never moves the player or computes hits. */
export class GuidedDrill {
  round = 1;
  side = 1;
  phase: 'move' | 'settle' | 'peek' | 'fire' | 'return';
  progress = 0;
  ready = false;
  point: Vec3;
  last: DrillAttempt | null = null;
  private anchorX = FPS_CONFIG.scene.spawnX;
  private location = { x: FPS_CONFIG.scene.spawnX, z: FPS_CONFIG.scene.spawnZ, yaw: 0 };
  private peakSpeed = 0;
  private safeSince: number | null = null;
  private placement: number | null = null;
  private exposedAt: number | null = null;
  private settledAt: number | null = null;
  private exposed = false;
  private score: DrillResult = {
    attempts: 0,
    successes: 0,
    prematureShots: 0,
    movingShots: 0,
    missedShots: 0,
    records: [],
  };
  private firstHits = 0;
  private delaySum = 0;
  private delayCount = 0;
  private placementSum = 0;
  private placementCount = 0;
  private hitTimeSum = 0;
  private hitTimeCount = 0;
  readonly kind: 'strafe' | 'peek';
  private settings: Settings;
  private random: () => number;
  constructor(kind: 'strafe' | 'peek', settings: Settings, random: () => number) {
    this.kind = kind;
    this.settings = settings;
    this.random = random;
    this.phase = kind === 'strafe' ? 'move' : 'peek';
    this.point = this.target();
  }
  get cover() {
    return this.kind === 'peek' ? FPS_CONFIG.drills.peek.cover : null;
  }
  get active() {
    return this.phase !== 'return';
  }
  get gateX() {
    return this.side * FPS_CONFIG.drills[this.kind].gateX;
  }
  get steps() {
    return this.kind === 'strafe'
      ? ['drillMove', 'drillStop', 'drillFire']
      : ['drillPeek', 'drillFire', 'drillReturn'];
  }
  get stepIndex() {
    return this.phase === 'move' || this.phase === 'peek'
      ? 0
      : this.phase === 'return' || (this.kind === 'strafe' && this.ready)
        ? 2
        : 1;
  }
  get returnCue(): { key: 'left' | 'right' | 'forward' | 'back' | null; distance: number } {
    const c = FPS_CONFIG.drills.peek;
    const p = this.location;
    const x =
      clamp(
        p.x,
        FPS_CONFIG.scene.spawnX - c.safeHalfWidth,
        FPS_CONFIG.scene.spawnX + c.safeHalfWidth,
      ) - p.x;
    const z =
      clamp(p.z, FPS_CONFIG.scene.spawnZ - c.laneDepth, FPS_CONFIG.scene.spawnZ + c.laneDepth) -
      p.z;
    const distance = Math.hypot(x, z);
    if (distance <= FPS_CONFIG.simulation.epsilon) return { key: null, distance: 0 };
    const side = x * Math.cos(p.yaw) + z * Math.sin(p.yaw);
    const forward = x * Math.sin(p.yaw) - z * Math.cos(p.yaw);
    return {
      key:
        Math.abs(side) > Math.abs(forward)
          ? side > 0
            ? 'right'
            : 'left'
          : forward > 0
            ? 'forward'
            : 'back',
      distance,
    };
  }
  private target(): Vec3 {
    const c = FPS_CONFIG.drills;
    const x =
      this.kind === 'strafe'
        ? (this.random() * 2 - 1) * c.strafe.targetJitter
        : this.side *
          Math.tan(
            radians(
              c.peek.targetAngleMin +
                this.random() * (c.peek.targetAngleMax - c.peek.targetAngleMin),
            ),
          ) *
          this.settings.distance;
    return {
      x,
      y: FPS_CONFIG.scene.target.headY,
      z: FPS_CONFIG.scene.spawnZ - this.settings.distance,
    };
  }
  inLane(o: DrillObservation) {
    return Math.abs(o.z - FPS_CONFIG.scene.spawnZ) <= FPS_CONFIG.drills[this.kind].laneDepth;
  }
  exposure(visible: boolean, angle: number, time: number) {
    this.exposed = visible;
    if (this.active && visible && this.placement === null) {
      this.placement = angle;
      this.exposedAt = time;
    }
  }
  step(o: DrillObservation) {
    this.location.x = o.x;
    this.location.z = o.z;
    this.location.yaw = o.yaw;
    const c = FPS_CONFIG.drills;
    if (this.phase === 'return') {
      const safe =
        this.inLane(o) &&
        Math.abs(o.x - FPS_CONFIG.scene.spawnX) <= c.peek.safeHalfWidth &&
        !this.exposed &&
        o.stable;
      this.safeSince = safe ? (this.safeSince ?? o.time) : null;
      this.progress = safe ? clamp((o.time - this.safeSince!) / c.peek.resetHold, 0, 1) : 0;
      if (this.safeSince !== null && o.time - this.safeSince >= c.peek.resetHold) this.next(o);
      return;
    }
    this.peakSpeed = Math.max(this.peakSpeed, o.speed);
    const travel = (o.x - this.anchorX) * this.side;
    const required = c[this.kind].minimumTravel;
    this.progress = clamp(
      travel /
        (this.kind === 'strafe'
          ? Math.max(required, (this.gateX - this.anchorX) * this.side)
          : required),
      0,
      1,
    );
    if (this.kind === 'strafe') {
      const crossed = o.x * this.side >= c.strafe.gateX;
      if (
        this.phase === 'move' &&
        crossed &&
        travel >= required &&
        this.peakSpeed >= o.maxSpeed * c.strafe.minimumSpeedRatio &&
        this.inLane(o)
      ) {
        this.phase = 'settle';
        this.last = null;
      }
    } else if (this.phase === 'peek' && travel >= required && this.exposed && this.inLane(o)) {
      this.phase = 'fire';
      this.last = null;
    }
    this.ready = (this.phase === 'settle' || this.phase === 'fire') && o.stable;
    if ((this.phase === 'settle' || this.phase === 'fire') && o.stable) this.settledAt ??= o.time;
    if (!o.stable) this.settledAt = null;
  }
  shot(shot: Shot, o: DrillObservation): boolean {
    const premature =
      this.phase === 'return'
        ? 'return'
        : !this.inLane(o)
          ? 'lane'
          : (o.x - this.anchorX) * this.side < 0
            ? 'side'
            : this.phase === 'move' ||
                this.phase === 'peek' ||
                (this.kind === 'peek' &&
                  (!this.exposed ||
                    (o.x - this.anchorX) * this.side < FPS_CONFIG.drills.peek.minimumTravel))
              ? 'travel'
              : null;
    const reason =
      premature ?? (shot.moving ? 'moving' : shot.region === 'head' ? 'success' : 'miss');
    const record: DrillAttempt = {
      round: this.round,
      side: this.side,
      time: shot.time,
      reason,
      stableDelayMs:
        !premature && !shot.moving && this.settledAt !== null
          ? Math.max(0, shot.time - this.settledAt) * 1000
          : null,
      placementDegrees: premature ? null : this.placement,
    };
    this.last = record;
    if (premature) {
      this.score.prematureShots++;
      return false;
    }
    this.score.attempts++;
    this.score.successes += reason === 'success' ? 1 : 0;
    this.score.movingShots += reason === 'moving' ? 1 : 0;
    this.score.missedShots += reason === 'miss' ? 1 : 0;
    this.firstHits += shot.region === 'head' ? 1 : 0;
    if (shot.region === 'head' && this.exposedAt !== null) {
      this.hitTimeSum += Math.max(0, shot.time - this.exposedAt) * 1000;
      this.hitTimeCount++;
    }
    if (record.stableDelayMs !== null) {
      this.delaySum += record.stableDelayMs;
      this.delayCount++;
    }
    if (record.placementDegrees !== null) {
      this.placementSum += record.placementDegrees;
      this.placementCount++;
    }
    this.score.records.push(record);
    this.score.records = this.score.records.slice(-FPS_CONFIG.drills.recordCapacity);
    if (this.kind === 'peek') {
      this.phase = 'return';
      this.progress = 0;
    } else this.next(o);
    return reason === 'success';
  }
  private next(o: DrillObservation) {
    this.round++;
    this.side *= -1;
    this.anchorX = this.kind === 'strafe' ? o.x : FPS_CONFIG.scene.spawnX;
    this.peakSpeed = 0;
    this.settledAt = this.safeSince = null;
    this.placement = null;
    this.exposedAt = null;
    this.exposed = false;
    this.phase = this.kind === 'strafe' ? 'move' : 'peek';
    this.progress = 0;
    this.ready = false;
    this.point = this.target();
  }
  result() {
    return { ...this.score, records: [...this.score.records] };
  }
  metrics() {
    return {
      firstRate: ratio(this.firstHits, this.score.attempts),
      stableDelayMs: this.delayCount ? this.delaySum / this.delayCount : null,
      placementDegrees: this.placementCount ? this.placementSum / this.placementCount : null,
      meanHitMs: this.hitTimeCount ? this.hitTimeSum / this.hitTimeCount : null,
    };
  }
}

export const DRILLS = {
  strafe: (settings: Settings, random: () => number) => new GuidedDrill('strafe', settings, random),
  peek: (settings: Settings, random: () => number) => new GuidedDrill('peek', settings, random),
};
