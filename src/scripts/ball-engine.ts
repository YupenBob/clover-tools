/**
 * 目标球追踪 - Canvas 球引擎
 * 职责：球体运动、碰撞检测、Canvas 渲染。
 * 与模式逻辑（ball-tracker.ts）分离，后续新增玩法可复用。
 */

export type BallKind = 'normal' | 'target' | 'trap' | 'lure';

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: BallKind;
  /** 目标球是否正处于标记高亮阶段 */
  marked?: boolean;
  /** 球是否已被玩家确认为目标（完成追踪） */
  confirmed?: boolean;
}

export interface EngineOptions {
  /** 球的基准半径（按画布尺寸等比缩放） */
  baseRadius: number;
  /** 碰撞弹性系数 */
  restitution?: number;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class BallEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private balls: Ball[] = [];
  private baseRadius: number;
  private restitution: number;
  private rotation = 0;
  private showGrid = false;
  private circular = false;
  private colors: { normal: string; target: string; trap: string; lure: string; glow: string };

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 上下文不可用');
    this.ctx = ctx;
    this.baseRadius = opts.baseRadius;
    this.restitution = opts.restitution ?? 0.9;
    this.colors = {
      normal: cssVar('--text-secondary', '#66604f'),
      target: cssVar('--primary', '#c9a96e'),
      trap: cssVar('--error', '#d64545'),
      lure: cssVar('--warning', '#b7791f'),
      glow: cssVar('--primary-rgb', '201, 169, 110'),
    };
    this.resize();
  }

  /** 按容器尺寸 + DPR 重置画布 */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  setBalls(balls: Ball[]): void {
    this.balls = balls;
  }

  getBalls(): Ball[] {
    return this.balls;
  }

  /** 场景整体旋转角（弧度），渲染与命中检测都会应用 */
  setRotation(rad: number): void {
    this.rotation = rad;
  }

  get rotationAngle(): number {
    return this.rotation;
  }

  /** 是否绘制方格背景（整体旋转模式的参考系） */
  setShowGrid(v: boolean): void {
    this.showGrid = v;
  }

  /** 圆形边界（整体旋转模式）：球始终位于画布内接圆内，旋转后不会出界 */
  setCircularBounds(v: boolean): void {
    this.circular = v;
  }

  get circularBounds(): boolean {
    return this.circular;
  }

  /** 追踪中混入新球（数量增减模式） */
  addBall(ball: Ball): void {
    this.balls.push(ball);
  }

  ballRadius(): number {
    return Math.max(14, Math.min(30, (this.baseRadius * Math.min(this.width, this.height)) / 420));
  }

  /** 生成一个不越界的随机球位置（圆形边界时位于内接圆内） */
  randomPoint(r: number): { x: number; y: number } {
    const margin = r + 10;
    if (this.circular) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxR = Math.min(this.width, this.height) / 2 - margin;
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * maxR;
      return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad };
    }
    return {
      x: margin + Math.random() * (this.width - 2 * margin),
      y: margin + Math.random() * (this.height - 2 * margin),
    };
  }

  private moveBall(b: Ball, dt: number): void {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const r = b.r;
    if (this.circular) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxR = Math.min(this.width, this.height) / 2 - r - 6;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = cx + nx * maxR;
        b.y = cy + ny * maxR;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= 2 * vn * nx;
          b.vy -= 2 * vn * ny;
        }
      }
      return;
    }
    if (b.x - r < 0) {
      b.x = r;
      b.vx = Math.abs(b.vx);
    } else if (b.x + r > this.width) {
      b.x = this.width - r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y - r < 0) {
      b.y = r;
      b.vy = Math.abs(b.vy);
    } else if (b.y + r > this.height) {
      b.y = this.height - r;
      b.vy = -Math.abs(b.vy);
    }
  }

  /** 弹性碰撞：交换法向速度分量并分离重叠 */
  private collide(a: Ball, b: Ball): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (dist >= minDist || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (minDist - dist) / 2;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
    const relVx = b.vx - a.vx;
    const relVy = b.vy - a.vy;
    const velAlongNormal = relVx * nx + relVy * ny;
    if (velAlongNormal > 0) return;
    const j = (-(1 + this.restitution) * velAlongNormal) / 2;
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
  }

  update(dt: number): void {
    for (const b of this.balls) {
      this.moveBall(b, dt);
    }
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        this.collide(this.balls[i], this.balls[j]);
      }
    }
  }

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.rotation !== 0) {
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(this.rotation);
      ctx.translate(-this.width / 2, -this.height / 2);
    }
    if (this.showGrid) this.renderGrid();
    for (const b of this.balls) {
      this.renderBall(b);
    }
    ctx.restore();
  }

  private renderGrid(): void {
    const ctx = this.ctx;
    const step = 44;
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 150, 120, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderBall(b: Ball): void {
    const ctx = this.ctx;
    const color = this.ballColor(b);
    const r = b.r;
    ctx.save();
    ctx.shadowColor = `rgba(${this.colors.glow}, 0.45)`;
    ctx.shadowBlur = r * 0.8;
    const grad = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.35, r * 0.15, b.x, b.y, r);
    grad.addColorStop(0, this.lighten(color));
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    if (b.confirmed) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgba(${this.colors.glow}, 0.8)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (b.marked) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private ballColor(b: Ball): string {
    if (b.confirmed || b.marked) return this.colors.target;
    switch (b.kind) {
      case 'target':
        return this.colors.target;
      case 'trap':
        return this.colors.trap;
      case 'lure':
        return this.colors.lure;
      default:
        return this.colors.normal;
    }
  }

  private lighten(hex: string): string {
    const m = hex.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.min(255, (n >> 16) + 70);
    const g = Math.min(255, ((n >> 8) & 0xff) + 70);
    const b = Math.min(255, (n & 0xff) + 70);
    return `rgb(${r},${g},${b})`;
  }

  hitTest(x: number, y: number): Ball | null {
    // 将画布坐标逆旋转为场景坐标后再命中检测
    let px = x;
    let py = y;
    if (this.rotation !== 0) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      px = cx + dx * cos - dy * sin;
      py = cy + dx * sin + dy * cos;
    }
    for (const b of this.balls) {
      if (b.confirmed) continue;
      const dx = px - b.x;
      const dy = py - b.y;
      if (dx * dx + dy * dy <= (b.r + 6) * (b.r + 6)) return b;
    }
    return null;
  }
}

export function makeBall(
  id: number,
  x: number,
  y: number,
  r: number,
  kind: BallKind,
  speed: number,
): Ball {
  const angle = Math.random() * Math.PI * 2;
  return {
    id,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r,
    kind,
  };
}
