import * as THREE from 'three';
import { FPS_CONFIG } from '../../../config/fps.mjs';
import { verticalFov, radians, degrees } from './math.ts';
import type { TrainingSession } from './core.ts';
import { DrillScene } from './drill-scene.ts';
import type { Shot, FeedbackEvent } from './types.ts';
import { RangeModels } from './range-models.ts';
import { createWeaponModel } from './weapon-model.ts';
import { weaponPose } from './presentation.ts';

/** Rendering consumes domain state; it never decides a hit or changes the clock. */
export class RangeRenderer {
  private drillScene: DrillScene;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private targets = new Map<number, THREE.Group>();
  private impacts: { mesh: THREE.Mesh; time: number }[] = [];
  private observer: ResizeObserver;
  private viewScene = new THREE.Scene();
  private viewCamera = new THREE.PerspectiveCamera(
    FPS_CONFIG.scene.gun.fov,
    1,
    FPS_CONFIG.scene.gun.near,
    FPS_CONFIG.scene.gun.far,
  );
  private gun: ReturnType<typeof createWeaponModel>;
  private shotAt = -Infinity;
  private reloadAt = 0;
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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const c = FPS_CONFIG.scene,
      p = c.palette;
    this.scene.background = new THREE.Color(p.background);
    this.scene.add(new THREE.HemisphereLight(p.light, p.floor, c.architecture.lightIntensity));
    const key = new THREE.DirectionalLight(p.light, c.architecture.keyIntensity);
    const lightPosition = c.architecture.keyPosition;
    key.position.set(lightPosition.x, lightPosition.y, lightPosition.z);
    key.castShadow = quality.shadows;
    if (quality.shadows) {
      key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
      const span = session.settings.distance + c.roomMargin;
      Object.assign(key.shadow.camera, {
        left: -span,
        right: span,
        top: span,
        bottom: -span,
        far: c.depth,
      });
      key.shadow.normalBias = c.architecture.panelInset;
    }
    this.scene.add(key, key.target);
    const models = new RangeModels(quality.sphereSegments);
    this.scene.add(models.environment(session));
    this.drillScene = new DrillScene(session, models);
    this.scene.add(this.drillScene.group);
    for (const target of session.targets) {
      const group = models.target(session);
      this.targets.set(target.id, group);
      this.scene.add(group);
    }
    this.gun = createWeaponModel(session.settings.weapon);
    this.viewScene.add(
      this.gun.group,
      new THREE.HemisphereLight(p.light, p.floor, c.architecture.lightIntensity),
    );
    const gunLight = new THREE.DirectionalLight(p.light, c.architecture.keyIntensity);
    gunLight.position.set(lightPosition.x, lightPosition.y, lightPosition.z);
    this.viewScene.add(gunLight);
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
    this.viewCamera.aspect = this.camera.aspect;
    this.viewCamera.updateProjectionMatrix();
  }
  feedback(event: FeedbackEvent) {
    if (event.kind === 'shot') {
      this.shotAt = event.time;
      this.impact(event.shot);
    } else if (event.kind === 'reload-start') this.reloadAt = event.time;
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
    this.drillScene.update();
    const s = this.session,
      p = s.player;
    this.camera.position.set(p.x, s.eye.y, p.z);
    this.camera.rotation.set(p.pitch + s.recoilY, -p.yaw - s.recoilX, 0, 'YXZ');
    const vfov = radians(verticalFov(s.settings.fov, s.game.values.referenceAspect));
    this.camera.fov = degrees(
      2 * Math.atan(Math.tan(vfov / 2) / (s.input.ads ? s.weapon.values.adsZoom : 1)),
    );
    this.camera.updateProjectionMatrix();
    const pose = weaponPose(
      s.time,
      this.shotAt,
      this.reloadAt,
      s.reloadUntil,
      s.speed,
      s.input.ads,
      s.settings.weaponMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    this.gun.group.visible = s.settings.showWeapon;
    this.gun.group.position.set(pose.x, pose.y, pose.z);
    this.gun.group.rotation.set(pose.pitch, 0, pose.roll);
    this.gun.magazine.position.y = this.gun.magazineY - pose.magazineDrop;
    this.gun.flash.visible = pose.flash;
    for (const target of s.targets) {
      const group = this.targets.get(target.id)!;
      group.position.set(target.x, s.mode.ball ? target.y : 0, target.z);
      group.visible = target.visible;
    }
    while (this.impacts[0] && s.time - this.impacts[0].time > FPS_CONFIG.scene.impacts.lifetime)
      this.removeImpact(this.impacts.shift()!);
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.viewScene, this.viewCamera);
  }
  dispose() {
    this.events.abort();
    this.observer.disconnect();
    this.impacts.forEach((impact) => this.removeImpact(impact));
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    const collect = (node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
        geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) =>
          materials.add(material),
        );
      }
    };
    this.scene.traverse(collect);
    this.viewScene.traverse(collect);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.targets.clear();
    this.impacts = [];
  }
}
