import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FPS_CONFIG } from '../../../config/fps.mjs';
import { roomWalls } from './layout.ts';
import type { TrainingSession } from './core.ts';

/** Original geometry. Collision and target sizes come from the domain configuration. */
export class RangeModels {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private segments: number;
  constructor(segments: number) {
    this.segments = segments;
  }
  material(color: string, roughness = FPS_CONFIG.scene.materials.roughness) {
    const key = `${color}:${roughness}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness,
          metalness: FPS_CONFIG.scene.materials.metalness,
        }),
      );
    return this.materials.get(key)!;
  }
  box(x: number, y: number, z: number, color: string, rounded = false) {
    const c = FPS_CONFIG.scene.mannequin,
      key = `box:${x}:${y}:${z}:${rounded}`;
    if (!this.geometries.has(key))
      this.geometries.set(
        key,
        rounded
          ? new RoundedBoxGeometry(x, y, z, c.segments, Math.min(c.bevel, x / 4, y / 4, z / 4))
          : new THREE.BoxGeometry(x, y, z),
      );
    const mesh = new THREE.Mesh(this.geometries.get(key), this.material(color));
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  sphere(radius: number, color: string, polished = false) {
    const key = `sphere:${radius}`;
    if (!this.geometries.has(key))
      this.geometries.set(
        key,
        new THREE.SphereGeometry(radius, this.segments, Math.round(this.segments * 0.75)),
      );
    const mesh = new THREE.Mesh(
      this.geometries.get(key),
      this.material(color, polished ? FPS_CONFIG.scene.materials.ballRoughness : undefined),
    );
    mesh.castShadow = true;
    return mesh;
  }
  environment(session: TrainingSession, coverLabel = '') {
    const group = new THREE.Group(),
      c = FPS_CONFIG.scene,
      p = c.palette,
      a = c.architecture;
    const walls = roomWalls(session.settings.distance);
    const floor = this.box(c.width, a.floorThickness, c.depth, p.floor);
    floor.position.set(0, -a.floorThickness / 2, c.spawnZ);
    group.add(floor);
    const grid = new THREE.GridHelper(c.width, c.width / a.gridSpacing, p.grid, p.grid);
    grid.position.set(0, a.gridElevation, c.spawnZ);
    const gridMaterial = grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = a.shadowOpacity;
    group.add(grid);
    const platform = this.box(a.platformSize, a.floorThickness, a.platformSize, p.platform);
    platform.position.set(0, -a.floorThickness / 2 + a.platformTop, 0);
    group.add(platform);
    for (const { min, max } of walls) {
      const w = max.x - min.x,
        d = max.z - min.z,
        x = (min.x + max.x) / 2,
        z = (min.z + max.z) / 2;
      const wall = this.box(w, c.height, d, p.wall);
      wall.position.set(x, c.height / 2, z);
      group.add(wall);
      for (const [height, thickness, color] of [
        [c.target.headY, a.headLineThickness, p.head],
        [a.baseHeight / 2, a.baseHeight, p.cover],
        [a.lightHeight, a.lightThickness, p.light],
      ] as const) {
        const line = this.box(w + a.panelInset, thickness, d + a.panelInset, color);
        line.position.set(x, height, z);
        if (color === p.light) {
          line.material.emissive.set(color);
          line.material.emissiveIntensity = a.fillIntensity;
        }
        group.add(line);
      }
      const horizontal = w > d,
        span = horizontal ? w : d;
      for (let along = -span / 2 + a.panelSpacing; along < span / 2; along += a.panelSpacing) {
        const rib = this.box(
          horizontal ? a.panelWidth : w + a.panelInset,
          c.height,
          horizontal ? d + a.panelInset : a.panelWidth,
          p.grid,
        );
        rib.position.set(x + (horizontal ? along : 0), c.height / 2, z + (horizontal ? 0 : along));
        group.add(rib);
      }
    }
    const half = (walls[0].max.x - walls[0].min.x) / 2;
    const ceiling = this.box(half * 2, a.floorThickness, half * 2, p.wall);
    ceiling.position.set(0, c.height + a.floorThickness / 2, c.spawnZ);
    ceiling.castShadow = false;
    group.add(ceiling);
    for (const side of [-1, 1]) {
      const edge = this.box(a.platformSize, a.platformEdge, a.platformEdge, p.head);
      edge.position.set(0, a.platformTop, (side * a.platformSize) / 2);
      const other = this.box(a.platformEdge, a.platformEdge, a.platformSize, p.head);
      other.position.set((side * a.platformSize) / 2, a.platformTop, 0);
      group.add(edge, other);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        session.settings.distance - a.platformEdge,
        session.settings.distance + a.platformEdge,
        96,
      ),
      new THREE.MeshBasicMaterial({ color: p.grid, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, a.gridElevation * 2, c.spawnZ);
    group.add(ring);
    const distanceTexture = this.labelTexture(`${session.settings.distance} m`, 4);
    if (distanceTexture) {
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(a.labelSize * 2, a.labelSize),
        new THREE.MeshBasicMaterial({
          map: distanceTexture,
          transparent: true,
          depthWrite: false,
        }),
      );
      label.position.set(0, a.stripeY, walls[0].max.z + a.panelInset);
      group.add(label);
    }
    for (const { min, max } of session.obstacles) {
      const cover = this.box(max.x - min.x, max.y - min.y, max.z - min.z, p.cover, true);
      cover.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      group.add(cover);
      const ratio = FPS_CONFIG.drills.presentation.coverPanelRatio;
      const face = this.box(
        (max.x - min.x) * ratio,
        (max.y - min.y) * ratio,
        a.panelInset,
        p.vest,
        true,
      );
      face.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, max.z - a.coverInset);
      group.add(face);
      // Edge inlays are inside the same collision bounds.
      for (const side of [-1, 1]) {
        const trim = this.box(a.panelInset, max.y - min.y, a.panelInset, p.head);
        trim.position.set(
          side > 0 ? max.x - a.panelInset / 2 : min.x + a.panelInset / 2,
          (max.y + min.y) / 2,
          max.z - a.coverInset,
        );
        group.add(trim);
      }
      if (coverLabel) {
        // Painted just clear of the recessed face: guidance without a surface that can z-fight.
        const texture = this.labelTexture(coverLabel, 5, 700);
        if (texture) {
          const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(
              (max.x - min.x) * ratio * 0.7,
              ((max.y - min.y) * ratio * 0.7) / 4,
            ),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
          );
          plate.position.set(
            (min.x + max.x) / 2,
            (min.y + max.y) / 2,
            max.z - a.coverInset + a.panelInset / 2 + 0.001,
          );
          group.add(plate);
        }
      }
    }
    return group;
  }
  /** Text is rasterised once per label; callers skip the mesh when a canvas is unavailable. */
  private labelTexture(text: string, sizeRatio: number, weight = 600) {
    const a = FPS_CONFIG.scene.architecture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = a.labelResolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = FPS_CONFIG.scene.palette.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
    ctx.font = `${weight} ${a.labelResolution / sizeRatio}px ${font || 'monospace'}`;
    ctx.fillText(text, a.labelResolution / 2, a.labelResolution / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  target(session: TrainingSession) {
    const group = new THREE.Group(),
      c = FPS_CONFIG.scene,
      t = c.target,
      m = c.mannequin,
      p = c.palette,
      scale = session.scale;
    if (session.mode.ball) {
      group.add(this.sphere(c.ball.radius * scale, p.ball, true));
      return group;
    }
    const head = this.sphere(t.headRadius * scale, p.head, true);
    head.position.y = t.headY;
    group.add(head);
    const visor = this.box(t.headRadius * scale, m.visorHeight * scale, m.vestInset, p.visor, true);
    visor.position.set(0, t.headY, t.headRadius * scale - m.vestInset);
    group.add(visor);
    const torso = this.box(t.torsoWidth * scale, t.torsoMax - t.torsoMin, t.depth, p.target, true);
    torso.position.y = (t.torsoMin + t.torsoMax) / 2;
    group.add(torso);
    const vest = this.box(
      t.torsoWidth * scale - m.vestInset * 2,
      (t.torsoMax - t.torsoMin) / 2,
      t.depth + m.vestInset,
      p.vest,
      true,
    );
    vest.position.y = t.torsoMax - (t.torsoMax - t.torsoMin) / 4;
    group.add(vest);
    // A painted center seam keeps the lower plate consistent with the continuous leg hit region.
    const legs = this.box(t.legWidth * scale, t.legMax - t.legMin, t.depth, p.cover, true);
    legs.position.y = (t.legMin + t.legMax) / 2;
    const seam = this.box(m.seam, t.legMax - t.legMin, t.depth + m.vestInset, p.vest);
    seam.position.y = legs.position.y;
    group.add(legs, seam);
    const belt = this.box(t.torsoWidth * scale, m.beltHeight, t.depth + m.vestInset, p.ink, true);
    belt.position.y = t.torsoMin + m.beltHeight / 2;
    group.add(belt);
    return group;
  }
}
