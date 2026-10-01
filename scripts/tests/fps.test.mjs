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
import { PointerCapture } from '../../src/scripts/fps/pointer.ts';

test('mouse capture requires an explicit active request and releases late grants after cancellation', async () => {
  let grant,
    owned = false,
    available = true,
    requests = 0,
    releases = 0;
  const pointer = new PointerCapture({
    available: () => available,
    owns: () => owned,
    release: () => {
      owned = false;
      releases++;
    },
    request: () => {
      requests++;
      return new Promise((resolve) => {
        grant = resolve;
      });
    },
  });
  available = false;
  assert.equal(await pointer.request(), 'ignored');
  assert.equal(requests, 0);
  available = true;
  const pending = pointer.request();
  assert.equal(await pointer.request(), 'ignored');
  pointer.cancel();
  owned = true;
  assert.equal(pointer.acceptChange(), false);
  assert.equal(owned, false);
  grant();
  assert.equal(await pending, 'cancelled');
  assert.equal(releases, 1);
  owned = true;
  assert.equal(pointer.acceptChange(), false);
  assert.equal(releases, 2);
});
test('cancelled raw-input requests never retry, while a fresh click can use supported fallback', async () => {
  let rejectRaw,
    cancelled = true,
    owned = false;
  const calls = [];
  const pointer = new PointerCapture({
    available: () => true,
    owns: () => owned,
    release: () => {
      owned = false;
    },
    request: (raw) => {
      calls.push(raw);
      if (raw)
        return cancelled
          ? new Promise((_, reject) => {
              rejectRaw = reject;
            })
          : Promise.reject(new DOMException('unsupported', 'NotSupportedError'));
      owned = true;
    },
  });
  const pending = pointer.request();
  pointer.cancel();
  rejectRaw(new DOMException('unsupported', 'NotSupportedError'));
  assert.equal(await pending, 'cancelled');
  assert.deepEqual(calls, [true]);
  cancelled = false;
  assert.equal(await pointer.request(), 'requested');
  assert.equal(pointer.raw, false);
  assert.equal(pointer.acceptChange(), true);
  pointer.cancel();
  assert.equal(owned, false);
});
test('denied or unfocused mouse capture stays inactive and requires a fresh request', async () => {
  let available = true,
    owned = false,
    deny = true;
  const pointer = new PointerCapture({
    available: () => available,
    owns: () => owned,
    release: () => {
      owned = false;
    },
    request: () => {
      if (deny) throw new DOMException('denied', 'NotAllowedError');
    },
  });
  assert.equal(await pointer.request(), 'failed');
  owned = true;
  assert.equal(pointer.acceptChange(), false);
  deny = false;
  assert.equal(await pointer.request(), 'requested');
  available = false;
  owned = true;
  assert.equal(pointer.acceptChange(), false);
  assert.equal(owned, false);
  available = true;
  owned = true;
  assert.equal(pointer.acceptChange(), false);
});

test('late raw-input error preserves a valid fallback grant; legacy denial still releases intent', async () => {
  let owned = false,
    available = true;
  const pointer = new PointerCapture({
    available: () => available,
    owns: () => owned,
    release: () => {
      owned = false;
    },
    request: (raw) => {
      if (raw) throw new DOMException('unsupported', 'NotSupportedError');
      owned = true;
    },
  });
  assert.equal(await pointer.request(), 'requested');
  assert.equal(pointer.handleError(), false);
  assert.equal(owned, true);
  assert.equal(pointer.acceptChange(), true);
  available = false;
  assert.equal(pointer.handleError(), true);
  assert.equal(owned, false);
  const legacy = new PointerCapture({
    available: () => true,
    owns: () => false,
    release: () => {},
    request: () => {},
  });
  assert.equal(await legacy.request(), 'requested');
  assert.equal(legacy.handleError(), true);
  assert.equal(await legacy.request(), 'requested');
});

test('a previous unlock notification cannot cancel the next explicit capture request', async () => {
  let owned = false,
    grant;
  const pointer = new PointerCapture({
    available: () => true,
    owns: () => owned,
    release: () => {
      owned = false;
    },
    request: () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  });
  let request = pointer.request();
  owned = true;
  assert.equal(pointer.acceptChange(), true);
  grant();
  assert.equal(await request, 'requested');
  pointer.cancel();
  request = pointer.request();
  assert.equal(pointer.acceptChange(), false);
  owned = true;
  assert.equal(pointer.acceptChange(), true);
  grant();
  assert.equal(await request, 'requested');
  owned = false;
  assert.equal(pointer.acceptChange(), false);
  owned = true;
  assert.equal(pointer.acceptChange(), false);
});

test('unsupported raw input is probed once per page instead of consuming resume request quota', async () => {
  let owned = false;
  const calls = [];
  const pointer = new PointerCapture({
    available: () => true,
    owns: () => owned,
    release: () => {
      owned = false;
    },
    request: (raw) => {
      calls.push(raw);
      if (raw) throw new DOMException('unsupported', 'NotSupportedError');
      owned = true;
    },
  });
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(await pointer.request(), 'requested');
    assert.equal(pointer.acceptChange(), true);
    assert.equal(pointer.raw, false);
    pointer.cancel();
  }
  assert.deepEqual(calls, [true, false, false, false]);
});

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
test('mouse angular gain, physical calibration and reference FOV have reversible units', () => {
  const settings = normalizeSettings({
    sensitivity: 1,
    dpi: 800,
    turnMultiplier: 1,
  });
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
  assert.equal(s.mode, FPS_CONFIG.defaults.mode);
  assert.equal(s.distance, FPS_CONFIG.controls.distance.min);
  assert.equal(s.count, FPS_CONFIG.controls.count.max);
  const val = normalizeSettings({ game: 'valorant', weapon: 'ak47' });
  assert.equal(WEAPON_PROFILES[val.weapon].values.game, 'valorant');
  assert.equal(val.fov, GAME_PROFILES.valorant.values.defaultFov);
});
test('browser turning is faster by default while physical input calibration takes priority', () => {
  const settings = normalizeSettings({ sensitivity: 1 });
  near(
    mouseGain(settings),
    radians(FPS_DATA.cs2.variables.m_yaw * FPS_CONFIG.defaults.turnMultiplier),
  );
  settings.turnMultiplier = 8;
  settings.cm360 = 35;
  near(cmPerTurn(settings), 35);
  settings.calibrationGain = 0.04;
  near(mouseGain(settings), radians(0.04));
  const legacy = normalizeSettings({
    game: 'cs2',
    mode: 'micro',
    sensitivity: 1.3,
  });
  assert.equal(legacy.sensitivity, 1.3);
  assert.equal(legacy.turnMultiplier, FPS_CONFIG.defaults.turnMultiplier);
  const val = normalizeSettings({ game: 'valorant', turnMultiplier: 1 });
  near(mouseGain(val), radians(GAME_PROFILES.valorant.values.yaw * val.sensitivity));
});
test('bot sectors, movement and infinite ammunition obey settings with deterministic respawns', () => {
  for (const sector of Object.keys(FPS_CONFIG.sectors)) {
    const s = new TrainingSession({ mode: 'free', sector, count: 12 }, 45);
    const half = radians(FPS_CONFIG.sectors[sector] / 2);
    for (const t of s.targets) {
      assert.ok(Math.abs(Math.atan2(t.x, FPS_CONFIG.scene.spawnZ - t.z)) <= half);
      assert.ok(
        Math.hypot(t.x, t.z - FPS_CONFIG.scene.spawnZ) <=
          s.settings.distance * (1 + FPS_CONFIG.scene.bot.radialJitter),
      );
    }
    const original = s.targets.map((t) => [t.x, t.z]);
    s.advanceTo(1);
    assert.deepEqual(
      s.targets.map((t) => [t.x, t.z]),
      original,
    );
  }
  const moving = new TrainingSession({ mode: 'free', movingBots: true }, 45);
  const original = moving.targets.map((t) => [t.x, t.z]);
  moving.advanceTo(1);
  assert.notDeepEqual(
    moving.targets.map((t) => [t.x, t.z]),
    original,
  );
  const endless = new TrainingSession({ mode: 'free', infiniteAmmo: true });
  endless.setInput(0, { firing: true });
  endless.advanceTo(4);
  assert.ok(endless.result().shots > endless.weapon.values.magazine);
  assert.equal(endless.ammo, endless.weapon.values.magazine);
  endless.reload(4);
  assert.equal(endless.reloadUntil, 0);
  const magazine = new TrainingSession({ mode: 'free', infiniteAmmo: false });
  magazine.setInput(0, { firing: true });
  magazine.advanceTo(4);
  assert.equal(magazine.result().shots, magazine.weapon.values.magazine);
});
test('small balls have spherical hit regions, one-hit completion and no headshot metric', () => {
  const s = new TrainingSession({ mode: 'dots', count: 1, distance: 10 }, 22);
  const target = s.targets[0];
  const yaw = Math.atan2(target.x - s.eye.x, s.eye.z - target.z);
  const pitch = Math.atan2(target.y - s.eye.y, Math.hypot(target.x - s.eye.x, target.z - s.eye.z));
  assert.equal(s.intersection(direction(yaw, pitch)).region, 'ball');
  const miss = Math.atan2(
    target.y + FPS_CONFIG.scene.ball.radius * s.scale * 1.1 - s.eye.y,
    s.eye.z - target.z,
  );
  assert.equal(s.intersection(direction(yaw, miss)), null);
  s.aim(0, yaw / mouseGain(s.settings), -pitch / mouseGain(s.settings));
  s.setInput(0, { firing: true });
  s.setInput(0.001, { firing: false });
  assert.equal(s.result().targets, 1);
  assert.equal(s.result().heads, 0);
  assert.equal(s.result().headRate, null);
  assert.equal(target.visible, false);
  s.advanceTo(0.1);
  assert.equal(target.visible, true);
  assert.equal(target.generation, 2);
  assert.equal(s.result().firstRate, 1);
});
test('small-ball precision remains exact at long range across all four rifles; bot headshot-only is optional', () => {
  for (const [weapon, profile] of Object.entries(WEAPON_PROFILES)) {
    const s = new TrainingSession(
      {
        mode: 'dots',
        count: 1,
        distance: 40,
        difficulty: 'hard',
        weapon,
        game: profile.values.game,
      },
      12,
    );
    const t = s.targets[0],
      eye = s.eye;
    s.aim(
      0,
      Math.atan2(t.x - eye.x, eye.z - t.z) / mouseGain(s.settings),
      -Math.atan2(t.y - eye.y, Math.hypot(t.x - eye.x, t.z - eye.z)) / mouseGain(s.settings),
    );
    s.setInput(0, { firing: true });
    s.setInput(0.001, { firing: false });
    assert.equal(s.result().accuracy, 1);
    assert.equal(s.recoilX, 0);
    assert.equal(s.recoilY, 0);
  }
  for (const headOnlyBots of [true, false]) {
    const s = new TrainingSession({ mode: 'free', weapon: 'm4a1s', count: 1, headOnlyBots }, 22);
    const t = s.targets[0];
    s.aim(0, Math.atan2(t.x - s.eye.x, s.eye.z - t.z) / mouseGain(s.settings), 0);
    s.setInput(0, { firing: true });
    s.setInput(0.001, { firing: false });
    assert.equal(s.result().heads, 1);
    assert.equal(s.result().targets, headOnlyBots ? 1 : 0);
  }
});
test('bot movement and small-ball respawns are identical at 30/60/144 rendering FPS', () => {
  for (const mode of ['free', 'dots']) {
    function replay(fps) {
      const s = new TrainingSession({ mode, count: 6, movingBots: true }, 22);
      const t = s.targets[0],
        eye = s.eye;
      s.aim(
        0,
        Math.atan2(t.x - eye.x, eye.z - t.z) / mouseGain(s.settings),
        -Math.atan2(t.y - eye.y, Math.hypot(t.x - eye.x, t.z - eye.z)) / mouseGain(s.settings),
      );
      s.setInput(0, { firing: true });
      for (let frame = 0; frame <= fps * 2; frame++) s.advanceTo(frame / fps);
      return { result: s.result(0), targets: s.targets };
    }
    assert.deepEqual(replay(30), replay(60));
    assert.deepEqual(replay(60), replay(144));
  }
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
  storage.save({
    ...result,
    revision: 'previous-model',
    comparisonKey: 'previous-model',
  });
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
