import {
  FPS_CONFIG,
  GAME_PROFILES,
  WEAPON_PROFILES,
  TRAINING_MODES,
} from '../../../config/fps.mjs';
import { byId } from '../toolkit';
import { TrainingSession } from './core';
import { calibratedGain, cmPerTurn } from './math';
import { FpsStorage, normalizeSettings } from './storage';
import { renderHistory, renderReport, renderSources } from './report';
import { PointerCapture } from './pointer';
import { RangeAudio, type AudioStatus } from './audio';
import type { FpsText } from '../../lib/fps-i18n';
import type { Settings, FeedbackEvent } from './types';
import type { RangeRenderer } from './renderer';

const root = document.getElementById('fpsTrainer');
if (root) initialize(root);
function initialize(root: HTMLElement) {
  const $ = <T extends HTMLElement>(id: string) => byId<T>(id);
  const text: FpsText = JSON.parse(document.getElementById('fpsText')!.textContent!);
  const form = $<HTMLFormElement>('fpsSettings'),
    stage = $('fpsStage'),
    veil = $('fpsVeil');
  let canvas = $<HTMLCanvasElement>('fpsCanvas');
  let browserStorage: Storage | null = null;
  try {
    browserStorage = window.localStorage;
  } catch {
    /* Training remains usable. */
  }
  const storage = new FpsStorage(browserStorage);
  let settings = storage.preferences(),
    session: TrainingSession | null = null,
    renderer: RangeRenderer | null = null;
  let running = false,
    starting = false,
    calibrating = false,
    calibrationCounts = 0;
  let entryGeneration = 0;
  let anchor = 0,
    elapsedBase = 0,
    lastFrame = 0,
    lastHud = 0,
    raf = 0,
    oldOverflow = '';
  const pressed = new Set<string>();
  let audio: RangeAudio | null = null;
  let markerUntil = 0;
  const events = new AbortController(),
    options = { signal: events.signal };
  const status = (message: string) => {
    $('fpsStatus').textContent = message;
  };
  const control = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const activeTime = (at = performance.now()) =>
    elapsedBase + (running ? Math.max(0, at - anchor) / 1000 : 0);
  function audioStatus(state: AudioStatus) {
    const labels = {
      idle: text.audioIdle,
      loading: text.audioLoading,
      ready: text.audioReady,
      running: text.audioRunning,
      muted: text.audioMuted,
      blocked: text.audioBlocked,
      unavailable: text.audioUnavailable,
    };
    for (const id of ['fpsAudioStatus', 'fpsAudioHud']) {
      $(id).textContent = labels[state];
      $(id).dataset.state = state;
    }
  }
  function disposeAudio() {
    audio?.dispose();
    audio = null;
  }
  const capture = new PointerCapture({
    available: () =>
      !!session &&
      !!renderer &&
      !renderer.lost &&
      !stage.hidden &&
      !document.hidden &&
      document.hasFocus() &&
      !events.signal.aborted,
    request: (raw) => canvas.requestPointerLock(raw ? { unadjustedMovement: true } : undefined),
    owns: () => document.pointerLockElement === canvas,
    release: () => document.exitPointerLock(),
  });

  function writeForm() {
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'mode') {
        const radio = form.querySelector<HTMLInputElement>(`input[name=mode][value="${value}"]`);
        if (radio) radio.checked = true;
      } else if (key !== 'calibrationGain') {
        const element = control(key);
        if (element instanceof HTMLInputElement && element.type === 'checkbox')
          element.checked = !!value;
        else if (element) element.value = String(value);
      }
    }
    for (const option of $<HTMLSelectElement>('fpsWeapon').options) {
      option.hidden = option.dataset.game !== settings.game;
      option.disabled = option.hidden;
    }
    for (const output of form.querySelectorAll<HTMLOutputElement>('[data-output]')) {
      const key = output.dataset.output as keyof typeof FPS_CONFIG.controls;
      output.value = `${settings[key as keyof Settings]} ${FPS_CONFIG.controls[key].unit}`;
    }
    $('fpsGain').textContent =
      `${text.referenceGain}: ${cmPerTurn(settings).toFixed(1)} cm/360${settings.calibrationGain ? ' · ' + text.calibrated : ''}`;
    const countPolicy = TRAINING_MODES[settings.mode as keyof typeof TRAINING_MODES].count;
    control('count').disabled = countPolicy !== null;
    control('duration').disabled =
      !TRAINING_MODES[settings.mode as keyof typeof TRAINING_MODES].timed;
    const policy = TRAINING_MODES[settings.mode as keyof typeof TRAINING_MODES];
    const bots = 'customBots' in policy && policy.customBots;
    control('speed').disabled = !(bots ? settings.movingBots : policy.moving);
    $('fpsBotOptions').hidden = !bots;
    for (const key of ['sector', 'movingBots', 'infiniteAmmo', 'headOnlyBots'])
      control(key).disabled = !bots;
    control('turnMultiplier').disabled = settings.cm360 > 0 || settings.calibrationGain > 0;
  }
  function readForm(): Settings {
    const data = new FormData(form),
      values: Record<string, unknown> = { ...settings };
    for (const [key, value] of data.entries())
      values[key] = key in FPS_CONFIG.controls ? Number(value) : value;
    for (const key of [
      'muted',
      'movingBots',
      'infiniteAmmo',
      'headOnlyBots',
      'showWeapon',
      'weaponMotion',
    ])
      values[key] = (control(key) as HTMLInputElement).checked;
    return normalizeSettings(values);
  }
  function refresh() {
    writeForm();
    renderSources(settings, text);
    renderHistory(storage, settings, text, root.dataset.lang || 'en');
    if (!storage.available) status(text.storageError);
    if (!audio) audioStatus(settings.muted || settings.volume === 0 ? 'muted' : 'idle');
    for (const button of root.querySelectorAll<HTMLElement>('[data-fps-preset]'))
      button.dataset.active = String(
        FPS_CONFIG.presets[button.dataset.fpsPreset as keyof typeof FPS_CONFIG.presets].mode ===
          settings.mode,
      );
  }
  form.addEventListener(
    'input',
    (event) => {
      const target = event.target as HTMLInputElement;
      if (['dpi', 'sensitivity', 'cm360'].includes(target.name)) settings.calibrationGain = 0;
      if (target.name === 'game') {
        const game = GAME_PROFILES[target.value as keyof typeof GAME_PROFILES];
        settings = normalizeSettings({
          ...readForm(),
          game: target.value,
          weapon: '',
          sensitivity: game.values.defaultSensitivity,
          fov: game.values.defaultFov,
          calibrationGain: 0,
        });
      } else settings = readForm();
      disposeAudio();
      audioStatus(settings.muted || settings.volume === 0 ? 'muted' : 'idle');
      storage.savePreferences(settings);
      refresh();
    },
    options,
  );
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-fps-preset]')) {
    button.addEventListener(
      'click',
      () => {
        const preset =
          FPS_CONFIG.presets[button.dataset.fpsPreset as keyof typeof FPS_CONFIG.presets];
        settings = normalizeSettings({ ...readForm(), ...preset });
        disposeAudio();
        storage.savePreferences(settings);
        refresh();
      },
      options,
    );
  }
  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void enter(false);
    },
    options,
  );
  $('fpsCalibrate').addEventListener('click', () => void enter(true), options);
  $('fpsTestAudio').addEventListener(
    'click',
    () => {
      disposeAudio();
      audio = new RangeAudio(readForm(), audioStatus);
      const current = audio;
      current.activate();
      void current.prepare().then(() => {
        if (audio === current) current.test();
      });
    },
    options,
  );
  $('fpsClear').addEventListener(
    'click',
    () => {
      storage.clear();
      refresh();
    },
    options,
  );
  $('fpsResetSettings').addEventListener(
    'click',
    () => {
      storage.clearPreferences();
      settings = normalizeSettings();
      disposeAudio();
      status('');
      refresh();
    },
    options,
  );
  $('fpsBack').addEventListener(
    'click',
    () => {
      $('fpsReport').hidden = true;
      $('fpsSetup').hidden = false;
      refresh();
    },
    options,
  );
  $('fpsAgain').addEventListener('click', () => void enter(false), options);
  $('fpsFinish').addEventListener('click', () => finish(), options);
  $('fpsResume').addEventListener('click', () => void lock(), options);
  $('fpsFullscreen').addEventListener(
    'click',
    () => {
      void stage.requestFullscreen().catch(() => {
        $('fpsPauseMessage').textContent = text.fullscreenError;
      });
    },
    options,
  );

  async function enter(calibration: boolean) {
    if (starting || !form.reportValidity()) return;
    settings = readForm();
    storage.savePreferences(settings);
    if (calibration && settings.cm360 <= 0) {
      status(text.calibrationError);
      return;
    }
    if (matchMedia('(pointer: coarse)').matches || !('requestPointerLock' in canvas)) {
      status(text.desktop);
      return;
    }
    starting = true;
    const generation = ++entryGeneration;
    status(text.loading);
    try {
      // The substantial graphics dependency is requested only after entering the range.
      const { RangeRenderer } = await import('./renderer');
      if (
        generation !== entryGeneration ||
        document.hidden ||
        !document.hasFocus() ||
        events.signal.aborted
      ) {
        status(text.pause);
        return;
      }
      disposeRenderer();
      disposeAudio();
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
      session = new TrainingSession(
        settings,
        crypto.getRandomValues(new Uint32Array(1))[0],
        window.innerWidth / Math.max(1, window.innerHeight),
      );
      calibrating = calibration;
      calibrationCounts = 0;
      elapsedBase = 0;
      lastHud = 0;
      session.onFeedback = feedback;
      markerUntil = 0;
      $('fpsHitMarker').hidden = true;
      $('fpsHitText').hidden = true;
      $('fpsCrosshair').classList.remove('hit');
      if (!calibration) {
        audio = new RangeAudio(settings, audioStatus);
        const pendingAudio = audio;
        await pendingAudio.prepare();
        if (
          generation !== entryGeneration ||
          document.hidden ||
          !document.hasFocus() ||
          events.signal.aborted
        ) {
          if (audio === pendingAudio) disposeAudio();
          session = null;
          status(text.pause);
          return;
        }
      }
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      stage.hidden = false;
      stage.dataset.phase = 'paused';
      renderer = new RangeRenderer(canvas, session, () => pause(text.contextLost));
      $('fpsReport').hidden = true;
      veil.hidden = false;
      $('fpsPauseTitle').textContent = calibration ? text.calibration : text.ready;
      $('fpsPauseMessage').textContent =
        `${text.captureHint} ${calibration ? text.calibrating : text.controls}`;
      $('fpsResume').textContent = text.begin;
      $<HTMLButtonElement>('fpsResume').disabled = false;
      $('fpsDrill').textContent =
        `${session.game.name} / ${session.weapon.name} · ${text[settings.mode as keyof FpsText]}`;
      $('fpsGunLabel').textContent = session.weapon.name;
      $('fpsTimeLabel').textContent = session.mode.timed ? text.time : text.freeTime;
      renderer.render();
      hud();
      status('');
      // Loading can outlive the initiating click. Only a fresh button click may capture the mouse.
    } catch {
      running = false;
      stage.hidden = true;
      document.body.style.overflow = oldOverflow;
      disposeRenderer();
      disposeAudio();
      session = null;
      status(text.unsupported);
    } finally {
      starting = false;
    }
  }
  async function lock() {
    if (running) return;
    audio?.activate(session?.time || 0);
    if ((await capture.request()) === 'failed') pause(text.lockError);
  }
  function resume() {
    if (!session || !renderer || renderer.lost || stage.hidden || running) return;
    running = true;
    audio?.syncTime(session.time);
    anchor = lastFrame = performance.now();
    lastHud = 0;
    veil.hidden = true;
    stage.dataset.phase = calibrating ? 'calibrating' : 'running';
    $('fpsInputStatus').textContent = capture.raw ? text.raw : text.adjusted;
    if (calibrating) $('fpsMovement').textContent = text.calibrating;
    raf = requestAnimationFrame(frame);
  }
  function pause(message = text.pause, at = performance.now()) {
    capture.cancel();
    if (!session || stage.hidden) return;
    if (running && !calibrating) session.advanceTo(activeTime(at));
    elapsedBase = session.time;
    running = false;
    audio?.stop();
    pressed.clear();
    session.clearInput();
    cancelAnimationFrame(raf);
    if (calibrating) {
      finishCalibration(false);
      return;
    }
    veil.hidden = false;
    stage.dataset.phase = renderer?.lost ? 'lost' : 'paused';
    $('fpsPauseTitle').textContent = text.pause;
    $('fpsPauseMessage').textContent = message;
    $('fpsResume').textContent = text.resume;
    $<HTMLButtonElement>('fpsResume').disabled = !!renderer?.lost;
    hud();
    renderer?.render();
  }
  function frame(now: number) {
    if (!running || !session || !renderer) return;
    if ((now - lastFrame) / 1000 > FPS_CONFIG.simulation.maxFrameGap) {
      pause(text.stalled, lastFrame);
      return;
    }
    lastFrame = now;
    if (!calibrating) session.advanceTo(activeTime(now));
    renderer.render();
    if (session.time >= markerUntil) {
      $('fpsCrosshair').classList.remove('hit');
      $('fpsHitMarker').hidden = $('fpsHitText').hidden = true;
    }
    if (now - lastHud >= FPS_CONFIG.feedback.hudInterval * 1000) {
      hud();
      lastHud = now;
    }
    if (session.ended) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function hud() {
    if (!session) return;
    const result = session.result();
    $('fpsTime').textContent =
      `${Math.max(0, session.mode.timed ? settings.duration - session.time : session.time).toFixed(1)} s`;
    $('fpsAmmo').textContent = session.reloadUntil
      ? text.reload
      : session.mode.customBots && settings.infiniteAmmo
        ? '∞'
        : `${session.ammo} / ${session.weapon.values.magazine}`;
    $('fpsKills').textContent = String(result.targets);
    $('fpsAccuracy').textContent =
      result.accuracy === null ? '—' : `${(result.accuracy * 100).toFixed(0)}%`;
    const progress = $<HTMLProgressElement>('fpsReloadProgress');
    progress.hidden = !session.reloadUntil;
    progress.value = session.reloadUntil
      ? 1 - (session.reloadUntil - session.time) / session.weapon.values.reload
      : 0;
    if (!calibrating)
      $('fpsMovement').textContent =
        `${session.stable ? text.stable : text.moving} · ${session.speed.toFixed(2)} m/s${session.input.ads ? ' · ' + text.ads : ''}`;
    stage.dataset.stable = String(session.stable);
    stage.dataset.ads = String(session.input.ads);
    stage.dataset.elapsed = session.time.toFixed(3);
  }
  function disposeRenderer() {
    renderer?.dispose();
    renderer = null;
  }
  function closeStage() {
    entryGeneration++;
    capture.cancel();
    running = false;
    pressed.clear();
    session?.clearInput();
    cancelAnimationFrame(raf);
    stage.hidden = true;
    stage.dataset.phase = 'closed';
    if (document.fullscreenElement === stage) void document.exitFullscreen().catch(() => {});
    document.body.style.overflow = oldOverflow;
    disposeRenderer();
    disposeAudio();
  }
  function finish(show = true) {
    if (!session) return;
    if (calibrating) {
      finishCalibration(false);
      return;
    }
    if (running) session.advanceTo(activeTime());
    const result = session.result();
    closeStage();
    storage.save(result);
    if (show) {
      renderReport(result, text);
      $('fpsSetup').hidden = true;
      $('fpsReport').hidden = false;
      $('fpsAgain').focus();
    }
    session = null;
    refresh();
  }
  function finishCalibration(save: boolean) {
    if (!calibrating) return;
    calibrating = false;
    if (save) {
      try {
        settings.calibrationGain = calibratedGain(
          calibrationCounts,
          FPS_CONFIG.calibration.distanceCm,
          settings.cm360,
        );
        settings = normalizeSettings(settings);
        storage.savePreferences(settings);
        status(text.calibrated);
      } catch {
        status(text.calibrationError);
      }
    }
    closeStage();
    session = null;
    refresh();
  }
  function movement(at = performance.now()) {
    if (!session || !running || calibrating) return;
    const keys = FPS_CONFIG.keys;
    session.setInput(activeTime(at), {
      forward: Number(pressed.has(keys.forward)) - Number(pressed.has(keys.back)),
      side: Number(pressed.has(keys.right)) - Number(pressed.has(keys.left)),
      walk: pressed.has(keys.walk),
      crouch: pressed.has(keys.crouch),
    });
  }
  document.addEventListener(
    'pointerlockchange',
    () => {
      if (capture.acceptChange()) resume();
      else if (running) pause();
    },
    options,
  );
  document.addEventListener(
    'pointerlockerror',
    () => {
      if (!stage.hidden && capture.handleError()) pause(text.lockError);
    },
    options,
  );
  window.addEventListener(
    'blur',
    () => {
      entryGeneration++;
      pause();
    },
    options,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        entryGeneration++;
        pause();
      }
    },
    options,
  );
  document.addEventListener(
    'mousemove',
    (event) => {
      if (!running || document.pointerLockElement !== canvas || !session) return;
      if (calibrating) calibrationCounts += event.movementX;
      else session.aim(activeTime(event.timeStamp), event.movementX, event.movementY);
    },
    options,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (!running || !session || document.pointerLockElement !== canvas) return;
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (!Object.values(FPS_CONFIG.keys).includes(event.code)) return;
      event.preventDefault();
      pressed.add(event.code);
      movement(event.timeStamp);
      if (event.code === FPS_CONFIG.keys.reload && !event.repeat && !calibrating)
        session.reload(activeTime(event.timeStamp));
    },
    options,
  );
  document.addEventListener(
    'keyup',
    (event) => {
      if (pressed.delete(event.code)) {
        event.preventDefault();
        movement(event.timeStamp);
      }
    },
    options,
  );
  document.addEventListener(
    'mousedown',
    (event) => {
      if (!running || document.pointerLockElement !== canvas || !session) return;
      event.preventDefault();
      if (calibrating && event.button === 0) {
        finishCalibration(true);
        return;
      }
      if (event.button === 0) session.setInput(activeTime(event.timeStamp), { firing: true });
      if (event.button === 2) session.setInput(activeTime(event.timeStamp), { ads: true });
    },
    options,
  );
  document.addEventListener(
    'mouseup',
    (event) => {
      if (!running || !session || calibrating) return;
      if (event.button === 0) session.setInput(activeTime(event.timeStamp), { firing: false });
      if (event.button === 2) session.setInput(activeTime(event.timeStamp), { ads: false });
    },
    options,
  );
  stage.addEventListener('contextmenu', (event) => event.preventDefault(), options);
  window.addEventListener(
    'pagehide',
    () => {
      entryGeneration++;
      capture.cancel();
      if (session) finish(false);
      events.abort();
      disposeAudio();
    },
    { once: true },
  );
  function feedback(event: FeedbackEvent) {
    renderer?.feedback(event);
    try {
      audio?.feedback(event);
    } catch {
      disposeAudio();
      audioStatus('unavailable');
    }
    if (event.kind !== 'shot' || !event.shot.region) return;
    markerUntil = event.time + FPS_CONFIG.feedback.markerSeconds;
    $('fpsCrosshair').classList.add('hit');
    $('fpsHitMarker').hidden = $('fpsHitText').hidden = false;
    $('fpsHitMarker').dataset.complete = String(event.completed);
    $('fpsHitText').textContent = event.completed
      ? text.feedbackComplete
      : event.shot.region === 'head'
        ? text.feedbackHead
        : text.feedbackHit;
  }
  refresh();
  audioStatus(settings.muted || settings.volume === 0 ? 'muted' : 'idle');
  if (matchMedia('(pointer: coarse)').matches) {
    status(text.desktop);
    $<HTMLButtonElement>('fpsStart').disabled = true;
    $<HTMLButtonElement>('fpsCalibrate').disabled = true;
  }
  root.dataset.ready = 'true';
}
