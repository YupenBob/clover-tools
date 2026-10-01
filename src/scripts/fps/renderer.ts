import * as THREE from 'three';
import { FPS_CONFIG } from '../../../config/fps.mjs';
import { verticalFov, radians, degrees } from './math.ts';
import type { TrainingSession } from './core.ts';
import type { Shot } from './types.ts';
import { RangeModels } from './range-models.ts';

/** Rendering consumes domain state; it never decides a hit or changes the clock. */
export class RangeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private targets = new Map<number, THREE.Group>();
  private impacts: { mesh: THREE.Mesh; time: number }[] = [];
  private observer: ResizeObserver;
  private gun = new THREE.Group();
  lost = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private session: TrainingSession,
    onLoss: () => void,
  ) {
    const quality = FPS_CONFIG.quality[session.settings.quality as keyof typeof FPS_CONFIG.quality];
    const context = canvas.getContext('webgl2', {
      antialias: quality.antialias,
    });
    if (!context) throw new Error('WebGL 2 unavailable');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: quality.antialias,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    const c = FPS_CONFIG.scene,
      p = c.palette;
    this.scene.background = new THREE.Color(p.background);
    this.scene.add(new THREE.HemisphereLight(p.wall, p.cover, c.architecture.lightIntensity));
    const models = new RangeModels();
    this.scene.add(models.environment(session));
    for (const target of session.targets) {
      const group = models.target(session);
      this.targets.set(target.id, group);
      this.scene.add(group);
    }
    this.gun = models.weapon();
    this.camera.add(this.gun);
    this.scene.add(this.camera);
    this.camera.near = 0.03;
    this.camera.far = c.depth * 2;
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.lost = true;
        onLoss();
      },
      { signal: this.events.signal },
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    this.resize();
  }
  private events = new AbortController();
  resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect(),
      settings = this.session.settings;
    let width = rect.width,
      height = rect.height;
    if (settings.aspect === 'bars') {
      width = Math.min(width, (height * 4) / 3);
      height = Math.min(height, (width * 3) / 4);
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = settings.aspect === 'stretch' ? 4 / 3 : width / Math.max(height, 1);
    this.session.viewportAspect = this.camera.aspect;
    this.camera.updateProjectionMatrix();
  }
  impact(shot: Shot) {
    const c = FPS_CONFIG.scene;
    const geometry = new THREE.SphereGeometry(c.impacts.radius, 6, 4);
    const material = new THREE.MeshBasicMaterial({
      color: shot.region === 'head' ? c.palette.head : shot.region ? c.palette.hit : c.palette.miss,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(shot.point.x, shot.point.y, shot.point.z);
    this.scene.add(mesh);
    this.impacts.push({ mesh, time: shot.time });
    while (this.impacts.length > c.impacts.maximum) this.removeImpact(this.impacts.shift()!);
  }
  private removeImpact(impact: { mesh: THREE.Mesh }) {
    this.scene.remove(impact.mesh);
    impact.mesh.geometry.dispose();
    (impact.mesh.material as THREE.Material).dispose();
  }
  render() {
    if (this.lost) return;
    const s = this.session,
      p = s.player;
    this.camera.position.set(p.x, s.eye.y, p.z);
    this.camera.rotation.set(p.pitch + s.recoilY, -p.yaw - s.recoilX, 0, 'YXZ');
    const vfov = radians(verticalFov(s.settings.fov, s.game.values.referenceAspect));
    this.camera.fov = degrees(
      2 * Math.atan(Math.tan(vfov / 2) / (s.input.ads ? s.weapon.values.adsZoom : 1)),
    );
    this.camera.updateProjectionMatrix();
    this.gun.visible = !s.input.ads;
    for (const target of s.targets) {
      const group = this.targets.get(target.id)!;
      group.position.set(target.x, s.mode.ball ? target.y : 0, target.z);
      group.visible = target.visible;
    }
    while (this.impacts[0] && s.time - this.impacts[0].time > FPS_CONFIG.scene.impacts.lifetime)
      this.removeImpact(this.impacts.shift()!);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.events.abort();
    this.observer.disconnect();
    this.impacts.forEach((impact) => this.removeImpact(impact));
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
        node.geometry.dispose();
        (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) =>
          material.dispose(),
        );
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.targets.clear();
    this.impacts = [];
  }
}
