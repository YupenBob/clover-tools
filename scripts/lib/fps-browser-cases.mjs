import assert from 'node:assert/strict';
import { join } from 'node:path';
import { FPS_CONFIG, TRAINING_MODES, WEAPON_PROFILES } from '../../config/fps.mjs';
import { localizedPath } from '../../config/routes.mjs';
import { BROWSER_CHECKS } from '../../config/quality.mjs';

/** Uses the existing browser harness; no production test controls or alternate game rules. */
export async function runFpsChecks({ run, remember, base, artifacts }) {
  const path = '/tools/fun/fps-aim-trainer/';
  async function open(page, context, lang = 'zh') {
    await remember(context, lang);
    await page.goto(base + localizedPath(path, lang));
    await page.waitForSelector('#fpsTrainer[data-ready=true]');
  }
  async function enter(page) {
    await page.locator('#fpsStart').click();
    await page.waitForFunction(() =>
      ['running', 'paused'].includes(document.querySelector('#fpsStage').dataset.phase),
    );
    if ((await page.locator('#fpsStage').getAttribute('data-phase')) === 'paused')
      await page.locator('#fpsResume').click();
    await page.waitForFunction(
      () => document.querySelector('#fpsStage').dataset.phase === 'running',
    );
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
      await page.locator('#fpsResume').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
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
      await page.locator('#fpsResume').click();
      await page.waitForFunction(
        () => document.querySelector('#fpsStage').dataset.phase === 'running',
      );
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
