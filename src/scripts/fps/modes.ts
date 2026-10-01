import { FPS_CONFIG, TRAINING_MODES } from '../../../config/fps.mjs';
import type { TrainingMode } from './types.ts';

const SPAWNS = {
  random: (_index: number, _count: number, random: () => number) =>
    (random() * 2 - 1) * FPS_CONFIG.scene.targetSpan,
  center: () => 0,
  lanes: (index: number, count: number) =>
    (index - (count - 1) / 2) * FPS_CONFIG.scene.targetSpacing,
};
export const MODES: Record<string, TrainingMode> = Object.fromEntries(
  Object.entries(TRAINING_MODES).map(([id, options]) => [
    id,
    {
      id,
      moving: options.moving,
      cover: options.cover,
      headOnly: options.headOnly,
      timed: options.timed,
      spawn: SPAWNS[options.behavior as keyof typeof SPAWNS],
    },
  ]),
);
