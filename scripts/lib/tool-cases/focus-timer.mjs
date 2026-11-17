import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { LOCALES, localizedPath } from "../../../config/routes.mjs";
const KEY = "clover-focus-timer:v1";
const fixed = Date.UTC(2026, 10, 16, 10);
const path = (lang) => localizedPath("/tools/daily/focus-timer/", lang);
const names = {
  zh: "专注时间",
  tw: "專注時間",
  en: "Focus Timer",
  ja: "集中タイマー",
  ko: "집중 타이머",
};
const tasks = {
  zh: "读完第三章",
  tw: "讀完第三章",
  en: "Read chapter three",
  ja: "第3章を読む",
  ko: "3장 읽기",
};
async function poll(page, fn, arg) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await page.evaluate(fn, arg)) return;
    await delay(30);
  }
  assert.fail(`Timed out: ${fn}`);
}
const status = (page, value) =>
  poll(
    page,
    (v) => document.querySelector("#focusTimer")?.dataset.status === v,
    value,
  );
const stored = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), KEY);
async function ready(page, base, lang = "zh") {
  await page.clock.install({ time: new Date(fixed) });
  await page.clock.pauseAt(new Date(fixed + 1000));
  const response = await page.goto(base + path(lang));
  assert.equal(response.status(), 200);
  await poll(
    page,
    () => document.querySelector("#focusTimer")?.dataset.ready === "true",
  );
}
async function add(page, name = "Task <b>plain</b>") {
  await page.locator("#ftTaskName").fill(name);
  await page.locator("#ftAdd").click();
  assert.ok((await page.locator("#ftOpenTasks").textContent()).includes(name));
  assert.equal(await page.locator("#ftOpenTasks b").count(), 0);
}
async function begin(page) {
  await page.locator("#ft-focus").fill("1");
  await page.locator("#ftPrimary").click();
  await status(page, "running");
}
async function confirm(page, id) {
  await page.locator(id).click();
  assert.equal(await page.locator("#ftDialog").evaluate((e) => e.open), true);
  await page.locator("#ftDialog button[value=confirm]").click();
}
async function finish(page) {
  await page.clock.runFor(60001);
  await status(page, "finished");
}
function monitor(page) {
  const errors = [],
    violations = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/(?:api\/)|\.(?:mp3|wav|ogg|m4a)(?:\?|$)/i.test(r.url()))
      requests.push(r.url());
  });
  return { errors, violations, requests };
}
export async function run({ run, remember, base, artifacts }) {
  const csp = readFileSync(
    new URL("../../../public/_headers", import.meta.url),
    "utf8",
  ).match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
  for (const lang of Object.keys(names))
    await run(`focus-timer-${lang}-core-csp`, {}, async (page, context) => {
      await remember(context, lang);
      const m = monitor(page);
      await context.addInitScript(() => {
        window.__ftCsp = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          window.__ftCsp.push(e.violatedDirective),
        );
      });
      await page.route("**/tools/daily/focus-timer/", async (route) => {
        const r = await route.fetch();
        await route.fulfill({
          response: r,
          headers: { ...r.headers(), "content-security-policy": csp },
        });
      });
      await ready(page, base, lang);
      // 存储为空时才有“暂无记录”提示与空态开始入口。
      assert.equal(await page.locator("#ftEmptyRecords").isVisible(), true);
      assert.equal(await page.locator("#ftEmptyStart").isVisible(), true);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        (await page.locator("h1").textContent()).trim(),
        names[lang],
      );
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        LOCALES[lang].htmlLang,
      );
      assert.ok(
        (
          await page.locator("link[rel=canonical]").getAttribute("href")
        ).endsWith(path(lang)),
      );
      const options = await page
        .locator("#langSelect option")
        .evaluateAll((nodes) => nodes.map((n) => n.value));
      for (const target of Object.keys(names))
        assert.ok(options.includes(path(target)));
      await add(page, tasks[lang]);
      assert.equal(
        await page
          .locator("#ftTaskName")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await begin(page);
      await page.clock.runFor(10000);
      await page.locator("#ftPrimary").click();
      await status(page, "paused");
      const remaining = await page.locator("#ftTime").textContent();
      await page.clock.fastForward(300000);
      assert.equal(await page.locator("#ftTime").textContent(), remaining);
      await page.locator("#ftPrimary").click();
      await finish(page);
      let value = await stored(page);
      assert.equal(value.records.length, 1);
      assert.equal(value.records[0].actualMs, 60000);
      assert.equal(value.records[0].method, "complete");
      assert.equal(value.records[0].taskName, tasks[lang]);
      assert.equal(await page.locator("#ftWeekMinutes").textContent(), "1");
      assert.equal(await page.locator("#ftWeekRounds").textContent(), "1");
      assert.equal(await page.locator("#ftTime").textContent(), "00:00");
      assert.equal(await page.locator("#ftEmptyRecords").isVisible(), false);
      assert.equal(await page.locator("#ftEmptyStart").isVisible(), false);
      await page.locator("#ftPrimary").click();
      await status(page, "break");
      await page.locator("#ftSkip").click();
      await status(page, "finished");
      await page.locator("#ftPrimary").click();
      await page.clock.runFor(10000);
      await confirm(page, "#ftEarly");
      // 对话框关闭后应用才落盘记录，避免在写入前读取（负载高时会 flaky）。
      await poll(
        page,
        (key) =>
          (JSON.parse(localStorage.getItem(key) || "null")?.records?.length ??
            0) === 2,
        KEY,
      );
      value = await stored(page);
      assert.equal(value.records.length, 2);
      assert.equal(value.records[1].method, "early");
      assert.ok(
        value.records[1].actualMs >= 10000 && value.records[1].actualMs < 11000,
      );
      await page.reload();
      await poll(
        page,
        () => document.querySelector("#focusTimer")?.dataset.ready === "true",
      );
      assert.equal((await stored(page)).records.length, 2);
      assert.ok(
        (await page.locator("#ftOpenTasks").textContent()).includes(
          tasks[lang],
        ),
      );
      assert.equal(await page.locator("#ftBars rect").count(), 7);
      assert.equal(await page.locator("#ftDays tr").count(), 7);
      await page.screenshot({
        path: join(artifacts, `focus-timer-${lang}-core.png`),
        fullPage: true,
      });
      assert.deepEqual(await page.evaluate(() => window.__ftCsp), []);
      assert.deepEqual(m.errors, []);
      assert.deepEqual(m.requests, []);
    });
  await run("focus-timer-invalid-input", {}, async (page) => {
    await ready(page, base);
    for (const raw of ["", "0", "181", "1.5"]) {
      await page.locator("#ft-focus").fill(raw);
      assert.equal(await page.locator("#ftPrimary").isDisabled(), true);
      assert.equal(
        await page.locator("#ft-focus").getAttribute("aria-invalid"),
        "true",
      );
      assert.ok(await page.locator("#ft-error-focus").textContent());
      assert.equal(
        await page.locator("#ft-focus").getAttribute("aria-describedby"),
        "ft-error-focus",
      );
    }
    await page.locator("#ft-focus").fill("1");
    assert.equal(await page.locator("#ftPrimary").isDisabled(), false);
    for (const raw of ["", "x".repeat(81)]) {
      await page.locator("#ftTaskName").fill(raw);
      await page.locator("#ftAdd").click();
      assert.ok(await page.locator("#ftTaskError").textContent());
      assert.equal(
        await page.locator("#ftTaskName").getAttribute("aria-invalid"),
        "true",
      );
    }
    await add(page);
    assert.equal(await page.locator("#ftOpenTasks li").count(), 1);
  });
  await run("focus-timer-recovery-monotonic-expiry", {}, async (page) => {
    await ready(page, base);
    await begin(page);
    await page.clock.runFor(10000);
    await page.locator("#ftPrimary").click();
    await page.locator("#ftPrimary").click(); // explicit checkpoint
    const before = (await stored(page)).stage.remainingMs;
    await page.reload();
    await poll(
      page,
      () => document.querySelector("#focusTimer")?.dataset.ready === "true",
    );
    await status(page, "paused");
    assert.equal((await stored(page)).stage.remainingMs, before);
    await page.clock.fastForward(86400000);
    assert.equal((await stored(page)).stage.focusMs, 60000 - before);
    await page.reload();
    await poll(
      page,
      () => document.querySelector("#focusTimer")?.dataset.ready === "true",
    );
    await status(page, "paused");
    await page.locator("#ftPrimary").click();
    const prior = await page.locator("#ftTime").textContent();
    await page.clock.setSystemTime(new Date(fixed + 2 * 86400000));
    await page.clock.runFor(250);
    assert.equal(await page.locator("#ftTime").textContent(), prior);
    assert.ok(await page.locator("#ftJump").textContent());
    await page.clock.runFor(before); // expiry is settled before a late pause can alter the record
    await status(page, "finished");
    assert.equal((await stored(page)).records.length, 1);
    await page.locator("#focusTimer").focus();
    await page.keyboard.press("r");
    assert.equal((await stored(page)).records.length, 1);
  });
  await run("focus-timer-auto-visible-and-background", {}, async (page) => {
    await page.addInitScript(() => {
      window.__ftHidden = false;
      Object.defineProperty(document, "visibilityState", {
        get: () => (window.__ftHidden ? "hidden" : "visible"),
      });
    });
    await ready(page, base);
    await begin(page);
    await finish(page);
    assert.equal((await stored(page)).nextPhase, "short");
    assert.equal((await stored(page)).status, "finished");
    await page.locator("#ftAuto").check();
    await page.locator("#ftPrimary").click();
    await page.clock.fastForward(5 * 60000 + 1000);
    await status(page, "running");
    assert.equal((await stored(page)).stage.focusMs, 0);
    await page.evaluate(() => {
      window.__ftHidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(60001);
    await status(page, "finished");
    assert.equal((await stored(page)).records.length, 2);
    await page.evaluate(() => {
      window.__ftHidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(1000);
    await status(page, "finished");
  });
  await run("focus-timer-two-tabs", {}, async (page, context) => {
    await ready(page, base);
    await begin(page);
    await page.clock.runFor(10000);
    await page.locator("#ftPrimary").click();
    await page.locator("#ftPrimary").click();
    const other = await context.newPage(),
      errors = [];
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto(base + path("zh"));
    await poll(
      other,
      () => document.querySelector("#focusTimer")?.dataset.ready === "true",
    );
    assert.equal(await other.locator("#ftPrimary").isDisabled(), true);
    assert.equal(await other.locator("#ftAdd").isDisabled(), true);
    assert.equal(await other.locator("#ftTakeover").isVisible(), true);
    await add(page, "Shared task");
    await poll(other, () =>
      document
        .querySelector("#ftOpenTasks")
        ?.textContent.includes("Shared task"),
    );
    await page.close();
    await other.locator("#ftTakeover").click();
    await poll(other, () => !document.querySelector("#ftPrimary").disabled);
    await status(other, "paused");
    assert.ok(
      (await other.locator("#ftOpenTasks").textContent()).includes(
        "Shared task",
      ),
    );
    assert.deepEqual(errors, []);
  });
  for (const problem of ["read", "write", "corrupt", "version", "no-locks"])
    await run(`focus-timer-storage-${problem}`, {}, async (page, context) => {
      await context.addInitScript(
        ({ key, problem }) => {
          if (problem === "no-locks")
            Object.defineProperty(navigator, "locks", { value: undefined });
          if (
            ["corrupt", "version"].includes(problem) &&
            !sessionStorage.getItem("ft-seeded")
          ) {
            localStorage.setItem(
              key,
              problem === "corrupt"
                ? "broken"
                : JSON.stringify({ schemaVersion: 99 }),
            );
            sessionStorage.setItem("ft-seeded", "yes");
          }
          const get = Storage.prototype.getItem,
            set = Storage.prototype.setItem;
          window.__ftOriginalGetItem = get;
          Storage.prototype.getItem = function (k) {
            if (k === key && problem === "read") throw new Error("read denied");
            return get.call(this, k);
          };
          Storage.prototype.setItem = function (k, v) {
            if (k === key && problem === "write") throw new Error("quota");
            return set.call(this, k, v);
          };
        },
        { key: KEY, problem },
      );
      await ready(page, base);
      await begin(page);
      await page.clock.runFor(10000);
      await page.locator("#ftPrimary").click();
      await status(page, "paused");
      const storageLabel = (await page.locator("#ftStorage").textContent())?.trim();
      const expectedLabel = await page.evaluate((problem) => {
        const t = JSON.parse(document.querySelector("#ftText").textContent);
        const key = {
          read: "temporary",
          write: "temporary",
          corrupt: "corrupt",
          version: "version",
          "no-locks": "lockUnavailable",
        }[problem];
        return t[key];
      }, problem);
      assert.equal(
        storageLabel,
        expectedLabel,
        `本机存储状态应与 ${problem} 降级原因一致`,
      );
      if (["corrupt", "version"].includes(problem)) {
        const value = await page.evaluate(
          (key) => localStorage.getItem(key),
          KEY,
        );
        assert.equal(
          value,
          problem === "corrupt"
            ? "broken"
            : JSON.stringify({ schemaVersion: 99 }),
        );
      }
      await confirm(page, "#ftClearAll");
      await status(page, "idle");
      assert.equal(await page.locator("#ftOpenTasks li").count(), 0);
      if (["corrupt", "version"].includes(problem)) {
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), KEY),
          null,
        );
        await page.reload();
        await poll(
          page,
          () => document.querySelector("#focusTimer")?.dataset.ready === "true",
        );
        await status(page, "idle");
      }
      if (problem === "read") {
        // 读取权限失败时，“清空全部数据”也必须真正删除旧值，而不是只报成功。
        const removed = await page.evaluate((key) => {
          Storage.prototype.getItem = window.__ftOriginalGetItem;
          return localStorage.getItem(key);
        }, KEY);
        assert.equal(removed, null);
        await page.reload();
        await poll(
          page,
          () => document.querySelector("#focusTimer")?.dataset.ready === "true",
        );
        await status(page, "idle");
      }
    });
  await run("focus-timer-empty-start", {}, async (page) => {
    await ready(page, base);
    await begin(page);
    await page.clock.runFor(60001);
    await status(page, "finished");
    await confirm(page, "#ftClearRecords");
    await status(page, "finished");
    assert.equal(await page.locator("#ftEmptyRecords").isVisible(), true);
    assert.equal(await page.locator("#ftEmptyStart").isVisible(), true);
    assert.equal(await page.locator("#ftEmptyStart").textContent(), "开始专注");
    await page.locator("#ftEmptyStart").click();
    await status(page, "running");
    const value = await stored(page);
    assert.equal(value.stage.phase, "focus");
    assert.equal(value.records.length, 0);
  });
  for (const wakeMode of ["reject", "delay", "missing"])
    await run(`focus-timer-platform-${wakeMode}`, {}, async (page, context) => {
      const m = monitor(page);
      await context.addInitScript((mode) => {
        window.__ftReleased = 0;
        window.__ftRequests = 0;
        window.__ftNotificationRequests = 0;
        class N {
          static permission = "denied";
          static requestPermission() {
            window.__ftNotificationRequests++;
            return Promise.resolve("denied");
          }
        }
        Object.defineProperty(window, "Notification", {
          value: N,
          configurable: true,
        });
        const wakeLock = {
          request: () => {
            window.__ftRequests++;
            if (mode === "reject") return Promise.reject(new Error("denied"));
            return new Promise((resolve) => {
              window.__ftResolve = () =>
                resolve({
                  release: async () => {
                    window.__ftReleased++;
                  },
                  addEventListener() {},
                });
            });
          },
        };
        Object.defineProperty(navigator, "wakeLock", {
          value: mode === "missing" ? undefined : wakeLock,
          configurable: true,
        });
        class BadAudio {
          state = "suspended";
          resume() {
            return Promise.reject(new Error("no audio"));
          }
          close() {
            return Promise.resolve();
          }
        }
        Object.defineProperty(window, "AudioContext", {
          value: BadAudio,
          configurable: true,
        });
      }, wakeMode);
      await ready(page, base);
      await page.locator("#ftNotifications").click();
      assert.equal(
        await page.evaluate(() => window.__ftNotificationRequests),
        0,
      );
      await page.locator("#ftSound").check();
      await poll(page, () =>
        document.querySelector("#ftSoundStatus").textContent.includes("不可用"),
      );
      await page.locator("#ftWake").check();
      await begin(page);
      if (wakeMode === "delay") {
        await poll(page, () => window.__ftRequests === 1);
        await page.locator("#ftPrimary").click();
        await page.evaluate(() => window.__ftResolve());
        await poll(page, () => window.__ftReleased === 1);
        await page.locator("#ftPrimary").click();
        await poll(page, () => window.__ftRequests === 2);
        await confirm(page, "#ftClearAll");
        await page.evaluate(() => window.__ftResolve());
        await poll(page, () => window.__ftReleased === 2);
      } else {
        await page.clock.runFor(10000);
        await page.locator("#ftPrimary").click();
        assert.equal((await stored(page)).stage.focusMs, 10000);
      }
      assert.deepEqual(m.errors, []);
      assert.deepEqual(m.requests, []);
    });
  await run(
    "focus-timer-audio-preview-switch-stop",
    {},
    async (page, context) => {
      await context.addInitScript(() => {
        window.__ftSources = 0;
        window.__ftStopped = 0;
        const node = () => ({
          connect() {},
          disconnect() {},
          gain: {
            value: 0,
            cancelScheduledValues() {},
            setTargetAtTime() {},
            linearRampToValueAtTime() {},
          },
          frequency: { value: 0 },
        });
        class Audio {
          state = "running";
          sampleRate = 8000;
          currentTime = 0;
          destination = {};
          resume() {
            return Promise.resolve();
          }
          close() {
            return Promise.resolve();
          }
          createGain() {
            return node();
          }
          createBiquadFilter() {
            return node();
          }
          createBuffer(c, n) {
            return { getChannelData: () => new Float32Array(n) };
          }
          createBufferSource() {
            const n = node();
            n.start = () => window.__ftSources++;
            n.stop = () => window.__ftStopped++;
            return n;
          }
        }
        Object.defineProperty(window, "AudioContext", { value: Audio });
      });
      await ready(page, base);
      for (const environment of ["white", "rain", "cafe"]) {
        await page.locator("#ftEnvironment").selectOption(environment);
        await page.locator("#ftPreview").click();
        await page.clock.runFor(5100);
        assert.equal(
          await page.evaluate(() => window.__ftSources - window.__ftStopped),
          0,
        );
      }
      await page.locator("#ftSound").check();
      await begin(page);
      await page.locator("#ftEnvironment").selectOption("rain");
      await page.locator("#ftEnvironment").selectOption("cafe");
      assert.equal(
        await page.evaluate(() => window.__ftSources - window.__ftStopped),
        2,
      );
      await page.locator("#ftVolume").evaluate((e) => {
        e.value = "60";
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.locator("#ftMute").check();
      await page.locator("#ftPrimary").click();
      assert.equal(
        await page.evaluate(() => window.__ftSources - window.__ftStopped),
        0,
      );
      // 未启用声音时，“重试声音”只解锁播放权限，不得自行开始持续播放。
      await page.locator("#ftSound").uncheck();
      await page.locator("#ftPrimary").click();
      await status(page, "running");
      assert.equal(
        await page.evaluate(() => window.__ftSources - window.__ftStopped),
        0,
      );
      await page.locator("#ftRetrySound").click();
      await page.clock.runFor(1000);
      assert.equal(
        await page.evaluate(() => window.__ftSources - window.__ftStopped),
        0,
      );
    },
  );
  for (const lang of Object.keys(names))
    for (const theme of ["light", "dark"])
      await run(
        `focus-timer-${lang}-360-${theme}`,
        { viewport: { width: 360, height: 800 }, colorScheme: theme },
        async (page, context) => {
          await remember(context, lang);
          await context.addInitScript(
            (theme) => localStorage.setItem("clover-theme", theme),
            theme,
          );
          await ready(page, base, lang);
          await page.evaluate(
            (theme) =>
              document.documentElement.setAttribute("data-theme", theme),
            theme,
          );
          const titleContrast = await page.locator(".ft-overview h2").evaluate((e) => {
            const luminance = (color) => {
              const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number);
              const linear = rgb.map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
              return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
            };
            const foreground = luminance(getComputedStyle(e).color);
            const background = luminance(getComputedStyle(e.closest(".ft-overview")).backgroundColor);
            return (Math.max(foreground, background) + 0.05) /
              (Math.min(foreground, background) + 0.05);
          });
          assert.ok(titleContrast >= 4.5, `概览标题对比度不足：${titleContrast}`);
          await add(page, "LongTask".repeat(10));
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          await page.locator("#ft-focus").fill("1");
          await page.locator("#ftTaskName").focus();
          await page.keyboard.press("s");
          await page.keyboard.press("r");
          await status(page, "idle");
          await page.locator("#ftTaskName").evaluate((e) =>
            e.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "s",
                isComposing: true,
                bubbles: true,
              }),
            ),
          );
          await status(page, "idle");
          await page.locator("#focusTimer").focus();
          await page.keyboard.press("Space");
          await status(page, "running");
          await page.keyboard.press("Space");
          await status(page, "paused");
          await page.keyboard.press("Control+Enter");
          await status(page, "running");
          await page.keyboard.press("Control+Enter");
          await status(page, "running");
          await page.clock.runFor(10000);
          await page.locator("#ftReset").focus();
          await page.keyboard.press("r");
          assert.equal(
            await page.locator("#ftDialog").evaluate((e) => e.open),
            true,
          );
          await page.keyboard.press("Escape");
          assert.equal(
            await page
              .locator("#ftReset")
              .evaluate((e) => e === document.activeElement),
            true,
          );
          await status(page, "running");
          assert.notEqual(
            await page
              .locator("#ftReset")
              .evaluate((e) => getComputedStyle(e).outlineStyle),
            "none",
          );
          await confirm(page, "#ftReset");
          await status(page, "idle");
          await page.locator("#ftTaskName").focus();
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator("#ftAdd")
              .evaluate((e) => e === document.activeElement),
            true,
          );
          await page.screenshot({
            path: join(artifacts, `focus-timer-${lang}-360-${theme}.png`),
            fullPage: true,
          });
        },
      );
  await run("focus-timer-offline-copy-and-clear", {}, async (page, context) => {
    await ready(page, base);
    await context.setOffline(true);
    await add(page);
    await begin(page);
    await finish(page);
    await page.locator("#ftCopy").click();
    // With clipboard permission unavailable, a manual selection is always provided.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      }),
    );
    await page.locator("#ftCopy").click();
    await poll(page, () => !document.querySelector("#ftManualCopy").hidden);
    assert.ok((await page.locator("#ftCopyText").inputValue()).includes("1"));
    await page.evaluate(() => {
      window.__ftCopied = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value) => {
            window.__ftCopied = value;
          },
        },
        configurable: true,
      });
    });
    await page.locator("#ftCopy").click();
    await poll(page, () => window.__ftCopied.length > 0);
    assert.equal(await page.locator("#ftManualCopy").isVisible(), false);
    await confirm(page, "#ftClearRecords");
    assert.equal((await stored(page)).records.length, 0);
    assert.equal(await page.locator("#ftOpenTasks li").count(), 1);
    assert.equal(await page.locator("#ftCopy").isDisabled(), true);
    await confirm(page, "#ftClearAll");
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
      null,
    );
    await context.setOffline(false);
    await page.reload();
    await poll(
      page,
      () => document.querySelector("#focusTimer")?.dataset.ready === "true",
    );
    assert.equal(await page.locator("#ftOpenTasks li").count(), 0);
    assert.equal(await page.locator("#ftWeekMinutes").textContent(), "0");
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), KEY),
      null,
    );
  });
}
