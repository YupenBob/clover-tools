import { FLIGHT_ROUTES, FLIGHT_STORAGE, ROUTE_CITIES, createFlight, advanceFlight, pauseFlight, resumeFlight, parseFlight, parseFlightHistory, flightRecord, addFlightRecord, routeGeometry, type FlightSession, type FlightRecord } from '../lib/focus-flight';
import type { FlightText } from '../lib/focus-flight-i18n';
import { byId as queryById } from './toolkit';
import { canvasBlob, saveBlob, wrapCanvasText } from './fun-ui';

const byId = <T extends Element = HTMLElement>(id: string) => queryById<T>(id);

const { lang, copy: t } = JSON.parse(byId('ffData').textContent ?? '{}') as { lang: string; copy: FlightText };
const locale = ({ zh: 'zh-CN', tw: 'zh-TW', en: 'en', ko: 'ko', ja: 'ja' } as Record<string, string>)[lang] ?? 'zh-CN';
const root = byId('ffRoot');
const originalTitle = document.title;
const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
let storageAvailable = true;
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); }
  catch { storageAvailable = false; return null; }
}
function writeStorage(key: string, value: unknown): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); }
  catch { storageAvailable = false; }
  byId('ffLocalNote').textContent = storageAvailable ? t.local : t.storageError;
}
let session: FlightSession | null = parseFlight(readStorage(FLIGHT_STORAGE.active), Date.now());
let history = parseFlightHistory(readStorage(FLIGHT_STORAGE.history));
let routeId: string = session?.routeId ?? FLIGHT_ROUTES[0].id;
let lastDisplayState = '';
let historyDay = '';
let saving = false;
let immersive = false;
const text = (id: string, value: string | number) => { byId(id).textContent = String(value); };
const notice = (value: string) => text('ffNotice', value);
function routeInfo(id = routeId) {
  const index = FLIGHT_ROUTES.findIndex((route) => route.id === id);
  return { route: FLIGHT_ROUTES[index], from: t.cities[ROUTE_CITIES[index][0]], to: t.cities[ROUTE_CITIES[index][1]] };
}
function configuredMinutes(): number | null {
  const value = byId<HTMLInputElement>('ffMinutes').value;
  const minutes = Number(value);
  return value.trim() && Number.isInteger(minutes) && minutes >= 1 && minutes <= 180 ? minutes : null;
}
function minutesChoice(): void {
  const minutes = configuredMinutes();
  document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === minutes)));
}
function durationValidation(valid: boolean): void {
  byId('ffValidation').hidden = valid;
  text('ffValidation', valid ? '' : t.invalid);
  byId('ffMinutes').setAttribute('aria-invalid', String(!valid));
}
function persist(): void { writeStorage(FLIGHT_STORAGE.active, session); }
function updateRoute(): void {
  const { route, from, to } = routeInfo();
  byId<HTMLSelectElement>('ffRouteSelect').value = routeId;
  const geometry = routeGeometry(routeId);
  text('ffFromCity', from); text('ffToCity', to);
  text('ffFromCode', route.from); text('ffToCode', route.to);
  text('ffMapDescription', `${from} (${route.from}) → ${to} (${route.to}). ${t.mapHint}`);
  byId('ffTrail').setAttribute('d', geometry.path);
  byId('ffRouteProgress').setAttribute('d', geometry.path);
  for (const [id, point] of [['ffOriginDot', geometry.from], ['ffDestinationDot', geometry.to]] as const) {
    byId(id).setAttribute('cx', String(point[0])); byId(id).setAttribute('cy', String(point[1]));
  }
  document.querySelectorAll<SVGElement>('[data-airport]').forEach((node) => { node.dataset.selected = String(node.dataset.airport === route.from || node.dataset.airport === route.to); });
  document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.route === routeId));
    button.disabled = !!session;
  });
}
function showHistory(): void {
  const now = new Date();
  historyDay = now.toDateString();
  const today = history.filter((record) => new Date(record.completedAt).toDateString() === now.toDateString()).reduce((sum, record) => sum + record.durationMs / 60_000, 0);
  byId('ffToday').replaceChildren(document.createTextNode(String(today)), Object.assign(document.createElement('span'), { textContent: t.minutes }));
  text('ffLandings', history.length);
  byId('ffEmptyLog').hidden = history.length > 0;
  byId<HTMLButtonElement>('ffClear').disabled = history.length === 0;
  byId('ffLogList').replaceChildren(...history.map((record) => {
    const entry = document.createElement('li'); entry.className = 'ff-log-entry'; entry.dataset.flightId = record.id;
    const mark = document.createElement('span'); mark.textContent = '↗'; mark.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    const title = document.createElement('strong');
    const { from, to } = routeInfo(record.routeId); title.textContent = `${from} → ${to}`;
    const info = document.createElement('p'); info.textContent = t.record.replace('{minutes}', String(record.durationMs / 60_000)).replace('{date}', dateFormat.format(record.completedAt));
    const task = document.createElement('small'); task.textContent = record.task || t.taskDefault; task.title = task.textContent;
    content.append(title, info, task); entry.append(mark, content); return entry;
  }));
}

let audio: AudioContext | null = null;
let noise: AudioBufferSourceNode | null = null;
let noiseGain: GainNode | null = null;
let wantsSound = false;
let soundRevision = 0;
async function readyAudio(): Promise<AudioContext> {
  if (!audio || audio.state === 'closed') audio = new AudioContext();
  if (audio.state === 'suspended') await audio.resume();
  return audio;
}
async function startNoise(): Promise<void> {
  const version = ++soundRevision;
  try {
    const ctx = await readyAudio();
    if (version !== soundRevision || !wantsSound) return;
    if (!noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02; samples[i] = previous * 3.5; }
      noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 800;
      noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
      noise.connect(lowpass).connect(noiseGain).connect(ctx.destination); noise.start();
    }
    updateNoise();
  } catch {
    if (version !== soundRevision) return;
    wantsSound = false; byId('ffSound').setAttribute('aria-checked', 'false'); notice(t.soundError);
  }
}
function updateNoise(): void {
  if (!audio || !noiseGain) return;
  const playing = wantsSound && session?.state !== 'paused' && session?.state !== 'landed';
  noiseGain.gain.setTargetAtTime(playing ? Number(byId<HTMLInputElement>('ffVolume').value) / 100 * 0.6 : 0, audio.currentTime, 0.15);
}
function stopNoise(): void {
  soundRevision++;
  noise?.stop(); noise?.disconnect(); noise = null;
  noiseGain?.disconnect(); noiseGain = null;
}
function arrivalChime(): void {
  if (!audio || audio.state !== 'running' || !byId<HTMLInputElement>('ffChime').checked) return;
  const ctx = audio;
  [523.25, 659.25, 783.99].forEach((frequency, i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = ctx.currentTime + i * 0.16;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.08, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
    oscillator.connect(gain).connect(ctx.destination); oscillator.start(start); oscillator.stop(start + 0.7);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
let wakeLock: WakeLockSentinel | null = null;
let requestingWake = false;
async function updateWakeLock(): Promise<void> {
  const needsWake = session?.state === 'flying' && document.visibilityState === 'visible';
  if (!needsWake) { const lock = wakeLock; wakeLock = null; await lock?.release().catch(() => {}); return; }
  if (wakeLock || requestingWake || !('wakeLock' in navigator)) return;
  requestingWake = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (session?.state !== 'flying' || document.visibilityState !== 'visible') await lock.release();
    else { wakeLock = lock; lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; }); }
  } catch { /* Optional capability: timing continues without a screen wake lock. */ }
  finally { requestingWake = false; }
}
function finish(arriving = false): void {
  if (!session) return;
  const record = flightRecord(session);
  if (!record) return;
  const saved = parseFlightHistory(readStorage(FLIGHT_STORAGE.history));
  const isNew = !history.some((item) => item.id === record.id) && !saved.some((item) => item.id === record.id);
  history = addFlightRecord(storageAvailable ? saved : history, record);
  writeStorage(FLIGHT_STORAGE.history, history); persist(); showHistory();
  if (arriving && isNew) arrivalChime();
  notice(t.complete.replace('{city}', routeInfo().to).replace('{minutes}', String(session.durationMs / 60_000)));
  byId<HTMLDialogElement>('ffStopDialog').close();
}
function render(force = false): void {
  const now = Date.now();
  const priorState = session?.state;
  if (session) {
    session = advanceFlight(session, now);
    if (priorState === 'flying' && session.state === 'landed') finish(true);
  }
  const state = session?.state ?? 'boarding';
  const minutes = session ? session.durationMs / 60_000 : configuredMinutes() ?? 25;
  const remaining = session ? session.remainingMs : minutes * 60_000;
  const seconds = Math.ceil(remaining / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  text('ffClock', clock);
  const progress = session ? 1 - remaining / session.durationMs : 0;
  const percent = Math.min(100, Math.floor(progress * 100));
  const geometry = routeGeometry(routeId, progress);
  byId('ffPlane').setAttribute('transform', `translate(${geometry.x} ${geometry.y}) rotate(${geometry.angle})`);
  byId('ffRouteProgress').setAttribute('stroke-dashoffset', String(100 - progress * 100));
  byId('ffProgressFill').style.width = `${progress * 100}%`;
  byId('ffProgress').setAttribute('aria-valuenow', String(percent)); text('ffPercent', `${percent}%`);
  const arrival = session ? session.deadline ?? session.completedAt : configuredMinutes() ? now + minutes * 60_000 : null;
  text('ffArrivalTime', arrival ? timeFormat.format(arrival) : '—');
  text('ffFlightNumber', `CF ${String(minutes).padStart(3, '0')}`);
  document.title = session ? `${clock} · ${t[state]} · ${originalTitle}` : originalTitle;
  if (force || lastDisplayState !== state) {
    lastDisplayState = state; root.dataset.state = state;
    text('ffStateText', t[state]);
    text('ffClockHint', ({ boarding: t.readyHint, flying: t.flyingHint, paused: t.pausedHint, landed: t.landedHint })[state]);
    text('ffPrimaryText', ({ boarding: t.depart, flying: t.pause, paused: t.resume, landed: t.again })[state]);
    text('ffArrivalLabel', state === 'landed' ? t.arrivalDone : t.arrivalTime);
    byId<HTMLFieldSetElement>('ffSettings').disabled = !!session;
    byId('ffEnd').hidden = !session || state === 'landed';
    byId('ffSave').hidden = state !== 'landed';
    byId<HTMLButtonElement>('ffSave').disabled = saving;
    byId('ffActiveTask').hidden = !session;
    text('ffActiveTask', session?.task || t.taskDefault);
    updateRoute(); updateNoise(); void updateWakeLock();
  }
}
function reset(): void {
  session = null; persist(); notice(''); durationValidation(true); render(true);
}
byId<HTMLFormElement>('ffForm').addEventListener('submit', (event) => {
  event.preventDefault(); render();
  if (!session) {
    const minutes = configuredMinutes(); durationValidation(minutes !== null);
    if (minutes === null) { byId('ffMinutes').focus(); return; }
    session = createFlight(crypto.randomUUID(), routeId, byId<HTMLInputElement>('ffTask').value, minutes, Date.now());
    notice('');
  } else if (session.state === 'flying') session = pauseFlight(session, Date.now());
  else if (session.state === 'paused') session = resumeFlight(session, Date.now());
  else { reset(); return; }
  if (byId<HTMLInputElement>('ffChime').checked) void readyAudio().catch(() => notice(t.soundError));
  if (wantsSound) void startNoise();
  persist(); render(true);
});
byId<HTMLInputElement>('ffMinutes').addEventListener('input', () => { durationValidation(true); minutesChoice(); render(); });
document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((button) => button.addEventListener('click', () => {
  if (session) return;
  byId<HTMLInputElement>('ffMinutes').value = button.dataset.minutes!; durationValidation(true); minutesChoice(); render();
}));
function chooseRoute(id: string): void {
  if (session) return;
  routeId = id;
  byId<HTMLInputElement>('ffMinutes').value = String(routeInfo().route.minutes);
  durationValidation(true); minutesChoice(); updateRoute(); render(true);
}
document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => button.addEventListener('click', () => chooseRoute(button.dataset.route!)));
byId<HTMLSelectElement>('ffRouteSelect').addEventListener('change', () => chooseRoute(byId<HTMLSelectElement>('ffRouteSelect').value));
byId('ffEnd').addEventListener('click', () => { render(); if (session && session.state !== 'landed') byId<HTMLDialogElement>('ffStopDialog').showModal(); });
byId('ffKeepFlying').addEventListener('click', () => byId<HTMLDialogElement>('ffStopDialog').close());
byId('ffStopConfirm').addEventListener('click', () => {
  byId<HTMLDialogElement>('ffStopDialog').close(); render();
  // A flight that landed while the dialog was open keeps its completed record.
  if (session && session.state !== 'landed') { reset(); wantsSound = false; byId('ffSound').setAttribute('aria-checked', 'false'); stopNoise(); }
});
byId('ffClear').addEventListener('click', () => { if (history.length) byId<HTMLDialogElement>('ffClearDialog').showModal(); });
byId('ffClearCancel').addEventListener('click', () => byId<HTMLDialogElement>('ffClearDialog').close());
byId('ffClearConfirm').addEventListener('click', () => {
  history = []; writeStorage(FLIGHT_STORAGE.history, history); showHistory(); byId<HTMLDialogElement>('ffClearDialog').close();
  if (session?.state === 'landed') writeStorage(FLIGHT_STORAGE.active, null);
});
byId('ffSound').addEventListener('click', () => {
  wantsSound = !wantsSound; byId('ffSound').setAttribute('aria-checked', String(wantsSound));
  if (wantsSound) void startNoise(); else stopNoise();
});
byId<HTMLInputElement>('ffVolume').addEventListener('input', () => { text('ffVolumeValue', `${byId<HTMLInputElement>('ffVolume').value}%`); updateNoise(); });
byId<HTMLInputElement>('ffChime').addEventListener('change', () => { if (byId<HTMLInputElement>('ffChime').checked) void readyAudio().catch(() => notice(t.soundError)); });
const immersiveSiblings = new Map<HTMLElement, boolean>();
function immersiveView(enabled: boolean): void {
  immersive = enabled; document.documentElement.classList.toggle('ff-immersive', immersive);
  if (enabled) {
    let element: HTMLElement = root;
    while (element.parentElement) {
      for (const sibling of element.parentElement.children) {
        if (sibling !== element && sibling instanceof HTMLElement) { immersiveSiblings.set(sibling, sibling.inert); sibling.inert = true; }
      }
      element = element.parentElement;
      if (element === document.body) break;
    }
  } else { for (const [element, wasInert] of immersiveSiblings) element.inert = wasInert; immersiveSiblings.clear(); }
  byId('ffImmersive').setAttribute('aria-pressed', String(immersive));
  byId('ffImmersive').querySelector('span')!.textContent = immersive ? t.exitImmersive : t.immersive;
  byId('ffImmersiveHint').hidden = !immersive;
}
byId('ffImmersive').addEventListener('click', () => immersiveView(!immersive));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && immersive && !document.querySelector('dialog[open]')) immersiveView(false); });

async function saveCard(record: FlightRecord): Promise<void> {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 900;
  const ctx = canvas.getContext('2d')!;
  const { route, from, to } = routeInfo(record.routeId);
  ctx.fillStyle = '#eef5f1'; ctx.fillRect(0, 0, 1080, 900);
  ctx.strokeStyle = '#dbe5dc'; ctx.lineWidth = 1;
  for (let x = 60; x < 1080; x += 80) { ctx.beginPath(); ctx.moveTo(x, 180); ctx.lineTo(x, 455); ctx.stroke(); }
  for (let y = 215; y < 455; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
  ctx.fillStyle = '#244d4c'; ctx.font = '18px ui-monospace, monospace'; ctx.fillText('C / F     FOCUS AIRLINES', 70, 68);
  ctx.textAlign = 'right'; ctx.fillText('CLOVERTOOLS.CN', 1010, 68); ctx.textAlign = 'left';
  ctx.font = '600 46px system-ui, sans-serif'; ctx.fillText(t.landed, 70, 139);
  ctx.fillStyle = '#687f7d'; ctx.font = '20px system-ui, sans-serif'; ctx.fillText(t.landedHint, 70, 177);
  ctx.strokeStyle = '#387f77'; ctx.lineWidth = 2; ctx.setLineDash([7, 9]); ctx.beginPath(); ctx.moveTo(130, 375); ctx.quadraticCurveTo(540, 160, 950, 375); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#387f77'; [130,950].forEach((x) => { ctx.beginPath(); ctx.arc(x, 375, 6, 0, Math.PI * 2); ctx.fill(); });
  ctx.save(); ctx.translate(540, 267.5); ctx.scale(1.7, 1.7); ctx.fillStyle = '#fffdf5'; ctx.strokeStyle = '#244d4c'; ctx.lineWidth = 1;
  const plane = new Path2D('M 19 0 L 3 -4 L -5 -17 L -10 -17 L -6 -3 L -16 -2 L -20 -7 L -23 -7 L -20 0 L -23 7 L -20 7 L -16 2 L -6 3 L -10 17 L -5 17 L 3 4 Z'); ctx.fill(plane); ctx.stroke(plane); ctx.restore();
  ctx.fillStyle = '#244d4c'; ctx.font = '600 48px ui-monospace, monospace'; ctx.fillText(route.from, 70, 345); ctx.textAlign = 'right'; ctx.fillText(route.to, 1010, 345);
  ctx.font = '28px system-ui, sans-serif'; ctx.fillText(to, 1010, 425); ctx.textAlign = 'left'; ctx.fillText(from, 70, 425);
  ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 470, 1080, 430);
  ctx.strokeStyle = '#d7e3dc'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(0, 470); ctx.lineTo(1080, 470); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#687f7d'; ctx.font = '18px system-ui, sans-serif'; ctx.fillText(t.task, 70, 525);
  ctx.fillStyle = '#244d4c'; ctx.font = '28px system-ui, sans-serif'; wrapCanvasText(ctx, record.task || t.taskDefault, 70, 578, 940, 38);
  ctx.fillStyle = '#687f7d'; ctx.font = '18px system-ui, sans-serif'; ctx.fillText(t.duration, 70, 742); ctx.fillText(t.arrivalDone, 540, 742);
  ctx.fillStyle = '#244d4c'; ctx.font = '500 42px ui-monospace, monospace'; ctx.fillText(`${record.durationMs / 60_000}`, 70, 794);
  ctx.font = '20px system-ui, sans-serif'; ctx.fillText(t.minutes, 180, 790); ctx.fillText(dateFormat.format(record.completedAt), 540, 787);
  ctx.strokeStyle = '#d7e3dc'; ctx.beginPath(); ctx.moveTo(70, 830); ctx.lineTo(1010, 830); ctx.stroke();
  ctx.fillStyle = '#687f7d'; ctx.font = '14px ui-monospace, monospace'; ctx.fillText('FIRST CLASS FOCUS · 01A', 70, 865); ctx.textAlign = 'right'; ctx.fillText('CloverTools', 1010, 865);
  saveBlob(`clover-focus-flight-${route.from}-${route.to}.png`, await canvasBlob(canvas));
}
byId('ffSave').addEventListener('click', async () => {
  const record = session && flightRecord(session);
  if (!record || saving) return;
  saving = true; byId<HTMLButtonElement>('ffSave').disabled = true;
  try { await saveCard(record); notice(t.saved); }
  catch { notice(t.exportError); }
  finally { saving = false; byId<HTMLButtonElement>('ffSave').disabled = false; }
});
document.addEventListener('visibilitychange', () => { render(); void updateWakeLock(); });
window.addEventListener('storage', (event) => {
  if (event.key === FLIGHT_STORAGE.active || event.key === null) {
    session = parseFlight(readStorage(FLIGHT_STORAGE.active), Date.now());
    if (session) { routeId = session.routeId; byId<HTMLInputElement>('ffTask').value = session.task; byId<HTMLInputElement>('ffMinutes').value = String(session.durationMs / 60_000); }
    minutesChoice(); render(true);
  }
  if (event.key === FLIGHT_STORAGE.history || event.key === null) { history = parseFlightHistory(readStorage(FLIGHT_STORAGE.history)); showHistory(); }
});
window.addEventListener('pagehide', () => { void audio?.suspend().catch(() => {}); void wakeLock?.release().catch(() => {}); });
window.addEventListener('pageshow', () => { render(); void updateWakeLock(); if (wantsSound) void startNoise(); });
if (session) {
  byId<HTMLInputElement>('ffTask').value = session.task;
  byId<HTMLInputElement>('ffMinutes').value = String(session.durationMs / 60_000);
  if (session.state === 'landed') finish(); else notice(t.restored);
}
byId('ffLocalNote').textContent = storageAvailable ? t.local : t.storageError;
minutesChoice(); showHistory(); updateRoute(); render(true);
setInterval(() => {
  if (session?.state === 'flying') render();
  if (new Date().toDateString() !== historyDay) showHistory();
}, 250);
