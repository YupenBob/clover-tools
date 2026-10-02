import * as THREE from 'three';
import { FPS_CONFIG } from '../../../config/fps.mjs';
import type { TrainingSession } from './core.ts';
import { RangeModels } from './range-models.ts';

/** Low lane markers provide direction without entering head/body sight lines. */
export class DrillScene {
  readonly group = new THREE.Group();
  private gates = new Map<number, THREE.Group>();
  private session: TrainingSession;
  constructor(session: TrainingSession, models: RangeModels) {
    this.session = session;
    const drill = session.drill;
    if (!drill) return;
    const c = FPS_CONFIG.drills.presentation,
      p = FPS_CONFIG.scene.palette;
    const gateX = FPS_CONFIG.drills[drill.kind].gateX;
    for (const side of [-1, 1]) {
      const gate = new THREE.Group();
      const line = models.box(c.markerWidth, c.markerHeight, c.markerDepth, p.head);
      line.position.set(side * gateX, c.markerHeight, FPS_CONFIG.scene.spawnZ);
      const beacon = models.box(c.beaconWidth, c.beaconHeight, c.beaconWidth, p.head, true);
      beacon.position.set(
        side * gateX,
        c.beaconHeight / 2,
        FPS_CONFIG.scene.spawnZ - c.markerDepth,
      );
      gate.add(line, beacon);
      this.gates.set(side, gate);
      this.group.add(gate);
    }
    const width = drill.kind === 'peek' ? FPS_CONFIG.drills.peek.safeHalfWidth * 2 : gateX * 2;
    const depth = FPS_CONFIG.drills[drill.kind].laneDepth * 2;
    for (const side of [-1, 1]) {
      const line = models.box(width, c.markerHeight, c.markerWidth, p.hit);
      line.position.set(0, c.markerHeight, FPS_CONFIG.scene.spawnZ + (side * depth) / 2);
      this.group.add(line);
      const edge = models.box(c.markerWidth, c.markerHeight, depth, p.hit);
      edge.position.set((side * width) / 2, c.markerHeight, FPS_CONFIG.scene.spawnZ);
      this.group.add(edge);
    }
  }
  update() {
    const drill = this.session.drill;
    if (!drill) return;
    for (const [side, group] of this.gates)
      group.visible = drill.phase !== 'return' && side === drill.side;
  }
}
