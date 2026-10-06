import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localizedPath } from "../../config/routes.mjs";
import { FLIGHT_STORAGE, createFlight } from "../../src/lib/focus-flight.ts";
import { flightText } from "../../src/lib/focus-flight-i18n.ts";

async function fits(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "flight tool fits the viewport",
  );
}
async function board(page, clock = false) {
  await page.click("#ffPrimary");
  assert.equal(await page.locator("#ffBoardingDialog").isVisible(), true);
  await page.click("#ffTear");
  if (clock) await page.clock.runFor(1500);
  await state(page, "flying");
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("ff-immersive"),
  );
}
async function state(page, value) {
  await page.waitForFunction(
    (value) => document.querySelector("#ffRoot")?.dataset.state === value,
    value,
  );
}
async function showControls(page) {
  if ((await page.locator("#ffRoot").getAttribute("data-idle")) === "true")
    await page.locator("#ffReveal").click();
}
async function flightControl(page) {
  await showControls(page);
  await page.click("#ffControl");
}
export async function runFocusFlightChecks({ run, remember, base, artifacts }) {
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const t = flightText(lang);
    await run(
      `focus flight validation, pause, deadline, log and PNG ${lang}`,
      { viewport: { width: 1440, height: 1080 } },
      async (page, context) => {
        await remember(context, lang);
        await page.clock.install({ time: new Date("2026-10-05T09:00:00Z") });
        await page.clock.pauseAt(new Date("2026-10-05T09:00:01Z"));
        await page.goto(base + localizedPath("/tools/fun/focus-flight/", lang));
        await fits(page);
        assert.equal(await page.locator("[data-route]").count(), 6);
        await page.locator('[data-route="hongkong-singapore"]').click();
        assert.equal(await page.inputValue("#ffMinutes"), "60");
        assert.equal(await page.textContent("#ffToCode"), "SIN");
        for (const invalid of ["0", "181", "1.5"]) {
          await page.fill("#ffMinutes", invalid);
          await page.click("#ffPrimary");
          assert.equal(
            await page.locator("#ffMinutes").getAttribute("aria-invalid"),
            "true",
          );
          await state(page, "boarding");
        }
        await page.fill("#ffMinutes", "1");
        await page.fill(
          "#ffTask",
          "<img src=x onerror=alert(1)> Read a chapter",
        );
        await board(page, true);
        assert.equal(await page.locator("#ffTask").isDisabled(), true);
        assert.equal(await page.locator("#ffMinutes").isDisabled(), true);
        assert.equal(
          await page.locator("#ffRoutes button:disabled").count(),
          6,
        );
        await page.clock.fastForward(20_000);
        assert.equal(await page.textContent("#ffClock"), "00:40");
        const originalArrival = await page.textContent("#ffArrivalTime");
        await flightControl(page);
        await state(page, "paused");
        const plane = await page.locator("#ffPlane").getAttribute("transform");
        await page.clock.fastForward(60_000);
        assert.equal(await page.textContent("#ffClock"), "00:40");
        assert.equal(
          await page.locator("#ffPlane").getAttribute("transform"),
          plane,
        );
        assert.equal(await page.textContent("#ffArrivalTime"), "—");
        await flightControl(page);
        await state(page, "flying");
        assert.notEqual(
          await page.textContent("#ffArrivalTime"),
          originalArrival,
        );
        await page.clock.fastForward(40_000);
        await state(page, "landed");
        assert.equal(await page.textContent("#ffClock"), "00:00");
        assert.equal(
          await page.locator("#ffProgress").getAttribute("aria-valuenow"),
          "100",
        );
        assert.equal(await page.locator("#ffLogList li").count(), 1);
        assert.equal(await page.locator("#ffLogList img").count(), 0);
        assert.equal(
          await page.locator("#ffActiveTask").textContent(),
          "<img src=x onerror=alert(1)> Read a chapter",
        );
        assert.equal(await page.textContent("#ffLandings"), "1");
        assert.ok((await page.textContent("#ffNotice")).includes(t.cities[6]));
        const pending = page.waitForEvent("download");
        await page.click("#ffSave");
        const download = await pending;
        assert.equal(await download.failure(), null);
        const path = join(artifacts, `focus-flight-card-${lang}.png`);
        await download.saveAs(path);
        const bytes = await readFile(path);
        assert.deepEqual(
          [...bytes.subarray(0, 8)],
          [137, 80, 78, 71, 13, 10, 26, 10],
        );
        assert.equal(bytes.readUInt32BE(16), 1080);
        assert.equal(bytes.readUInt32BE(20), 900);
        assert.ok(bytes.length > 1000);
        await page.reload();
        await state(page, "landed");
        assert.equal(
          await page.locator("#ffLogList li").count(),
          1,
          "reload does not duplicate completed flights",
        );
        await page.click("#ffClear");
        assert.equal(await page.locator("#ffClearDialog").isVisible(), true);
        await page.click("#ffClearConfirm");
        await page.reload();
        await state(page, "boarding");
        assert.equal(
          await page.locator("#ffLogList li").count(),
          0,
          "cleared records do not reappear after reload",
        );
      },
    );
    await run(
      `focus flight mobile themes, audio, immersive and early end ${lang}`,
      {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/fun/focus-flight/", lang));
        await fits(page);
        await page.selectOption("#ffRouteSelect", "tokyo-sapporo");
        assert.equal(await page.textContent("#ffToCode"), "CTS");
        assert.equal(await page.inputValue("#ffMinutes"), "120");
        if (["zh", "en"].includes(lang))
          await page.screenshot({
            path: join(artifacts, `focus-flight-mobile-${lang}.png`),
            fullPage: true,
          });
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await fits(page);
        await page.click('[data-mood="night"]');
        assert.equal(
          await page.locator("#ffRoot").getAttribute("data-mood"),
          "night",
        );
        await page.click("#ffSound");
        assert.equal(
          await page.locator("#ffSound").getAttribute("aria-checked"),
          "true",
        );
        await page.locator("#ffVolume").fill("10");
        assert.equal(await page.textContent("#ffVolumeValue"), "10%");
        await page.click("#ffSound");
        assert.equal(
          await page.locator("#ffSound").getAttribute("aria-checked"),
          "false",
        );
        await board(page);
        assert.equal(
          await page.locator("#ffImmersive").getAttribute("aria-pressed"),
          "true",
        );
        await fits(page);
        await page.click("#ffEnd");
        assert.equal(await page.locator("#ffStopDialog").isVisible(), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#ffStopDialog").isVisible(), false);
        assert.equal(
          await page.locator("#ffImmersive").getAttribute("aria-pressed"),
          "true",
          "Esc closes the dialog first",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("#ffImmersive").getAttribute("aria-pressed"),
          "false",
        );
        await page.click("#ffEnd");
        await page.click("#ffKeepFlying");
        await state(page, "flying");
        await page.click("#ffEnd");
        await page.click("#ffStopConfirm");
        await state(page, "boarding");
        assert.equal(await page.locator("#ffLogList li").count(), 0);
        assert.equal(
          await page.evaluate(
            (key) => localStorage.getItem(key),
            FLIGHT_STORAGE.active,
          ),
          null,
        );
      },
    );
  }
  await run(
    "focus flight restores a paused session across languages",
    {},
    async (page, context) => {
      await remember(context, "zh");
      await page.goto(base + "/tools/fun/focus-flight/");
      await board(page);
      await flightControl(page);
      await state(page, "paused");
      const remaining = await page.textContent("#ffClock");
      await page.reload();
      await state(page, "paused");
      assert.equal(await page.textContent("#ffClock"), remaining);
      await remember(context, "en");
      await page.goto(base + "/en/tools/fun/focus-flight/");
      await state(page, "paused");
      assert.equal(await page.textContent("#ffClock"), remaining);
      assert.equal(await page.textContent("#ffStateText"), "Flight paused");
      await flightControl(page);
      await state(page, "flying");
    },
  );
  await run(
    "focus flight catches up a closed session without duplicate arrivals",
    {},
    async (page, context) => {
      await remember(context, "zh");
      await page.clock.install({ time: new Date("2026-10-05T09:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-05T09:00:01Z"));
      await context.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        {
          key: FLIGHT_STORAGE.active,
          value: JSON.stringify(
            createFlight(
              "closed-flight",
              "beijing-seoul",
              "Closed session",
              1,
              Date.UTC(2026, 9, 5, 8, 57),
            ),
          ),
        },
      );
      await page.goto(base + "/tools/fun/focus-flight/");
      await state(page, "landed");
      assert.equal(await page.locator("#ffLogList li").count(), 1);
      assert.equal(await page.textContent("#ffToCode"), "ICN");
      await page.reload();
      await state(page, "landed");
      assert.equal(await page.locator("#ffLogList li").count(), 1);
      assert.equal(await page.textContent("#ffToday"), "1分钟");
      await page.clock.fastForward(24 * 60 * 60_000);
      assert.equal(
        await page.textContent("#ffToday"),
        "0分钟",
        "the daily log summary rolls over without a reload",
      );
    },
  );
  await run(
    "focus flight tolerates unavailable storage and audio",
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        localStorage.setItem("clover-lang", "zh");
        Storage.prototype.setItem = function () {
          throw new Error("Storage denied");
        };
        Storage.prototype.getItem = function () {
          throw new Error("Storage denied");
        };
        window.AudioContext = class {
          constructor() {
            throw new Error("Audio denied");
          }
        };
      });
      await page.goto(base + "/tools/fun/focus-flight/");
      await page.click("#ffSound");
      await page.waitForFunction(
        () =>
          document.querySelector("#ffSound").getAttribute("aria-checked") ===
          "false",
      );
      await board(page);
      assert.ok((await page.textContent("#ffLocalNote")).includes("无法恢复"));
    },
  );
  await run(
    "focus flight synchronizes active sessions between tabs",
    {},
    async (page, context) => {
      await remember(context, "zh");
      await page.goto(base + "/tools/fun/focus-flight/");
      const other = await context.newPage();
      await other.goto(base + "/tools/fun/focus-flight/");
      await page.fill("#ffTask", "Shared task");
      await board(page);
      await state(other, "flying");
      assert.equal(await other.inputValue("#ffTask"), "Shared task");
      await showControls(other);
      await other.click("#ffControl");
      await state(page, "paused");
      await page.click("#ffEnd");
      await page.click("#ffStopConfirm");
      await state(other, "boarding");
      await other.close();
    },
  );
  await run(
    "focus flight supports the production CSP",
    {},
    async (page, context) => {
      await remember(context, "en");
      const headers = await readFile(
        new URL("../../public/_headers", import.meta.url),
        "utf8",
      );
      const csp = headers.match(/Content-Security-Policy: ([^\r\n]+)/)[1];
      await page.route("**/tools/fun/focus-flight/", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), "content-security-policy": csp },
        });
      });
      await page.goto(base + "/en/tools/fun/focus-flight/");
      await page.click("#ffSound");
      await page.waitForFunction(
        () =>
          document.querySelector("#ffSound").getAttribute("aria-checked") ===
          "true",
      );
      await board(page);
      await fits(page);
      assert.equal(await page.locator("#ffRoot image").count(), 0);
      assert.equal(await page.locator("#ffRoot img").count(), 0);
      assert.equal(await page.locator("#ffRoot canvas").count(), 0);
    },
  );
  await run(
    "focus flight incomplete drag, pointer cancellation and keyboard boarding",
    {},
    async (page, context) => {
      await remember(context, "zh");
      await page.goto(base + "/tools/fun/focus-flight/");
      await page.click("#ffPrimary");
      const box = await page.locator("#ffTear").boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 45, y, { steps: 6 });
      const p = Number(
        await page.locator("#ffPaperTicket").getAttribute("data-progress"),
      );
      assert.ok(p > 0 && p < 1);
      await page.screenshot({
        path: join(artifacts, "focus-flight-tearing.png"),
      });
      await page.mouse.up();
      await state(page, "boarding");
      assert.equal(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          FLIGHT_STORAGE.active,
        ),
        null,
      );
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y, { steps: 4 });
      await page.locator("#ffTear").dispatchEvent("pointercancel");
      await page.mouse.up();
      assert.equal(
        await page.locator("#ffPaperTicket").getAttribute("data-progress"),
        "0",
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#ffBoardingDialog").isVisible(), false);
      await page.click("#ffPrimary");
      await page.focus("#ffTear");
      await page.keyboard.press("Enter");
      await state(page, "flying");
      await page.waitForFunction(
        () => document.querySelector("#ffPaperTicket").dataset.torn === "true",
      );
      const id = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).id,
        FLIGHT_STORAGE.active,
      );
      await page.locator("#ffTear").dispatchEvent("click");
      assert.equal(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).id,
          FLIGHT_STORAGE.active,
        ),
        id,
      );
      assert.equal(await page.locator("#ffBoardStamp").textContent(), "已登机");
    },
  );
  await run(
    "focus flight full desktop drag boards exactly once",
    {},
    async (page, context) => {
      await remember(context, "en");
      await page.goto(base + "/en/tools/fun/focus-flight/");
      await page.click("#ffPrimary");
      const box = await page.locator("#ffTear").boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 145, y + 12, { steps: 18 });
      await page.mouse.up();
      await state(page, "flying");
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("ff-immersive"),
      );
      assert.equal(
        await page.locator("#ffRoot").getAttribute("data-view"),
        "window",
      );
      const value = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        FLIGHT_STORAGE.active,
      );
      assert.equal(value.routeId, "shanghai-tokyo");
      assert.equal(await page.locator("#ffLogList li").count(), 0);
    },
  );
  await run(
    "focus flight downward touch tear on a narrow phone",
    { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true },
    async (page, context) => {
      await remember(context, "zh");
      await page.goto(base + "/tools/fun/focus-flight/");
      await page.click("#ffPrimary");
      await fits(page);
      assert.equal(await page.textContent("#ffTearHint"), "向下拖动副票");
      const box = await page.locator("#ffTear").boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      const client = await context.newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + 50 }],
      });
      assert.ok(
        Number(
          await page.locator("#ffPaperTicket").getAttribute("data-progress"),
        ) < 1,
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + 110 }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await state(page, "flying");
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("ff-immersive"),
      );
      await fits(page);
      await page.screenshot({
        path: join(artifacts, "focus-flight-phone-window.png"),
      });
    },
  );
  await run(
    "focus flight scene phases, camera views and silent boarding",
    { reducedMotion: "reduce" },
    async (page, context) => {
      await remember(context, "en");
      await page.clock.install({ time: new Date("2026-10-05T09:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-05T09:00:01Z"));
      await page.goto(base + "/en/tools/fun/focus-flight/");
      await page.fill("#ffMinutes", "1");
      assert.equal(
        await page.locator("#ffRouteProgress").getAttribute("d"),
        "",
      );
      await board(page, true);
      assert.equal(
        await page.locator("#ffRoot").getAttribute("data-phase"),
        "takeoff",
      );
      assert.equal(
        await page.locator("#ffSound").getAttribute("aria-checked"),
        "false",
      );
      const deadline = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).deadline,
        FLIGHT_STORAGE.active,
      );
      await page.clock.fastForward(
        Math.max(0, deadline - 54000 - (await page.evaluate(() => Date.now()))),
      );
      assert.equal(
        await page.locator("#ffRoot").getAttribute("data-phase"),
        "cruise",
      );
      await showControls(page);
      await page.click("button[data-view=map]");
      await page.click("button[data-camera=follow]");
      await page.clock.runFor(500);
      const separation = await page.evaluate(() => {
        const path = document.querySelector("#ffRouteProgress"),
          end = path.getPointAtLength(path.getTotalLength()),
          plane = document
            .querySelector("#ffPlane")
            .transform.baseVal.consolidate().matrix;
        return Math.hypot(end.x - plane.e, end.y - plane.f);
      });
      assert.ok(
        separation < 0.01,
        "the traveled route ends at the visible plane",
      );
      const registration = await page.evaluate(() => {
        const terrain = document
            .querySelector("#ffGeographySvg")
            .getScreenCTM(),
          overlay = document.querySelector("#ffMapSvg").getScreenCTM();
        return Math.max(
          ...["ffOriginDot", "ffDestinationDot"].map((id) => {
            const dot = document.getElementById(id),
              point = new DOMPoint(dot.cx.baseVal.value, dot.cy.baseVal.value),
              a = point.matrixTransform(terrain),
              b = point.matrixTransform(overlay);
            return Math.hypot(a.x - b.x, a.y - b.y);
          }),
        );
      });
      assert.ok(
        registration < 0.05,
        "airport overlays align with the independently composited geography",
      );
      assert.equal(
        await page
          .locator("button[data-view=map]")
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.clock.fastForward(
        Math.max(0, deadline - 3000 - (await page.evaluate(() => Date.now()))),
      );
      assert.equal(
        await page.locator("#ffRoot").getAttribute("data-phase"),
        "descent",
      );
      await page.clock.fastForward(
        Math.max(0, deadline - (await page.evaluate(() => Date.now()))),
      );
      await state(page, "landed");
      assert.equal(await page.locator("#ffArrivalPanel").isVisible(), true);
      assert.equal(await page.locator("#ffClock").isVisible(), false);
      assert.equal(await page.locator("#ffDock").isVisible(), false);
      await page.click("#ffAgain");
      await state(page, "boarding");
      assert.equal(await page.locator("#ffLogList li").count(), 1);
    },
  );
  for (const mobile of [false, true]) {
    await run(
      `focus flight quiet cruise, controls and settings ${mobile ? "touch" : "keyboard"}`,
      {
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "reduce",
      },
      async (page, context) => {
        await remember(context, "zh");
        await page.clock.install({ time: new Date("2026-10-06T09:00:00Z") });
        await page.clock.pauseAt(new Date("2026-10-06T09:00:01Z"));
        await page.goto(base + "/tools/fun/focus-flight/");
        await board(page, true);
        await page.clock.runFor(5500);
        assert.equal(
          await page.locator("#ffRoot").getAttribute("data-idle"),
          "true",
        );
        assert.equal(await page.locator("#ffClock").isVisible(), false);
        assert.equal(await page.locator("#ffDock").isVisible(), false);
        assert.equal(await page.locator("#ffPreferences").isVisible(), false);
        assert.equal(
          await page.locator("#ffReveal").getAttribute("aria-expanded"),
          "false",
        );
        if (mobile) {
          await page.touchscreen.tap(195, 400);
        } else {
          await page.mouse.move(700, 400);
          assert.equal(
            await page.locator("#ffRoot").getAttribute("data-idle"),
            "true",
            "a cursor crossing the window does not interrupt cruise",
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator("#ffImmersive")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.clock.runFor(6000);
          assert.equal(
            await page.locator("#ffRoot").getAttribute("data-idle"),
            "false",
            "keyboard-focused controls do not disappear",
          );
        }
        assert.equal(await page.locator("#ffDock").isVisible(), true);
        assert.equal(await page.locator("#ffPreferences").isVisible(), false);
        await page.click("#ffMixer");
        assert.equal(await page.locator("#ffPreferences").isVisible(), true);
        await page.click('button[data-mood="night"]');
        await page.clock.runFor(6000);
        assert.equal(
          await page.locator("#ffPreferences").isVisible(),
          true,
          "an open settings panel stays available",
        );
        assert.equal(
          await page.locator("#ffRoot").getAttribute("data-mood"),
          "night",
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#ffPreferences").isVisible(), false);
        assert.equal(
          await page.locator("#ffImmersive").getAttribute("aria-pressed"),
          "true",
        );
        await page.click("#ffMixer");
        if (mobile) await page.touchscreen.tap(195, 180);
        else await page.mouse.click(720, 180);
        assert.equal(
          await page.locator("#ffPreferences").isVisible(),
          false,
          "tapping outside closes settings without leaving the cabin",
        );
        await flightControl(page);
        await state(page, "paused");
        await page.clock.runFor(7000);
        assert.equal(await page.locator("#ffDock").isVisible(), true);
        await flightControl(page);
        await state(page, "flying");
        await page.click("#ffReveal");
        assert.equal(await page.locator("#ffDock").isVisible(), false);
        await page.click("#ffReveal");
        assert.equal(
          await page.locator("#ffDock").isVisible(),
          true,
          "the visible affordance restores hidden controls",
        );
        await page.clock.runFor(6000);
        assert.equal(
          await page.locator("#ffClock").isVisible(),
          false,
          "pointer focus does not pin controls after resuming",
        );
        await page.screenshot({
          path: join(
            artifacts,
            `focus-flight-quiet-${mobile ? "phone" : "desktop"}.png`,
          ),
        });
        await showControls(page);
        await page.click("button[data-view=map]");
        await page.clock.runFor(6000);
        assert.equal(
          await page.locator(".ff-camera-switch").isVisible(),
          false,
        );
        assert.equal(
          await page.locator("#ffPercent").isVisible(),
          false,
          "quiet map mode also removes navigation and progress overlays",
        );
        await showControls(page);
        assert.equal(await page.locator(".ff-camera-switch").isVisible(), true);
        if (mobile) {
          await page.setViewportSize({ width: 844, height: 390 });
          const scene = await page.locator("#ffStage").boundingBox(),
            dock = await page.locator("#ffDock").boundingBox();
          assert.ok(
            scene.height <= 390 && scene.y === 0,
            "the immersive scene fits a short landscape screen",
          );
          assert.ok(
            dock.y >= 0 && dock.y + dock.height <= 390,
            "landscape controls are reachable without scrolling the cabin",
          );
          await page.click("#ffMixer");
          await page.locator("#ffChime").scrollIntoViewIfNeeded();
          assert.ok(
            await page
              .locator("#ffPreferences")
              .evaluate((el) => el.scrollTop > 0),
          );
          assert.equal(
            await page.locator("#ffRoot").evaluate((el) => el.scrollTop),
            0,
            "scrolling settings does not move the cabin",
          );
        }
        await fits(page);
      },
    );
  }
  await run(
    "focus flight concurrent tab boarding shares one session",
    { reducedMotion: "reduce" },
    async (page, context) => {
      await remember(context, "zh");
      await page.goto(base + "/tools/fun/focus-flight/");
      const other = await context.newPage();
      await other.goto(base + "/tools/fun/focus-flight/");
      await page.click("#ffPrimary");
      await other.click("#ffPrimary");
      await Promise.all([
        page.locator("#ffTear").dispatchEvent("click"),
        other.locator("#ffTear").dispatchEvent("click"),
      ]);
      await state(page, "flying");
      await state(other, "flying");
      const a = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          FLIGHT_STORAGE.active,
        ),
        b = await other.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          FLIGHT_STORAGE.active,
        );
      assert.equal(a.id, b.id);
      assert.equal(await page.locator("#ffLogList li").count(), 0);
      await other.close();
    },
  );
  await run(
    "focus flight a lost-focus gesture and reduced-motion Space do not skip separation",
    { reducedMotion: "reduce" },
    async (page, context) => {
      await remember(context, "en");
      await page.goto(base + "/en/tools/fun/focus-flight/");
      await page.click("#ffPrimary");
      const box = await page.locator("#ffTear").boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 35, y, { steps: 4 });
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      await state(page, "boarding");
      assert.equal(
        await page.locator("#ffPaperTicket").getAttribute("data-progress"),
        "0",
      );
      await page.focus("#ffTear");
      await page.keyboard.press("Space");
      await state(page, "flying");
      await page.waitForFunction(
        () => document.querySelector("#ffPaperTicket").dataset.torn === "true",
      );
      assert.equal(
        await page.locator("#ffPaperTicket").getAttribute("data-progress"),
        "1",
      );
    },
  );
}
