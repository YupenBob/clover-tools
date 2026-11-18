import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { localizedPath, LOCALES } from "../../../config/routes.mjs";
import {
  SOURCES,
  STORAGE_KEY,
  validateTimeResponse,
} from "../../../src/lib/time-sync.ts";
const fixed = Date.UTC(2026, 10, 17, 15, 59, 59),
  path = (lang = "zh") => localizedPath("/tools/daily/time-sync/", lang);
const names = {
  zh: "标准北京时间校时",
  tw: "標準北京時間校時",
  en: "Beijing Time Check",
  ja: "北京標準時の確認",
  ko: "베이징 표준시 확인",
};
function payload(now, mode = "complete", offset = 1200) {
  const sources = SOURCES.map((source, i) => ({
    source,
    ok: true,
    nowMs: now + offset + (mode === "conflict" && i === 1 ? 10000 : 0),
    sourceSampleMs: now + offset + (mode === "conflict" && i === 1 ? 10000 : 0),
    upstreamRttMs: 0,
    sampleAgeMs: 0,
    timestampResolutionMs: 1000,
    cached: false,
  }));
  if (mode === "partial" || mode === "unavailable")
    sources[1] = {
      source: SOURCES[1],
      ok: false,
      error: { code: "upstream-timeout", retryable: true },
    };
  if (mode === "unavailable")
    sources[0] = {
      source: SOURCES[0],
      ok: false,
      error: { code: "upstream-http", retryable: true },
    };
  return {
    version: 1,
    ok: mode !== "unavailable",
    status:
      mode === "partial"
        ? "partial"
        : mode === "unavailable"
          ? "unavailable"
          : "complete",
    responseAtRuntimeMs: now,
    sources,
    error:
      mode === "unavailable"
        ? { code: "upstreams-unavailable", retryable: true }
        : null,
  };
}
async function poll(page, fn, arg) {
  await page.waitForFunction(fn, arg, { timeout: 12000 });
}
async function state(page, value) {
  await poll(
    page,
    (v) => document.querySelector("#timeSync")?.dataset.state === v,
    value,
  );
}
async function records(page, n) {
  await poll(
    page,
    (n) => document.querySelectorAll("#tsHistory>li").length === n,
    n,
  );
}
async function ready(page, base, lang = "zh") {
  await page.goto(base + path(lang));
  await page.locator("#tsStart").waitFor();
  await poll(
    page,
    () => document.querySelector("#tsDeviceTime")?.textContent !== "—",
  );
}
function monitor(page) {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/|cloudflare\.com\/cdn-cgi|timeapi\.io/.test(r.url()))
      requests.push(r.url());
  });
  return () => {
    assert.deepEqual(errors, []);
    assert.ok(
      requests.every((u) => new URL(u).pathname === "/api/time-sync"),
      requests.join("\n"),
    );
  };
}
async function mock(page, mode = "complete", mutate) {
  let calls = 0;
  await page.route("**/api/time-sync", async (route) => {
    calls++;
    if (mode === "timeout") return;
    const v = payload(await page.evaluate(() => Date.now()), mode);
    if (mutate) mutate(v);
    await route.fulfill({
      status: mode === "unavailable" ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(v),
    });
  });
  return () => calls;
}
async function measure(page, expected = "consistent") {
  await page.locator("#tsStart").click();
  await state(page, expected);
  await poll(
    page,
    () =>
      document.querySelector("#tsResults").getAttribute("aria-busy") ===
      "false",
  );
}
async function shot(page, artifacts, name) {
  await page.screenshot({
    path: join(artifacts, `time-sync-${name}-mock.png`),
    fullPage: true,
  });
}
export async function run({ run, remember, base, artifacts }) {
  const csp = readFileSync(
    new URL("../../../public/_headers", import.meta.url),
    "utf8",
  ).match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
  for (const lang of Object.keys(names))
    await run(`time-sync-${lang}-core-csp`, {}, async (page, context) => {
      const clean = monitor(page);
      await remember(context, lang);
      await page.clock.install({ time: fixed });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.addInitScript(() => {
        window.tsCsp = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          window.tsCsp.push({
            directive: e.violatedDirective,
            source: e.sourceFile,
          }),
        );
      });
      await page.route("**/tools/daily/time-sync/", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), "content-security-policy": csp },
        });
      });
      const calls = await mock(page);
      await ready(page, base, lang);
      assert.equal(calls(), 0);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("h1").textContent(), names[lang]);
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        LOCALES[lang].htmlLang,
      );
      assert.ok(
        (
          await page.locator("link[rel=canonical]").getAttribute("href")
        ).endsWith(path(lang)),
      );
      assert.match(await page.title(), / - CloverTools$/);
      const options = await page
        .locator("#langSelect option")
        .evaluateAll((ns) => ns.map((n) => n.value));
      for (const l of Object.keys(names)) assert.ok(options.includes(path(l)));
      if (["en", "ko", "ja"].includes(lang)) {
        const d = JSON.parse(
          readFileSync(
            new URL(`../../../src/lib/i18n/${lang}.json`, import.meta.url),
            "utf8",
          ),
        ).content["time-sync"].detail;
        const guide = await page.locator(".tool-guide").textContent();
        for (const text of [
          d.intro,
          d.privacy,
          ...d.steps,
          ...d.principles,
          ...d.pitfalls,
          ...d.examples.flatMap(Object.values),
          ...d.faqs.flatMap(Object.values),
        ])
          assert.ok(guide.includes(text), text);
      }
      await page.locator("#tsExamples summary").click();
      assert.equal(calls(), 0);
      assert.equal(await page.locator("#tsHistory>li").count(), 0);
      await measure(page);
      assert.equal(calls(), 1);
      assert.equal(await page.locator("#tsSourceRows tr").count(), 2);
      assert.equal(await page.locator("#tsCount").textContent(), "2");
      const yes = JSON.parse(await page.locator("#tsCopy").textContent()).yes;
      assert.deepEqual(
        await page.locator("#tsSourceRows tr td:nth-child(7)").allTextContents(),
        [yes, yes],
      );
      await records(page, 1);
      const expected = {
        zh: /慢/,
        tw: /慢/,
        en: /behind/,
        ja: /遅れ/,
        ko: /느립니다/,
      };
      assert.match(
        await page.locator("#tsOffset").textContent(),
        expected[lang],
      );
      const before = await page.locator("#tsNetworkTime").textContent();
      await page.clock.runFor(2000);
      assert.notEqual(
        await page.locator("#tsNetworkTime").textContent(),
        before,
      );
      assert.ok(
        (await page.locator("#tsNetworkDate").textContent()).includes("18"),
      );
      await page.locator("#tsCopyCurrent").click();
      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      for (const s of SOURCES) assert.ok(clipboard.includes(s));
      assert.match(clipboard, /HTTP/);
      assert.match(clipboard, /RTT/);
      await page.locator("#tsHistory details summary").click();
      await page.locator("#tsHistory button").click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        clipboard,
      );
      await shot(page, artifacts, `${lang}-desktop-success`);
      await page.reload();
      await state(page, "idle");
      assert.equal(await page.locator("#tsNetworkTime").textContent(), "—");
      await records(page, 1);
      assert.equal(calls(), 1);
      assert.deepEqual(await page.evaluate(() => window.tsCsp), []);
      clean();
    });
  for (const [mode, expected] of [
    ["partial", "single"],
    ["conflict", "conflict"],
    ["unavailable", "unavailable"],
  ])
    await run(`time-sync-${mode}-keeps-facts`, {}, async (page, context) => {
      const clean = monitor(page);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await mock(page, mode);
      await ready(page, base);
      await measure(page, expected);
      await records(page, 1);
      assert.equal(await page.locator("#tsSourceRows tr").count(), 2);
      if (mode !== "partial") {
        assert.equal(await page.locator("#tsOffset").textContent(), "—");
        assert.equal(await page.locator("#tsNetworkTime").textContent(), "—");
      }
      const participation = mode === "partial" ? ["是", "否"] : ["否", "否"];
      assert.deepEqual(
        await page.locator("#tsSourceRows tr td:nth-child(7)").allTextContents(),
        participation,
      );
      if (mode === "conflict") {
        assert.equal(await page.locator("#tsCount").textContent(), "2");
        for (const value of await page
          .locator("#tsSourceRows tr td:nth-child(2)")
          .allTextContents())
          assert.notEqual(value, "—");
      }
      await page.locator("#tsCopyCurrent").click();
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      assert.deepEqual(
        [...clipboard.matchAll(/参与推荐: (是|否)/g)].map((m) => m[1]),
        participation,
      );
      await shot(page, artifacts, mode);
      await page.reload();
      await state(page, "idle");
      await records(page, 1);
      await page.locator("#tsHistory details summary").click();
      assert.deepEqual(
        await page.locator("#tsHistory tbody tr td:nth-child(7)").allTextContents(),
        participation,
      );
      await page.locator("#tsHistory button").click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        clipboard,
      );
      clean();
    });
  const corruptions = {
    empty: (v) => {
      for (const k of Object.keys(v)) delete v[k];
    },
    duplicate: (v) => {
      v.sources[1] = v.sources[0];
    },
    string: (v) => {
      v.sources[0].nowMs = String(v.sources[0].nowMs);
    },
    range: (v) => {
      v.sources[0].nowMs = v.sources[0].sourceSampleMs = 4102444800000;
    },
    negative: (v) => {
      v.sources[0].upstreamRttMs = -1;
    },
    unknown: (v) => {
      v.sources[0].source = "runtime";
    },
  };
  for (const [name, mutate] of Object.entries(corruptions))
    await run(`time-sync-invalid-${name}`, {}, async (page) => {
      const clean = monitor(page);
      await mock(page, "complete", mutate);
      await ready(page, base);
      await measure(page, "unavailable");
      assert.equal(await page.locator("#tsOffset").textContent(), "—");
      assert.equal(await page.locator("#tsNetworkTime").textContent(), "—");
      await records(page, 1);
      clean();
    });
  for (const mode of ["html", "large"])
    await run(`time-sync-${mode}-response`, {}, async (page) => {
      const clean = monitor(page);
      await page.route("**/api/time-sync", (route) =>
        route.fulfill({
          contentType: mode === "html" ? "text/html" : "application/json",
          body: mode === "html" ? "<html>Error</html>" : " ".repeat(65537),
        }),
      );
      await ready(page, base, "en");
      await measure(page, "unavailable");
      assert.equal(await page.locator("#tsOffset").textContent(), "—");
      assert.doesNotMatch(
        await page.locator("#tsStatus").textContent(),
        /[\u3400-\u9fff]/,
      );
      clean();
    });
  await run("time-sync-timeout-and-cancel", {}, async (page) => {
    const clean = monitor(page);
    await page.clock.install({ time: fixed });
    await mock(page, "timeout");
    await ready(page, base);
    await page.locator("#tsStart").click();
    await state(page, "loading");
    assert.equal(
      await page.locator("#tsResults").getAttribute("aria-busy"),
      "true",
    );
    await page.clock.runFor(5001);
    await state(page, "unavailable");
    await records(page, 1);
    assert.equal(await page.locator("#tsCancel").isVisible(), false);
    await page.locator("#tsStart").click();
    await state(page, "loading");
    await page.locator("#tsCancel").click();
    await state(page, "idle");
    await records(page, 1);
    clean();
  });
  for (const failOld of [false, true])
    await run(
      `time-sync-race-${failOld ? "old-failure" : "old-success"}`,
      {},
      async (page) => {
        const clean = monitor(page);
        let a,
          b,
          calls = 0;
        await page.route("**/api/time-sync", async (route) => {
          calls++;
          if (calls === 1) a = route;
          else b = route;
        });
        await ready(page, base);
        await page.locator("#tsStart").click();
        await poll(
          page,
          () =>
            document.querySelector("#tsResults").getAttribute("aria-busy") ===
            "true",
        );
        for (let i = 0; i < 100 && !a; i++) await delay(10);
        assert.ok(a, "first request did not arrive");
        await page.locator("#tsStart").click();
        for (let i = 0; i < 100 && !b; i++) await delay(10);
        assert.ok(b, "replacement request did not arrive");
        if (failOld) {
          try {
            await a.abort();
          } catch {
            /* Superseded requests may already be aborted. */
          }
          assert.equal(
            await page.locator("#tsResults").getAttribute("aria-busy"),
            "true",
          );
          assert.equal(await page.locator("#tsHistory>li").count(), 0);
        }
        const now = await page.evaluate(() => Date.now());
        await b.fulfill({
          contentType: "application/json",
          body: JSON.stringify(payload(now, "complete", 2200)),
        });
        await state(page, "consistent");
        await records(page, 1);
        const text = await page.locator("#tsOffset").textContent();
        if (!failOld) {
          try {
            await a.fulfill({
              contentType: "application/json",
              body: JSON.stringify(payload(now, "complete", -5000)),
            });
          } catch {
            /* Aborted by replacement. */
          }
        }
        await delay(50);
        assert.equal(await page.locator("#tsOffset").textContent(), text);
        await records(page, 1);
        clean();
      },
    );
  await run(
    "time-sync-validity-clock-jump-background-and-sixty-seconds",
    {},
    async (page) => {
      const clean = monitor(page);
      await page.clock.install({ time: fixed });
      let calls = await mock(page);
      await ready(page, base);
      await measure(page);
      await page.clock.runFor(60001);
      await state(page, "expired");
      assert.equal(await page.locator("#tsNetworkTime").textContent(), "—");
      await measure(page);
      await page.clock.setSystemTime(fixed + 300000);
      await page.clock.runFor(1000);
      await state(page, "expired");
      await measure(page);
      const n = calls();
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await state(page, "expired");
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          value: false,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      assert.equal(calls(), n);
      await measure(page);
      clean();
    },
  );
  await run("time-sync-jump-during-request-and-high-rtt", {}, async (page) => {
    const clean = monitor(page);
    await page.clock.install({ time: fixed });
    let mode = "jump";
    await page.route("**/api/time-sync", async (route) => {
      if (mode === "jump") await page.clock.setSystemTime(fixed + 1000);
      else await page.clock.runFor(2001);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(payload(await page.evaluate(() => Date.now()))),
      });
    });
    await ready(page, base);
    await measure(page, "unavailable");
    mode = "high";
    await measure(page, "unavailable");
    assert.equal(await page.locator("#tsCount").textContent(), "0");
    assert.match(await page.locator("#tsSourceRows").textContent(), /2000/);
    await records(page, 2);
    clean();
  });
  await run(
    "time-sync-history-eleven-clear-storage-event",
    {},
    async (page, context) => {
      const clean = monitor(page);
      await mock(page);
      await ready(page, base);
      for (let i = 0; i < 11; i++) {
        await measure(page);
        await records(page, Math.min(10, i + 1));
      }
      assert.equal(await page.locator("#tsChart circle").count(), 10);
      const saved = await page.evaluate(
        (key) => localStorage.getItem(key),
        STORAGE_KEY,
      );
      await page.reload();
      await records(page, 10);
      await state(page, "idle");
      await page.locator("#tsClear").click();
      await page.locator("#tsKeepHistory").click();
      await records(page, 10);
      await page.evaluate(() =>
        localStorage.setItem("time-sync-unrelated", "keep"),
      );
      await page.locator("#tsClear").click();
      await page.locator("#tsConfirmClear").click();
      await records(page, 0);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("time-sync-unrelated")),
        "keep",
      );
      await page.reload();
      await records(page, 0);
      const other = await context.newPage();
      await other.goto(base + path());
      await other.evaluate(
        ({ key, saved }) => localStorage.setItem(key, saved),
        { key: STORAGE_KEY, saved },
      );
      await records(page, 10);
      await other.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
      await records(page, 0);
      await other.close();
      clean();
    },
  );
  for (const problem of ["corrupt", "version", "disabled", "delete-failure"])
    await run(`time-sync-storage-${problem}`, {}, async (page) => {
      const clean = monitor(page);
      await page.addInitScript(
        ({ key, problem }) => {
          if (problem === "disabled") {
            Storage.prototype.getItem = () => {
              throw Error("blocked");
            };
            Storage.prototype.setItem = () => {
              throw Error("blocked");
            };
          } else if (problem === "delete-failure") {
            Storage.prototype.removeItem = () => {
              throw Error("blocked");
            };
          } else
            localStorage.setItem(
              key,
              problem === "version" ? '{"version":99,"records":[]}' : "{bad",
            );
        },
        { key: STORAGE_KEY, problem },
      );
      await mock(page);
      await ready(page, base);
      await measure(page);
      await records(page, 1);
      assert.equal(
        await page.locator("#tsStorageNotice").isVisible(),
        problem !== "delete-failure",
      );
      if (problem === "corrupt" || problem === "version") {
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
          problem === "version" ? '{"version":99,"records":[]}' : "{bad",
        );
      }
      if (problem === "delete-failure") {
        await page.locator("#tsClear").click();
        await page.locator("#tsConfirmClear").click();
        await records(page, 1);
        assert.equal(await page.locator("#tsStorageNotice").isVisible(), true);
      }
      clean();
    });
  await run(
    "time-sync-clipboard-denied-keyboard-fallback",
    {},
    async (page) => {
      const clean = monitor(page);
      await mock(page);
      await ready(page, base, "en");
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async () => {
              throw Error("denied");
            },
          },
          configurable: true,
        }),
      );
      await page.locator("#tsStart").focus();
      await page.keyboard.press("Control+Enter");
      await state(page, "consistent");
      await page.locator("#tsCopyCurrent").focus();
      await page.keyboard.press("Space");
      await page.locator("#tsManual").waitFor();
      assert.equal(
        await page
          .locator("#tsManual")
          .evaluate(
            (n) =>
              document.activeElement === n && n.selectionEnd === n.value.length,
          ),
        true,
      );
      assert.match(
        await page.locator("#tsManual").inputValue(),
        /cloudflare-trace/,
      );
      await page.locator("#tsClear").focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .locator("#tsConfirmClear")
          .evaluate((n) => document.activeElement === n),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator("#tsKeepHistory")
          .evaluate((n) => document.activeElement === n),
        true,
      );
      await page.keyboard.press("Enter");
      clean();
    },
  );
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [360, 800],
  ])
    for (const theme of ["light", "dark"])
      await run(
        `time-sync-layout-${width}-${theme}`,
        { viewport: { width, height }, colorScheme: theme },
        async (page) => {
          const clean = monitor(page);
          await page.addInitScript((theme) => {
            document.addEventListener("DOMContentLoaded", () =>
              document.documentElement.setAttribute("data-theme", theme),
            );
          }, theme);
          let mode = "complete";
          await page.route("**/api/time-sync", async (route) => {
            if (mode === "loading") return;
            await route.fulfill({
              status: mode === "unavailable" ? 502 : 200,
              contentType: "application/json",
              body: JSON.stringify(
                payload(await page.evaluate(() => Date.now()), mode),
              ),
            });
          });
          await ready(page, base, "en");
          const fits = async () =>
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            );
          await fits();
          await shot(page, artifacts, `${width}-${theme}-empty`);
          for (const m of ["complete", "conflict", "unavailable"]) {
            mode = m;
            await measure(page, m === "complete" ? "consistent" : m);
            await fits();
            await shot(page, artifacts, `${width}-${theme}-${m}`);
          }
          mode = "loading";
          await page.locator("#tsStart").click();
          await state(page, "loading");
          await fits();
          await shot(page, artifacts, `${width}-${theme}-loading`);
          await page.locator("#tsCancel").click();
          clean();
        },
      );
  await run("time-sync-cache-boundary-and-hidden-request", {}, async (page) => {
    const clean = monitor(page);
    await page.clock.install({ time: fixed });
    let mode = "cache",
      calls = 0;
    await page.route("**/api/time-sync", async (route) => {
      calls++;
      if (mode === "pending") return;
      const value = payload(await page.evaluate(() => Date.now()));
      for (const source of value.sources) {
        source.cached = true;
        source.sampleAgeMs = 2000;
        source.upstreamRttMs = 2000;
        source.sourceSampleMs = source.nowMs - 3000;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    });
    await ready(page, base);
    await measure(page);
    await records(page, 1);
    assert.equal(await page.locator("#tsCount").textContent(), "2");
    assert.match(await page.locator("#tsSourceRows").textContent(), /2000/);
    assert.match(await page.locator("#tsSourceRows").textContent(), /缓存命中/);
    mode = "pending";
    await page.locator("#tsStart").click();
    await state(page, "loading");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await state(page, "expired");
    await records(page, 1);
    const count = calls;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(calls, count);
    mode = "cache";
    await measure(page);
    await records(page, 2);
    clean();
  });
  for (const timezoneId of ["UTC", "Asia/Tokyo", "America/New_York"])
    await run(
      `time-sync-zone-${timezoneId.replaceAll("/", "-")}`,
      { timezoneId },
      async (page) => {
        const clean = monitor(page);
        await page.clock.install({ time: fixed - 1000 });
        await page.clock.pauseAt(fixed);
        await mock(page);
        await ready(page, base);
        assert.equal(
          await page.locator("#tsDeviceTime").textContent(),
          "23:59:59",
        );
        await page.clock.runFor(1000);
        assert.equal(
          await page.locator("#tsDeviceTime").textContent(),
          "00:00:00",
        );
        clean();
      },
    );
}
/** Independent real API probe. Never installs browser routes or mock responses. */
export async function verifyLiveTimeSync(
  base,
  fetcher = (input, init) => globalThis.fetch(input, init),
  pause = (ms) => delay(ms),
) {
  const reports = [];
  for (let i = 0; i < 2; i++) {
    if (i) await pause(2100);
    const p0 = performance.now(),
      response = await fetcher(new URL("/api/time-sync", base), {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
    assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
    // Keep the five-second deadline active while consuming the body.
    const reader = response.body?.getReader();
    assert.ok(reader);
    let size = 0,
      raw = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        assert.ok(size <= 65536);
        raw += decoder.decode(part.value, { stream: true });
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    raw += decoder.decode();
    const result = validateTimeResponse(JSON.parse(raw));
    assert.ok(result.value, `Invalid API response (${response.status})`);
    const v = result.value;
    assert.ok(
      response.status === 200 && v.ok,
      `Network sources unavailable (${response.status})`,
    );
    reports.push({
      response: v,
      received: performance.now(),
      rttMs: performance.now() - p0,
    });
  }
  const a = reports[0],
    b = reports[1],
    common = a.response.sources.filter(
      (s) =>
        s.ok && b.response.sources.some((t) => t.source === s.source && t.ok),
    );
  assert.ok(
    common.length,
    "No common successful source to check time progression",
  );
  const elapsed = b.received - a.received;
  assert.ok(elapsed >= 2000);
  for (const s of common) {
    const t = b.response.sources.find((t) => t.source === s.source);
    const delta = t.nowMs - s.nowMs;
    assert.ok(
      delta > 0 &&
        Math.abs(delta - elapsed) <=
          Math.max(3000, s.upstreamRttMs + t.upstreamRttMs + a.rttMs + b.rttMs),
      `Time did not advance plausibly: ${s.source}`,
    );
    if (t.cached && t.sourceSampleMs === s.sourceSampleMs)
      assert.ok(t.sampleAgeMs > s.sampleAgeMs, "Cached age did not advance");
  }
  return {
    availability: reports.every((r) => r.response.status === "complete")
      ? "complete"
      : "partial",
    elapsedMs: elapsed,
    sources: reports.map((r) =>
      r.response.sources.map((s) =>
        s.ok
          ? {
              source: s.source,
              cached: s.cached,
              sampleAgeMs: s.sampleAgeMs,
              upstreamRttMs: s.upstreamRttMs,
            }
          : { source: s.source, error: s.error.code },
      ),
    ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.argv[2] === "--verify"
) {
  try {
    console.log(
      JSON.stringify(
        await verifyLiveTimeSync(process.argv[3] ?? "https://clovertools.cn"),
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(
      "time-sync real API probe failed:",
      e instanceof Error ? e.message : "unknown failure",
    );
    process.exitCode = 1;
  }
}
