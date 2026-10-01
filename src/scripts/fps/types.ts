export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type Region = 'head' | 'body' | 'legs' | 'ball';
export interface Evidence {
  unit: string;
  status: 'source' | 'measured' | 'approximate';
  source: string;
  field: string;
  version: string;
}
export interface GameProfile {
  id: string;
  name: string;
  values: Record<string, number>;
  evidence: Record<string, Evidence>;
}
export interface WeaponStats {
  game: string;
  interval: number;
  magazine: number;
  reload: number;
  damage: number;
  headMultiplier: number;
  armorRatio: number;
  rangeModifier: number;
  maxSpeed: number;
  spread: number;
  standSpread: number;
  crouchSpread: number;
  moveSpread: number;
  recovery: number;
  recoilVertical: number;
  recoilHorizontal: number;
  recoilStart: number;
  recoilCap: number;
  adsZoom: number;
  adsInterval: number;
  adsSpread: number;
  damageRanges?: {
    rangeStartMeters: number;
    rangeEndMeters: number;
    headDamage: number;
    bodyDamage: number;
    legDamage: number;
  }[];
}
export interface WeaponProfile {
  id: string;
  name: string;
  values: WeaponStats;
  evidence: Record<string, Evidence>;
}
export interface Settings {
  game: string;
  weapon: string;
  mode: string;
  duration: number;
  distance: number;
  count: number;
  speed: number;
  difficulty: string;
  dpi: number;
  sensitivity: number;
  fov: number;
  aspect: string;
  cm360: number;
  calibrationGain: number;
  turnMultiplier: number;
  sector: string;
  movingBots: boolean;
  infiniteAmmo: boolean;
  headOnlyBots: boolean;
  muted: boolean;
  quality: string;
}
export interface Input {
  forward: number;
  side: number;
  walk: boolean;
  crouch: boolean;
  firing: boolean;
  ads: boolean;
}
export interface Target {
  id: number;
  x: number;
  z: number;
  baseX: number;
  baseZ: number;
  y: number;
  health: number;
  visible: boolean;
  exposedAt: number | null;
  firstHitAt: number | null;
  attempted: boolean;
  respawnAt: number;
  generation: number;
}
export interface Shot {
  time: number;
  target: number | null;
  region: Region | null;
  moving: boolean;
  stableDelay: number | null;
  point: Vec3;
  errorX: number;
  errorY: number;
  recoilX: number;
  recoilY: number;
  damage: number;
}
export interface TimelineEvent {
  time: number;
  kind: 'move' | 'release' | 'stable' | 'shot';
  speed: number;
}
export interface TrainingMode {
  id: string;
  moving: boolean;
  cover: boolean;
  headOnly: boolean;
  timed: boolean;
  ball: boolean;
  precision: boolean;
  customBots: boolean;
  spawn(index: number, count: number, random: () => number, settings: Settings): Vec3;
}
export interface SessionResult {
  version: number;
  revision: string;
  comparisonKey: string;
  settings: Settings;
  timestamp: number;
  elapsed: number;
  completed: boolean;
  shots: number;
  hits: number;
  heads: number;
  targets: number;
  accuracy: number | null;
  headRate: number | null;
  firstRate: number | null;
  movingRate: number | null;
  meanHitMs: number | null;
  switchMs: number | null;
  stableDelayMs: number | null;
  placementDegrees: number | null;
  recoilDegrees: number | null;
  coverage: number | null;
  impacts: Shot[];
  timeline: TimelineEvent[];
}
