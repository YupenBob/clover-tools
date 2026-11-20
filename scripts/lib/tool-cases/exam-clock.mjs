import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { validateTimeResponse } from "../../../src/lib/exam-clock.ts";
import { snapshotInPage } from "../presentation-check.mjs";
import { LOCALES, localizedPath } from "../../../config/routes.mjs";
const KEY = "clover-exam-clock:v1";
const presentation = JSON.parse(
  readFileSync(
    new URL("../../../data/tool-presentation/exam-clock.json", import.meta.url),
    "utf8",
  ),
);
const TIME_SLOT = presentation.primary.slots.find((slot) => slot.kind === "time");
const TIME_FORMAT = TIME_SLOT.format;
const EXIT_SELECTOR = presentation.controls.find((control) => control.role === "exit").selector;
const AUTO_HIDE_MS = presentation.interaction.autoHideMs;
const shortcutFor = (action) =>
  Object.entries(presentation.interaction.shortcuts).find(([, value]) => value === action)[0];
const SETTINGS_SHORTCUT = shortcutFor("settings");
const FULLSCREEN_SHORTCUT = shortcutFor("fullscreen");
const fixed = Date.UTC(2026, 10, 15, 1);
const inputTime = (ms) => new Date(ms + 28800000).toISOString().slice(0, 16);
const path = (lang = "zh") => localizedPath("/tools/daily/exam-clock/", lang);
const names = {
  zh: "考场大屏时钟",
  tw: "考場大螢幕時鐘",
  en: "Exam clock",
  ja: "試験時計",
  ko: "시험 시계",
};
const synced = {
  zh: "已校准",
  tw: "已校時",
  en: "Synced",
  ja: "同期済み",
  ko: "동기화됨",
};
const local = {
  zh: "本地时钟",
  tw: "本機時鐘",
  en: "Device clock",
  ja: "端末の時計",
  ko: "기기 시계",
};
async function poll(page, fn, arg) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await page.evaluate(fn, arg)) return;
    await delay(20);
  }
  assert.fail("Timed out: " + String(fn));
}
async function pageNow(page) {
  // A reload may tear the execution context down between the request and this
  // read; retry instead of crashing the whole regression run.
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await page.evaluate(() => Date.now());
    } catch (error) {
      lastError = error;
      await delay(20);
    }
  }
  throw lastError;
}
async function api(page, mode = "ok", behindMs = 0) {
  await page.route("**/api/time", async (route) => {
    try {
      await handleApiRoute(page, route, mode, behindMs);
    } catch {
      // The requesting document went away (e.g. a reload); the next document
      // issues its own request, so just drop this one.
      try {
        await route.abort();
      } catch {
        /* already handled */
      }
    }
  });
}
async function handleApiRoute(page, route, mode = "ok", behindMs = 0) {
    if (mode === "timeout") return; // Deliberately leave the request pending until its AbortController fires.
    if (mode === "502")
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"ok":false,"code":"upstream-failed"}',
      });
    if (mode === "json")
      return route.fulfill({
        contentType: "application/json",
        body: "<html>not JSON</html>",
      });
    if (mode === "missing")
      return route.fulfill({
        contentType: "application/json",
        body: '{"ok":true}',
      });
    if (mode === "rtt") await page.clock.runFor(2101);
  const now = await pageNow(page) - behindMs;
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      source: "cloudflare-trace",
      sourceUrl: "https://www.cloudflare.com/cdn-cgi/trace",
      serverNowMs: now,
      sourceSampleMs: now,
      sampleAgeMs: 0,
      upstreamRttMs: 0,
      uncertaintyMs: 1000,
      cached: false,
    }),
  });
}
async function ready(page, base, lang = "zh", mode = "ok") {
  await page.clock.install({ time: new Date(fixed) });
  await page.clock.pauseAt(new Date(fixed + 1000));
  await api(page, mode);
  const response = await page.goto(base + path(lang));
  assert.equal(response.status(), 200);
  await poll(page, () =>
    /^\d\d:\d\d/.test(document.querySelector("#ecTime")?.textContent || ""),
  );
  if (mode === "ok") await source(page, synced[lang]);
  await workspace(page);
}
async function source(page, value) {
  await poll(
    page,
    (v) => document.querySelector("#ecSource")?.textContent === v,
    value,
  );
}
async function presentationState(page) {
  return page.evaluate(() =>
    document.querySelector("#examClock")?.getAttribute("data-presentation-state") ?? null,
  );
}
/**
 * The projector opens on the clock itself, so every legacy assertion enters the
 * workspace first: Escape (or C) opens the hidden settings panel as deployed.
 */
async function workspace(page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await presentationState(page)) === "settingsOpen") break;
    await page.keyboard.press("Escape");
  }
  await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "settingsOpen");
  await poll(page, () => document.querySelector("#ecSettings")?.hidden === false);
}
function luminance(color) {
  const channels = String(color).match(/[\d.]+/g);
  if (!channels || channels.length < 3) return null;
  const [r, g, b] = channels.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
async function attr(page, key, value) {
  await poll(
    page,
    ({ key, value }) =>
      document.querySelector("#examClock")?.getAttribute(key) === value,
    { key, value },
  );
}
async function fill(
  page,
  start = fixed + 60000,
  end = fixed + 180000,
  name = "Exam <script> plain text",
) {
  await workspace(page);
  // The component attaches form listeners after its initial storage read; give
  // the fake clock a real tick to finish hydration before submitting.
  await page.waitForTimeout(250);
  await page.locator("#ecInputName").fill(name);
  await page.locator("#ecStart").fill(inputTime(start));
  await page.locator("#ecEnd").fill(inputTime(end));
}
async function clear(page) {
  await workspace(page);
  page.once("dialog", (d) => d.accept());
  await page.locator("#ecClear").click();
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    "page must fit viewport",
  );
  assert.equal(
    await page
      .locator("#ecTime")
      .evaluate(
        (e) =>
          e.getBoundingClientRect().width <=
          e.closest(".ec-readout").getBoundingClientRect().width + 1,
      ),
    true,
    "clock must fit stage",
  );
}
export async function run({ run, remember, base, artifacts }) {
  const csp = readFileSync(
    new URL("../../../public/_headers", import.meta.url),
    "utf8",
  ).match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
  for (const lang of Object.keys(names))
    await run(`exam-clock-${lang}-core-csp`, {}, async (page, context) => {
      await remember(context, lang);
      await page.route("**/tools/daily/exam-clock/", async (route) => {
        const r = await route.fetch();
        await route.fulfill({
          response: r,
          headers: { ...r.headers(), "content-security-policy": csp },
        });
      });
      await ready(page, base, lang);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("h1").textContent(), names[lang]);
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        LOCALES[lang].htmlLang,
      );
      assert.match(await page.title(), / - CloverTools$/);
      assert.ok(
        (await page.locator("meta[name=description]").getAttribute("content"))
          .length >= 40,
      );
      assert.ok(
        (
          await page.locator("link[rel=canonical]").getAttribute("href")
        ).endsWith(path(lang)),
      );
      const languageOptions = await page
        .locator('#langSelect option')
        .evaluateAll((nodes) => nodes.map((node) => node.value));
      for (const target of Object.keys(names))
        assert.ok(
          languageOptions.includes(path(target)),
          `language option ${target}`,
        );
      if (["en", "ja", "ko"].includes(lang)) {
        const detail = JSON.parse(
          readFileSync(new URL(`../../../src/lib/i18n/${lang}.json`, import.meta.url), "utf8"),
        ).content["exam-clock"].detail;
        assert.ok(detail.steps.length >= 3);
        assert.ok(detail.examples.length >= 2);
        assert.ok(detail.faqs.length >= 2);
        assert.ok(detail.principles.length > 0 && detail.pitfalls.length > 0);
        const guide = page.locator(".tool-guide");
        assert.equal(await guide.count(), 1);
        assert.equal(await guide.locator(".guide-intro").textContent(), detail.intro);
        assert.deepEqual(await guide.locator(".guide-steps li").allTextContents(), detail.steps);
        const guideText = await guide.textContent();
        for (const value of [
          detail.privacy,
          ...detail.principles,
          ...detail.pitfalls,
          ...detail.examples.flatMap((example) => Object.values(example)),
          ...detail.faqs.flatMap((faq) => Object.values(faq)),
        ]) assert.ok(guideText.includes(value), `missing ${lang} guide text: ${value}`);
      }
      assert.match(
        await page.locator("#ecSourceDetail").textContent(),
        /RTT.*ms/,
      );
      await fill(page);
      await page.locator("#ecEnable").click();
      await attr(page, "data-exam-state", "waiting");
      await page.clock.runFor(60000);
      await attr(page, "data-exam-state", "running");
      assert.ok(
        Number(await page.locator("#ecProgress").getAttribute("value")) > 0,
      );
      await page.clock.runFor(120000);
      await attr(page, "data-phase", "finished");
      assert.equal(
        await page.locator("#ecRemaining").textContent(),
        "00:00:00",
      );
      const time = await page.locator("#ecTime").textContent();
      await page.clock.runFor(1000);
      assert.notEqual(await page.locator("#ecTime").textContent(), time);
      assert.equal(await page.locator("#ecName script").count(), 0);
      await page.screenshot({
        path: join(artifacts, `exam-clock-${lang}-finished.png`),
        fullPage: true,
      });
      await page.evaluate(() => {
        HTMLElement.prototype.requestFullscreen = undefined;
        window.AudioContext = undefined;
        window.webkitAudioContext = undefined;
      });
      await page.locator("#ecFullscreen").click();
      assert.match(
        await page.locator("#examClock").getAttribute("class"),
        /ec-immersive/,
      );
      await page.keyboard.press("Escape");
      assert.doesNotMatch(
        await page.locator("#examClock").getAttribute("class"),
        /ec-immersive/,
      );
      await page.locator("#ecEnableSound").click();
      assert.equal(
        await page.locator("#ecSoundStatus").textContent(),
        JSON.parse(await page.locator("#examClockText").textContent())
          .soundError,
      );
    });
  await run("exam-clock-thresholds-terminal-and-mute", {}, async (page) => {
    await ready(page, base);
    await fill(page, fixed, fixed + 7200000);
    await page.locator("#ecEnable").click();
    let elapsed = 0;
    for (const m of [30, 15, 5, 1]) {
      const boundary = 7200000 - m * 60000;
      await page.clock.fastForward(boundary - elapsed);
      elapsed = boundary;
      await attr(page, "data-node", String(m));
      await attr(page, "data-phase", m <= 5 ? "critical" : "warning");
    }
    await page.clock.fastForward(60000);
    await attr(page, "data-phase", "finished");
    await page.clock.setSystemTime(fixed);
    await page.clock.runFor(300);
    await attr(page, "data-phase", "finished");
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      KEY,
    );
    assert.deepEqual(saved.active.processed, ["30", "15", "5", "1", "end"]);
    assert.equal(await page.locator("#ecSound").isChecked(), false);
  });
  await run(
    "exam-clock-field-errors-and-host-timezone",
    { timezoneId: "America/New_York" },
    async (page) => {
      await ready(page, base);
      for (const [start, end, name, field] of [
        [fixed + 5000, fixed, "Exam", "ecEnd"],
        [fixed, fixed, "Exam", "ecEnd"],
        [fixed, fixed + 86400000, "Exam", "ecEnd"],
        [fixed, fixed + 10000, " ", "ecInputName"],
      ]) {
        await fill(page, start, end, name);
        await page.locator("#ecEnable").click();
        await attr(page, "data-exam-state", "disabled");
        assert.equal(
          await page.locator(`#${field}`).getAttribute("aria-invalid"),
          "true",
        );
        assert.equal(await page.locator("#ecErrorSummary").isVisible(), true);
      }
      await fill(page);
      await page.locator("#ecMode").selectOption("duration");
      await page.locator("#ecHours").fill("0");
      await page.locator("#ecMinutes").fill("0");
      await page.locator("#ecSeconds").fill("0");
      await page.locator("#ecEnable").click();
      assert.equal(
        await page.locator("#ecHours").getAttribute("aria-invalid"),
        "true",
      );
      await page.locator("#ecMode").selectOption("end");
      await fill(page, fixed - 60000, fixed + 60000, "UTC+8");
      await page.locator("#ecEnable").click();
      await attr(page, "data-exam-state", "running");
      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        KEY,
      );
      assert.equal(saved.active.exam.endMs, fixed + 60000);
      assert.equal(saved.active.exam.startMs, fixed - 60000);
    },
  );
  for (const mode of ["502", "json", "missing", "rtt", "timeout"])
    await run(`exam-clock-fallback-${mode}`, {}, async (page) => {
      await ready(page, base, "zh", mode);
      if (mode === "timeout")
        for (let i = 0; i < 3; i++) {
          await page.clock.runFor(4100);
          await page.evaluate(() => Promise.resolve());
        }
      await source(page, local.zh);
      assert.doesNotMatch(
        await page.locator("#ecSourceDetail").textContent(),
        /±/,
      );
      await fill(page);
      await page.locator("#ecEnable").click();
      await attr(page, "data-exam-state", "waiting");
    });
  await run("exam-clock-clear-invalidates-delayed-round", {}, async (page) => {
    let pending;
    await page.route("**/api/time", (route) => {
      pending = route;
    });
    await page.clock.install({ time: new Date(fixed) });
    await page.goto(base + path());
    await poll(page, () =>
      /^\d/.test(document.querySelector("#ecTime").textContent),
    );
    await workspace(page);
    await page.locator("#ecExample").click();
    await clear(page);
    if (pending)
      await pending
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            source: "cloudflare-trace",
            sourceUrl: "https://www.cloudflare.com/cdn-cgi/trace",
            serverNowMs: fixed,
            sourceSampleMs: fixed,
            sampleAgeMs: 0,
            upstreamRttMs: 0,
            uncertaintyMs: 1000,
            cached: false,
          }),
        })
        .catch(() => {});
    await page.clock.runFor(1000);
    await source(page, local.zh);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
      null,
    );
    assert.equal(await page.locator("#ecInputName").inputValue(), "");
  });
  await run(
    "exam-clock-storage-presets-cross-language-clear",
    {},
    async (page, context) => {
      await ready(page, base);
      await page.locator("#ecExample").click();
      await page.locator("#ecSaveNew").click();
      await page.locator("#ecInputName").fill("第二场");
      await page.locator("#ecSaveNew").click();
      assert.equal(await page.locator("#ecPresets option").count(), 3);
      await page.locator("#ecInputName").fill("Updated");
      await page.locator("#ecUpdate").click();
      await page.locator("#ecPresets").selectOption("1");
      await page.locator("#ecLoad").click();
      assert.notEqual(
        await page.locator("#ecInputName").inputValue(),
        "Updated",
      );
      await page.locator("#ecEnable").click();
      await remember(context, "en");
      await page.goto(base + path("en"));
      await source(page, synced.en);
      await workspace(page);
      await attr(page, "data-exam-state", "waiting");
      assert.equal(await page.locator("#ecPresets option").count(), 3);
      await page.locator("#ecReset").click();
      await page.locator("#ecPresets").selectOption("2");
      await page.locator("#ecDelete").click();
      assert.equal(await page.locator("#ecPresets option").count(), 2);
      await clear(page);
      await page.reload();
      await source(page, synced.en);
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), KEY),
        null,
      );
    },
  );
  await run("exam-clock-storage-other-tab-keeps-saving", {}, async (page, context) => {
    await ready(page, base);
    await fill(page, fixed, fixed + 3600000, "This tab exam");
    await page.locator("#ecEnable").click();
    await attr(page, "data-exam-state", "running");
    const otherPage = await context.newPage();
    await otherPage.goto(base + "/robots.txt");
    const originalEnd = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.active.exam.endMs;
    }, KEY);
    await otherPage.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      state.active = null;
      state.draft.name = "Other tab exam";
      state.settings.hour12 = true;
      localStorage.setItem(key, JSON.stringify(state));
    }, KEY);
    await poll(page, () => document.querySelector("#ecStorageNotice").textContent.includes("其他页面"));
    await attr(page, "data-exam-state", "running");
    assert.equal(await page.locator("#ecName").textContent(), "This tab exam");
    assert.equal(await page.locator("#ecHour12").isChecked(), false);
    await page.locator("#ecShowSeconds").uncheck();
    let saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal(saved.settings.showSeconds, false);
    assert.equal(saved.active.exam.name, "This tab exam");
    assert.equal(saved.active.exam.endMs, originalEnd);
    await page.clock.fastForward(1800000);
    await attr(page, "data-node", "30");
    saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    assert.ok(saved.active.processed.includes("30"));
    await otherPage.close();
    await page.reload();
    await source(page, synced.zh);
    await attr(page, "data-exam-state", "running");
    assert.equal(await page.locator("#ecName").textContent(), "This tab exam");
    assert.equal(await page.locator("#ecShowSeconds").isChecked(), false);
    saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal(saved.active.exam.endMs, originalEnd);
    assert.ok(saved.active.processed.includes("30"));
  });
  for (const problem of [
    "SecurityError",
    "QuotaExceededError",
    "corrupt",
    "version",
  ])
    await run(`exam-clock-storage-${problem}`, {}, async (page, context) => {
      await context.addInitScript(
        ({ KEY, problem }) => {
          if (problem === "corrupt" || problem === "version")
            localStorage.setItem(
              KEY,
              problem === "corrupt"
                ? "broken"
                : JSON.stringify({ version: 99 }),
            );
          if (problem === "SecurityError")
            Object.defineProperty(Storage.prototype, "getItem", {
              value() {
                throw new DOMException("Denied", "SecurityError");
              },
            });
          if (problem === "QuotaExceededError")
            Object.defineProperty(Storage.prototype, "setItem", {
              value() {
                throw new DOMException("Full", "QuotaExceededError");
              },
            });
        },
        { KEY, problem },
      );
      await ready(page, base);
      await fill(page);
      await page.locator("#ecEnable").click();
      await attr(page, "data-exam-state", "waiting");
      assert.ok(
        (await page.locator("#ecStorageNotice").textContent()).length > 0,
      );
      if (problem === "corrupt" || problem === "version")
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), KEY),
          problem === "corrupt" ? "broken" : JSON.stringify({ version: 99 }),
        );
    });
  await run("exam-clock-invalid-form-still-saves-settings", {}, async (page) => {
    await ready(page, base);
    // A valid draft is stored first, so the rollback path has something to keep.
    const draftName = "Exam safety draft";
    await fill(page, fixed + 60000, fixed + 3600000, draftName);
    await page.locator("#ecTheme").selectOption("dark");
    await page.locator("#ecScale").selectOption("120");
    await page
      .locator("#ecVolume")
      .evaluate((node) => (node.value = "70", node.dispatchEvent(new Event("input", { bubbles: true }))));
    await poll(page, () => {
      const stored = JSON.parse(localStorage.getItem("clover-exam-clock:v1"));
      return stored?.draft?.name === "Exam safety draft" && stored.settings.theme === "dark";
    });
    // A form that cannot be stored (over-long name) must not take the display and
    // sound preferences down with it, and must keep the last saved draft.
    await page.locator("#ecInputName").fill("x".repeat(81));
    await poll(page, () => Boolean(document.querySelector("#ecStorageNotice")?.textContent));
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      KEY,
    );
    assert.equal(stored.settings.theme, "dark");
    assert.equal(stored.settings.scale, 120);
    assert.equal(stored.settings.volume, 70);
    assert.equal(stored.draft.name, draftName);
    await page.reload();
    await poll(page, () => /^\d\d:\d\d/.test(document.querySelector("#ecTime")?.textContent || ""));
    await workspace(page);
    assert.equal(await page.locator("#ecTheme").inputValue(), "dark");
    assert.equal(await page.locator("#ecScale").inputValue(), "120");
    // Clearing everything must not let the kept draft come back through a later
    // invalid edit.
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#ecClear").click();
    await page.locator("#ecTheme").selectOption("light");
    await page.locator("#ecInputName").fill("y".repeat(81));
    const cleared = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      KEY,
    );
    assert.equal(cleared.settings.theme, "light");
    assert.equal(cleared.draft.name, "");
  });
  await run("exam-clock-time-jumps-and-offline", {}, async (page, context) => {
    await ready(page, base);
    await fill(page, fixed, fixed + 7200000);
    await page.locator("#ecEnable").click();
    await page.clock.fastForward(5400000);
    await attr(page, "data-node", "30");
    await page.clock.setSystemTime(fixed + 5300000);
    await page.clock.runFor(300);
    assert.ok((await page.locator("#ecAdjustment").textContent()).length > 0);
    await source(page, synced.zh);
    await page.unroute("**/api/time");
    await page.route("**/api/time", (route) =>
      route.abort("internetdisconnected"),
    );
    await context.setOffline(true);
    await source(page, local.zh);
    assert.equal(
      await page
        .locator("#ecSourceDetail")
        .textContent()
        .then((v) => v.includes("±")),
      false,
    );
    await page.unroute("**/api/time");
    await api(page);
    await context.setOffline(false);
    await source(page, synced.zh);
    const s = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      KEY,
    );
    assert.equal(s.active.processed.filter((n) => n === "30").length, 1);
  });
  await run("exam-clock-forward-jump-cannot-end-exam", {}, async (page) => {
    await ready(page, base);
    await fill(page, fixed + 60000, fixed + 3600000);
    await page.locator("#ecEnable").click();
    await page.clock.fastForward(120000);
    await attr(page, "data-exam-state", "running");
    // The device clock jumps past the exam end while the reference time is
    // still mid-exam: report the change, re-check immediately, and never end the
    // exam from a clock that just moved.
    await page.unroute("**/api/time");
    await api(page, "ok", 3879000);
    await page.clock.setSystemTime(fixed + 4000000);
    await page.clock.runFor(300);
    assert.ok((await page.locator("#ecAdjustment").textContent()).length > 0);
    assert.notEqual(
      await page.getAttribute("#examClock", "data-exam-state"),
      "finished",
    );
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.finished,
        KEY,
      ),
      false,
    );
    await source(page, synced.zh);
    await attr(page, "data-exam-state", "running");
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.finished,
        KEY,
      ),
      false,
    );
  });
  await run("exam-clock-fullscreen-idle-focus-and-audio", {}, async (page) => {
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = async () => {
        throw Error("denied");
      };
      window.AudioContext = class {
        state = "suspended";
        resume() {
          return Promise.reject(Error("denied"));
        }
        close() {
          return Promise.resolve();
        }
      };
    });
    await ready(page, base);
    await fill(page, fixed, fixed + 60000);
    await page.locator("#ecEnable").click();
    const deadline = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).active.exam.endMs,
      KEY,
    );
    await page.locator("#ecEnableSound").click();
    assert.match(
      await page.locator("#ecSoundStatus").textContent(),
      /声音不可用/,
    );
    await page.locator("#ecFullscreen").click();
    await page.mouse.move(1, 1);
    await page.locator("#examClock").evaluate((e) => {
      e.tabIndex = -1;
      e.focus();
    });
    await page.clock.runFor(5100);
    assert.equal(
      await page.locator("#ecControls").evaluate((e) => e.inert),
      true,
    );
    await page.keyboard.press("s");
    assert.equal(await page.locator("#ecSettings").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#ecSettings").isVisible(), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#ecSettings").isVisible(), true);
    assert.equal(
      await page
        .locator("#ecFullscreen")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.locator("#examClock").focus();
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator("#ecPauseSound").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).active.exam.endMs,
        KEY,
      ),
      deadline,
    );
    await page.locator("#ecReset").click();
    await page.locator("#ecInputName").focus();
    await page.keyboard.press("f");
    assert.doesNotMatch(
      await page.locator("#examClock").getAttribute("class"),
      /ec-immersive/,
    );
  });
  for (const mode of ["unsupported", "rejected", "success"])
    await run(`exam-clock-wake-${mode}`, {}, async (page, context) => {
      await context.addInitScript((mode) => {
        let calls = 0;
        window.examWakeCalls = () => calls;
        Object.defineProperty(navigator, "wakeLock", {
          value:
            mode === "unsupported"
              ? undefined
              : {
                  async request() {
                    calls++;
                    if (mode === "rejected") throw Error("denied");
                    const lock = new EventTarget();
                    lock.released = false;
                    lock.release = async () => {
                      lock.released = true;
                      lock.dispatchEvent(new Event("release"));
                    };
                    window.examWakeRelease = lock.release;
                    return lock;
                  },
                },
        });
      }, mode);
      await ready(page, base);
      await page.locator("#ecWake").check();
      await poll(
        page,
        (mode) =>
          document
            .querySelector("#ecWakeStatus")
            .textContent.includes(
              mode === "unsupported"
                ? "不支持"
                : mode === "rejected"
                  ? "失败"
                  : "已启用",
            ),
        mode,
      );
      if (mode === "success") {
        await page.evaluate(() => window.examWakeRelease());
        assert.match(
          await page.locator("#ecWakeStatus").textContent(),
          /已释放/,
        );
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await poll(page, () => window.examWakeCalls() === 2);
      }
      await clear(page);
      assert.match(await page.locator("#ecWakeStatus").textContent(), /已关闭/);
    });
  await run(
    "exam-clock-audio-nodes-and-mute-consumption",
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        window.examAudioContexts = 0;
        window.examSoundCount = 0;
        window.AudioContext = class {
          state = "running";
          currentTime = 0;
          destination = {};
          constructor() {
            window.examAudioContexts++;
          }
          resume() {
            return Promise.resolve();
          }
          close() {
            return Promise.resolve();
          }
          createOscillator() {
            return {
              frequency: { value: 0 },
              connect() {},
              start() {
                window.examSoundCount++;
              },
              stop() {},
              disconnect() {},
            };
          }
          createGain() {
            return {
              gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
              connect() {},
              disconnect() {},
            };
          }
        };
      });
      await ready(page, base);
      assert.equal(await page.evaluate(() => window.examAudioContexts), 0);
      await page.waitForTimeout(300);
      await page.locator("#ecSound").check();
      await page.locator("#ecTestSound").click();
      assert.equal(await page.evaluate(() => window.examAudioContexts), 1);
      assert.equal(await page.evaluate(() => window.examSoundCount), 1);
      await fill(page, fixed, fixed + 7200000);
      await page.locator("#ecEnable").click();
      await page.bringToFront();
      await page.clock.fastForward(5340000);
      await page.clock.runFor(61000);
      await attr(page, "data-node", "30");
      assert.equal(await page.evaluate(() => window.examSoundCount), 2);
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press("Space");
      await page.clock.runFor(900000);
      await attr(page, "data-node", "15");
      assert.equal(await page.evaluate(() => window.examSoundCount), 2);
      await page.keyboard.press("Space");
      await page.clock.runFor(900000);
      await attr(page, "data-phase", "finished");
      assert.equal(await page.evaluate(() => window.examSoundCount), 6);
      await page.clock.runFor(5000);
      assert.equal(await page.evaluate(() => window.examSoundCount), 6);
      const data = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        KEY,
      );
      assert.equal(data.active.exam.endMs, fixed + 7200000);
      assert.deepEqual(data.active.processed, ["30", "15", "5", "1", "end"]);
    },
  );
  await run(
    "exam-clock-fixed-offset-compatibility-and-offline-hint",
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        const Original = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function (locale, options) {
          if (options?.timeZone === "Asia/Shanghai")
            throw new RangeError("zone unavailable");
          return new Original(locale, options);
        };
        Object.setPrototypeOf(Intl.DateTimeFormat, Original);
        Object.defineProperty(navigator, "onLine", { get: () => false });
      });
      await ready(page, base);
      assert.ok(
        (await page.locator("#ecCompatibility").textContent()).length > 0,
      );
      await source(page, synced.zh);
      await fill(page);
      await page.locator("#ecEnable").click();
      const data = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        KEY,
      );
      assert.equal(data.active.exam.startMs, fixed + 60000);
    },
  );
  for (const [width, height] of [
    [360, 780],
    [768, 1024],
    [1440, 900],
    [3840, 2160],
    [780, 360],
  ])
    await run(
      `exam-clock-layout-${width}`,
      { viewport: { width, height }, reducedMotion: "reduce" },
      async (page) => {
        await ready(page, base);
        await page
          .locator("#ecInputName")
          .fill("Very long exam name ".repeat(4));
        await page.locator("#ecScale").selectOption("140");
        await page.locator("#ecHour12").check();
        for (const theme of ["light", "dark"]) {
          await page.locator("#ecTheme").selectOption(theme);
          await page.locator("#ecContrast").check();
          await noOverflow(page);
        }
        await page.locator("#ecShowSeconds").uncheck();
        await noOverflow(page);
        assert.equal(
          await page
            .locator("#ecControls")
            .evaluate((e) => getComputedStyle(e).transitionDuration),
          "0s",
        );
        if (width === 1440) {
          await page.evaluate(() => {
            document.documentElement.style.zoom = "2";
          });
          await noOverflow(page);
        }
        await page.screenshot({
          path: join(artifacts, `exam-clock-${width}-dark.png`),
          fullPage: true,
        });
      },
    );
  // ---- Projector presentation contract ----------------------------------
  const slotEntries = (runtime) =>
    runtime.texts.filter((entry) => entry.selector.includes(TIME_SLOT.selector));
  const allowedSlotText = (runtime) => new Set(slotEntries(runtime).map((entry) => entry.text));
  const extraVisibleText = (runtime) => {
    const allowed = allowedSlotText(runtime);
    return runtime.texts.filter((entry) => !allowed.has(entry.text)).map((entry) => entry.text);
  };
  const visibleInteractives = (runtime) => runtime.interactives.map((entry) => entry.selector);
  const onlyExitControl = (runtime) => {
    assert.equal(runtime.interactives.length, 1, `expected one persistent control, got ${visibleInteractives(runtime).join(", ")}`);
    assert.ok(runtime.interactives[0].selector.includes(EXIT_SELECTOR), `persistent control must be ${EXIT_SELECTOR}`);
  };
  const withinProjectedMinute = async (page, displayed) => {
    const nowMs = await page.evaluate(() => Date.now());
    const expected = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_FORMAT.timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(nowMs));
    const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const raw = Math.abs(toMinutes(displayed) - toMinutes(expected));
    return Math.min(raw, 1440 - raw) * 60000 <= TIME_FORMAT.withinMs + 60000;
  };

  await run("exam-clock-presentation-first-load", {}, async (page, context) => {
    await remember(context, "zh");
    const blocked = [];
    await page.route("**/*", (route) => {
      if (route.request().resourceType() === "script") {
        blocked.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const response = await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    assert.ok(blocked.length > 0, "the first-load probe must block scripts");
    const runtime = await page.evaluate(snapshotInPage);
    assert.ok(
      runtime.state === "firstLoad" || runtime.state === "primary",
      `SSR state must be firstLoad/primary, got "${runtime.state}"`,
    );
    const slots = slotEntries(runtime);
    assert.equal(slots.length, 1, "the server-rendered first paint must show the time slot");
    assert.match(slots[0].text, new RegExp(TIME_FORMAT.pattern));
    assert.deepEqual(extraVisibleText(runtime), [], "first paint may not show any copy besides the time");
    onlyExitControl(runtime);
    assert.ok(
      luminance(runtime.background) <= presentation.appearance.maxBackgroundLuminance,
      `first paint background ${runtime.background} is too bright`,
    );
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-first-load.png") });
  });

  await run("exam-clock-presentation-primary-static", {}, async (page, context) => {
    await remember(context, "zh");
    await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    const runtime = await page.evaluate(snapshotInPage);
    assert.equal(runtime.state, "primary");
    const slots = slotEntries(runtime);
    assert.equal(slots.length, 1);
    assert.match(slots[0].text, new RegExp(TIME_FORMAT.pattern));
    assert.equal(slots[0].text.length, TIME_FORMAT.showSeconds ? 8 : 5, "primary view hides seconds");
    assert.deepEqual(extraVisibleText(runtime), [], "primary view may not show extra copy");
    onlyExitControl(runtime);
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const fontVh = (slots[0].rect.h / viewport.height) * 100;
    assert.ok(fontVh + 0.5 >= presentation.appearance.minPrimaryFontVh, `primary time is ${fontVh.toFixed(1)}vh`);
    assert.ok(luminance(runtime.background) <= presentation.appearance.maxBackgroundLuminance);
    assert.ok(
      runtime.scroll.width <= runtime.scroll.viewportWidth && runtime.scroll.height <= runtime.scroll.viewportHeight,
      "primary view must not scroll",
    );
    assert.ok(await withinProjectedMinute(page, slots[0].text), "primary time must track the declared time zone");
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-primary.png") });
  });

  await run("exam-clock-presentation-reveal-auto-hide", {}, async (page, context) => {
    await remember(context, "zh");
    await page.clock.install();
    await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    await page.mouse.move(20, 20);
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "reveal");
    const revealed = await page.evaluate(snapshotInPage);
    assert.deepEqual(extraVisibleText(revealed), [], "the reveal layer may not add visible copy");
    const controls = visibleInteractives(revealed).join(" ");
    for (const selector of [EXIT_SELECTOR, "#ecFullscreen", "#ecSettingsToggle", "#ecSync"])
      assert.ok(controls.includes(selector), `reveal must expose ${selector}`);
    await page.clock.fastForward(AUTO_HIDE_MS + 100);
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    const hidden = await page.evaluate(snapshotInPage);
    onlyExitControl(hidden);
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-reveal.png") });
  });

  await run("exam-clock-presentation-degraded", {}, async (page, context) => {
    await remember(context, "zh");
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "wakeLock", {
        value: { request: () => Promise.reject(new Error("denied")) },
        configurable: true,
      });
    });
    await page.route("**/api/**", (route) => route.abort());
    await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    const before = await page.evaluate(snapshotInPage);
    await page.waitForTimeout(400);
    const runtime = await page.evaluate(snapshotInPage);
    assert.equal(runtime.state, "primary", "degradation must not leave the primary view");
    assert.deepEqual(extraVisibleText(runtime), [], "degradation may not draw an error overlay on the clock");
    assert.ok(runtime.texts.length <= before.texts.length + 1, "degradation may not add visible copy");
    const announcements = await page.evaluate(() =>
      [...document.querySelectorAll("[aria-live]")].map((el) => el.textContent.trim()).filter(Boolean),
    );
    assert.ok(announcements.length > 0, "degradation must be announced through aria-live");
    const degraded = await page.evaluate(() =>
      document.querySelector("#examClock")?.getAttribute("data-presentation-degraded") ?? "",
    );
    assert.ok(degraded.length > 0, "degraded capabilities must be recorded on the root");
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-degraded.png") });
  });

  await run("exam-clock-presentation-fullscreen-fallback", {}, async (page) => {
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
    });
    await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    await page.keyboard.press(FULLSCREEN_SHORTCUT);
    await poll(
      page,
      () => document.querySelector("#examClock")?.getAttribute("data-presentation-mode") === "fallback",
    );
    assert.match(await page.locator("#examClock").getAttribute("class"), /ec-immersive/);
    const runtime = await page.evaluate(snapshotInPage);
    assert.ok(["fullscreen", "primary"].includes(runtime.state), `fallback state is ${runtime.state}`);
    assert.deepEqual(extraVisibleText(runtime), [], "the fallback view may not add visible copy");
    onlyExitControl(runtime);
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-fullscreen-fallback.png") });
    await page.keyboard.press("Escape");
    await poll(
      page,
      () => document.querySelector("#examClock")?.getAttribute("data-presentation-mode") === "inline",
    );
  });

  await run("exam-clock-presentation-exit-control", {}, async (page, context) => {
    await remember(context, "zh");
    await page.goto(base + path(), { waitUntil: "domcontentloaded" });
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    const exit = page.locator(EXIT_SELECTOR);
    const box = await exit.boundingBox();
    assert.ok(box, "the persistent exit control must be rendered");
    assert.ok(
      box.width >= presentation.controls[0].minHitTargetPx && box.height >= presentation.controls[0].minHitTargetPx,
      `exit control is ${box.width}x${box.height}`,
    );
    assert.equal(await exit.evaluate((el) => el.tagName), "BUTTON");
    assert.equal(
      await exit.evaluate((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())),
      false,
      "the persistent control must be icon only",
    );
    const text = JSON.parse(await page.locator("#examClockText").textContent());
    assert.equal(await exit.getAttribute("aria-label"), text.exitProjection);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate((selector) => document.activeElement?.matches(selector), EXIT_SELECTOR),
      true,
      "the exit control must take keyboard focus",
    );
    assert.notEqual(await exit.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
    await exit.click();
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "settingsOpen");
    await page.keyboard.press(SETTINGS_SHORTCUT);
    await poll(page, () => document.querySelector("#examClock")?.getAttribute("data-presentation-state") === "primary");
    await page.screenshot({ path: join(artifacts, "exam-clock-presentation-exit.png") });
  });

}

/** Read-only post-deployment probe; unlike preview cases this uses the real API. */
export async function verifyLiveTime(
  base,
  { fetcher = fetch, mono = () => performance.now(), sleep = delay } = {},
) {
  async function sample() {
    const start = mono();
    const response = await fetcher(new URL("/api/time", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200, "production time API must succeed");
    assert.match(
      response.headers.get("content-type") || "",
      /^application\/json/i,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = validateTimeResponse(await response.json());
    const end = mono();
    return { data, midpoint: (start + end) / 2 };
  }
  const first = await sample();
  await sleep(2000);
  const second = await sample();
  const elapsed = second.midpoint - first.midpoint;
  const advanced = second.data.serverNowMs - first.data.serverNowMs;
  assert.ok(elapsed >= 1900, "probe must allow about two seconds to elapse");
  assert.ok(
    advanced > 0 && Math.abs(advanced - elapsed) <= 1000,
    "server reference must advance with monotonic elapsed time",
  );
  return {
    source: second.data.source,
    elapsedMs: elapsed,
    advancedMs: advanced,
    cached: second.data.cached,
    sampleAgeMs: second.data.sampleAgeMs,
  };
}
if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === "--verify-api"
) {
  const target = process.argv[3];
  if (!target)
    throw new Error(
      "Usage: node scripts/lib/tool-cases/exam-clock.mjs --verify-api https://your-deployed-site",
    );
  console.log(JSON.stringify(await verifyLiveTime(target)));
}
