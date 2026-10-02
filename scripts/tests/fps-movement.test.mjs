import test from 'node:test';
import assert from 'node:assert/strict';
import { FPS_CONFIG, WEAPON_PROFILES } from '../../config/fps.mjs';
import { TrainingSession } from '../../src/scripts/fps/core.ts';

test('walking and crouching traverse at bounded stance speeds, settle and replay across render rates', () => {
  for (const [weapon, profile] of Object.entries(WEAPON_PROFILES))
    for (const stance of ['walk', 'crouch']) {
      const run = (fps) => {
        const s = new TrainingSession({ game: profile.values.game, weapon, mode: 'free' }, 22);
        const start = s.player.x;
        const cap = profile.values.maxSpeed * s.game.values[`${stance}Ratio`];
        s.setInput(0, { side: 1, [stance]: true });
        for (let frame = 1; frame <= fps; frame++) s.advanceTo(frame / fps);
        assert.ok(s.speed <= cap + FPS_CONFIG.simulation.epsilon, `${weapon}/${stance}: speed cap`);
        assert.ok(s.speed >= cap * 0.9, `${weapon}/${stance}: failed to accelerate`);
        assert.ok(s.player.x - start > cap * 0.5, `${weapon}/${stance}: failed to traverse`);
        const moving = { x: s.player.x, speed: s.speed };
        s.setInput(1, { side: 0 });
        s.advanceTo(1.05);
        assert.ok(s.speed < moving.speed, `${weapon}/${stance}: release must decelerate`);
        s.advanceTo(1.8);
        assert.equal(s.speed, 0);
        assert.equal(s.stable, true);
        return { moving, stoppedX: s.player.x };
      };
      assert.deepEqual(run(30), run(60), `${weapon}/${stance}: 30 vs 60 FPS`);
      assert.deepEqual(run(30), run(144), `${weapon}/${stance}: 30 vs 144 FPS`);
    }
});

test('CS2 crouch movement returns behind cover and completes the settled dwell without position correction', () => {
  for (const weapon of ['ak47', 'm4a1s']) {
    const s = new TrainingSession({ game: 'cs2', weapon, mode: 'peek', distance: 5 }, 22);
    s.setInput(0, { side: 1 });
    s.setInput(0.35, { side: 0 });
    s.advanceTo(1);
    assert.equal(s.drill.phase, 'fire');
    s.setInput(1, { firing: true });
    s.setInput(1, { firing: false });
    assert.equal(s.drill.phase, 'return');
    const start = s.time;
    s.setInput(start, { side: -1, crouch: true });
    while (s.drill.round === 1 && s.time - start < 4)
      s.advanceTo(s.time + FPS_CONFIG.simulation.step);
    assert.equal(s.drill.round, 2, `${weapon}: return must finish within a real traverse`);
    assert.ok(
      Math.abs(s.player.x - FPS_CONFIG.scene.spawnX) <= FPS_CONFIG.drills.peek.safeHalfWidth,
    );
    assert.equal(s.stable, true);
    assert.equal(s.targets[0].exposedAt, null);
    assert.equal(s.result().drill.attempts, 1);
  }
});
