import {
  FPS_CONFIG,
  GAME_PROFILES,
  WEAPON_PROFILES,
  TRAINING_MODES,
} from '../../../config/fps.mjs';
import { MODES } from './modes.ts';
import { DRILLS, type GuidedDrill } from './drills.ts';
import { roomWalls } from './layout.ts';
import { SessionStatistics } from './statistics.ts';
import { normalizeSettings, comparisonKey } from './storage.ts';
import {
  angleDifference,
  clamp,
  degrees,
  direction,
  mouseGain,
  radians,
  rayBox,
  raySphere,
  seededRandom,
  verticalFov,
} from './math.ts';
import type {
  GameProfile,
  FeedbackEvent,
  Input,
  Region,
  SessionResult,
  Settings,
  Shot,
  Target,
  TimelineEvent,
  Vec3,
  WeaponProfile,
} from './types.ts';

export class TrainingSession {
  readonly settings: Settings;
  readonly game: GameProfile;
  readonly weapon: WeaponProfile;
  readonly mode;
  readonly drill?: GuidedDrill;
  readonly targets: Target[] = [];
  input: Input = {
    forward: 0,
    side: 0,
    walk: false,
    crouch: false,
    firing: false,
    ads: false,
  };
  player = {
    x: FPS_CONFIG.scene.spawnX,
    z: FPS_CONFIG.scene.spawnZ,
    vx: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
  };
  time = 0;
  ticks = 0;
  ammo: number;
  reloadUntil = 0;
  recoilX = 0;
  recoilY = 0;
  ended = false;
  viewportAspect = 16 / 9;
  private statistics = new SessionStatistics();
  get shots() {
    return this.statistics.impacts;
  }
  get timeline() {
    return this.statistics.timeline;
  }
  private random: () => number;
  private nextShotAt = 0;
  private lastShotAt = -Infinity;
  private burst = 0;
  private stableAt: number | null = null;
  private wasStable = true;
  private wasMoving = false;
  onShot?: (shot: Shot) => void;
  onFeedback?: (event: FeedbackEvent) => void;

  constructor(settings: Partial<Settings> = {}, seed = 1, viewportAspect = 16 / 9) {
    this.viewportAspect = viewportAspect;
    this.settings = normalizeSettings(settings);
    this.game = GAME_PROFILES[
      this.settings.game as keyof typeof GAME_PROFILES
    ] as unknown as GameProfile;
    this.weapon = WEAPON_PROFILES[
      this.settings.weapon as keyof typeof WEAPON_PROFILES
    ] as unknown as WeaponProfile;
    const registered = MODES[this.settings.mode];
    this.mode = {
      ...registered,
      moving: registered.customBots ? this.settings.movingBots : registered.moving,
      headOnly: registered.customBots ? this.settings.headOnlyBots : registered.headOnly,
    };
    this.random = seededRandom(seed);
    if (this.mode.drill) this.drill = DRILLS[this.mode.drill](this.settings, this.random);
    this.ammo = this.weapon.values.magazine;
    const policy = TRAINING_MODES[this.settings.mode as keyof typeof TRAINING_MODES];
    const count = policy.count ?? this.settings.count;
    for (let index = 0; index < count; index++) {
      const target: Target = {
        id: index,
        x: 0,
        z: 0,
        baseX: 0,
        baseZ: 0,
        y: 0,
        health: 0,
        visible: true,
        exposedAt: null,
        firstHitAt: null,
        attempted: false,
        respawnAt: 0,
        generation: 0,
      };
      this.targets.push(target);
      this.spawn(target);
    }
    this.updateExposure();
  }
  get speed() {
    return Math.hypot(this.player.vx, this.player.vz);
  }
  get stable() {
    return this.speed <= this.weapon.values.maxSpeed * this.game.values.stopRatio;
  }
  get eye(): Vec3 {
    return {
      x: this.player.x,
      y: this.input.crouch ? this.game.values.crouchEyeHeight : this.game.values.eyeHeight,
      z: this.player.z,
    };
  }
  get scale() {
    return FPS_CONFIG.difficulties[this.settings.difficulty as keyof typeof FPS_CONFIG.difficulties]
      .targetScale;
  }
  get ray() {
    return direction(this.player.yaw + this.recoilX, this.player.pitch + this.recoilY);
  }
  get obstacles() {
    return this.mode.cover ? [this.drill?.cover ?? FPS_CONFIG.scene.cover] : [];
  }
  private observation() {
    return {
      time: this.time,
      x: this.player.x,
      z: this.player.z,
      yaw: this.player.yaw,
      speed: this.speed,
      maxSpeed: this.weapon.values.maxSpeed,
      stable: this.stable,
    };
  }
  private syncDrill() {
    if (!this.drill) return;
    const target = this.targets[0];
    if (target.generation !== this.drill.round) this.spawn(target);
    target.visible = this.drill.active;
  }
  private obstruction(origin: Vec3, ray: Vec3) {
    const distances = [...this.obstacles, ...roomWalls(this.settings.distance)]
      .map((box) => rayBox(origin, ray, box.min, box.max))
      .filter((d): d is number => d !== null);
    return distances.length ? Math.min(...distances) : null;
  }
  private spawn(target: Target) {
    const point =
      this.drill?.point ??
      this.mode.spawn(
        target.id,
        TRAINING_MODES[this.settings.mode as keyof typeof TRAINING_MODES].count ??
          this.settings.count,
        this.random,
        this.settings,
      );
    target.x = target.baseX = point.x;
    target.z = target.baseZ = point.z;
    target.y = point.y;
    target.health = this.game.values.health;
    target.visible = true;
    target.exposedAt = null;
    target.firstHitAt = null;
    target.attempted = false;
    target.generation++;
  }
  aim(at: number, dx: number, dy: number) {
    this.advanceTo(at);
    if (this.ended) return;
    const gain = mouseGain(this.settings) / (this.input.ads ? this.weapon.values.adsZoom : 1);
    this.player.yaw += dx * gain;
    this.player.pitch = clamp(
      this.player.pitch - dy * gain,
      -radians(FPS_CONFIG.simulation.pitchLimit),
      radians(FPS_CONFIG.simulation.pitchLimit),
    );
    this.updateExposure();
  }
  setInput(at: number, change: Partial<Input>) {
    this.advanceTo(at);
    if (this.ended) return;
    const previous = this.input;
    this.input = { ...previous, ...change };
    if (this.weapon.values.adsZoom <= 1) this.input.ads = false;
    if ((previous.forward || previous.side) && !this.input.forward && !this.input.side)
      this.event('release');
    if (this.input.firing && !previous.firing && this.ammo === 0 && !this.reloadUntil)
      this.onFeedback?.({ kind: 'empty', time: at });
    if (
      this.input.firing &&
      !previous.firing &&
      at + FPS_CONFIG.simulation.epsilon >= this.nextShotAt
    )
      this.fire(at);
  }
  clearInput() {
    this.input = {
      forward: 0,
      side: 0,
      walk: false,
      crouch: false,
      firing: false,
      ads: false,
    };
  }
  reload(at: number) {
    this.advanceTo(at);
    if (this.mode.customBots && this.settings.infiniteAmmo) return;
    if (!this.ended && this.ammo < this.weapon.values.magazine && this.reloadUntil === 0) {
      this.reloadUntil = this.time + this.weapon.values.reload;
      this.nextShotAt = Math.max(this.nextShotAt, this.reloadUntil);
      this.input.firing = false;
      this.onFeedback?.({ kind: 'reload-start', time: this.time });
    }
  }
  advanceTo(seconds: number) {
    if (!Number.isFinite(seconds) || this.ended) return;
    const end = this.mode.timed ? Math.min(seconds, this.settings.duration) : seconds;
    const targetTicks = Math.floor(
      (end + FPS_CONFIG.simulation.epsilon) / FPS_CONFIG.simulation.step,
    );
    while (this.ticks < targetTicks) {
      this.ticks++;
      this.time = this.ticks * FPS_CONFIG.simulation.step;
      this.step(FPS_CONFIG.simulation.step);
    }
    if (this.mode.timed && this.time + FPS_CONFIG.simulation.epsilon >= this.settings.duration)
      this.ended = true;
  }
  private event(kind: TimelineEvent['kind'], at = this.time) {
    this.statistics.event(kind, at, this.speed);
  }
  private step(dt: number) {
    this.move(dt);
    if (!this.stable && this.wasStable) this.stableAt = null;
    if (this.stable && !this.wasStable) {
      this.stableAt = this.time;
      this.event('stable');
    }
    this.wasStable = this.stable;
    const moving = this.speed > FPS_CONFIG.simulation.epsilon;
    if (moving && !this.wasMoving) this.event('move');
    this.wasMoving = moving;
    if (this.reloadUntil > 0 && this.time >= this.reloadUntil) {
      this.ammo = this.weapon.values.magazine;
      this.reloadUntil = 0;
      this.onFeedback?.({ kind: 'reload-end', time: this.time });
    }
    if (
      this.time - this.lastShotAt >
      this.weapon.values.interval * FPS_CONFIG.recoilModel.recoveryDelayRatio
    ) {
      const decay = Math.exp(-dt / this.weapon.values.recovery);
      this.recoilX *= decay;
      this.recoilY *= decay;
      if (this.time - this.lastShotAt > this.weapon.values.recovery) this.burst = 0;
    }
    for (const target of this.targets) {
      if (!this.drill && !target.visible && this.time >= target.respawnAt) this.spawn(target);
      if (target.visible && this.mode.moving) {
        const difficulty =
          FPS_CONFIG.difficulties[this.settings.difficulty as keyof typeof FPS_CONFIG.difficulties];
        const span = this.mode.customBots
          ? FPS_CONFIG.scene.bot.movementSpan
          : FPS_CONFIG.scene.targetSpan;
        const offset =
          Math.sin((this.time * this.settings.speed * difficulty.speedScale) / span + target.id) *
          span;
        const angle = this.mode.customBots
          ? Math.atan2(target.baseX, FPS_CONFIG.scene.spawnZ - target.baseZ)
          : 0;
        target.x = target.baseX + Math.cos(angle) * offset;
        target.z = target.baseZ + Math.sin(angle) * offset;
      }
    }
    this.updateExposure();
    this.drill?.step(this.observation());
    this.syncDrill();
    if (['head', 'ball'].includes(this.intersection(this.ray)?.region || ''))
      this.statistics.cover(dt);
    if (
      this.input.firing &&
      this.time + FPS_CONFIG.simulation.epsilon >= this.nextShotAt &&
      !this.reloadUntil &&
      this.ammo > 0
    )
      this.fire(
        this.nextShotAt > this.lastShotAt ? Math.max(this.lastShotAt, this.nextShotAt) : this.time,
      );
  }
  private move(dt: number) {
    const p = this.player,
      g = this.game.values;
    const length = Math.hypot(this.input.forward, this.input.side);
    const top =
      this.weapon.values.maxSpeed *
      (this.input.crouch ? g.crouchRatio : this.input.walk ? g.walkRatio : 1);
    const speed = this.speed;
    if (speed > 0) {
      const reduced = Math.max(0, speed - Math.max(speed, g.stopSpeed) * g.friction * dt);
      p.vx *= reduced / speed;
      p.vz *= reduced / speed;
    }
    if (length) {
      const side = this.input.side / length,
        forward = this.input.forward / length;
      const x = Math.cos(p.yaw) * side + Math.sin(p.yaw) * forward;
      const z = Math.sin(p.yaw) * side - Math.cos(p.yaw) * forward;
      const current = p.vx * x + p.vz * z;
      // Stance caps speed separately from the acceleration reference. Using the crouch
      // cap for both can make acceleration weaker than the minimum ground friction.
      const reference = top + (this.weapon.values.maxSpeed - top) * g.stanceAccelerationBlend;
      const add = Math.min(Math.max(0, top - current), reference * g.acceleration * dt);
      p.vx += x * add;
      p.vz += z * add;
    }
    const nextX = clamp(
      p.x + p.vx * dt,
      -FPS_CONFIG.scene.playerLimit,
      FPS_CONFIG.scene.playerLimit,
    );
    const nextZ = clamp(
      p.z + p.vz * dt,
      -FPS_CONFIG.scene.playerLimit,
      FPS_CONFIG.scene.playerLimit,
    );
    const r = FPS_CONFIG.scene.bodyRadius;
    const collides = this.obstacles.some(
      (cover) =>
        nextX > cover.min.x - r &&
        nextX < cover.max.x + r &&
        nextZ > cover.min.z - r &&
        nextZ < cover.max.z + r,
    );
    if (!collides) {
      p.x = nextX;
      p.z = nextZ;
    } else {
      p.vx = 0;
      p.vz = 0;
    }
    if (Math.abs(p.x) === FPS_CONFIG.scene.playerLimit) p.vx = 0;
    if (Math.abs(p.z) === FPS_CONFIG.scene.playerLimit) p.vz = 0;
  }
  private head(target: Target): Vec3 {
    return { x: target.x, y: target.y, z: target.z };
  }
  private updateExposure() {
    const vfov = radians(verticalFov(this.settings.fov, this.game.values.referenceAspect));
    const aspect = this.settings.aspect === 'native' ? this.viewportAspect : 4 / 3;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    for (const target of this.targets) {
      if (!target.visible && !this.drill) continue;
      const head = this.head(target),
        eye = this.eye;
      const x = head.x - eye.x,
        y = head.y - eye.y,
        z = head.z - eye.z,
        distance = Math.hypot(x, y, z);
      const yaw = Math.atan2(x, -z),
        pitch = Math.atan2(y, Math.hypot(x, z));
      const ray = { x: x / distance, y: y / distance, z: z / distance };
      const obstruction = this.obstruction(eye, ray);
      const angle = degrees(
        Math.hypot(
          angleDifference(yaw, this.player.yaw + this.recoilX),
          pitch - this.player.pitch - this.recoilY,
        ),
      );
      this.drill?.exposure(obstruction === null || obstruction > distance, angle, this.time);
      if (
        target.visible &&
        target.exposedAt === null &&
        (obstruction === null || obstruction > distance) &&
        Math.abs(angleDifference(yaw, this.player.yaw + this.recoilX)) < hfov / 2 &&
        Math.abs(pitch - this.player.pitch - this.recoilY) < vfov / 2
      ) {
        target.exposedAt = this.time;
        this.statistics.exposure(angle);
      }
    }
  }
  intersection(ray: Vec3): { target: Target; region: Region; distance: number } | null {
    const origin = this.eye,
      t = FPS_CONFIG.scene.target,
      scale = this.scale;
    let closest: { target: Target; region: Region; distance: number } | null = null;
    const cover = this.obstruction(origin, ray);
    for (const target of this.targets) {
      if (!target.visible) continue;
      if (this.mode.ball) {
        const distance = raySphere(
          origin,
          ray,
          this.head(target),
          FPS_CONFIG.scene.ball.radius * scale,
        );
        if (
          distance !== null &&
          (cover === null || distance < cover) &&
          (!closest || distance < closest.distance)
        )
          closest = { target, region: 'ball', distance };
        continue;
      }
      const candidates: [Region, number | null][] = [
        ['head', raySphere(origin, ray, this.head(target), t.headRadius * scale)],
        [
          'body',
          rayBox(
            origin,
            ray,
            {
              x: target.x - (t.torsoWidth * scale) / 2,
              y: t.torsoMin,
              z: target.z - t.depth / 2,
            },
            {
              x: target.x + (t.torsoWidth * scale) / 2,
              y: t.torsoMax,
              z: target.z + t.depth / 2,
            },
          ),
        ],
        [
          'legs',
          rayBox(
            origin,
            ray,
            {
              x: target.x - (t.legWidth * scale) / 2,
              y: t.legMin,
              z: target.z - t.depth / 2,
            },
            {
              x: target.x + (t.legWidth * scale) / 2,
              y: t.legMax,
              z: target.z + t.depth / 2,
            },
          ),
        ],
      ];
      for (const [region, distance] of candidates) {
        if (
          distance !== null &&
          (cover === null || distance < cover) &&
          (!closest || distance < closest.distance)
        )
          closest = { target, region, distance };
      }
    }
    return closest;
  }
  private damage(region: Region, distance: number) {
    if (region === 'ball') return this.game.values.health;
    const w = this.weapon.values;
    if (w.damageRanges) {
      const range =
        w.damageRanges.find((r) => distance >= r.rangeStartMeters && distance < r.rangeEndMeters) ??
        w.damageRanges[w.damageRanges.length - 1];
      return region === 'head'
        ? range.headDamage
        : region === 'body'
          ? range.bodyDamage
          : range.legDamage;
    }
    const base =
      w.damage *
      Math.pow(
        w.rangeModifier,
        distance / (this.game.values.rangeReferenceUnits * this.game.values.unitScale),
      );
    return (
      base *
      (region === 'head'
        ? w.headMultiplier
        : region === 'legs'
          ? this.game.values.legMultiplier
          : 1) *
      (region === 'legs' ? 1 : w.armorRatio / this.game.values.armorDivisor)
    );
  }
  private fire(at: number) {
    if (
      this.ammo <= 0 ||
      this.reloadUntil ||
      this.ended ||
      (this.mode.timed && at >= this.settings.duration - FPS_CONFIG.simulation.epsilon) ||
      at + FPS_CONFIG.simulation.epsilon < this.nextShotAt
    )
      return;
    const w = this.weapon.values;
    if (!(this.mode.customBots && this.settings.infiniteAmmo)) this.ammo--;
    this.lastShotAt = at;
    this.nextShotAt = at + (this.input.ads ? w.adsInterval : w.interval);
    const movingFactor = clamp(
      (this.speed / w.maxSpeed - this.game.values.stopRatio) / (1 - this.game.values.stopRatio),
      0,
      1,
    );
    const spread = this.mode.precision
      ? 0
      : (this.input.ads ? w.adsSpread : this.input.crouch ? w.crouchSpread : w.standSpread) +
        w.spread +
        movingFactor * w.moveSpread +
        this.burst * FPS_CONFIG.recoilModel.fireSpreadPerRound;
    const angle = this.random() * Math.PI * 2,
      radius = Math.sqrt(this.random()) * spread;
    const yaw = this.player.yaw + this.recoilX + Math.cos(angle) * radius;
    const pitch = this.player.pitch + this.recoilY + Math.sin(angle) * radius;
    const ray = direction(yaw, pitch),
      hit = this.intersection(ray),
      origin = this.eye;
    const wall = this.obstruction(origin, ray);
    const length = hit?.distance ?? wall ?? this.settings.distance;
    const nearest = this.targets
      .filter((target) => target.visible)
      .sort(
        (a, b) =>
          Math.abs(angleDifference(Math.atan2(a.x - origin.x, origin.z - a.z), yaw)) -
          Math.abs(angleDifference(Math.atan2(b.x - origin.x, origin.z - b.z), yaw)),
      )[0];
    let errorX = 0,
      errorY = 0;
    if (nearest) {
      errorX = degrees(
        angleDifference(yaw, Math.atan2(nearest.x - origin.x, origin.z - nearest.z)),
      );
      errorY = degrees(
        pitch -
          Math.atan2(nearest.y - origin.y, Math.hypot(nearest.x - origin.x, nearest.z - origin.z)),
      );
    }
    const record: Shot = {
      time: at,
      target: hit?.target.id ?? null,
      region: hit?.region ?? null,
      moving: !this.stable,
      stableDelay: this.stableAt === null ? null : Math.max(0, at - this.stableAt),
      point: {
        x: origin.x + ray.x * length,
        y: origin.y + ray.y * length,
        z: origin.z + ray.z * length,
      },
      errorX,
      errorY,
      recoilX: degrees(this.recoilX),
      recoilY: degrees(this.recoilY),
      damage: hit ? this.damage(hit.region, hit.distance) : 0,
    };
    const policy = TRAINING_MODES[this.settings.mode as keyof typeof TRAINING_MODES];
    this.statistics.shot(
      record,
      nearest,
      hit?.target,
      this.mode.headOnly,
      !this.drill && policy.metrics.includes('stableDelayMs'),
    );
    let completed = false;
    if (this.drill) {
      completed = this.drill.shot(record, this.observation());
      if (completed) this.statistics.complete(at, hit!.target.id);
      this.syncDrill();
    } else if (hit) {
      hit.target.health -= record.damage;
      if (
        hit.region === 'ball' ||
        (this.mode.headOnly && hit.region === 'head') ||
        (!this.mode.headOnly && hit.target.health <= 0)
      ) {
        this.statistics.complete(at, hit.target.id);
        completed = true;
        if ('persistent' in policy && policy.persistent)
          hit.target.health = this.game.values.health;
        else {
          hit.target.visible = false;
          hit.target.respawnAt =
            at +
            (this.mode.ball
              ? FPS_CONFIG.scene.ball.respawnSeconds
              : this.mode.customBots
                ? FPS_CONFIG.scene.botRespawnSeconds
                : FPS_CONFIG.scene.respawnSeconds);
        }
      }
    }
    this.event('shot', at);
    if (this.mode.precision) {
      this.onShot?.(record);
      this.onFeedback?.({ kind: 'shot', time: at, shot: record, completed });
      return;
    }
    this.burst++;
    const vertical =
      w.recoilVertical *
      Math.max(
        FPS_CONFIG.recoilModel.minimumKick,
        1 - this.burst * FPS_CONFIG.recoilModel.verticalRamp,
      );
    const horizontal =
      this.burst >= w.recoilStart
        ? (this.settings.game === 'valorant'
            ? this.random() * 2 - 1
            : Math.sin((this.burst - w.recoilStart) * FPS_CONFIG.recoilModel.horizontalFrequency)) *
          w.recoilHorizontal
        : 0;
    this.recoilY = Math.min(radians(w.recoilCap), this.recoilY + radians(vertical));
    this.recoilX = clamp(
      this.recoilX + radians(horizontal),
      -radians(w.recoilCap / 2),
      radians(w.recoilCap / 2),
    );
    this.onShot?.(record);
    this.onFeedback?.({ kind: 'shot', time: at, shot: record, completed });
  }
  result(timestamp = Date.now()): SessionResult {
    const score = this.statistics.score(this.time);
    return {
      version: FPS_CONFIG.storage.version,
      revision: FPS_CONFIG.revision,
      comparisonKey: comparisonKey(this.settings),
      settings: { ...this.settings },
      timestamp,
      elapsed: this.time,
      completed: this.ended,
      ...score,
      ...(this.drill ? { ...this.drill.metrics(), drill: this.drill.result() } : {}),
      headRate: this.mode.ball ? null : score.headRate,
      impacts: [...this.shots],
      timeline: [...this.timeline],
    };
  }
}
