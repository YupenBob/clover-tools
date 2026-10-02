import { FPS_CONFIG, TRAINING_MODES } from '../../../config/fps.mjs';
import type { TrainingMode, Settings } from './types.ts';

const lane = (x: number, settings: Settings, y = FPS_CONFIG.scene.target.headY) => ({
  x,
  y,
  z: FPS_CONFIG.scene.spawnZ - settings.distance,
});
const SPAWNS = {
  random: (_index: number, _count: number, random: () => number, settings: Settings) =>
    lane((random() * 2 - 1) * FPS_CONFIG.scene.targetSpan, settings),
  center: (_index: number, _count: number, _random: () => number, settings: Settings) =>
    lane(0, settings),
  lanes: (index: number, count: number, _random: () => number, settings: Settings) =>
    lane((index - (count - 1) / 2) * FPS_CONFIG.scene.targetSpacing, settings),
  ring: (index: number, count: number, random: () => number, settings: Settings) => {
    const arc =
      (FPS_CONFIG.sectors[settings.sector as keyof typeof FPS_CONFIG.sectors] * Math.PI) / 180;
    const cell = arc / count,
      c = FPS_CONFIG.scene.bot;
    const angle = -arc / 2 + cell * (index + 0.5) + (random() * 2 - 1) * cell * c.angularJitter;
    const radius = settings.distance * (1 + (random() * 2 - 1) * c.radialJitter);
    return {
      x: Math.sin(angle) * radius,
      y: FPS_CONFIG.scene.target.headY,
      z: FPS_CONFIG.scene.spawnZ - Math.cos(angle) * radius,
    };
  },
  balls: (index: number, count: number, random: () => number, settings: Settings) => {
    const c = FPS_CONFIG.scene.ball;
    return lane(
      (index - (count - 1) / 2) * c.spacing + (random() * 2 - 1) * c.jitter,
      settings,
      c.minY + random() * (c.maxY - c.minY),
    );
  },
};
export const MODES: Record<string, TrainingMode> = Object.fromEntries(
  Object.entries(TRAINING_MODES).map(([id, options]) => [
    id,
    {
      id,
      drill: 'drill' in options ? (options.drill as TrainingMode['drill']) : undefined,
      moving: options.moving,
      cover: options.cover,
      headOnly: options.headOnly,
      timed: options.timed,
      ball: 'ball' in options && options.ball,
      precision: 'precision' in options && options.precision,
      customBots: 'customBots' in options && options.customBots,
      spawn: SPAWNS[options.behavior as keyof typeof SPAWNS],
    },
  ]),
);
