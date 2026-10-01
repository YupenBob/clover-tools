import { FPS_CONFIG, GAME_PROFILES } from '../../../config/fps.mjs';
import type { Settings, Vec3 } from './types.ts';
export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const degrees = (radiansValue: number) => (radiansValue * 180) / Math.PI;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const ratio = (part: number, total: number): number | null =>
  total > 0 ? part / total : null;
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function mouseGain(settings: Settings): number {
  if (settings.calibrationGain > 0) return radians(settings.calibrationGain);
  if (settings.cm360 > 0) return radians((360 * 2.54) / (settings.dpi * settings.cm360));
  return radians(
    GAME_PROFILES[settings.game as keyof typeof GAME_PROFILES].values.yaw * settings.sensitivity,
  );
}
export function cmPerTurn(settings: Settings): number {
  return (360 * 2.54) / (settings.dpi * degrees(mouseGain(settings)));
}
export function calibratedGain(counts: number, distanceCm: number, cm360: number): number {
  if (Math.abs(counts) < FPS_CONFIG.calibration.minCounts || distanceCm <= 0 || cm360 <= 0)
    throw new Error('Insufficient calibration movement');
  const gain = (360 * distanceCm) / (Math.abs(counts) * cm360);
  const range = FPS_CONFIG.controls.calibrationGain;
  if (!Number.isFinite(gain) || gain <= range.min || gain > range.max)
    throw new Error('Calibration outside supported range');
  return gain;
}
export function verticalFov(horizontal: number, referenceAspect: number): number {
  return degrees(2 * Math.atan(Math.tan(radians(horizontal) / 2) / referenceAspect));
}
export function direction(yaw: number, pitch: number): Vec3 {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function raySphere(origin: Vec3, ray: Vec3, center: Vec3, radius: number): number | null {
  const x = origin.x - center.x,
    y = origin.y - center.y,
    z = origin.z - center.z;
  const b = x * ray.x + y * ray.y + z * ray.z;
  const c = x * x + y * y + z * z - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const near = -b - Math.sqrt(discriminant),
    far = -b + Math.sqrt(discriminant);
  return near >= 0 ? near : far >= 0 ? far : null;
}
export function rayBox(origin: Vec3, ray: Vec3, min: Vec3, max: Vec3): number | null {
  let near = 0,
    far = Infinity;
  for (const key of ['x', 'y', 'z'] as const) {
    if (Math.abs(ray[key]) < FPS_CONFIG.simulation.epsilon) {
      if (origin[key] < min[key] || origin[key] > max[key]) return null;
    } else {
      let a = (min[key] - origin[key]) / ray[key],
        b = (max[key] - origin[key]) / ray[key];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a);
      far = Math.min(far, b);
      if (near > far) return null;
    }
  }
  return near;
}
export const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
