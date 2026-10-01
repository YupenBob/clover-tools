import { FPS_CONFIG } from '../../../config/fps.mjs';

/** Cosmetic pose is a function of simulation time, with no accumulated render-frame state. */
export function weaponPose(
  time: number,
  shotAt: number,
  reloadAt: number,
  reloadUntil: number,
  speed: number,
  ads: boolean,
  motion: boolean,
) {
  const c = FPS_CONFIG.scene.gun;
  const age = Math.max(0, time - shotAt);
  const kick = motion && Number.isFinite(shotAt) ? Math.exp(-age * c.kickDecay) : 0;
  const progress =
    reloadUntil > time && reloadUntil > reloadAt
      ? Math.max(0, Math.min(1, (time - reloadAt) / (reloadUntil - reloadAt)))
      : 0;
  const dip = motion ? Math.sin(progress * Math.PI) : 0;
  const sway = motion && !ads ? Math.min(1, speed) * c.swayDistance : 0;
  const offset = ads ? c.adsOffset : c.offset;
  return {
    x: offset.x + Math.sin(time * c.swayFrequency) * sway,
    y: offset.y + Math.cos(time * c.swayFrequency * 2) * sway - dip * c.reloadDip,
    z: offset.z + kick * c.kickDistance,
    pitch: kick * c.kickAngle,
    roll: dip * c.reloadAngle,
    magazineDrop: dip * c.magazine.y,
    flash: Number.isFinite(shotAt) && age < c.flashSeconds,
  };
}
