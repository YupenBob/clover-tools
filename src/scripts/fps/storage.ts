import {
  FPS_CONFIG,
  GAME_PROFILES,
  WEAPON_PROFILES,
  TRAINING_MODES,
} from '../../../config/fps.mjs';
import type { SessionResult, Settings } from './types.ts';

export function normalizeSettings(raw: Partial<Settings> = {}): Settings {
  const next = { ...FPS_CONFIG.defaults } as Settings;
  if (raw.game && Object.hasOwn(GAME_PROFILES, raw.game)) next.game = raw.game;
  const game = GAME_PROFILES[next.game as keyof typeof GAME_PROFILES];
  next.fov = game.values.defaultFov;
  next.sensitivity = game.values.defaultSensitivity;
  if (
    !Object.hasOwn(WEAPON_PROFILES, next.weapon) ||
    WEAPON_PROFILES[next.weapon as keyof typeof WEAPON_PROFILES].values.game !== next.game
  )
    next.weapon = Object.entries(WEAPON_PROFILES).find(
      ([, weapon]) => weapon.values.game === next.game,
    )![0];
  if (
    raw.weapon &&
    Object.hasOwn(WEAPON_PROFILES, raw.weapon) &&
    WEAPON_PROFILES[raw.weapon as keyof typeof WEAPON_PROFILES].values.game === next.game
  )
    next.weapon = raw.weapon;
  if (raw.mode && Object.hasOwn(TRAINING_MODES, raw.mode)) next.mode = raw.mode;
  for (const [key, limit] of Object.entries(FPS_CONFIG.controls)) {
    const n = raw[key as keyof Settings];
    if (typeof n === 'number' && Number.isFinite(n))
      (next as unknown as Record<string, unknown>)[key] = Math.max(
        limit.min,
        Math.min(limit.max, n),
      );
  }
  if (raw.difficulty && Object.hasOwn(FPS_CONFIG.difficulties, raw.difficulty))
    next.difficulty = raw.difficulty;
  if (raw.quality && Object.hasOwn(FPS_CONFIG.quality, raw.quality)) next.quality = raw.quality;
  if (raw.aspect && FPS_CONFIG.aspects.includes(raw.aspect)) next.aspect = raw.aspect;
  if (raw.sector && Object.hasOwn(FPS_CONFIG.sectors, raw.sector)) next.sector = raw.sector;
  for (const key of ['movingBots', 'infiniteAmmo', 'headOnlyBots'] as const)
    if (typeof raw[key] === 'boolean') next[key] = raw[key];
  next.muted = raw.muted === true;
  return next;
}
export function comparisonKey(settings: Settings): string {
  const { muted: _muted, quality: _quality, ...comparable } = settings;
  return JSON.stringify([FPS_CONFIG.revision, comparable]);
}
export class FpsStorage {
  available = true;
  private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
    this.storage = storage;
    this.available = !!storage;
  }
  private read(key: string): unknown {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      this.available = false;
      return null;
    }
  }
  private write(key: string, value: unknown) {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      this.available = false;
    }
  }
  preferences(): Settings {
    const data = this.read(FPS_CONFIG.storage.preferences) as {
      version?: number;
      settings?: Partial<Settings>;
    } | null;
    return normalizeSettings(
      data?.version === FPS_CONFIG.storage.version &&
        data.settings &&
        typeof data.settings === 'object'
        ? data.settings
        : {},
    );
  }
  savePreferences(settings: Settings) {
    this.write(FPS_CONFIG.storage.preferences, {
      version: FPS_CONFIG.storage.version,
      settings,
    });
  }
  clearPreferences() {
    try {
      this.storage?.removeItem(FPS_CONFIG.storage.preferences);
    } catch {
      this.available = false;
    }
  }
  history(): SessionResult[] {
    const data = this.read(FPS_CONFIG.storage.history);
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => {
        if (
          !item ||
          item.version !== FPS_CONFIG.storage.version ||
          typeof item.revision !== 'string' ||
          !item.revision ||
          typeof item.comparisonKey !== 'string' ||
          !Number.isFinite(item.timestamp) ||
          typeof item.completed !== 'boolean' ||
          !item.settings ||
          !Object.hasOwn(GAME_PROFILES, item.settings.game) ||
          !Object.hasOwn(WEAPON_PROFILES, item.settings.weapon) ||
          !Object.hasOwn(TRAINING_MODES, item.settings.mode)
        )
          return false;
        if (
          !['shots', 'hits', 'heads', 'targets', 'elapsed'].every(
            (key) => Number.isFinite(item[key]) && item[key] >= 0,
          )
        )
          return false;
        if (
          !['accuracy', 'headRate', 'firstRate', 'movingRate', 'coverage'].every(
            (key) =>
              item[key] === null ||
              (Number.isFinite(item[key]) && item[key] >= 0 && item[key] <= 1),
          )
        )
          return false;
        if (
          !['meanHitMs', 'switchMs', 'stableDelayMs', 'placementDegrees', 'recoilDegrees'].every(
            (key) => item[key] === null || (Number.isFinite(item[key]) && item[key] >= 0),
          )
        )
          return false;
        return Array.isArray(item.impacts) && Array.isArray(item.timeline);
      })
      .slice(0, FPS_CONFIG.storage.capacity);
  }
  save(result: SessionResult) {
    // Preserve exact counters; sample chart points to keep 80 records within typical storage quotas.
    const capacity = FPS_CONFIG.storage.impactCapacity;
    const impacts =
      result.impacts.length <= capacity
        ? result.impacts
        : Array.from(
            { length: capacity },
            (_, index) =>
              result.impacts[Math.round((index * (result.impacts.length - 1)) / (capacity - 1))],
          );
    const compact = {
      ...result,
      impacts,
      timeline: result.timeline.slice(-FPS_CONFIG.storage.timelineCapacity),
    };
    this.write(
      FPS_CONFIG.storage.history,
      [compact, ...this.history()].slice(0, FPS_CONFIG.storage.capacity),
    );
  }
  clear() {
    try {
      this.storage?.removeItem(FPS_CONFIG.storage.history);
    } catch {
      this.available = false;
    }
  }
}
