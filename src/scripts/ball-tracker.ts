/**
 * 目标球追踪训练 - 页面逻辑与三模式
 * 架构：模式注册表驱动（新增模式只需注册条目），
 * Canvas 渲染与碰撞由 ball-engine 负责。
 */

import { byId } from './toolkit';
import { BallEngine, makeBall, type Ball, type BallKind } from './ball-engine';

type ModeId = 'track' | 'distract' | 'timing';
type Phase = 'mark' | 'move' | 'select' | 'timing-run' | 'done';

interface ModeMeta {
  id: ModeId;
  name: string;
  icon: string;
  desc: string;
}

const MODES: Record<ModeId, ModeMeta> = {
  track: { id: 'track', name: '目标追踪', icon: 'bi-crosshair', desc: '记住目标球，移动后找出' },
  distract: { id: 'distract', name: '干扰追踪', icon: 'bi-shield-x', desc: '追踪中混入诱惑与陷阱球' },
  timing: { id: 'timing', name: '时机等待', icon: 'bi-hourglass-split', desc: '进入得分区才点击，克制急躁' },
};

const MODE_ORDER: ModeId[] = ['track', 'distract', 'timing'];
const SPEED_MAP: Record<number, number> = { 1: 70, 2: 110, 3: 160 };
const SPEED_LABELS: Record<number, string> = { 1: '慢', 2: '中', 3: '快' };
const HISTORY_KEY = 'ct-balltracker-history';
const PREF_KEY = 'ct-balltracker-prefs';

interface Session {
  mode: ModeId;
  size: number;
  targets: number;
  speed: number;
  hit: number;
  miss: number;
  impulse: number;
  time: number;
  ts: number;
}

interface Prefs {
  mode?: ModeId;
  size?: number;
  targets?: number;
  speed?: number;
  duration?: number;
  distractFreq?: number;
  muted?: boolean;
}

const $ = <T extends HTMLElement>(id: string): T => byId<T>(id);

// ── DOM ──
const actStart = $<HTMLElement>('btStart');
const actTrain = $<HTMLElement>('btTrain');
const actResult = $<HTMLElement>('btResult');
const modesEl = $<HTMLElement>('btModes');
const canvasWrap = $<HTMLElement>('btStage');
const canvas = $<HTMLCanvasElement>('btCanvas');
const sizeInput = $<HTMLInputElement>('btSize');
const sizeLabel = $<HTMLElement>('btSizeLabel');
const targetsWrap = $<HTMLElement>('btTargetsWrap');
const targetsInput = $<HTMLInputElement>('btTargets');
const targetsLabel = $<HTMLElement>('btTargetsLabel');
const speedWrap = $<HTMLElement>('btSpeedWrap');
const speedInput = $<HTMLInputElement>('btSpeed');
const speedLabel = $<HTMLElement>('btSpeedLabel');
const durInput = $<HTMLInputElement>('btDur');
const durLabel = $<HTMLElement>('btDurLabel');
const freqWrap = $<HTMLElement>('btFreqWrap');
const freqInput = $<HTMLInputElement>('btFreq');
const freqLabel = $<HTMLElement>('btFreqLabel');
const startBtn = $<HTMLButtonElement>('btStartBtn');
const fullBtn = $<HTMLButtonElement>('btFull');
const muteBtn = $<HTMLButtonElement>('btMute');
const exitBtn = $<HTMLButtonElement>('btExit');
const modeLabel = $<HTMLElement>('btModeLabel');
const phaseText = $<HTMLElement>('btPhaseText');
const trainStatus = $<HTMLElement>('btTrainStatus');
const trainCount = $<HTMLElement>('btCount');
const timerEl = $<HTMLElement>('btTimer');
const gradeEl = $<HTMLElement>('btGrade');
const metricsEl = $<HTMLElement>('btMetrics');
const noteEl = $<HTMLElement>('btNote');
const trendEl = $<HTMLElement>('btTrend');
const againBtn = $<HTMLButtonElement>('btAgain');
const backBtn = $<HTMLButtonElement>('btBack');
const veil = $<HTMLElement>('btVeil');
const veilInner = $<HTMLElement>('btVeilInner');
const toast = $<HTMLElement>('btToast');

// ── 状态 ──
let mode: ModeId = 'track';
let size = 8;
let targets = 2;
let speedLevel = 2;
let duration = 15;
let distractFreq = 6;
let muted = false;
let phase: Phase = 'mark';
let running = false;
let raf = 0;
let lastT = 0;
let phaseTimer: ReturnType<typeof setTimeout> | null = null;
let lureTimer: ReturnType<typeof setInterval> | null = null;
let timingTimer: ReturnType<typeof setInterval> | null = null;
let engine: BallEngine;
let nextBallId = 1;
let targetIds = new Set<number>();
let hitCount = 0;
let missCount = 0;
let impulseCount = 0;
let roundStartAt = 0;
let timingScore = 0;
let timingTotal = 0;
let timingImpulse = 0;
let ballX = 0;
let ballDir = 1;
let thisZoneIn = false;
let timingCtx: CanvasRenderingContext2D | null = null;
let audioCtx: AudioContext | null = null;

// ── 音效 ──
function ensureAudio(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function beep(freq: number, dur = 0.09, vol = 0.13, type: OscillatorType = 'sine') {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function soundCorrect() {
  beep(660, 0.07, 0.1);
  beep(880, 0.08, 0.08);
}

function soundWrong() {
  beep(180, 0.16, 0.15, 'sawtooth');
}

function soundComplete() {
  beep(523, 0.12, 0.11);
  setTimeout(() => beep(659, 0.12, 0.11), 110);
  setTimeout(() => beep(784, 0.2, 0.11), 220);
}

function vibrate(pattern: number | number[]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* 忽略 */
  }
}

// ── 存储 ──
function readHistory(): Session[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: Session[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {
    /* 忽略 */
  }
}

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

function savePrefs() {
  try {
    const p: Prefs = {
      mode,
      size,
      targets,
      speed: speedLevel,
      duration,
      distractFreq: freqInput.value ? Number(freqInput.value) : undefined,
      muted,
    };
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* 忽略 */
  }
}

function toastMsg(msg: string) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout((toast as HTMLElement & { _t?: number })._t);
  (toast as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── 开始幕 UI ──
function buildModeTabs() {
  modesEl.innerHTML = '';
  for (const id of MODE_ORDER) {
    const m = MODES[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bt-mode';
    btn.dataset.mode = id;
    btn.innerHTML =
      `<span class="bt-mode-ico"><i class="bi ${m.icon}" aria-hidden="true"></i></span>` +
      `<span>${m.name}</span>` +
      `<span class="bt-mode-desc">${m.desc}</span>`;
    btn.addEventListener('click', () => setMode(id));
    modesEl.appendChild(btn);
  }
  syncModeTabs();
}

function syncModeTabs() {
  for (const btn of modesEl.querySelectorAll<HTMLButtonElement>('.bt-mode')) {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('active', on);
  }
}

function setMode(m: ModeId) {
  stopAll();
  mode = m;
  syncModeTabs();
  updateControls();
  savePrefs();
}

function updateControls() {
  sizeLabel.textContent = String(size);
  targetsLabel.textContent = String(targets);
  speedLabel.textContent = SPEED_LABELS[speedLevel];
  durLabel.textContent = `${duration}s`;
  freqLabel.textContent = `${freqInput.value}s`;
  const isTiming = mode === 'timing';
  targetsWrap.hidden = isTiming;
  speedWrap.hidden = isTiming;
  freqWrap.hidden = mode !== 'distract';
  targetsInput.max = String(Math.max(1, Math.floor(size / 2)));
  if (targets > Math.floor(size / 2)) targets = Math.max(1, Math.floor(size / 2));
  targetsInput.value = String(targets);
  targetsLabel.textContent = String(targets);
}

// ── 球体初始化 ──
function spawnBalls(count: number, targetCount: number): Ball[] {
  const engineSize = engine.size;
  const r = engine.ballRadius();
  const balls: Ball[] = [];
  let attempts = 0;
  while (balls.length < count && attempts < 300) {
    attempts++;
    const x = r + 8 + Math.random() * (engineSize.width - 2 * (r + 8));
    const y = r + 8 + Math.random() * (engineSize.height - 2 * (r + 8));
    const overlap = balls.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 1.4);
    if (overlap) continue;
    const kind: BallKind = balls.length < targetCount ? 'target' : 'normal';
    balls.push(makeBall(nextBallId++, x, y, r, kind, SPEED_MAP[speedLevel]));
  }
  // 兜底：不足时随机补充
  while (balls.length < count) {
    const kind: BallKind = balls.length < targetCount ? 'target' : 'normal';
    balls.push(makeBall(nextBallId++, r + 8, r + 8, r, kind, SPEED_MAP[speedLevel]));
  }
  return shuffle(balls);
}

// ── 训练流程 ──
function startGame() {
  stopAll();
  running = true;
  hitCount = 0;
  missCount = 0;
  impulseCount = 0;
  timingScore = 0;
  timingTotal = 0;
  timingImpulse = 0;
  targetIds = new Set();
  actStart.hidden = true;
  actResult.hidden = true;
  actTrain.hidden = false;
  engine.resize();
  modeLabel.textContent = MODES[mode].name;
  trainCount.textContent = '';
  timerEl.hidden = true;
  trainStatus.classList.remove('error');

  if (mode === 'timing') {
    startTiming();
    return;
  }
  startTrack();
  void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

function startTrack() {
  phase = 'mark';
  const balls = spawnBalls(size, targets);
  engine.setBalls(balls);
  targetIds = new Set(balls.filter((b) => b.kind === 'target').map((b) => b.id));
  for (const b of balls) {
    if (b.kind === 'target') b.marked = true;
  }
  phaseText.textContent = '记住金色目标球';
  trainStatus.textContent = '记住目标球，标记消失后持续追踪';
  roundStartAt = performance.now();
  startRaf();
  phaseTimer = setTimeout(() => {
    if (!running) return;
    phase = 'move';
    for (const b of engine.getBalls()) b.marked = false;
    phaseText.textContent = '追踪中……';
    if (mode === 'distract') startLures();
    phaseTimer = setTimeout(() => {
      if (!running) return;
      phase = 'select';
      phaseText.textContent = '点击你追踪到的目标球';
      trainStatus.textContent = `共 ${targets} 个目标，请全部点出`;
      timerEl.hidden = false;
      timerEl.textContent = '0s';
      let elapsed = 0;
      timingTimer = setInterval(() => {
        elapsed += 1;
        timerEl.textContent = `${elapsed}s`;
      }, 1000);
    }, duration * 1000);
  }, 2200);
}

function startLures() {
  lureTimer = setInterval(() => {
    if (!running || phase !== 'move') return;
    const balls = engine.getBalls();
    const normals = balls.filter((b) => b.kind === 'normal' && !b.confirmed);
    if (normals.length === 0) return;
    const lure = normals[Math.floor(Math.random() * normals.length)];
    lure.kind = 'lure';
    setTimeout(() => {
      if (lure.kind === 'lure') lure.kind = 'normal';
    }, 900);
    // 35% 概率额外注入一颗陷阱球（3 秒后消失）
    if (Math.random() < 0.35) {
      const r = engine.ballRadius();
      const s = engine.size;
      const trap = makeBall(
        nextBallId++,
        r + 10 + Math.random() * (s.width - 2 * (r + 10)),
        r + 10 + Math.random() * (s.height - 2 * (r + 10)),
        r,
        'trap',
        SPEED_MAP[speedLevel],
      );
      balls.push(trap);
      engine.setBalls(balls);
      setTimeout(() => {
        const list = engine.getBalls();
        const i = list.indexOf(trap);
        if (i >= 0) list.splice(i, 1);
      }, 3000);
    }
  }, Number(freqInput.value) * 1000);
}

function startTiming() {
  phase = 'timing-run';
  const s = engine.size;
  ballX = s.width / 2;
  ballDir = 1;
  phaseText.textContent = '球进入金色区域时点击';
  trainStatus.textContent = '克制急躁：太早点击会重置';
  timerEl.hidden = false;
  const totalTime = duration * 2;
  let left = totalTime;
  timerEl.textContent = `${left}s`;
  timingTimer = setInterval(() => {
    left--;
    timerEl.textContent = `${left}s`;
    if (left <= 0) {
      clearInterval(timingTimer);
      timingTimer = null;
      finishTiming();
    }
  }, 1000);
  roundStartAt = performance.now();
  startRaf();
}

function timingUpdate(dt: number) {
  const s = engine.size;
  const r = engine.ballRadius();
  const speed = s.width * 0.4; // 每秒横穿约 40%，兼顾可玩性与挑战
  ballX += ballDir * speed * dt;
  if (ballX - r < 0) {
    ballX = r;
    ballDir = 1;
  } else if (ballX + r > s.width) {
    ballX = s.width - r;
    ballDir = -1;
  }
  // 渲染：轨道 + 得分区 + 球
  if (!timingCtx) timingCtx = canvas.getContext('2d');
  const ctx = timingCtx;
  if (!ctx) return;
  ctx.clearRect(0, 0, s.width, s.height);
  const midY = s.height / 2;
  const zoneW = s.width * 0.2;
  const zoneL = s.width / 2 - zoneW / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(201, 169, 110, 0.14)';
  ctx.fillRect(zoneL, midY - r - 14, zoneW, (r + 14) * 2);
  ctx.strokeStyle = 'rgba(201, 169, 110, 0.55)';
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(zoneL, midY - r - 14, zoneW, (r + 14) * 2);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(201, 169, 110, 0.3)';
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(s.width, midY);
  ctx.stroke();
  ctx.restore();
  const inZone = ballX >= zoneL + r && ballX <= zoneL + zoneW - r;
  const color = inZone ? '#c9a96e' : '#8b8577';
  ctx.save();
  ctx.shadowColor = inZone ? 'rgba(201,169,110,0.7)' : 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = inZone ? 18 : 6;
  const grad = ctx.createRadialGradient(ballX - r * 0.35, midY - r * 0.35, r * 0.15, ballX, midY, r);
  grad.addColorStop(0, inZone ? '#e6d6ae' : '#b8b2a4');
  grad.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(ballX, midY, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  thisZoneIn = inZone;
}

function onCanvasClick(e: MouseEvent) {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (mode === 'timing') {
    // 实时判定球是否位于得分区（不依赖渲染帧状态，逻辑独立）
    const s = engine.size;
    const r = engine.ballRadius();
    const zoneW = s.width * 0.2;
    const zoneL = s.width / 2 - zoneW / 2;
    const inZone = ballX >= zoneL + r && ballX <= zoneL + zoneW - r;
    if (inZone) {
      timingScore++;
      timingTotal++;
      soundCorrect();
      vibrate(8);
      phaseText.textContent = `命中 ${timingScore} 次`;
    } else {
      timingImpulse++;
      timingTotal++;
      soundWrong();
      vibrate(40);
      phaseText.textContent = '太早了，等球进入金色区域';
      trainStatus.classList.add('error');
      setTimeout(() => trainStatus.classList.remove('error'), 500);
    }
    return;
  }
  const ball = engine.hitTest(x, y);
  if (!ball) return;
  // 移动阶段：点击干扰球 = 冲动误触
  if (phase === 'move') {
    if (ball.kind === 'lure' || ball.kind === 'trap') {
      impulseCount++;
      soundWrong();
      vibrate(40);
      if (ball.kind === 'lure') {
        ball.kind = 'normal';
      } else {
        const list = engine.getBalls();
        const i = list.indexOf(ball);
        if (i >= 0) list.splice(i, 1);
      }
      trainStatus.textContent = `冲动点击：干扰球不能点（累计 ${impulseCount} 次）`;
      trainStatus.classList.add('error');
      setTimeout(() => trainStatus.classList.remove('error'), 600);
    }
    return;
  }
  if (phase !== 'select') return;
  if (targetIds.has(ball.id)) {
    if (ball.confirmed) return;
    ball.confirmed = true;
    hitCount++;
    soundCorrect();
    vibrate(8);
    if (hitCount >= targets) finishTrack();
  } else {
    missCount++;
    soundWrong();
    vibrate(40);
    trainStatus.textContent = `点错了：那不是目标球（剩余 ${targets - hitCount} 个）`;
    trainStatus.classList.add('error');
    setTimeout(() => trainStatus.classList.remove('error'), 500);
  }
}

function finishTrack() {
  stopTimers();
  running = false;
  phase = 'done';
  soundComplete();
  const elapsed = (performance.now() - roundStartAt) / 1000;
  const session: Session = {
    mode,
    size,
    targets,
    speed: speedLevel,
    hit: hitCount,
    miss: missCount,
    impulse: impulseCount,
    time: Number(elapsed.toFixed(2)),
    ts: Date.now(),
  };
  saveSession(session);
}

function finishTiming() {
  stopTimers();
  running = false;
  phase = 'done';
  soundComplete();
  const session: Session = {
    mode,
    size,
    targets: 1,
    speed: speedLevel,
    hit: timingScore,
    miss: 0,
    impulse: timingImpulse,
    time: duration * 2,
    ts: Date.now(),
  };
  saveSession(session);
}

function saveSession(session: Session) {
  const history = readHistory();
  history.push(session);
  saveHistory(history);
  renderResult(session, history);
  actTrain.hidden = true;
  actResult.hidden = false;
  savePrefs();
}

// ── rAF 循环 ──
function startRaf() {
  cancelAnimationFrame(raf);
  lastT = 0;
  raf = requestAnimationFrame(tick);
}

function tick(ts: number) {
  const dt = lastT ? Math.min((ts - lastT) / 1000, 0.05) : 0.016;
  lastT = ts;
  if (mode === 'timing') {
    timingUpdate(dt);
  } else {
    // 选择阶段冻结球体，方便玩家从容点击
    if (phase !== 'select') engine.update(dt);
    engine.render();
  }
  if (running) raf = requestAnimationFrame(tick);
}

function stopTimers() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (phaseTimer) {
    clearTimeout(phaseTimer);
    phaseTimer = null;
  }
  if (lureTimer) {
    clearInterval(lureTimer);
    lureTimer = null;
  }
  if (timingTimer) {
    clearInterval(timingTimer);
    timingTimer = null;
  }
}

function stopAll() {
  stopTimers();
  running = false;
  veil.hidden = true;
}

// ── 评级与报告 ──
function gradeFor(s: Session): { grade: string; color: string } {
  let acc: number;
  if (s.mode === 'timing') {
    acc = s.hit / Math.max(s.hit + s.impulse, 1);
  } else {
    acc = s.hit / Math.max(s.targets, 1);
    acc = Math.max(0, acc - s.impulse * 0.08 - s.miss * 0.04);
  }
  if (acc >= 0.9) return { grade: '优秀', color: 'var(--success)' };
  if (acc >= 0.75) return { grade: '良好', color: 'var(--primary-dark)' };
  if (acc >= 0.6) return { grade: '一般', color: 'var(--warning)' };
  return { grade: '需要加强', color: 'var(--error)' };
}

function renderResult(s: Session, history: Session[]) {
  const g = gradeFor(s);
  gradeEl.textContent = g.grade;
  gradeEl.style.color = g.color;
  const acc =
    s.mode === 'timing'
      ? s.hit / Math.max(s.hit + s.impulse, 1)
      : s.hit / Math.max(s.targets, 1);
  metricsEl.innerHTML =
    `<div class="bt-metric"><b>${Math.round(acc * 100)}<small>%</small></b><span>命中准确率</span></div>` +
    `<div class="bt-metric"><b>${s.impulse}</b><span>冲动/干扰误触</span></div>` +
    `<div class="bt-metric"><b>${s.miss}</b><span>错点次数</span></div>` +
    `<div class="bt-metric"><b style="color:${g.color}">${g.grade}</b><span>本次评级</span></div>`;
  const recs = history.filter((h) => h.mode === s.mode && h.size === s.size && h.targets === s.targets);
  const avgAcc =
    recs.length > 0
      ? recs.reduce((sum, r) => sum + (r.mode === 'timing' ? r.hit / Math.max(r.hit + r.impulse, 1) : r.hit / Math.max(r.targets, 1)), 0) / recs.length
      : 0;
  noteEl.textContent =
    `${MODES[s.mode].name}（${s.size} 球 / 目标 ${s.targets}）· 同配置共训练 ${recs.length} 次，` +
    `平均准确率 ${Math.round(avgAcc * 100)}%。冲动与干扰误触共 ${s.impulse} 次，坚持训练可逐步降低。`;
  renderTrend(recs);
}

function renderTrend(recs: Session[]) {
  trendEl.innerHTML = '';
  if (recs.length === 0) {
    trendEl.innerHTML = '<div class="bt-trend-empty">暂无同配置历史记录</div>';
    return;
  }
  const last = recs.slice(-10);
  const vals = last.map((r) => (r.mode === 'timing' ? r.hit / Math.max(r.hit + r.impulse, 1) : r.hit / Math.max(r.targets, 1)));
  const max = Math.max(...vals, 0.1);
  for (let i = 0; i < last.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'bt-bar';
    bar.style.height = `${Math.max(8, (vals[i] / max) * 100)}%`;
    bar.setAttribute('data-label', String(Math.round(vals[i] * 100)));
    trendEl.appendChild(bar);
  }
}

function exitTraining() {
  stopAll();
  actTrain.hidden = true;
  actResult.hidden = true;
  actStart.hidden = false;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

function toggleFull() {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  } else {
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }
}

// ── 事件绑定 ──
sizeInput.addEventListener('input', () => {
  size = Number(sizeInput.value);
  updateControls();
  savePrefs();
});
targetsInput.addEventListener('input', () => {
  targets = Number(targetsInput.value);
  targetsLabel.textContent = String(targets);
  savePrefs();
});
speedInput.addEventListener('input', () => {
  speedLevel = Number(speedInput.value);
  speedLabel.textContent = SPEED_LABELS[speedLevel];
  savePrefs();
});
durInput.addEventListener('input', () => {
  duration = Number(durInput.value);
  durLabel.textContent = `${duration}s`;
  savePrefs();
});
freqInput.addEventListener('input', () => {
  freqLabel.textContent = `${freqInput.value}s`;
  savePrefs();
});
startBtn.addEventListener('click', startGame);
exitBtn.addEventListener('click', exitTraining);
fullBtn.addEventListener('click', toggleFull);
againBtn.addEventListener('click', () => {
  actResult.hidden = true;
  startGame();
});
backBtn.addEventListener('click', exitTraining);
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.innerHTML = muted ? '<i class="bi bi-volume-mute" aria-hidden="true"></i>' : '<i class="bi bi-volume-up" aria-hidden="true"></i>';
  savePrefs();
});
canvas.addEventListener('click', onCanvasClick);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !actTrain.hidden) exitTraining();
});
window.addEventListener('resize', () => {
  engine.resize();
  if (running && phase === 'mark') {
    // 标记阶段 resize 后重摆球，保持可玩
  }
});

// ── 初始化 ──
const prefs = readPrefs();
if (prefs.mode && MODES[prefs.mode]) mode = prefs.mode;
if (typeof prefs.size === 'number' && prefs.size >= 6 && prefs.size <= 12) size = prefs.size;
if (typeof prefs.targets === 'number') targets = prefs.targets;
if (typeof prefs.speed === 'number' && prefs.speed >= 1 && prefs.speed <= 3) speedLevel = prefs.speed;
if (typeof prefs.duration === 'number') duration = prefs.duration;
if (typeof prefs.distractFreq === 'number') freqInput.value = String(prefs.distractFreq);
if (typeof prefs.muted === 'boolean') {
  muted = prefs.muted;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.innerHTML = muted ? '<i class="bi bi-volume-mute" aria-hidden="true"></i>' : '<i class="bi bi-volume-up" aria-hidden="true"></i>';
}
sizeInput.value = String(size);
targetsInput.value = String(targets);
speedInput.value = String(speedLevel);
durInput.value = String(duration);
engine = new BallEngine(canvas, { baseRadius: 24 });
buildModeTabs();
updateControls();
