  import { byId } from './toolkit';

  type ModeId = 'classic' | 'interval' | 'disc' | 'dual' | 'memory' | 'countdown' | 'dual-task';

  interface ModeMeta {
    id: ModeId;
    name: string;
    icon: string;
    desc: string;
    grid: boolean;
  }

  const MODES: Record<ModeId, ModeMeta> = {
    classic: { id: 'classic', name: '经典方格', icon: 'bi-grid-3x3', desc: '从 1 按序点击', grid: true },
    interval: { id: 'interval', name: '间隔变换', icon: 'bi-arrow-repeat', desc: '数字定时随机换位', grid: true },
    disc: { id: 'disc', name: '旋转圆盘', icon: 'bi-disc', desc: '多环旋转动态追踪', grid: false },
    dual: { id: 'dual', name: '双圆盘', icon: 'bi-record-circle', desc: '双盘独立旋转扫描', grid: false },
    memory: { id: 'memory', name: '记忆方格', icon: 'bi-braces', desc: '先记后找，隐藏作答', grid: true },
    countdown: { id: 'countdown', name: '倒计时挑战', icon: 'bi-stopwatch', desc: '限时冲刺，多点多分', grid: true },
    'dual-task': { id: 'dual-task', name: '双任务干扰', icon: 'bi-shuffle', desc: '间隔弹出色词干扰题', grid: true },
  };

  const MODE_ORDER: ModeId[] = ['classic', 'interval', 'disc', 'dual', 'memory', 'countdown', 'dual-task'];
  const SPEED_MAP: Record<number, number> = { 1: 5, 2: 11, 3: 20 };
  const SPEED_LABELS: Record<number, string> = { 1: '慢', 2: '中', 3: '快' };
  const STROOP_COLORS = ['红', '蓝', '绿', '黄'];
  const STROOP_STYLE: Record<string, string> = {
    红: 'var(--error)',
    蓝: 'var(--info)',
    绿: 'var(--success)',
    黄: 'var(--warning)',
  };
  const HISTORY_KEY = 'ct-schulte-history';
  const PREF_KEY = 'ct-schulte-prefs';

  interface Session {
    mode: ModeId;
    size: number;
    time: number;
    errors: number;
    score?: number;
    ts: number;
  }

  interface Prefs {
    mode?: ModeId;
    size?: number;
    interval?: number;
    speed?: number;
    time?: number;
    peek?: number;
    rounds?: boolean;
    muted?: boolean;
  }

  const $ = <T extends HTMLElement>(id: string): T => byId<T>(id);

  const actStart = $<HTMLElement>('actStart');
  const actTrain = $<HTMLElement>('actTrain');
  const actResult = $<HTMLElement>('actResult');
  const stageEl = document.getElementById('stStage') as HTMLElement;
  const modesEl = $<HTMLElement>('stModes');
  const grid = $<HTMLElement>('stGrid');
  const discs = $<HTMLElement>('stDiscs');
  const discA = $<HTMLElement>('stDiscA');
  const discB = $<HTMLElement>('stDiscB');
  const sizeInput = $<HTMLInputElement>('stSize');
  const sizeLabel = $<HTMLElement>('stSizeLabel');
  const sizeHint = $<HTMLElement>('stSizeHint');
  const intervalWrap = $<HTMLElement>('stIntervalWrap');
  const intervalInput = $<HTMLInputElement>('stInterval');
  const intervalLabel = $<HTMLElement>('stIntervalLabel');
  const speedWrap = $<HTMLElement>('stSpeedWrap');
  const speedInput = $<HTMLInputElement>('stSpeed');
  const speedLabel = $<HTMLElement>('stSpeedLabel');
  const timeWrap = $<HTMLElement>('stTimeWrap');
  const timeInput = $<HTMLInputElement>('stTime');
  const timeLabel = $<HTMLElement>('stTimeLabel');
  const peekWrap = $<HTMLElement>('stPeekWrap');
  const peekInput = $<HTMLInputElement>('stPeek');
  const peekLabel = $<HTMLElement>('stPeekLabel');
  const roundsInput = $<HTMLInputElement>('stRounds');
  const startBtn = $<HTMLButtonElement>('stStart');
  const fullBtn = $<HTMLButtonElement>('stFull');
  const muteBtn = $<HTMLButtonElement>('stMute');
  const clearHistoryBtn = $<HTMLButtonElement>('stClearHistory');
  const startStatus = $<HTMLElement>('stStartStatus');
  const exitBtn = $<HTMLButtonElement>('stExit');
  const modeLabel = $<HTMLElement>('stModeLabel');
  const sizeLabel2 = $<HTMLElement>('stSizeLabel2');
  const trainCount = $<HTMLElement>('stCount');
  const progressBar = $<SVGCircleElement>('stProgressBar');
  const timerEl = $<HTMLElement>('stTimer');
  const targetNum = $<HTMLElement>('stTarget');
  const targetSide = $<HTMLElement>('stTargetSide');
  const trainStatus = $<HTMLElement>('stTrainStatus');
  const gradeEl = $<HTMLElement>('stGrade');
  const metricsEl = $<HTMLElement>('stMetrics');
  const noteEl = $<HTMLElement>('stNote');
  const trendEl = $<HTMLElement>('stTrend');
  const againBtn = $<HTMLButtonElement>('stAgain');
  const backBtn = $<HTMLButtonElement>('stBack');
  const veil = $<HTMLElement>('stVeil');
  const veilInner = $<HTMLElement>('stVeilInner');
  const toast = $<HTMLElement>('stToast');

  let mode: ModeId = 'classic';
  let size = 5;
  let running = false;
  let finished = false;
  let nextNum = 1;
  let total = 1;
  let errors = 0;
  let score = 0;
  let startAt = 0;
  let muted = false;
  let peekDone = false;
  let stroopPending = false;
  let stroopAt = 0;
  let countdownLeft = 0;
  let shuffleTimer: ReturnType<typeof setInterval> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let breakTimer: ReturnType<typeof setInterval> | null = null;
  let raf = 0;
  let lastT = 0;
  let ringAngles: number[] = [];
  let ringDirs: number[] = [];
  let ringBtns: HTMLButtonElement[][] = [];
  let ringEls: HTMLElement[] = [];
  let audioCtx: AudioContext | null = null;

  const cells = new Map<number, HTMLButtonElement>();
  const discNums = new Map<number, { el: HTMLButtonElement; ring: number; disc: 'A' | 'B' }>();

  /* ── 音效 ── */
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

  function beep(freq: number, dur = 0.09, vol = 0.14, type: OscillatorType = 'sine') {
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
    beep(180, 0.16, 0.16, 'sawtooth');
  }

  function soundComplete() {
    beep(523, 0.12, 0.12);
    setTimeout(() => beep(659, 0.12, 0.12), 110);
    setTimeout(() => beep(784, 0.2, 0.12), 220);
  }

  function vibrate(pattern: number | number[]) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* 忽略 */
    }
  }

  /* ── 存储 ── */
  function readHistory(): Session[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as Session[]) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(sessions: Session[]) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, 80)));
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
        interval: Number(intervalInput.value),
        speed: Number(speedInput.value),
        time: Number(timeInput.value),
        peek: Number(peekInput.value),
        rounds: roundsInput.checked,
        muted,
      };
      localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch {
      /* 忽略 */
    }
  }

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function toastMsg(msg: string) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout((toast as HTMLElement & { _t?: number })._t);
    (toast as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  /* ── 数量计算 ── */
  function sumRingCounts(ringCount: number): number {
    let t = 0;
    for (let r = 1; r <= ringCount; r++) t += 8 + (r - 1) * 4;
    return t;
  }

  function discRings(m: ModeId): [number, number] {
    if (m !== 'dual') return [size, 0];
    const k = Math.max(1, Math.ceil(size / 2));
    return [k, k];
  }

  function discTotal(m: ModeId): number {
    const [a, b] = discRings(m);
    return sumRingCounts(a) + sumRingCounts(b);
  }

  function gridTotal(): number {
    return size * size;
  }

  function currentTotal(): number {
    return MODES[mode].grid ? gridTotal() : discTotal(mode);
  }

  function ringCounts(ringCount: number): number[] {
    return Array.from({ length: ringCount }, (_, r) => 8 + r * 4);
  }

  /* ── 开始界面 ── */
  function buildModeTabs() {
    modesEl.innerHTML = '';
    for (const id of MODE_ORDER) {
      const m = MODES[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-mode';
      btn.dataset.mode = id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(id === mode));
      btn.innerHTML =
        `<span class="st-mode-ico"><i class="bi ${m.icon}" aria-hidden="true"></i></span>` +
        `<span>${m.name}</span>` +
        `<span class="st-mode-desc">${m.desc}</span>`;
      btn.addEventListener('click', () => setMode(id));
      modesEl.appendChild(btn);
    }
    syncModeTabs();
  }

  function syncModeTabs() {
    for (const btn of modesEl.querySelectorAll<HTMLButtonElement>('.st-mode')) {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
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
    const isGrid = MODES[mode].grid;
    sizeHint.textContent = isGrid ? `${gridTotal()} 个数字` : `${discTotal(mode)} 个数字`;
    intervalWrap.hidden = mode !== 'interval';
    speedWrap.hidden = mode !== 'disc' && mode !== 'dual';
    timeWrap.hidden = mode !== 'countdown';
    peekWrap.hidden = mode !== 'memory';
    intervalLabel.textContent = `${intervalInput.value}s`;
    speedLabel.textContent = SPEED_LABELS[Number(speedInput.value)];
    timeLabel.textContent = `${timeInput.value}s`;
    peekLabel.textContent = `${peekInput.value}s`;
  }

  /* ── 训练渲染 ── */
  function buildGrid() {
    grid.innerHTML = '';
    cells.clear();
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const nums = shuffle(Array.from({ length: gridTotal() }, (_, i) => i + 1));
    for (const n of nums) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-cell';
      btn.textContent = String(n);
      btn.dataset.num = String(n);
      btn.setAttribute('role', 'gridcell');
      btn.addEventListener('click', () => onCellClick(btn));
      grid.appendChild(btn);
      cells.set(n, btn);
    }
  }

  function shuffleGridKeepState() {
    if (finished || !running) return;
    const entries = Array.from(cells.entries());
    const nums = shuffle(entries.map(([n]) => n));
    entries.forEach(([, btn], i) => {
      btn.textContent = String(nums[i]);
      btn.dataset.num = String(nums[i]);
    });
    const map = new Map<number, HTMLButtonElement>();
    entries.forEach(([, btn], i) => map.set(nums[i], btn));
    cells.clear();
    for (const [n, btn] of map) cells.set(n, btn);
    const el = cells.get(nextNum);
    if (el && !el.classList.contains('done')) {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 320);
    }
  }

  function ringRadius(i: number): number {
    return 62 + i * 56;
  }

  function sectorClip(
    cx: number,
    cy: number,
    rIn: number,
    rOut: number,
    a0: number,
    a1: number,
  ): { clip: string; box: { l: number; t: number; w: number; h: number } } {
    const rad = (a: number) => (a * Math.PI) / 180;
    const mid = (a0 + a1) / 2;
    const pts = [a0, mid, a1, a1, mid, a0].map((a, i) => {
      const rr = i < 3 ? rIn : rOut;
      return [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))] as const;
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const clip =
      'polygon(' +
      pts.map((p) => `${(((p[0] - minX) / w) * 100).toFixed(2)}% ${(((p[1] - minY) / h) * 100).toFixed(2)}%`).join(', ') +
      ')';
    return { clip, box: { l: minX, t: minY, w: maxX - minX, h: maxY - minY } };
  }

  function buildDisc(discEl: HTMLElement, nums: number[], ringCount: number, offset: number, label: 'A' | 'B') {
    discEl.innerHTML = '';
    const d = ringRadius(ringCount - 1) * 2 + 96;
    discEl.style.width = `${d}px`;
    discEl.style.height = `${d}px`;
    discEl.dataset.d = String(d);
    const hub = document.createElement('div');
    hub.className = 'st-hub';
    discEl.appendChild(hub);

    const counts = ringCounts(ringCount);
    let cursor = 0;
    counts.forEach((per, ring) => {
      const ringNums = nums.slice(cursor, cursor + per);
      cursor += per;
      const ringEl = document.createElement('div');
      ringEl.className = 'st-ring';
      ringEl.style.width = `${d}px`;
      ringEl.style.height = `${d}px`;
      discEl.appendChild(ringEl);
      ringEls[ring + offset] = ringEl;
      ringAngles[ring + offset] = (ring * 37 + 12) % 360;
      ringDirs[ring + offset] = ring % 2 === 0 ? 1 : -1;
      ringBtns[ring + offset] = [];

      const r = ringRadius(ring);
      const rIn = Math.max(12, r - 26 + 1.5);
      const rOut = r + 26 - 1.5;
      const cx = d / 2;
      const cy = d / 2;
      // 环带外缘分隔圆线
      const line = document.createElement('div');
      line.className = 'st-bandline';
      line.style.width = `${(rOut + 1.5) * 2}px`;
      line.style.height = `${(rOut + 1.5) * 2}px`;
      line.style.left = `${cx - (rOut + 1.5)}px`;
      line.style.top = `${cy - (rOut + 1.5)}px`;
      discEl.appendChild(line);
      ringNums.forEach((n, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-dnum';
        const span = document.createElement('span');
        span.textContent = String(n);
        btn.appendChild(span);
        btn.dataset.num = String(n);
        const gapDeg = 0.9;
        const spanA = (360 / ringNums.length) * idx + gapDeg / 2;
        const spanB = (360 / ringNums.length) * (idx + 1) - gapDeg / 2;
        const { clip, box } = sectorClip(cx, cy, rIn, rOut, spanA, spanB);
        btn.style.left = `${box.l}px`;
        btn.style.top = `${box.t}px`;
        btn.style.width = `${box.w}px`;
        btn.style.height = `${box.h}px`;
        btn.style.clipPath = clip;
        btn.addEventListener('click', () => onCellClick(btn));
        ringEl.appendChild(btn);
        ringBtns[ring + offset].push(btn);
        discNums.set(n, { el: btn, ring: ring + offset, disc: label });
      });
    });
    return d;
  }

  function buildDiscs() {
    discA.innerHTML = '';
    discB.innerHTML = '';
    discNums.clear();
    ringAngles = [];
    ringDirs = [];
    ringBtns = [];
    ringEls = [];
    const all = shuffle(Array.from({ length: discTotal(mode) }, (_, i) => i + 1));
    const avail = stageEl.clientWidth || 720;
    if (mode === 'disc') {
      for (const w of [discA.parentElement, discB.parentElement]) {
        if (w) w.classList.remove('st-scaled');
      }
      const d = buildDisc(discA, all, size, 0, 'A');
      applyScale(discA, d, avail - 8);
      discB.style.display = 'none';
      if (discB.parentElement) discB.parentElement.style.display = 'none';
      $<HTMLElement>('stTagB').style.display = 'none';
      discA.style.display = '';
      $<HTMLElement>('stTagA').style.display = '';
    } else {
      const [ringsA, ringsB] = discRings(mode);
      const countA = sumRingCounts(ringsA);
      const dA = buildDisc(discA, all.slice(0, countA), ringsA, 0, 'A');
      const dB = buildDisc(discB, all.slice(countA), ringsB, ringsA, 'B');
      const gap = parseFloat(getComputedStyle(discs).columnGap) || 28;
      const target = (avail - gap - 4) / 2;
      applyScale(discA, dA, target);
      applyScale(discB, dB, target);
      discA.style.display = '';
      discB.style.display = '';
      if (discA.parentElement) discA.parentElement.style.display = '';
      if (discB.parentElement) discB.parentElement.style.display = '';
      $<HTMLElement>('stTagA').style.display = '';
      $<HTMLElement>('stTagB').style.display = '';
    }
  }

  function applyScale(discEl: HTMLElement, baseD: number, target: number) {
    const wrap = discEl.parentElement;
    if (!wrap) return;
    const s = Math.min(1, Math.max(0.45, target / baseD));
    wrap.classList.add('st-scaled');
    wrap.style.setProperty('--dw', `${baseD * s}px`);
    wrap.style.setProperty('--s', String(s));
  }

  function tick(ts: number) {
    const dt = lastT ? Math.min((ts - lastT) / 1000, 0.1) : 0;
    lastT = ts;
    const speed = SPEED_MAP[Number(speedInput.value)];
    for (let i = 0; i < ringAngles.length; i++) {
      ringAngles[i] = (ringAngles[i] ?? 0) + speed * ringDirs[i] * dt * (0.65 + (i % 3) * 0.25);
      const angle = ringAngles[i];
      if (ringEls[i]) ringEls[i].style.transform = `rotate(${angle}deg)`;
      const btns = ringBtns[i];
      if (btns) {
        for (const b of btns) {
          const s = b.querySelector('span');
          if (s) s.style.transform = `rotate(${-angle}deg)`;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function startTicking() {
    cancelAnimationFrame(raf);
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  function stopAll() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (shuffleTimer) {
      clearInterval(shuffleTimer);
      shuffleTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (breakTimer) {
      clearInterval(breakTimer);
      breakTimer = null;
    }
    veil.hidden = true;
  }

  /* ── 开始训练 ── */
  function startGame() {
    stopAll();
    running = true;
    finished = false;
    nextNum = 1;
    errors = 0;
    score = 0;
    startAt = 0;
    peekDone = false;
    stroopPending = false;
    stroopAt = 0;
    total = currentTotal();

    actStart.hidden = true;
    actResult.hidden = true;
    actTrain.hidden = false;
    modeLabel.textContent = MODES[mode].name;
    sizeLabel2.textContent = `N=${size}`;
    targetNum.textContent = '1';
    targetSide.hidden = mode !== 'dual';
    targetSide.textContent = '';
    trainCount.textContent = `0 / ${total}`;
    setProgress(0);
    timerEl.hidden = true;
    trainStatus.textContent = mode === 'memory' ? '先记住数字位置' : '从 1 开始，按顺序点击';
    trainStatus.classList.remove('error');

    if (MODES[mode].grid) {
      buildGrid();
      grid.hidden = false;
      discs.hidden = true;
      if (mode === 'interval') {
        shuffleTimer = setInterval(shuffleGridKeepState, Number(intervalInput.value) * 1000);
      }
      if (mode === 'memory') showPeek();
      if (mode === 'countdown') {
        countdownLeft = Number(timeInput.value);
        timerEl.hidden = false;
        renderCountdown();
        countdownTimer = setInterval(() => {
          countdownLeft--;
          renderCountdown();
          if (countdownLeft <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            finishGame(true);
          }
        }, 1000);
      }
    } else {
      buildDiscs();
      grid.hidden = true;
      discs.hidden = false;
      startTicking();
    }
    updateTargetSide();
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  function renderCountdown() {
    timerEl.textContent = `${countdownLeft}s`;
    timerEl.classList.toggle('urgent', countdownLeft <= 10);
  }

  function setProgress(completed: number) {
    const circ = 2 * Math.PI * 19;
    const pct = total > 0 ? completed / total : 0;
    progressBar.style.strokeDasharray = String(circ);
    progressBar.style.strokeDashoffset = String(circ * (1 - pct));
  }

  function updateTargetSide() {
    if (mode !== 'dual') return;
    targetSide.hidden = false;
    const info = discNums.get(nextNum);
    targetSide.textContent = info ? `圆盘 ${info.disc}` : '';
  }

  /* ── 点击处理 ── */
  function onCellClick(btn: HTMLButtonElement) {
    const n = Number(btn.dataset.num);
    if (finished || !running) return;
    if (btn.classList.contains('done')) return;
    if (mode === 'memory' && !peekDone) return;
    if (stroopPending) {
      toastMsg('先完成干扰题');
      return;
    }
    if (n !== nextNum) {
      errors++;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 260);
      soundWrong();
      vibrate(40);
      trainStatus.textContent = `点错了：现在要找 ${nextNum}`;
      trainStatus.classList.add('error');
      return;
    }
    if (startAt === 0) startAt = performance.now();
    if (mode === 'dual-task' && !stroopPending) {
      if (stroopAt === 0) stroopAt = 3 + Math.floor(Math.random() * 2);
      if (score + 1 >= stroopAt) {
        stroopAt += 3 + Math.floor(Math.random() * 2);
        stroopPending = true;
        showStroop();
      }
    }
    btn.classList.add('done');
    btn.disabled = true;
    nextNum++;
    score++;
    soundCorrect();
    vibrate(8);
    trainStatus.textContent = '';
    trainStatus.classList.remove('error');
    targetNum.textContent = String(Math.min(nextNum, total));
    trainCount.textContent = `${score} / ${total}`;
    setProgress(score);
    targetNum.classList.remove('bump');
    void targetNum.offsetWidth;
    targetNum.classList.add('bump');
    updateTargetSide();
    if (mode === 'countdown') return;
    if (nextNum > total) finishGame(false);
  }

  /* ── 记忆 / Stroop / 休息 ── */
  function showPeek() {
    veil.hidden = false;
    veilInner.dataset.phase = 'peek';
    veilInner.innerHTML =
      `<div class="big">记住数字位置</div>` +
      `<div class="sub">展示 ${peekInput.value} 秒，之后数字隐藏，凭记忆按 1 → ${total} 顺序点击</div>`;
    setTimeout(() => {
      if (running && !finished) {
        veil.hidden = true;
        peekDone = true;
        for (const [n, btn] of cells) {
          if (n >= nextNum) {
            btn.classList.add('hidden');
            btn.textContent = '';
          }
        }
        trainStatus.textContent = '数字已隐藏，凭记忆点击';
      }
    }, Number(peekInput.value) * 1000);
  }

  function showStroop() {
    const word = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
    const color = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
    veil.hidden = false;
    veilInner.dataset.phase = 'stroop';
    veilInner.dataset.correct = color;
    veilInner.innerHTML =
      `<div class="sub">干扰题：点击「颜色」按钮（字的颜色）</div>` +
      `<div class="st-question" style="color:${STROOP_STYLE[color]}">${word}</div>` +
      `<div class="st-answers">${STROOP_COLORS.map(
        (c) => `<button class="st-answer" type="button" data-color="${c}">${c}</button>`,
      ).join('')}</div>`;
    for (const btn of veilInner.querySelectorAll<HTMLButtonElement>('.st-answer')) {
      btn.addEventListener('click', () => {
        if (btn.dataset.color === color) {
          soundCorrect();
          veil.hidden = true;
          stroopPending = false;
        } else {
          errors++;
          soundWrong();
          vibrate(40);
          toastMsg('选错了，再试');
        }
      });
    }
  }

  function startBreak() {
    let left = 5;
    veil.hidden = false;
    veilInner.dataset.phase = 'break';
    veilInner.innerHTML = `<div class="big" id="stBreakNum">${left}</div><div class="sub">休息后自动进入下一轮</div>`;
    breakTimer = setInterval(() => {
      left--;
      const el = document.getElementById('stBreakNum');
      if (el) el.textContent = String(left);
      if (left <= 0) {
        if (breakTimer) {
          clearInterval(breakTimer);
          breakTimer = null;
        }
        veil.hidden = true;
        startGame();
      }
    }, 1000);
  }

  /* ── 完成与报告 ── */
  function finishGame(timeUp: boolean) {
    stopAll();
    running = false;
    finished = true;
    const elapsed = (performance.now() - startAt) / 1000;
    soundComplete();
    vibrate([30, 40, 80]);
    const session: Session = {
      mode,
      size,
      time: timeUp ? Number(timeInput.value) : Number(elapsed.toFixed(2)),
      errors,
      score: mode === 'countdown' ? score : undefined,
      ts: Date.now(),
    };
    const history = readHistory();
    history.push(session);
    saveHistory(history);
    renderResult(session, history);
    actTrain.hidden = true;
    actResult.hidden = false;
    if (roundsInput.checked) {
      startBreak();
    }
    savePrefs();
  }

  function gradeFor(m: ModeId, sizeN: number, time: number, errs: number): { grade: string; color: string } {
    let per = 0.64;
    if (sizeN >= 8) per = 1.0;
    else if (sizeN === 7) per = 0.9;
    else if (sizeN === 6) per = 0.78;
    const penalty = m === 'interval' ? 1.15 : m === 'disc' || m === 'dual' ? 1.4 : m === 'memory' ? 1.25 : m === 'dual-task' ? 1.35 : 1;
    if (m === 'countdown') {
      const perSec = score / Math.max(time, 1);
      if (perSec >= 1.6) return { grade: '优秀', color: 'var(--success)' };
      if (perSec >= 1.15) return { grade: '良好', color: 'var(--primary-dark)' };
      if (perSec >= 0.75) return { grade: '一般', color: 'var(--warning)' };
      return { grade: '需要加强', color: 'var(--error)' };
    }
    const target = currentTotal() * per * penalty;
    const t = time + errs * 0.8;
    if (t <= target) return { grade: '优秀', color: 'var(--success)' };
    if (t <= target * 1.55) return { grade: '良好', color: 'var(--primary-dark)' };
    if (t <= target * 2.2) return { grade: '一般', color: 'var(--warning)' };
    return { grade: '需要加强', color: 'var(--error)' };
  }

  function renderResult(session: Session, history: Session[]) {
    const g = gradeFor(session.mode, session.size, session.time, session.errors);
    gradeEl.textContent = g.grade;
    gradeEl.style.color = g.color;
    const modeName = MODES[session.mode]?.name ?? session.mode;
    const avg = session.mode === 'countdown' ? session.score / Math.max(session.time, 1) : session.time / currentTotal();
    const m1 =
      session.mode === 'countdown'
        ? `<div class="st-metric"><b>${session.score}<small>个</small></b><span>完成数量</span></div>`
        : `<div class="st-metric"><b>${session.time.toFixed(2)}<small>s</small></b><span>完成用时</span></div>`;
    const m2 =
      session.mode === 'countdown'
        ? `<div class="st-metric"><b>${avg.toFixed(2)}<small>个/s</small></b><span>点击速率</span></div>`
        : `<div class="st-metric"><b>${avg.toFixed(2)}<small>s</small></b><span>平均每数</span></div>`;
    metricsEl.innerHTML = m1 + `<div class="st-metric"><b>${session.errors}</b><span>错点次数</span></div>` + m2;

    const recs = history.filter((h) => h.mode === session.mode && h.size === session.size);
    const avgAll = recs.reduce((a, b) => a + b.time, 0) / recs.length;
    const best = Math.min(...recs.map((r) => r.time));
    const prev = recs.length > 1 ? recs[recs.length - 2].time : null;
    let trend = `同模式同难度共训练 ${recs.length} 次，平均 ${avgAll.toFixed(2)} 秒，历史最佳 ${best.toFixed(2)} 秒。`;
    if (prev !== null) {
      const delta = session.time - prev;
      trend += ` 较上次${delta <= 0 ? '提升' : '慢了'} ${Math.abs(delta).toFixed(2)} 秒。`;
    }
    noteEl.textContent = `本次模式：${modeName}（N=${session.size}）。${trend}`;
    renderTrend(recs);
  }

  function renderTrend(recs: Session[]) {
    trendEl.innerHTML = '';
    if (recs.length === 0) {
      trendEl.innerHTML = '<div class="st-trend-empty">暂无同模式同难度的历史记录</div>';
      return;
    }
    const last = recs.slice(-10);
    const max = Math.max(...last.map((r) => (r.mode === 'countdown' ? r.score ?? 1 : r.time)), 1);
    for (const r of last) {
      const val = r.mode === 'countdown' ? r.score ?? 0 : r.time;
      const bar = document.createElement('div');
      bar.className = 'st-bar';
      bar.style.height = `${Math.max(8, (val / max) * 100)}%`;
      bar.setAttribute('data-label', String(val));
      bar.title = `${new Date(r.ts).toLocaleString('zh-CN')} · ${val}`;
      trendEl.appendChild(bar);
    }
  }

  function exitTraining() {
    stopAll();
    running = false;
    finished = false;
    actTrain.hidden = true;
    actResult.hidden = true;
    actStart.hidden = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    startStatus.textContent = '';
  }

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }

  /* ── 事件绑定 ── */
  sizeInput.addEventListener('input', () => {
    size = Number(sizeInput.value);
    updateControls();
    savePrefs();
  });
  intervalInput.addEventListener('input', () => {
    intervalLabel.textContent = `${intervalInput.value}s`;
    savePrefs();
  });
  speedInput.addEventListener('input', () => {
    speedLabel.textContent = SPEED_LABELS[Number(speedInput.value)];
    savePrefs();
  });
  timeInput.addEventListener('input', () => {
    timeLabel.textContent = `${timeInput.value}s`;
    savePrefs();
  });
  peekInput.addEventListener('input', () => {
    peekLabel.textContent = `${peekInput.value}s`;
    savePrefs();
  });
  roundsInput.addEventListener('change', savePrefs);
  startBtn.addEventListener('click', startGame);
  exitBtn.addEventListener('click', exitTraining);
  fullBtn.addEventListener('click', toggleFull);
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.innerHTML = muted
      ? '<i class="bi bi-volume-mute" aria-hidden="true"></i>'
      : '<i class="bi bi-volume-up" aria-hidden="true"></i>';
    savePrefs();
  });
  clearHistoryBtn.addEventListener('click', () => {
    saveHistory([]);
    toastMsg('历史记录已清空');
  });
  againBtn.addEventListener('click', () => {
    actResult.hidden = true;
    startGame();
  });
  backBtn.addEventListener('click', exitTraining);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !actTrain.hidden) exitTraining();
  });

  /* ── 初始化 ── */
  const prefs = readPrefs();
  if (prefs.mode && MODES[prefs.mode]) mode = prefs.mode;
  if (typeof prefs.size === 'number' && prefs.size >= 3 && prefs.size <= 9) size = prefs.size;
  if (typeof prefs.interval === 'number') intervalInput.value = String(prefs.interval);
  if (typeof prefs.speed === 'number') speedInput.value = String(prefs.speed);
  if (typeof prefs.time === 'number') timeInput.value = String(prefs.time);
  if (typeof prefs.peek === 'number') peekInput.value = String(prefs.peek);
  if (typeof prefs.rounds === 'boolean') roundsInput.checked = prefs.rounds;
  if (typeof prefs.muted === 'boolean') {
    muted = prefs.muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.innerHTML = muted ? '<i class="bi bi-volume-mute" aria-hidden="true"></i>' : '<i class="bi bi-volume-up" aria-hidden="true"></i>';
  }
  sizeInput.value = String(size);
  sizeLabel.textContent = String(size);
  buildModeTabs();
  updateControls();