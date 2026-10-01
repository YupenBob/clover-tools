import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FPS_CONFIG, WEAPON_PROFILES } from '../../config/fps.mjs';
import { TrainingSession } from '../../src/scripts/fps/core.ts';
import { comparisonKey, normalizeSettings } from '../../src/scripts/fps/storage.ts';
import { weaponPose } from '../../src/scripts/fps/presentation.ts';
import * as THREE from 'three';
import { RangeModels } from '../../src/scripts/fps/range-models.ts';

test('recorded audio derivatives match their provenance and contain audible, unclipped PCM', () => {
  const root = new URL('../../public/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('fps/audio/manifest.json', root), 'utf8'));
  for (const [id, asset] of Object.entries(FPS_CONFIG.feedback.audio.assets)) {
    const declared = manifest.assets[id],
      bytes = readFileSync(new URL(asset.file.slice(1), root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), declared.sha256);
    assert.equal(declared.bytes, bytes.length);
    assert.equal(manifest.sources[asset.source].license, 'CC0-1.0');
    assert.match(declared.originalSha256, /^[a-f0-9]{64}$/);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    let pcm, sampleRate;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset, offset + 4),
        size = bytes.readUInt32LE(offset + 4);
      if (type === 'fmt ') {
        assert.equal(bytes.readUInt16LE(offset + 8), 1);
        assert.equal(bytes.readUInt16LE(offset + 10), 1);
        sampleRate = bytes.readUInt32LE(offset + 12);
        assert.equal(sampleRate, manifest.encoding.sampleRate);
        assert.equal(bytes.readUInt16LE(offset + 22), 16);
      }
      if (type === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + (size % 2);
    }
    assert.ok(pcm?.length > 0);
    let peak = 0,
      power = 0,
      onset = null;
    for (let offset = 0; offset < pcm.length; offset += 2) {
      const value = Math.abs(pcm.readInt16LE(offset) / 32768);
      peak = Math.max(peak, value);
      power += value * value;
      if (onset === null && value > 0.02) onset = offset / 2 / sampleRate;
    }
    assert.ok(peak > 0.1 && peak < 0.99, `${id} peak ${peak}`);
    assert.ok(Math.sqrt(power / (pcm.length / 2)) > 0.015, `${id} is too quiet`);
    if (id === 'ak47' || id === 'ar15') assert.ok(onset < 0.02, `${id} onset ${onset}`);
  }
  for (const [id] of Object.entries(WEAPON_PROFILES)) {
    assert.ok(FPS_CONFIG.scene.gun.profiles[id]);
    assert.ok(manifest.assets[FPS_CONFIG.feedback.audio.profiles[id].sample]);
  }
});

test('presentation settings migrate safely and do not split comparable training results', () => {
  const old = normalizeSettings({ game: 'cs2', sensitivity: 2, mode: 'dots' });
  assert.equal(old.volume, FPS_CONFIG.defaults.volume);
  assert.equal(old.showWeapon, true);
  const modified = normalizeSettings({
    ...old,
    volume: 0,
    shotVolume: Infinity,
    hitVolume: -5,
    showWeapon: false,
    weaponMotion: false,
    muted: true,
    quality: 'performance',
  });
  assert.equal(modified.volume, 0);
  assert.equal(modified.hitVolume, 0);
  assert.equal(modified.shotVolume, FPS_CONFIG.defaults.shotVolume);
  assert.equal(comparisonKey(old), comparisonKey(modified));
  const a = new TrainingSession(old, 22),
    b = new TrainingSession(modified, 22);
  for (const session of [a, b]) {
    session.setInput(0, { firing: true });
    session.advanceTo(2);
    session.clearInput();
  }
  assert.deepEqual(a.shots, b.shots);
  assert.equal(a.recoilX, b.recoilX);
  assert.equal(a.recoilY, b.recoilY);
});

test('shot, empty and reload feedback follow simulation events at 30/60/144 rendering FPS', () => {
  function simulate(fps) {
    const session = new TrainingSession({ mode: 'dots' }, 22),
      events = [];
    session.onFeedback = (event) => events.push(event);
    session.setInput(0, { firing: true });
    for (let frame = 1; frame <= fps * 4; frame++) session.advanceTo(frame / fps);
    session.clearInput();
    session.setInput(4, { firing: true });
    session.clearInput();
    session.reload(4);
    session.reload(4);
    for (let frame = fps * 4 + 1; frame <= fps * 8; frame++) session.advanceTo(frame / fps);
    return { events, shots: session.shots, result: session.result(0) };
  }
  const baseline = simulate(30);
  assert.deepEqual(simulate(60), baseline);
  assert.deepEqual(simulate(144), baseline);
  assert.equal(
    baseline.events.filter((event) => event.kind === 'shot').length,
    WEAPON_PROFILES.ak47.values.magazine,
  );
  assert.equal(baseline.events.filter((event) => event.kind === 'empty').length, 1);
  assert.equal(baseline.events.filter((event) => event.kind === 'reload-start').length, 1);
  assert.equal(baseline.events.filter((event) => event.kind === 'reload-end').length, 1);
  for (const event of baseline.events.filter((event) => event.kind === 'shot'))
    assert.equal(event.time, event.shot.time);
});

test('cosmetic motion uses absolute session time, freezes on pause and can be disabled', () => {
  const evaluateAt = (fps, time) => {
    let pose;
    for (let frame = 0; frame <= Math.round(fps * time); frame++)
      pose = weaponPose(Math.min(frame / fps, time), 0.2, 0.5, 2.5, 1, false, true);
    return pose;
  };
  assert.deepEqual(evaluateAt(30, 1), evaluateAt(60, 1));
  assert.deepEqual(evaluateAt(144, 1), evaluateAt(60, 1));
  assert.equal(weaponPose(0, -Infinity, 0, 0, 0, false, true).flash, false);
  const shot = weaponPose(0.2, 0.2, 0, 0, 0, false, true);
  assert.equal(shot.flash, true);
  assert.ok(shot.pitch > 0);
  const disabled = weaponPose(0.2, 0.2, 0, 0, 2, false, false);
  assert.equal(disabled.pitch, 0);
  assert.equal(disabled.x, FPS_CONFIG.scene.gun.offset.x);
  const ads = weaponPose(1, -Infinity, 0, 0, 2, true, true);
  assert.equal(ads.x, FPS_CONFIG.scene.gun.adsOffset.x);
});

test('completion feedback distinguishes a hit from finishing a target', () => {
  const session = new TrainingSession({ mode: 'dots' }, 22),
    target = session.targets[0],
    events = [];
  const eye = session.eye;
  session.player.yaw = Math.atan2(target.x - eye.x, -(target.z - eye.z));
  session.player.pitch = Math.atan2(
    target.y - eye.y,
    Math.hypot(target.x - eye.x, target.z - eye.z),
  );
  session.onFeedback = (event) => events.push(event);
  session.setInput(0, { firing: true });
  assert.equal(events[0].kind, 'shot');
  assert.equal(events[0].shot.region, 'ball');
  assert.equal(events[0].completed, true);
  assert.equal(session.result().targets, 1);
});

test('decorative room geometry does not occlude target rays across configured distances and sizes', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => null }) };
  try {
    for (const distance of [
      FPS_CONFIG.controls.distance.min,
      10,
      FPS_CONFIG.controls.distance.max,
    ]) {
      for (const difficulty of Object.keys(FPS_CONFIG.difficulties)) {
        const session = new TrainingSession(
          { mode: 'dots', count: FPS_CONFIG.controls.count.max, distance, difficulty },
          22,
        );
        const scene = new THREE.Scene(),
          models = new RangeModels(FPS_CONFIG.quality.performance.sphereSegments);
        scene.add(models.environment(session));
        for (const target of session.targets) {
          const model = models.target(session);
          model.position.set(target.x, target.y, target.z);
          scene.add(model);
        }
        scene.updateMatrixWorld(true);
        const eye = new THREE.Vector3(session.eye.x, session.eye.y, session.eye.z);
        for (const target of session.targets) {
          const direction = new THREE.Vector3(target.x, target.y, target.z).sub(eye).normalize();
          const hit = new THREE.Raycaster(eye, direction)
            .intersectObjects(scene.children, true)
            .find((intersection) => intersection.object instanceof THREE.Mesh);
          assert.equal(
            hit.object.geometry.parameters.radius,
            FPS_CONFIG.scene.ball.radius * session.scale,
            `Decorative obstruction at ${distance}m/${difficulty}/target${target.id}`,
          );
        }
      }
    }
  } finally {
    globalThis.document = originalDocument;
  }
});
