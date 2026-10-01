import test from 'node:test';
import assert from 'node:assert/strict';
import { FPS_CONFIG, GAME_PROFILES, WEAPON_PROFILES, TRAINING_MODES } from '../../config/fps.mjs';
import { FPS_DATA } from '../../config/fps-data.mjs';
import { TrainingSession } from '../../src/scripts/fps/core.ts';
import {
  calibratedGain,
  cmPerTurn,
  direction,
  mouseGain,
  rayBox,
  raySphere,
  radians,
  verticalFov,
} from '../../src/scripts/fps/math.ts';
import { comparisonKey, FpsStorage, normalizeSettings } from '../../src/scripts/fps/storage.ts';
import { fpsText } from '../../src/lib/fps-i18n.ts';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
test('mouse angular gain, physical calibration and reference FOV have reversible units', () => {
  const settings = normalizeSettings({ sensitivity: 1, dpi: 800 });
  near(mouseGain(settings), radians(FPS_DATA.cs2.variables.m_yaw));
  near(cmPerTurn(settings), (360 * 2.54) / (800 * 0.022));
  settings.cm360 = 40;
  near(cmPerTurn(settings), 40);
  near(calibratedGain(2000, 10, 40), 0.045);
  settings.calibrationGain = 0.045;
  near(mouseGain(settings), radians(0.045));
  assert.throws(() => calibratedGain(0, 10, 40));
  assert.throws(() => calibratedGain(20, 10, 0.1));
  near(verticalFov(90, 4 / 3), 73.73979529168804);
});
test('configuration normalizes malformed preferences and incompatible rifles without prototype access', () => {
  const defaultWeapon = FPS_CONFIG.defaults.weapon;
  try {
    FPS_CONFIG.defaults.weapon = 'm4a1s';
    assert.equal(normalizeSettings().weapon, 'm4a1s');
  } finally {
    FPS_CONFIG.defaults.weapon = defaultWeapon;
  }
  const s = normalizeSettings({
    game: '__proto__',
    weapon: '__proto__',
    mode: 'constructor',
    duration: Infinity,
    distance: -100,
    count: 999,
    difficulty: '__proto__',
    quality: '__proto__',
  });
  assert.equal(s.game, 'cs2');
  assert.equal(s.mode, 'micro');
  assert.equal(s.distance, FPS_CONFIG.controls.distance.min);
  assert.equal(s.count, FPS_CONFIG.controls.count.max);
  const val = normalizeSettings({ game: 'valorant', weapon: 'ak47' });
  assert.equal(WEAPON_PROFILES[val.weapon].values.game, 'valorant');
  assert.equal(val.fov, GAME_PROFILES.valorant.values.defaultFov);
});
test('all gameplay parameters declare units, source/version and fidelity without invented measurements', () => {
  for (const profile of [...Object.values(GAME_PROFILES), ...Object.values(WEAPON_PROFILES)]) {
    assert.deepEqual(Object.keys(profile.values), Object.keys(profile.evidence));
    for (const evidence of Object.values(profile.evidence)) {
      assert.ok(evidence.unit && evidence.source && evidence.version);
      assert.notEqual(evidence.status, 'measured');
    }
  }
  assert.equal(WEAPON_PROFILES.ak47.values.magazine, FPS_DATA.cs2.weapons.ak47.m_iMaxClip1);
  near(WEAPON_PROFILES.vandal.values.interval, 1 / FPS_DATA.valorant.weapons.vandal.fireRate);
  assert.match(FPS_DATA.cs2.sha256.weapons, /^[a-f0-9]{64}$/);
  for (const lang of ['zh', 'tw', 'en', 'ko', 'ja'])
    for (const value of Object.values(fpsText(lang)))
      assert.ok(typeof value === 'string' && value.trim());
});
test('ray primitives detect boundaries, parallel rays and distinct head/body/leg regions', () => {
  near(raySphere({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 1), 2);
  assert.equal(
    raySphere({ x: 2, y: 0, z: 3 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 1),
    null,
  );
  assert.equal(
    rayBox(
      { x: 2, y: 0, z: 3 },
      { x: 0, y: 0, z: -1 },
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
    ),
    null,
  );
  const s = new TrainingSession({ mode: 'spray' });
  assert.equal(s.intersection(direction(0, 0)).region, 'head');
  assert.equal(
    s.intersection(direction(0, Math.atan2(1.1 - s.eye.y, s.settings.distance))).region,
    'body',
  );
  assert.equal(
    s.intersection(direction(0, Math.atan2(0.35 - s.eye.y, s.settings.distance))).region,
    'legs',
  );
  s.advanceTo(1);
  near(s.result().coverage, 1);
  s.aim(1, 10000, 0);
  s.advanceTo(2);
  near(s.result().coverage, 0.5);
});
test('cover blocks targets before exposure; lanes are centered and cover collision is enforced', () => {
  const s = new TrainingSession({ mode: 'peek' });
  assert.equal(s.targets.length, 2);
  near(s.targets[0].baseX, -s.targets[1].baseX);
  assert.ok(s.targets.every((target) => target.exposedAt === null));
  const target = s.targets[0];
  assert.equal(s.intersection(direction(Math.atan2(target.x, s.eye.z - target.z), 0)), null);
  s.setInput(0, { forward: 1 });
  s.advanceTo(1);
  assert.ok(s.player.z >= FPS_CONFIG.scene.cover.max.z + FPS_CONFIG.scene.bodyRadius);
  s.setInput(1, { side: 1, forward: 0 });
  s.advanceTo(1.6);
  assert.ok(s.targets.some((target) => target.exposedAt !== null));
});
test('release and reverse movement decelerate physically; diagonal motion stays bounded', () => {
  const release = new TrainingSession(),
    reverse = new TrainingSession();
  for (const s of [release, reverse]) {
    s.setInput(0, { side: 1 });
    s.advanceTo(0.5);
    assert.equal(s.stable, false);
  }
  release.setInput(0.5, { side: 0 });
  reverse.setInput(0.5, { side: -1 });
  assert.equal(reverse.stable, false); // Counter input is not an instant stop.
  release.advanceTo(0.57);
  reverse.advanceTo(0.57);
  assert.ok(reverse.speed < release.speed);
  release.advanceTo(1);
  assert.equal(release.stable, true);
  const diagonal = new TrainingSession();
  diagonal.setInput(0, { side: 1, forward: 1 });
  diagonal.advanceTo(0.5);
  assert.ok(diagonal.speed <= diagonal.weapon.values.maxSpeed + 1e-8);
});
test('ammo, shot intervals, reload blocking and recovery obey the weapon clock', () => {
  const s = new TrainingSession({ mode: 'spray', weapon: 'm4a1s' }, 3);
  s.setInput(0, { firing: true });
  s.advanceTo(3);
  assert.equal(s.result().shots, s.weapon.values.magazine);
  assert.equal(s.ammo, 0);
  s.reload(3);
  const until = s.reloadUntil;
  s.setInput(3.1, { firing: true });
  s.advanceTo(until - 0.01);
  assert.equal(s.result().shots, s.weapon.values.magazine);
  s.advanceTo(until + 0.25);
  const post = s.shots.filter((shot) => shot.time >= until);
  assert.equal(post.length, 3);
  assert.ok(post.every((shot) => shot.time >= until));
  for (let i = 1; i < post.length; i++)
    near(post[i].time - post[i - 1].time, s.weapon.values.interval);
  s.setInput(until + 0.3, { firing: false });
  const before = s.recoilY;
  s.advanceTo(until + 2);
  assert.ok(s.recoilY < before * 0.1);
});
test('first-hit timing measures the first hit rather than the final damage needed to complete a target', () => {
  const s = new TrainingSession({ mode: 'spray', weapon: 'm4a1s' }, 1);
  s.setInput(0.2, { firing: true });
  s.setInput(0.201, { firing: false });
  assert.equal(s.result().hits, 1);
  assert.equal(s.result().targets, 0);
  near(s.result().meanHitMs, 200);
});
test('continuous recoil and tracking targets remain visible after lethal damage', () => {
  for (const mode of ['spray', 'track']) {
    const s = new TrainingSession({ mode, game: 'valorant', weapon: 'vandal' }, 1);
    s.setInput(0, { firing: true });
    s.setInput(0.001, { firing: false });
    assert.equal(s.result().targets, 1);
    assert.equal(s.targets[0].visible, true);
    assert.equal(s.targets[0].health, s.game.values.health);
  }
});
test('all drills complete at their active-time boundary; free warm-up ends manually', () => {
  for (const mode of Object.keys(TRAINING_MODES)) {
    const s = new TrainingSession({ mode, duration: 15 });
    s.advanceTo(15);
    assert.equal(s.ended, TRAINING_MODES[mode].timed);
    if (mode === 'switch') assert.equal(s.targets.length, s.settings.count);
  }
  const zero = new TrainingSession({ duration: 15 });
  zero.advanceTo(15);
  const r = zero.result();
  assert.equal(r.accuracy, null);
  assert.equal(r.headRate, null);
  assert.equal(r.firstRate, null);
  assert.equal(r.meanHitMs, null);
});
test('30/60/144 FPS produce identical movement, shooting, coverage and reports from timestamped inputs', () => {
  function replay(fps) {
    const s = new TrainingSession({ mode: 'track', game: 'valorant', weapon: 'vandal' }, 33);
    const events = [
      [0, { side: 1 }],
      [0.23, { firing: true }],
      [0.41, { side: -1 }],
      [0.57, { side: 0 }],
      [0.91, { firing: false }],
      [1.13, { ads: true }],
      [1.31, { firing: true }],
      [1.73, { firing: false }],
    ];
    let index = 0;
    for (let frame = 0; frame <= fps * 3; frame++) {
      const at = frame / fps;
      while (events[index] && events[index][0] <= at) {
        const [time, input] = events[index++];
        s.setInput(time, input);
      }
      s.advanceTo(at);
    }
    return { result: s.result(0), player: s.player, ammo: s.ammo };
  }
  assert.deepEqual(replay(30), replay(60));
  assert.deepEqual(replay(60), replay(144));
});
test('clearing input freezes firing and prevents sticky movement after pause; missed shots retain finite metrics', () => {
  const s = new TrainingSession({ mode: 'spray' });
  s.aim(0, 10000, 10000);
  s.setInput(0, { firing: true });
  s.advanceTo(0.3);
  s.clearInput();
  const shots = s.result().shots;
  s.advanceTo(1);
  assert.equal(s.result().shots, shots);
  assert.equal(s.result().hits, 0);
  assert.equal(s.result().accuracy, 0);
  assert.equal(s.result().headRate, null);
});
test('storage handles denied access, corrupt records, capacity and comparable configuration boundaries', () => {
  const denied = new FpsStorage({
    getItem() {
      throw Error('denied');
    },
    setItem() {
      throw Error('denied');
    },
    removeItem() {
      throw Error('denied');
    },
  });
  assert.doesNotThrow(() => {
    denied.preferences();
    denied.save(new TrainingSession().result());
    denied.clear();
  });
  assert.equal(denied.available, false);
  const map = new Map(),
    storage = new FpsStorage({
      getItem: (key) => map.get(key),
      setItem: (key, value) => map.set(key, value),
      removeItem: (key) => map.delete(key),
    });
  map.set(FPS_CONFIG.storage.preferences, '{broken');
  assert.equal(storage.preferences().game, 'cs2');
  const result = new TrainingSession().result();
  const shot = new TrainingSession({ mode: 'spray' });
  shot.setInput(0, { firing: true });
  const dense = {
    ...result,
    shots: 1500,
    impacts: Array(1500).fill(shot.shots[0]),
    timeline: Array(120).fill({ time: 0, kind: 'shot', speed: 0 }),
  };
  storage.save(dense);
  assert.equal(storage.history()[0].shots, 1500);
  assert.equal(storage.history()[0].impacts.length, FPS_CONFIG.storage.impactCapacity);
  assert.equal(storage.history()[0].timeline.length, FPS_CONFIG.storage.timelineCapacity);
  assert.equal(dense.impacts.length, 1500);
  for (let i = 0; i < FPS_CONFIG.storage.capacity + 2; i++)
    storage.save({ ...result, timestamp: i });
  assert.equal(storage.history().length, FPS_CONFIG.storage.capacity);
  storage.save({ ...result, revision: 'previous-model', comparisonKey: 'previous-model' });
  assert.equal(storage.history()[0].revision, 'previous-model');
  assert.notEqual(storage.history()[0].comparisonKey, comparisonKey(result.settings));
  map.set(FPS_CONFIG.storage.history, JSON.stringify([{ ...result, accuracy: 'corrupt' }]));
  assert.deepEqual(storage.history(), []);
  const settings = normalizeSettings();
  assert.equal(
    comparisonKey(settings),
    comparisonKey({ ...settings, muted: true, quality: 'performance' }),
  );
  assert.notEqual(comparisonKey(settings), comparisonKey({ ...settings, sensitivity: 2 }));
  storage.clear();
  assert.deepEqual(storage.history(), []);
});
