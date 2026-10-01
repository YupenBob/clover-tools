import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FPS_CONFIG } from '../../../config/fps.mjs';

/** Original rifle silhouettes, selected by data. No game meshes or textures are used. */
export function createWeaponModel(id: string) {
  const c = FPS_CONFIG.scene.gun,
    p = FPS_CONFIG.scene.palette,
    m = FPS_CONFIG.scene.materials;
  const profile = c.profiles[id as keyof typeof c.profiles] || c.profiles.ak47;
  const group = new THREE.Group();
  group.scale.setScalar(c.scale);
  const metal = new THREE.MeshStandardMaterial({
    color: p.ink,
    metalness: m.weaponMetalness,
    roughness: m.weaponRoughness,
  });
  const accent = new THREE.MeshStandardMaterial({ color: profile.accent, roughness: m.roughness });
  const glove = new THREE.MeshStandardMaterial({ color: p.glove, roughness: m.roughness });
  const box = (x: number, y: number, z: number, material = metal) =>
    new THREE.Mesh(
      new RoundedBoxGeometry(
        x,
        y,
        z,
        FPS_CONFIG.scene.mannequin.segments,
        Math.min(c.bevel, x / 4, y / 4, z / 4),
      ),
      material,
    );
  const body = box(c.body.x, c.body.y, c.body.z);
  const handguard = box(c.body.x * 1.15, c.body.y * 0.8, c.body.z * 0.7, accent);
  handguard.position.z = -c.body.z * 0.65;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(c.barrel.radius, c.barrel.radius, profile.barrel, c.barrel.segments),
    metal,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, c.body.y / 5, -c.body.z - profile.barrel / 2);
  const stock = box(c.stock.x, c.stock.y, profile.stock, accent);
  stock.position.set(0, -c.body.y / 4, (c.body.z + profile.stock) / 2);
  const magazine = box(c.magazine.x, c.magazine.y, c.magazine.z);
  const magazineY = -(c.body.y + c.magazine.y) / 2;
  magazine.position.set(0, magazineY, -c.body.z / 5);
  magazine.rotation.x = profile.magazineAngle;
  const grip = box(c.grip.x, c.grip.y, c.grip.z);
  grip.position.set(0, -(c.body.y + c.grip.y) / 2, c.body.z / 3);
  grip.rotation.x = -profile.magazineAngle;
  const rearSight = box(c.body.x * 0.5, c.body.y * 0.3, c.body.z * 0.1);
  rearSight.position.set(0, c.body.y * 0.6, c.body.z / 3);
  const frontSight = box(c.body.x / 4, c.body.y / 2, c.body.z / 12);
  frontSight.position.set(0, c.body.y * 0.6, -c.body.z - profile.barrel / 4);
  group.add(body, handguard, barrel, stock, magazine, grip, rearSight, frontSight);
  if (profile.rail) {
    const rail = box(c.body.x * 0.6, c.body.y / 5, c.body.z * 0.8, accent);
    rail.position.y = c.body.y / 2;
    group.add(rail);
  }
  let muzzleZ = -c.body.z - profile.barrel;
  if (profile.silencer) {
    const silencer = new THREE.Mesh(
      new THREE.CylinderGeometry(
        c.barrel.radius * 2,
        c.barrel.radius * 2,
        profile.silencer,
        c.barrel.segments,
      ),
      metal,
    );
    silencer.rotation.x = Math.PI / 2;
    silencer.position.set(0, c.body.y / 5, muzzleZ - profile.silencer / 2);
    muzzleZ -= profile.silencer;
    group.add(silencer);
  }
  for (const support of [true, false]) {
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(c.hand.x / 2, c.gloveSegments, c.gloveSegments),
      glove,
    );
    hand.scale.set(1, c.hand.y / c.hand.x, c.hand.z / c.hand.x);
    hand.position.set(
      support ? -c.body.x / 3 : c.grip.x / 3,
      -c.body.y,
      support ? -c.body.z * 0.7 : c.body.z / 3,
    );
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(c.hand.x / 3, c.armLength, c.gloveSegments / 2, c.gloveSegments),
      glove,
    );
    arm.position.copy(hand.position);
    arm.position.z += c.armLength / 2;
    arm.rotation.set(Math.PI / 2, 0, support ? Math.PI / 5 : -Math.PI / 12);
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(c.fingerRadius, c.hand.y / 2, c.gloveSegments / 2, c.gloveSegments),
      glove,
    );
    thumb.position.copy(hand.position);
    thumb.position.x += c.hand.x / 2;
    thumb.rotation.z = Math.PI / 4;
    group.add(hand, arm, thumb);
  }
  const flash = new THREE.Mesh(
    new THREE.ConeGeometry(c.flashRadius, c.flashLength, c.barrel.segments),
    new THREE.MeshBasicMaterial({
      color: p.flash,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  flash.rotation.x = -Math.PI / 2;
  flash.position.set(0, c.body.y / 5, muzzleZ - c.flashLength / 2);
  flash.visible = false;
  group.add(flash);
  return { group, magazine, magazineY, flash };
}
