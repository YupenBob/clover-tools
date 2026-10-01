import * as THREE from 'three';
import { FPS_CONFIG } from '../../../config/fps.mjs';
import { roomWalls } from './layout.ts';
import type { TrainingSession } from './core.ts';

/** Original procedural scenery and targets. Hit rules remain in the simulation. */
export class RangeModels {
  box(x: number, y: number, z: number, color: string) {
    return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshLambertMaterial({ color }));
  }
  sphere(radius: number, color: string) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshLambertMaterial({ color }),
    );
  }
  environment(session: TrainingSession) {
    const group = new THREE.Group(),
      c = FPS_CONFIG.scene,
      p = c.palette,
      a = c.architecture;
    const floor = this.box(c.width, a.floorThickness, c.depth, p.floor);
    floor.position.set(0, -a.floorThickness / 2, c.spawnZ);
    group.add(floor);
    const grid = new THREE.GridHelper(c.width, c.width / a.gridSpacing, p.grid, p.grid);
    grid.position.set(0, a.gridElevation, c.spawnZ);
    group.add(grid);
    const platform = this.box(a.platformSize, a.floorThickness, a.platformSize, p.platform);
    platform.position.set(0, -a.floorThickness / 2 + a.platformTop, 0);
    group.add(platform);
    for (const { min, max } of roomWalls(session.settings.distance)) {
      const w = max.x - min.x,
        d = max.z - min.z,
        x = (min.x + max.x) / 2,
        z = (min.z + max.z) / 2;
      const wall = this.box(w, c.height, d, p.wall);
      wall.position.set(x, c.height / 2, z);
      group.add(wall);
      for (const [height, thickness, color] of [
        [c.target.headY, a.headLineThickness, p.head],
        [a.stripeY, a.stripeHeight, p.cover],
      ] as const) {
        const line = this.box(w + a.wallThickness, thickness, d + a.wallThickness, color);
        line.position.set(x, height, z);
        group.add(line);
      }
    }
    for (const side of [-1, 1]) {
      const edge = this.box(a.platformSize, a.platformEdge, a.platformEdge, p.head);
      edge.position.set(0, 0, (side * a.platformSize) / 2);
      const other = this.box(a.platformEdge, a.platformEdge, a.platformSize, p.head);
      other.position.set((side * a.platformSize) / 2, 0, 0);
      group.add(edge, other);
    }
    // A visible distance ring distinguishes the bot zone from the central movement platform.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        session.settings.distance - a.platformEdge,
        session.settings.distance + a.platformEdge,
        96,
      ),
      new THREE.MeshBasicMaterial({ color: p.head, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, a.platformEdge / 2, c.spawnZ);
    group.add(ring);
    if (session.mode.cover) {
      const { min, max } = c.cover;
      const cover = this.box(max.x - min.x, max.y - min.y, max.z - min.z, p.cover);
      cover.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      group.add(cover);
    }
    return group;
  }
  target(session: TrainingSession) {
    const group = new THREE.Group(),
      c = FPS_CONFIG.scene,
      t = c.target,
      m = c.mannequin,
      p = c.palette,
      scale = session.scale;
    if (session.mode.ball) {
      group.add(this.sphere(c.ball.radius * scale, p.ball));
      return group;
    }
    const head = this.sphere(t.headRadius * scale, p.head);
    head.position.y = t.headY;
    group.add(head);
    const torso = this.box(t.torsoWidth * scale, t.torsoMax - t.torsoMin, t.depth, p.target);
    torso.position.y = (t.torsoMin + t.torsoMax) / 2;
    group.add(torso);
    const vest = this.box(
      t.torsoWidth * scale - m.vestInset,
      (t.torsoMax - t.torsoMin) / 2,
      t.depth + m.vestInset,
      p.vest,
    );
    vest.position.y = t.torsoMax - (t.torsoMax - t.torsoMin) / 4;
    group.add(vest);
    // Two contrasting trouser panels share the simulation's continuous leg region.
    for (const side of [-1, 1]) {
      const leg = this.box(
        (t.legWidth * scale) / 2,
        t.legMax - t.legMin,
        t.depth,
        side < 0 ? p.cover : p.vest,
      );
      leg.position.set((side * t.legWidth * scale) / 4, (t.legMin + t.legMax) / 2, 0);
      group.add(leg);
    }
    const belt = this.box(t.torsoWidth * scale, m.beltHeight, t.depth + m.vestInset, p.ink);
    belt.position.y = t.torsoMin + m.beltHeight / 2;
    group.add(belt);
    return group;
  }
  weapon() {
    const group = new THREE.Group(),
      c = FPS_CONFIG.scene,
      p = c.palette;
    const body = this.box(c.gun.body.x, c.gun.body.y, c.gun.body.z, p.ink);
    const barrel = this.box(c.gun.barrel.x, c.gun.barrel.y, c.gun.barrel.z, p.cover);
    barrel.position.z = -c.gun.body.z / 2;
    const magazine = this.box(c.gun.magazine.x, c.gun.magazine.y, c.gun.magazine.z, p.vest);
    magazine.position.y = -(c.gun.body.y + c.gun.magazine.y) / 2;
    const grip = this.box(c.gun.grip.x, c.gun.grip.y, c.gun.grip.z, p.cover);
    grip.position.set(0, -(c.gun.body.y + c.gun.grip.y) / 2, c.gun.body.z / 4);
    group.add(body, barrel, magazine, grip);
    group.position.set(c.gun.offset.x, c.gun.offset.y, c.gun.offset.z);
    return group;
  }
}
