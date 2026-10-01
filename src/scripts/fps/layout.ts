import { FPS_CONFIG } from '../../../config/fps.mjs';
import type { Vec3 } from './types.ts';

export interface Box {
  min: Vec3;
  max: Vec3;
}
/** Shared room boundaries keep rendered walls and bullet impacts in the same coordinate system. */
export function roomWalls(distance = FPS_CONFIG.controls.distance.max): Box[] {
  const c = FPS_CONFIG.scene,
    size = Math.max(c.roomMinimumHalf, distance + c.roomMargin);
  const halfX = Math.min(c.width / 2, size),
    halfZ = Math.min(c.depth / 2, size);
  const minZ = c.spawnZ - halfZ,
    maxZ = c.spawnZ + halfZ,
    t = c.architecture.wallThickness;
  return [
    {
      min: { x: -halfX, y: 0, z: minZ - t },
      max: { x: halfX, y: c.height, z: minZ },
    },
    {
      min: { x: -halfX, y: 0, z: maxZ },
      max: { x: halfX, y: c.height, z: maxZ + t },
    },
    {
      min: { x: -halfX - t, y: 0, z: minZ },
      max: { x: -halfX, y: c.height, z: maxZ },
    },
    {
      min: { x: halfX, y: 0, z: minZ },
      max: { x: halfX + t, y: c.height, z: maxZ },
    },
  ];
}
