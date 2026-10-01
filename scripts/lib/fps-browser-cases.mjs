import assert from 'node:assert/strict';
import { join } from 'node:path';
import { FPS_CONFIG, TRAINING_MODES, WEAPON_PROFILES } from '../../config/fps.mjs';
import { localizedPath } from '../../config/routes.mjs';
import { BROWSER_CHECKS } from '../../config/quality.mjs';
import { TrainingSession } from '../../src/scripts/fps/core.ts';
import { mouseGain } from '../../src/scripts/fps/math.ts';

/** Uses the existing browser harness; no production test controls or alternate game rules. */
export async function runFpsChecks({ run, remember, base, artifacts }) {
  const path = '/tools/fun/fps-aim-trainer/';
  async function open(page, context, lang = 'zh') {
    await remember(context, lang);
    await page.goto(base + localizedPath(path, lang));
    await page.waitForSelector('#fpsTrainer[data-ready=true]');
  }
  async function enter(page) {
    await page.evaluate(() => {
      const trace = (window.__fpsLockTrace = []);
      const record = (event) =>
        trace.push({
          event,
          locked: document.pointerLockElement?.id || null,
          focused: document.hasFocus(),
          at: performance.now(),
        });
      document.addEventListener('pointerlockchange', () => record('change'));
      document.addEventListener('pointerlockerror', () => record('error'));
      window.addEventListener('blur', () => record('blur'));
      const original = HTMLCanvasElement.prototype.requestPointerLock;
      HTMLCanvasElement.prototype.requestPointerLock = function (options) {
        record(options?.unadjustedMovement ? 'request-raw' : 'request-adjusted');
        const pending = original.call(this, options);
        Promise.resolve(pending).then(
          () => record('resolved'),
          (error) => record(`rejected:${error.name}:${error.message}`),
        );
        return pending;
      };
    });
    await page.locator('#fpsStart').click();
    await page.waitForFunction(() =>
      ['running', 'paused'].includes(document.querySelector('#fpsStage').dataset.phase),
    );
    if ((await page.locator('#fpsStage').getAttribute('data-phase')) === 'paused')
      await page.locator('#fpsResume').click();
    try {
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        phase: document.querySelector('#fpsStage').dataset.phase,
        message: document.querySelector('#fpsPauseMessage').textContent,
        status: document.querySelector('#fpsStatus').textContent,
        elapsed: document.querySelector('#fpsStage').dataset.elapsed,
        locked: document.pointerLockElement?.id || null,
        active: document.activeElement?.id,
        focused: document.hasFocus(),
        hidden: document.hidden,
        trace: window.__fpsLockTrace,
      }));
      throw new Error(`Range start failed: ${JSON.stringify(state)}`, {
        cause: error,
      });
    }
    assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'fpsCanvas');
  }
  async function pause(page) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => document.querySelector('#fpsStage').dataset.phase === 'paused',
    );
    // A real Esc exit arms the browser's relock cooldown. Keep the user click after that window.
    await page.waitForTimeout(BROWSER_CHECKS.pointerUnlockSettleMs);
  }
  async function recover(page) {
    // Let native unlock notifications settle before a new user gesture, including synthetic hide tests.
    await page.waitForFunction(() => document.pointerLockElement === null);
    await page.waitForTimeout(BROWSER_CHECKS.pointerUnlockSettleMs);
    await page.locator('#fpsResume').click();
    try {
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        phase: document.querySelector('#fpsStage').dataset.phase,
        message: document.querySelector('#fpsPauseMessage').textContent,
        trace: window.__fpsLockTrace,
        focused: document.hasFocus(),
        hidden: document.hidden,
        locked: document.pointerLockElement?.id || null,
      }));
      throw new Error(`Recovery failed: ${JSON.stringify(state)}`, {
        cause: error,
      });
    }
  }
  await run(
    'FPS presentation: gesture audio, waveform, reload and pause cleanup',
    { viewport: { width: 1440, height: 1000 } },
    async (page, context) => {
      await context.addInitScript(() => {
        window.__fpsAudioContexts = [];
        window.__fpsAudioMeters = [];
        window.__fpsAudioVoices = [];
        const NativeAudio = window.AudioContext;
        window.AudioContext = class extends NativeAudio {
          constructor(...args) {
            super(...args);
            window.__fpsAudioContexts.push(this);
          }
          createDynamicsCompressor() {
            const compressor = super.createDynamicsCompressor(),
              analyser = super.createAnalyser();
            compressor.connect(analyser);
            window.__fpsAudioMeters.push(analyser);
            return compressor;
          }
          createBufferSource() {
            const source = super.createBufferSource(),
              start = source.start.bind(source),
              stop = source.stop.bind(source);
            const entry = { started: false, stopped: false, ended: false, duration: 0 };
            source.addEventListener('ended', () => {
              entry.ended = true;
            });
            source.start = (...args) => {
              entry.started = true;
              entry.duration = source.buffer.duration;
              window.__fpsAudioVoices.push(entry);
              return start(...args);
            };
            source.stop = (...args) => {
              entry.stopped = true;
              return stop(...args);
            };
            return source;
          }
        };
      });
      await open(page, context);
      await page.locator('[data-fps-preset=ballWarmup]').click();
      await page.locator('#fpsTestAudio').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsAudioStatus').dataset.state === 'running',
      );
      await page.waitForFunction(() =>
        window.__fpsAudioMeters.some((meter) => {
          const values = new Float32Array(meter.fftSize);
          meter.getFloatTimeDomainData(values);
          return values.some((value) => Math.abs(value) > 0.001);
        }),
      );
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      assert.equal(await page.locator('#fpsStage').isHidden(), true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(artifacts, 'fps-polished-settings.png'), fullPage: true });
      await enter(page);
      await page.waitForFunction(
        () => document.querySelector('#fpsAudioHud').dataset.state === 'running',
      );
      assert.equal(await page.evaluate(() => window.__fpsAudioContexts[0].state), 'closed');
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.keyboard.press('r');
      await page.waitForFunction(() => !document.querySelector('#fpsReloadProgress').hidden);
      assert.ok(
        await page.evaluate(() => window.__fpsAudioVoices.some((voice) => voice.duration > 1)),
      );
      await page.screenshot({ path: join(artifacts, 'fps-polished-reload.png') });
      await pause(page);
      assert.equal(await page.locator('#fpsAudioHud').getAttribute('data-state'), 'ready');
      assert.equal(
        await page.evaluate(
          () =>
            window.__fpsAudioVoices.filter(
              (voice) => voice.started && !voice.stopped && !voice.ended,
            ).length,
        ),
        0,
      );
      const count = await page.evaluate(() => window.__fpsAudioVoices.length);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.__fpsAudioVoices.length), count);
      await page.locator('#fpsFinish').click();
      await page.waitForFunction(() =>
        window.__fpsAudioContexts.every((ctx) => ctx.state === 'closed'),
      );
    },
  );
  await run('FPS presentation: mute and saved visual controls', {}, async (page, context) => {
    const requested = [];
    page.on('request', (request) => requested.push(request.url()));
    await open(page, context);
    await page.locator('[name=muted]').check();
    await page.locator('[name=showWeapon]').uncheck();
    await page.locator('[name=weaponMotion]').uncheck();
    await page.locator('[name=volume]').evaluate((element) => {
      element.value = '35';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.reload();
    await page.waitForSelector('#fpsTrainer[data-ready=true]');
    assert.equal(await page.locator('[name=volume]').inputValue(), '35');
    assert.equal(await page.locator('[name=showWeapon]').isChecked(), false);
    assert.equal(await page.locator('[name=weaponMotion]').isChecked(), false);
    await enter(page);
    assert.equal(await page.locator('#fpsAudioHud').getAttribute('data-state'), 'muted');
    assert.equal(
      requested.some((url) => /\/fps\/audio\/.*\.wav/.test(url)),
      false,
    );
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await pause(page);
    await page.locator('#fpsFinish').click();
    assert.ok(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key))[0].shots > 0,
        FPS_CONFIG.storage.history,
      ),
    );
  });
  await run(
    'FPS presentation: denied audio does not deny mouse capture or training',
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        AudioContext.prototype.resume = () =>
          Promise.reject(new DOMException('Denied test audio', 'NotAllowedError'));
      });
      await open(page, context);
      await enter(page);
      await page.waitForFunction(
        () => document.querySelector('#fpsAudioHud').dataset.state === 'blocked',
      );
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.keyboard.down('d');
      await page.waitForTimeout(100);
      await page.keyboard.up('d');
      assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'running');
      await pause(page);
      await page.locator('#fpsFinish').click();
    },
  );
  await run(
    'FPS presentation: missing audio files keep an explicit degraded state',
    {},
    async (page, context) => {
      await context.route('**/fps/audio/*.wav', (route) => route.abort());
      await open(page, context);
      await enter(page);
      assert.equal(await page.locator('#fpsAudioHud').getAttribute('data-state'), 'unavailable');
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();
      await pause(page);
      await page.locator('#fpsFinish').click();
      assert.equal(await page.locator('#fpsReport').isVisible(), true);
    },
  );
  for (const [lang, title] of [
    ['zh', 'FPS练枪'],
    ['tw', 'FPS練槍'],
    ['en', 'FPS Aim Trainer'],
    ['ko', 'FPS 에임 훈련'],
    ['ja', 'FPSエイム練習'],
  ]) {
    await run(
      `FPS ${lang}: shared controls, language and lazy graphics`,
      { viewport: { width: 1440, height: 1000 } },
      async (page, context) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));
        await open(page, context, lang);
        assert.equal(await page.locator('h1').innerText(), title);
        assert.equal(
          await page.locator('input[name=mode]').count(),
          Object.keys(TRAINING_MODES).length,
        );
        assert.equal(
          await page.locator('[name=duration]').inputValue(),
          String(FPS_CONFIG.defaults.duration),
        );
        assert.equal(
          requested.some((url) => /\/renderer\.[^/]+\.js/.test(url)),
          false,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (lang === 'en') {
          await page.locator('#themeToggle').click();
          await page.screenshot({
            path: join(artifacts, 'fps-settings-dark.png'),
            fullPage: true,
          });
        }
      },
    );
  }
  await run(
    'FPS presentation: four rifle silhouettes and visible ADS',
    { viewport: { width: 1440, height: 1000 } },
    async (page, context) => {
      await open(page, context);
      for (const [id, weapon] of Object.entries(WEAPON_PROFILES)) {
        await page.locator('#fpsGame').selectOption(weapon.values.game);
        await page.locator('#fpsWeapon').selectOption(id);
        await page.locator('[data-fps-preset=ballWarmup]').click();
        await enter(page);
        await page.screenshot({ path: join(artifacts, `fps-viewmodel-${id}.png`) });
        if (weapon.values.adsZoom > 1) {
          await page.mouse.down({ button: 'right' });
          await page.waitForFunction(
            () => document.querySelector('#fpsStage').dataset.ads === 'true',
          );
          await page.screenshot({ path: join(artifacts, `fps-viewmodel-${id}-ads.png`) });
          await page.mouse.up({ button: 'right' });
        }
        await pause(page);
        await page.locator('#fpsFinish').click();
        await page.locator('#fpsBack').click();
      }
    },
  );
  await run(
    'FPS desktop: live shots, movement, crouch, reload, pause and local results',
    { viewport: { width: 1440, height: 1000 } },
    async (page, context) => {
      await open(page, context);
      await page.locator('[name=mode][value=spray]').check();
      await enter(page);
      await page.waitForTimeout(100);
      await page.screenshot({ path: join(artifacts, 'fps-range-desktop.png') });
      const before = await page.locator('#fpsAmmo').innerText();
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(150);
      assert.notEqual(await page.locator('#fpsAmmo').innerText(), before);
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-stable'), 'false');
      await page.keyboard.up('KeyD');
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-stable'), 'true');
      await page.keyboard.down('Control');
      await page.waitForTimeout(100);
      await page.keyboard.up('Control');
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(100);
      assert.match(await page.locator('#fpsAmmo').innerText(), /换弹/);
      await pause(page);
      const frozen = await page.locator('#fpsStage').getAttribute('data-elapsed');
      await page.waitForTimeout(450);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-elapsed'), frozen);
      await page.locator('#fpsFullscreen').click();
      await page.waitForFunction(
        () =>
          document.fullscreenElement !== null ||
          document.querySelector('#fpsPauseMessage').textContent.includes('全屏'),
      );
      await page.locator('#fpsResume').click();
      try {
        await page.waitForFunction(
          () => document.querySelector('#fpsStage').dataset.phase === 'running',
        );
      } catch (error) {
        const state = await page.evaluate(() => ({
          phase: document.querySelector('#fpsStage').dataset.phase,
          message: document.querySelector('#fpsPauseMessage').textContent,
          locked: !!document.pointerLockElement,
          focused: document.hasFocus(),
          hidden: document.hidden,
        }));
        throw new Error(`Fullscreen resume failed: ${JSON.stringify(state)}`, {
          cause: error,
        });
      }
      await pause(page);
      await page.locator('#fpsFinish').click();
      assert.equal(await page.locator('#fpsReport').isVisible(), true);
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.ok(Number(await page.locator('[data-metric=shots] strong').innerText()) >= 1);
      const stored = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        FPS_CONFIG.storage.history,
      );
      assert.ok(stored[0].impacts.length >= 1);
      assert.ok(stored[0].heads >= 1);
      assert.equal(stored[0].completed, false);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(artifacts, 'fps-report-desktop.png'),
        fullPage: true,
      });
      await page.locator('#fpsBack').click();
      await page.reload();
      await page.waitForSelector('#fpsTrainer[data-ready=true]');
      assert.equal(await page.locator('[name=mode]:checked').inputValue(), 'spray');
      await page.locator('#fpsClear').click();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), FPS_CONFIG.storage.history),
        null,
      );
      await page.locator('#fpsResetSettings').click();
      assert.equal(
        await page.locator('[name=mode]:checked').inputValue(),
        FPS_CONFIG.defaults.mode,
      );
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), FPS_CONFIG.storage.preferences),
        null,
      );
    },
  );
  await run(
    'FPS bot range: sectors, moving bots, unlimited ammo and faster turning preferences',
    { viewport: { width: 1440, height: 1000 } },
    async (page, context) => {
      await open(page, context);
      await page.locator('[data-fps-preset=botWarmup]').click();
      assert.equal(await page.locator('[name=mode]:checked').inputValue(), 'free');
      assert.equal(
        await page.locator('[name=turnMultiplier]').inputValue(),
        String(FPS_CONFIG.defaults.turnMultiplier),
      );
      await page.locator('[name=sector]').selectOption('surround');
      await page.locator('[name=movingBots]').check();
      assert.equal(await page.locator('[name=speed]').isEnabled(), true);
      await page.locator('[name=headOnlyBots]').uncheck();
      await page.locator('[name=turnMultiplier]').fill('6');
      await page.reload();
      await page.waitForSelector('#fpsTrainer[data-ready=true]');
      assert.equal(await page.locator('[name=turnMultiplier]').inputValue(), '6');
      assert.equal(await page.locator('[name=sector]').inputValue(), 'surround');
      assert.equal(await page.locator('[name=movingBots]').isChecked(), true);
      assert.equal(await page.locator('[name=headOnlyBots]').isChecked(), false);
      await page.locator('[data-fps-preset=botWarmup]').click();
      await enter(page);
      await page.screenshot({ path: join(artifacts, 'fps-bot-range.png') });
      assert.equal(await page.locator('#fpsAmmo').innerText(), '∞');
      await page.mouse.move(720, 500);
      await page.mouse.move(1000, 500);
      await page.screenshot({ path: join(artifacts, 'fps-bot-turn.png') });
      await page.mouse.down();
      await page.waitForTimeout(3300);
      await page.mouse.up();
      assert.equal(await page.locator('#fpsAmmo').innerText(), '∞');
      await pause(page);
      await page.locator('#fpsFinish').click();
      assert.ok(
        Number(await page.locator('[data-metric=shots] strong').innerText()) >
          WEAPON_PROFILES.ak47.values.magazine,
      );
      const stored = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key))[0],
        FPS_CONFIG.storage.history,
      );
      assert.equal(stored.settings.turnMultiplier, 6);
    },
  );
  await run(
    'FPS small balls: actual hit, rapid respawn and ball-specific report',
    { viewport: { width: 1440, height: 1000 } },
    async (page, context) => {
      await open(page, context);
      await page.evaluate(() => {
        window.__fpsAimTrace = [];
        document.addEventListener('mousemove', (event) => {
          if (document.querySelector('#fpsStage').dataset.phase === 'running')
            window.__fpsAimTrace.push({
              x: event.movementX,
              y: event.movementY,
              locked: !!document.pointerLockElement,
            });
        });
        crypto.getRandomValues = (array) => {
          array.fill(22);
          return array;
        };
      });
      await page.locator('[data-fps-preset=ballWarmup]').click();
      await page.screenshot({
        path: join(artifacts, 'fps-ball-settings.png'),
        fullPage: true,
      });
      await enter(page);
      const simulation = new TrainingSession(FPS_CONFIG.presets.ballWarmup, 22);
      const target = simulation.targets[0],
        eye = simulation.eye;
      const yaw = Math.atan2(target.x - eye.x, eye.z - target.z);
      const pitch = Math.atan2(target.y - eye.y, Math.hypot(target.x - eye.x, target.z - eye.z));
      await page.evaluate(
        ({ dx, dy }) =>
          document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy })),
        {
          dx: yaw / mouseGain(simulation.settings),
          dy: -pitch / mouseGain(simulation.settings),
        },
      );
      await page.waitForTimeout(100);
      await page.screenshot({
        path: join(artifacts, 'fps-small-ball-range.png'),
      });
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(200);
      assert.equal(
        await page.locator('#fpsKills').innerText(),
        '1',
        JSON.stringify(
          await page.evaluate(() => ({
            trace: window.__fpsAimTrace,
            prefs: localStorage.getItem('ct-fps-prefs'),
          })),
        ),
      );
      await pause(page);
      await page.locator('#fpsFinish').click();
      assert.equal(await page.locator('[data-metric=headRate]').count(), 0);
      assert.match(await page.locator('#fpsImpactTitle').innerText(), /小球/);
      const stored = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key))[0],
        FPS_CONFIG.storage.history,
      );
      assert.equal(stored.impacts[0].region, 'ball');
      assert.equal(stored.headRate, null);
      assert.equal(stored.targets, 1);
    },
  );
  for (const mode of Object.keys(TRAINING_MODES).filter((id) => TRAINING_MODES[id].timed)) {
    await run(
      `FPS ${mode}: full timed session and report`,
      { viewport: { width: 1280, height: 900 } },
      async (page, context) => {
        await open(page, context);
        await page.locator(`[name=mode][value=${mode}]`).check();
        await page.locator('[name=duration]').fill(String(FPS_CONFIG.controls.duration.min));
        await enter(page);
        await pause(page);
        const frozen = await page.locator('#fpsStage').getAttribute('data-elapsed');
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#fpsStage').getAttribute('data-elapsed'), frozen);
        await page.locator('#fpsResume').click();
        await page.waitForFunction(
          () => document.querySelector('#fpsStage').dataset.phase === 'running',
        );
        try {
          await page.locator('#fpsReport').waitFor({
            state: 'visible',
            timeout: (FPS_CONFIG.controls.duration.min + 12) * 1000,
          });
        } catch (error) {
          const state = await page.evaluate(() => ({
            phase: document.querySelector('#fpsStage').dataset.phase,
            message: document.querySelector('#fpsPauseMessage').textContent,
            elapsed: document.querySelector('#fpsStage').dataset.elapsed,
            locked: !!document.pointerLockElement,
            focused: document.hasFocus(),
            hidden: document.hidden,
          }));
          throw new Error(`Timed ${mode} session failed: ${JSON.stringify(state)}`, {
            cause: error,
          });
        }
        assert.equal(await page.locator('#fpsCompletion').innerText(), '已完成');
        assert.equal(await page.evaluate(() => document.pointerLockElement), null);
        assert.equal(await page.locator('[data-metric=accuracy] strong').innerText(), '—');
      },
    );
  }
  await run(
    'FPS VALORANT: game filtering, ADS and raw-input fallback',
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.requestPointerLock;
        HTMLCanvasElement.prototype.requestPointerLock = function (options) {
          if (options?.unadjustedMovement)
            return Promise.reject(new DOMException('unsupported raw', 'NotSupportedError'));
          return original.call(this);
        };
      });
      await open(page, context);
      await page.locator('[name=game]').selectOption('valorant');
      assert.equal(await page.locator('[name=sensitivity]').inputValue(), '0.35');
      assert.equal(await page.locator('#fpsWeapon option:not([disabled])').count(), 2);
      for (const weapon of ['vandal', 'phantom']) {
        await page.locator('[name=weapon]').selectOption(weapon);
        await page.locator('[name=mode][value=free]').check();
        await enter(page);
        assert.match(await page.locator('#fpsInputStatus').innerText(), /普通鼠标/);
        // Linux Chromium can emit the raw request's error after granting ordinary input.
        await page.evaluate(() => document.dispatchEvent(new Event('pointerlockerror')));
        assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'running');
        assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'fpsCanvas');
        await page.mouse.down({ button: 'right' });
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#fpsStage').getAttribute('data-ads'), 'true');
        await page.mouse.up({ button: 'right' });
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.mouse.up();
        await pause(page);
        await page.locator('#fpsFinish').click();
        const result = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key))[0],
          FPS_CONFIG.storage.history,
        );
        assert.equal(result.settings.weapon, weapon);
        assert.ok(result.shots >= 1 && result.shots < WEAPON_PROFILES[weapon].values.magazine);
        await page.locator('#fpsBack').click();
      }
    },
  );
  await run(
    'FPS calibration: physical counts are saved and invalidated when sensitivity changes',
    {},
    async (page, context) => {
      await open(page, context);
      await page.locator('#fpsAdvanced summary').click();
      await page.locator('[name=cm360]').fill('40');
      await page.locator('#fpsCalibrate').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'paused',
      );
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.locator('#fpsResume').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'calibrating',
      );
      await page.mouse.move(100, 100);
      await page.mouse.move(700, 100);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('#fpsStage').hidden);
      let prefs = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).settings,
        FPS_CONFIG.storage.preferences,
      );
      assert.ok(prefs.calibrationGain > 0);
      await page.locator('[name=sensitivity]').fill('2');
      prefs = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).settings,
        FPS_CONFIG.storage.preferences,
      );
      assert.equal(prefs.calibrationGain, 0);
    },
  );
  await run(
    'FPS failure lifecycle: focus, hidden tab, lock denial and WebGL loss',
    {},
    async (page, context) => {
      await open(page, context);
      await enter(page);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'paused');
      await recover(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'paused');
      await page.evaluate(() => {
        delete document.hidden;
      });
      await recover(page);
      await page.evaluate(() =>
        document
          .querySelector('#fpsCanvas')
          .getContext('webgl2')
          .getExtension('WEBGL_lose_context')
          .loseContext(),
      );
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'lost',
      );
      assert.equal(await page.locator('#fpsResume').isDisabled(), true);
      await page.locator('#fpsFinish').click();
      await page.locator('#fpsBack').click();
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.requestPointerLock = () =>
          Promise.reject(new DOMException('denied', 'NotAllowedError'));
      });
      await page.locator('#fpsStart').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'paused',
      );
      await page.locator('#fpsResume').click();
      await page.waitForFunction(() =>
        document.querySelector('#fpsPauseMessage').textContent.includes('锁定失败'),
      );
      assert.match(await page.locator('#fpsPauseMessage').innerText(), /锁定失败/);
      await page.locator('#fpsFinish').click();
    },
  );
  await run(
    'FPS mouse ownership: preparation, cancelled late grants and focus never capture automatically',
    {},
    async (page, context) => {
      await open(page, context);
      await page.route('**/renderer.*.js', async (route) => {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await route.continue();
      });
      await page.locator('#fpsStart').click();
      await page.waitForFunction(() =>
        document.querySelector('#fpsStatus').textContent.includes('暂停'),
      );
      assert.equal(await page.locator('#fpsStage').isVisible(), false);
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.unroute('**/renderer.*.js');
      await page.locator('#fpsStart').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'paused',
      );
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-elapsed'), '0.000');
      await page.screenshot({ path: join(artifacts, 'fps-ready-desktop.png') });
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.requestPointerLock;
        window.__fpsOriginalLock = original;
        HTMLCanvasElement.prototype.requestPointerLock = function (options) {
          const pending = original.call(this, options);
          document.querySelector('#fpsFinish').focus();
          window.dispatchEvent(new Event('blur'));
          return pending;
        };
      });
      await page.locator('#fpsResume').click();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'paused');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'fpsFinish');
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.requestPointerLock = window.__fpsOriginalLock;
        window.dispatchEvent(new Event('focus'));
      });
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.locator('#fpsResume').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
      await page.evaluate((ms) => {
        const until = performance.now() + ms;
        while (performance.now() < until) {
          /* Deliberate short render stall. */
        }
      }, FPS_CONFIG.simulation.maxFrameGap * 500);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#fpsStage').getAttribute('data-phase'), 'running');
      assert.equal(await page.evaluate(() => document.pointerLockElement?.id), 'fpsCanvas');
      await page.evaluate(() => {
        // Pause controls are hidden while running. Preserve focus on the visible canvas instead.
        const canvas = document.querySelector('#fpsCanvas');
        canvas.tabIndex = 0;
        canvas.focus();
        window.dispatchEvent(new Event('blur'));
      });
      assert.equal(await page.evaluate(() => document.activeElement.id), 'fpsCanvas');
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.locator('#fpsResume').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
      await page.evaluate((ms) => {
        const until = performance.now() + ms;
        while (performance.now() < until) {
          /* Deliberate long render stall. */
        }
      }, FPS_CONFIG.simulation.maxFrameGap * 1200);
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'paused',
      );
      assert.match(await page.locator('#fpsPauseMessage').innerText(), /画面停顿/);
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.locator('#fpsFinish').click();
    },
  );
  await run(
    'FPS mobile: explanatory state, disabled training and no overflow',
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    async (page, context) => {
      await open(page, context);
      assert.equal(await page.locator('#fpsStart').isDisabled(), true);
      assert.match(await page.locator('#fpsStatus').innerText(), /电脑键盘与鼠标/);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({
        path: join(artifacts, 'fps-settings-mobile.png'),
        fullPage: true,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(artifacts, 'fps-mobile-viewport.png'),
      });
    },
  );
  await run(
    'FPS M4A1-S and denied storage: training and reports remain available',
    {},
    async (page, context) => {
      await context.addInitScript(() =>
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('denied', 'SecurityError');
          },
        }),
      );
      await page.goto(base + path);
      await page.waitForSelector('#fpsTrainer[data-ready=true]');
      assert.match(await page.locator('#fpsStatus').innerText(), /存储不可用/);
      await page.locator('[name=weapon]').selectOption('m4a1s');
      await page.locator('[name=quality]').selectOption('performance');
      await page.locator('[name=mode][value=spray]').check();
      await enter(page);
      assert.equal(
        await page.evaluate(
          () =>
            document.querySelector('#fpsCanvas').getContext('webgl2').getContextAttributes()
              .antialias,
        ),
        FPS_CONFIG.quality.performance.antialias,
      );
      await page.mouse.down();
      await page.waitForTimeout(250);
      await page.mouse.up();
      await pause(page);
      await page.locator('#fpsFinish').click();
      assert.ok(Number(await page.locator('[data-metric=shots] strong').innerText()) > 1);
      assert.equal(await page.locator('#fpsReport').isVisible(), true);
    },
  );
  await run(
    'FPS unavailable WebGL: clear fallback without entering an empty range',
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return kind === 'webgl2' ? null : original.call(this, kind, ...args);
        };
      });
      await open(page, context);
      await page.locator('#fpsStart').click();
      await page.waitForFunction(() =>
        document.querySelector('#fpsStatus').textContent.includes('WebGL 2'),
      );
      assert.equal(await page.locator('#fpsStage').isVisible(), false);
    },
  );
}
