import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FPS_CONFIG } from '../../config/fps.mjs';
import { TrainingSession } from '../../src/scripts/fps/core.ts';
import { direction } from '../../src/scripts/fps/math.ts';
import { FpsStorage } from '../../src/scripts/fps/storage.ts';
import { RangeModels } from '../../src/scripts/fps/range-models.ts';
import { DrillScene } from '../../src/scripts/fps/drill-scene.ts';

function tap(s, at = s.time) {
  const target = s.targets[0];
  s.player.yaw = Math.atan2(target.x - s.eye.x, s.eye.z - target.z) - s.recoilX;
  s.player.pitch =
    Math.atan2(target.y - s.eye.y, Math.hypot(target.x - s.eye.x, target.z - s.eye.z)) - s.recoilY;
  s.setInput(at, { firing: true });
  s.setInput(at, { firing: false });
}
function traverse(s, side, seconds = 0.35) {
  const start = s.time;
  s.player.yaw = 0;
  s.setInput(start, { side });
  s.advanceTo(start + seconds);
  s.setInput(s.time, { side: 0 });
}
test('standing taps cannot complete strafe rounds; eligible first shots alternate gates', () => {
  const s = new TrainingSession({ mode: 'strafe', distance: 5, difficulty: 'easy' }, 22);
  tap(s);
  assert.equal(s.drill.round, 1);
  assert.equal(s.result().targets, 0);
  assert.equal(s.result().drill.attempts, 0);
  assert.equal(s.result().drill.prematureShots, 1);
  traverse(s, 1);
  assert.equal(s.drill.phase, 'settle');
  s.advanceTo(s.time + 0.6);
  tap(s);
  assert.equal(s.drill.round, 2);
  assert.equal(s.drill.side, -1);
  assert.equal(s.result().drill.successes, 1);
  const firstDelay = s.result().stableDelayMs;
  assert.ok(firstDelay !== null && firstDelay >= 0);
  tap(s, s.time + 0.5);
  assert.equal(s.drill.round, 2);
  assert.equal(s.result().stableDelayMs, firstDelay);
  assert.equal(s.result().drill.attempts, 1);
});
test('moving first shots fail a completed traverse and do not count as settled successes', () => {
  const s = new TrainingSession({ mode: 'strafe', distance: 5 }, 22);
  traverse(s, 1);
  assert.equal(s.stable, false);
  tap(s);
  const r = s.result();
  assert.equal(r.drill.attempts, 1);
  assert.equal(r.drill.movingShots, 1);
  assert.equal(r.drill.successes, 0);
  assert.equal(r.stableDelayMs, null);
  assert.equal(s.drill.round, 2);
});
test('peek requires return behind cover and settled dwell before switching sides and measuring fresh exposure', () => {
  const s = new TrainingSession({ mode: 'peek', distance: 5, difficulty: 'easy' }, 22);
  assert.equal(s.targets[0].exposedAt, null);
  tap(s);
  assert.equal(s.result().drill.prematureShots, 1);
  traverse(s, 1);
  s.advanceTo(s.time + 0.6);
  assert.equal(s.drill.phase, 'fire');
  tap(s);
  assert.equal(s.drill.phase, 'return');
  assert.equal(s.targets[0].visible, false);
  assert.equal(s.result().drill.successes, 1);
  s.advanceTo(s.time + 1);
  assert.equal(s.drill.round, 1, 'camping outside cover must not respawn the target');
  tap(s);
  assert.equal(s.result().drill.prematureShots, 2);
  // Use real reverse input until the centre; settle in the safe zone.
  s.player.yaw = 0;
  s.setInput(s.time, { side: -1 });
  while (s.player.x > 0.18) s.advanceTo(s.time + FPS_CONFIG.simulation.step);
  s.setInput(s.time, { side: 1 });
  while (s.player.vx < 0) s.advanceTo(s.time + FPS_CONFIG.simulation.step);
  s.setInput(s.time, { side: 0 });
  s.advanceTo(s.time + 0.8);
  assert.equal(s.drill.round, 2);
  assert.equal(s.drill.side, -1);
  assert.equal(s.drill.phase, 'peek');
  assert.equal(s.targets[0].visible, true);
  assert.equal(s.targets[0].exposedAt, null);
  assert.ok(s.targets[0].x < 0);
});
test('wrong direction and walking around the cover do not create eligible peek rounds', () => {
  for (const input of [{ side: -1 }, { side: 1, forward: -1 }]) {
    const s = new TrainingSession({ mode: 'peek', distance: 5 }, 22);
    s.setInput(0, input);
    s.advanceTo(0.8);
    s.setInput(s.time, { side: 0, forward: 0 });
    s.advanceTo(1.5);
    tap(s);
    assert.equal(s.result().drill.attempts, 0);
    assert.equal(s.drill.round, 1);
  }
  const withdrawn = new TrainingSession({ mode: 'peek', distance: 5 }, 22);
  traverse(withdrawn, 1);
  withdrawn.advanceTo(withdrawn.time + 0.8);
  assert.equal(withdrawn.drill.phase, 'fire');
  traverse(withdrawn, -1);
  withdrawn.advanceTo(withdrawn.time + 0.8);
  tap(withdrawn);
  assert.equal(withdrawn.result().drill.attempts, 0, 'a concealed shot after returning early is ineligible');
  assert.equal(withdrawn.drill.last.reason, 'travel');
});
test('guided drills replay identically at 30/60/144 render FPS, including first-shot reports', () => {
  for (const mode of ['strafe', 'peek']) {
    const run = (fps) => {
      const s = new TrainingSession({ mode, distance: 5, difficulty: 'easy' }, 22);
      const events = [
        [0, { side: 1 }],
        [0.35, { side: 0 }],
        [1, 'tap'],
        [1.4, { side: -1 }],
        [1.61, { side: 0 }],
        [3, 'tap'],
      ];
      let i = 0;
      for (let frame = 0; frame <= fps * 4; frame++) {
        const at = frame / fps;
        while (i < events.length && events[i][0] <= at) {
          const [t, input] = events[i++];
          s.advanceTo(t);
          if (input === 'tap') tap(s, t);
          else {
            s.player.yaw = 0;
            s.setInput(t, input);
          }
        }
        s.advanceTo(at);
      }
      return s.result(1);
    };
    assert.deepEqual(run(30), run(60));
    assert.deepEqual(run(30), run(144));
  }
});
test('rendered covers and low drill cues agree with head occlusion across distances, sizes and sides', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => null }) };
  try {
    for (const mode of ['strafe', 'peek'])
      for (const distance of [5, 40])
        for (const difficulty of Object.keys(FPS_CONFIG.difficulties)) {
          const s = new TrainingSession({ mode, distance, difficulty }, 22);
          const models = new RangeModels(FPS_CONFIG.quality.performance.sphereSegments);
          const scene = new THREE.Scene();
          scene.add(models.environment(s), new DrillScene(s, models).group);
          const t = s.targets[0],
            target = models.target(s);
          target.position.set(t.x, 0, t.z);
          scene.add(target);
          scene.updateMatrixWorld(true);
          for (const x of [0, 1.3, -1.3]) {
            s.player.x = x;
            const ray = direction(Math.atan2(t.x - x, s.eye.z - t.z), 0);
            const visual = new THREE.Raycaster(
              new THREE.Vector3(x, s.eye.y, s.eye.z),
              new THREE.Vector3(ray.x, ray.y, ray.z),
            ).intersectObjects(scene.children, true)[0];
            const physical = s.intersection(ray);
            assert.equal(
              !!physical,
              target.children.includes(visual.object),
              `${mode}/${distance}/${difficulty}/${x}`,
            );
          }
        }
  } finally {
    globalThis.document = originalDocument;
  }
});
test('guided results preserve old history and reject malformed round records; zero-shot metrics stay null', () => {
  const s = new TrainingSession({ mode: 'peek' });
  const r = s.result();
  assert.equal(r.firstRate, null);
  assert.equal(r.stableDelayMs, null);
  assert.equal(r.placementDegrees, null);
  const old = new TrainingSession({ mode: 'micro' }).result();
  const data = new Map();
  const storage = new FpsStorage({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  });
  storage.save(old);
  storage.save(r);
  assert.equal(storage.history().length, 2);
  r.drill.records.push({
    round: 1,
    time: 0,
    side: 1,
    reason: 'fake',
    stableDelayMs: null,
    placementDegrees: null,
  });
  data.set(FPS_CONFIG.storage.history, JSON.stringify([r, old]));
  assert.equal(storage.history().length, 1);
});
