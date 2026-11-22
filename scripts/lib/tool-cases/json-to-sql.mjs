import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localizedPath } from "../../../config/routes.mjs";
import { generateSql } from "../../../src/lib/json-to-sql.ts";
const langs = ["zh", "tw", "en", "ko", "ja"];
const path = (lang) => localizedPath("/tools/dev/json-to-sql/", lang);
const csp = readFileSync(
  new URL("../../../public/_headers", import.meta.url),
  "utf8",
).match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
const htmlLang = { zh: "zh-CN", tw: "zh-Hant", en: "en", ko: "ko", ja: "ja" };
const users =
  '[{"id":1,"name":"Alice","active":true},{"id":2,"name":"Bob","active":false}]';
const root = "#jsonToSql";
const wait = (page, state) =>
  page.waitForFunction(
    (s) => document.querySelector("#jsonToSql")?.dataset.process === s,
    state,
  );
const sql = (page) => page.locator("#jtsOutput").textContent();
const shot = (page, artifacts, name) =>
  page.screenshot({
    path: join(artifacts, `json-to-sql-${name}.png`),
    fullPage: true,
  });
async function monitor(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", async (d) => {
    errors.push("dialog: " + d.type());
    await d.dismiss();
  });
  await page.addInitScript(() => {
    window.jtsViolations = [];
    window.jtsRejections = [];
    window.jtsNetwork = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.jtsViolations.push(e.violatedDirective),
    );
    window.addEventListener("unhandledrejection", () =>
      window.jtsRejections.push("unhandled"),
    );
    const original = window.fetch;
    window.fetch = (...args) => {
      window.jtsNetwork.push("fetch");
      return original(...args);
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      window.jtsNetwork.push("xhr");
      return open.apply(this, args);
    };
    for (const key of ["WebSocket", "EventSource"]) {
      const Real = window[key];
      window[key] = class extends Real {
        constructor(...args) {
          window.jtsNetwork.push(key);
          super(...args);
        }
      };
    }
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => {
      window.jtsNetwork.push("beacon");
      return beacon(...args);
    };
  });
  return async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.jtsViolations), []);
    assert.deepEqual(await page.evaluate(() => window.jtsRejections), []);
  };
}
async function open(page, base, lang = "zh") {
  const response = await page.goto(base + path(lang));
  assert.equal(response.status(), 200);
  await page.waitForFunction(
    () =>
      document.querySelector("#jsonToSql")?.dataset.presentationState ===
      "primary",
  );
  assert.equal(await page.locator("#jtsInput").inputValue(), "");
  assert.match(await sql(page), /^-- SQL\n-- /);
}
async function reveal(page) {
  await page.locator("#jtsExit").click();
  await page.locator("#jtsGenerate").waitFor({ state: "visible" });
}
async function fill(page, text) {
  await page.locator("#jtsInput").fill(text);
  assert.equal(await page.locator("#jtsCopy").isDisabled(), true);
  assert.equal(await page.locator("#jtsDownload").isDisabled(), true);
}
async function generate(page) {
  await page.locator("#jtsGenerate").click();
  await wait(page, "success");
  return sql(page);
}
async function setting(page, id, value) {
  if (await page.locator("#jtsSettings").isHidden())
    await page.keyboard.press("F2");
  await page.locator("#" + id).selectOption(value);
}
async function error(page, text, code) {
  await fill(page, text);
  await page.locator("#jtsGenerate").click();
  await wait(page, "error");
  assert.equal(await page.locator(root).getAttribute("data-error-code"), code);
  assert.match(await sql(page), /^-- SQL\n-- /);
  assert.equal(await page.locator("#jtsCopy").isDisabled(), true);
}
async function fits(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
}
async function actionsDoNotOverlap(page, ...selectors) {
  // 两个 Playwright boundingBox 调用之间页面可能因聚焦滚动，视口坐标会漂移；
  // 在同一帧里量全部盒子，避免假的"遮挡"。
  const boxes = await page.evaluate((list) => {
    const out = {};
    for (const selector of list) {
      const node = document.querySelector(selector);
      if (!node) {
        out[selector] = null;
        continue;
      }
      const rect = node.getBoundingClientRect();
      out[selector] = {
        y: rect.y,
        bottom: rect.y + rect.height,
        width: rect.width,
        height: rect.height,
      };
    }
    return out;
  }, ["#jsonToSql > .jts-actions", ...selectors]);
  const actions = boxes["#jsonToSql > .jts-actions"];
  assert.ok(actions, "actions should have a visible layout box");
  for (const selector of selectors) {
    const field = boxes[selector];
    assert.ok(field, `${selector} should have a visible layout box`);
    assert.ok(
      actions.bottom <= field.y,
      `actions overlap ${selector}`,
    );
  }
}
export async function run({ run, remember, base, artifacts }) {
  for (const lang of langs)
    await run(`json-to-sql-${lang}-core-csp`, {}, async (page, context) => {
      await remember(context, lang);
      const clean = await monitor(page);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.route("**/tools/dev/json-to-sql/", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), "content-security-policy": csp },
        });
      });
      await open(page, base, lang);
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        htmlLang[lang],
      );
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(
        (
          await page.locator('link[rel="canonical"]').getAttribute("href")
        ).endsWith(path(lang)),
      );
      for (const other of langs)
        assert.equal(
          await page
            .locator(`#langSelect option[value="${path(other)}"]`)
            .count(),
          1,
        );
      assert.equal(await page.locator("#jtsGenerate").isVisible(), false);
      await reveal(page);
      await page.locator('[data-sample="users"]').click();
      await wait(page, "ready");
      assert.deepEqual(
        JSON.parse(await page.locator("#jtsInput").inputValue()),
        JSON.parse(users),
      );
      assert.match(await sql(page), /^-- SQL\n-- /);
      assert.equal(await page.locator("#jtsFields tr").count(), 3);
      const pg = await generate(page);
      assert.equal(pg, generateSql(users).value.sql);
      assert.match(pg, /TRUE/);
      await setting(page, "jtsDialect", "mysql");
      assert.equal(await page.locator("#jtsCopy").isDisabled(), true);
      await page.locator("#jtsIncludeCreate").check();
      const mysql = await generate(page);
      assert.match(mysql, /CREATE TABLE `records`/);
      assert.match(mysql, /`active` BOOLEAN NOT NULL/);
      assert.match(mysql, /utf8mb4/);
      assert.match(mysql, /\(1, 'Alice', 1\)/);
      assert.equal(await page.locator("#jtsSettings").isVisible(), true);
      await page.locator("#jtsIncludeCreate").uncheck();
      await setting(page, "jtsDialect", "sqlite");
      const sqlite = await generate(page);
      assert.match(sqlite, /"records"/);
      assert.match(sqlite, /\(2, 'Bob', 0\)/);
      await setting(page, "jtsMode", "create");
      const ddl = await generate(page);
      assert.match(ddl, /CREATE TABLE/);
      assert.match(ddl, /"active" INTEGER NOT NULL/);
      assert.doesNotMatch(ddl, /INSERT|UPDATE|IF NOT EXISTS|DROP TABLE/);
      await setting(page, "jtsMode", "update");
      await wait(page, "ready");
      await page.locator("#jtsPrimaryKey").selectOption("id");
      const update = await generate(page);
      assert.equal((update.match(/WHERE "id" = /g) || []).length, 2);
      assert.doesNotMatch(update, /SET "id"/);
      await page.locator("#jtsCopy").click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        update,
      );
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#jtsDownload").click();
      const download = await downloadPromise;
      assert.equal(
        download.suggestedFilename(),
        "json-to-sql-sqlite-update.sql",
      );
      const data = await readFile(await download.path());
      assert.equal(
        new TextDecoder("utf-8", { fatal: true }).decode(data),
        update,
      );
      assert.notDeepEqual([...data.subarray(0, 3)], [239, 187, 191]);
      await setting(page, "jtsMode", "insert");
      await fill(
        page,
        '{"x":"<img id=unsafe-jts src=x onerror=alert(1)><script id=unsafe-script>bad()</script>"}',
      );
      await generate(page);
      assert.equal(await page.locator("#unsafe-jts,#unsafe-script").count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "primary",
      );
      // 主视图声明了 keyboard 展开触发：按 Tab 会进入 reveal 并恢复正常页面 tab 顺序，
      // 因此这里只断言展开前焦点仍在主视图允许的元素内，以及展开确实发生。
      assert.ok(
        await page.evaluate(() => {
          const e = document.activeElement;
          return (
            e === document.body || e?.id === "jtsInput" || e?.id === "jtsExit"
          );
        }),
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "reveal",
      );
      await page.keyboard.press("Escape");
      await page.locator("#jtsInput").focus();
      await page.keyboard.press("Control+Enter");
      await wait(page, "success");
      await shot(page, artifacts, `${lang}-success`);
      await clean();
    });
  await run("json-to-sql-errors-and-locations", {}, async (page, context) => {
    await remember(context, "zh");
    const clean = await monitor(page);
    await open(page, base);
    await reveal(page);
    await fill(page, users);
    await generate(page);
    const invalid = '[\r\n {"id":1,}\r\n]';
    await error(page, invalid, "SYNTAX");
    assert.match(
      await page.locator("#jtsErrorText").textContent(),
      /行 2，列 10/,
    );
    await page.locator("#jtsLocate").click();
    const selected = await page.locator("#jtsInput").evaluate((e) => ({
      start: e.selectionStart,
      end: e.selectionEnd,
      focused: document.activeElement === e,
    }));
    // <textarea> 会把 CRLF 规范成 LF，断言要基于规范后的文本算偏移。
    const normalized = invalid.replace(/\r\n/g, "\n");
    assert.deepEqual(selected, {
      start: normalized.indexOf("}"),
      end: normalized.indexOf("}") + 1,
      focused: true,
    });
    for (const [data, code] of [
      ["[]", "EMPTY_ARRAY"],
      ["[{},null]", "ROW_TYPE"],
      ['{"a":1,"\\u0061":2}', "DUPLICATE_KEY"],
    ])
      await error(page, data, code);
    await fill(page, users);
    await wait(page, "ready");
    await setting(page, "jtsMode", "update");
    await wait(page, "ready");
    await page.locator("#jtsGenerate").click();
    await wait(page, "error");
    assert.equal(
      await page.locator(root).getAttribute("data-error-code"),
      "PRIMARY_REQUIRED",
    );
    await page.locator("#jtsLocate").click();
    assert.equal(
      await page
        .locator("#jtsPrimaryKey")
        .evaluate((e) => document.activeElement === e),
      true,
    );
    await page.locator("#jtsPrimaryKey").selectOption("id");
    await error(page, '[{"id":1,"n":2},{"n":3}]', "PRIMARY_MISSING");
    await error(page, '[{"id":1,"n":2},{"id":1e0,"n":3}]', "PRIMARY_DUPLICATE");
    await fill(
      page,
      '[{"id":1,"name":"A","n":1},{"id":2,"n":2},{"id":3,"name":null}]',
    );
    const update = await generate(page);
    assert.match(update, /SET "n" = 2 WHERE "id" = 2/);
    assert.match(update, /SET "name" = NULL WHERE "id" = 3/);
    await page.locator("#jtsTable").fill(" padded");
    await page.locator("#jtsGenerate").click();
    await wait(page, "error");
    await page.locator("#jtsLocate").click();
    assert.equal(
      await page
        .locator("#jtsTable")
        .evaluate((e) => document.activeElement === e),
      true,
    );
    assert.doesNotMatch(
      await page.locator("#jtsErrorText").textContent(),
      /行 \d/,
    );
    await page.locator("#jtsTable").fill("records");
    await generate(page);
    await clean();
  });
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [360, 800],
  ])
    for (const theme of ["light", "dark"])
      await run(
        `json-to-sql-layout-${width}-${theme}`,
        { viewport: { width, height }, colorScheme: theme },
        async (page, context) => {
          await remember(context, "en");
          const clean = await monitor(page);
          await page.addInitScript((theme) => {
            localStorage.setItem("clover-theme", theme);
          }, theme);
          // Hold completed Worker replies only in this test to inspect loading UI.
          await page.addInitScript(() => {
            const Real = window.Worker;
            window.jtsHoldReplies = false;
            window.Worker = class extends Real {
              constructor(...args) {
                super(...args);
                Object.defineProperty(this, "onmessage", {
                  set: (fn) =>
                    this.addEventListener("message", (e) => {
                      if (!window.jtsHoldReplies) fn(e);
                    }),
                });
              }
            };
          });
          await open(page, base, "en");
          await fits(page);
          await shot(page, artifacts, `${width}-${theme}-empty`);
          await reveal(page);
          await fill(page, '{"id":1,"long":"' + "A".repeat(2000) + '"}');
          await generate(page);
          await fits(page);
          await actionsDoNotOverlap(page, "#jtsInput", "#jtsOutput");
          await shot(page, artifacts, `${width}-${theme}-success`);
          assert.ok(
            await page
              .locator("#jtsOutput")
              .evaluate((e) => e.scrollWidth > e.clientWidth),
          );
          await error(page, '{"x":}', "SYNTAX");
          await fits(page);
          await shot(page, artifacts, `${width}-${theme}-error`);
          await page.keyboard.press("F2");
          assert.equal(await page.locator("#jtsSettings").isVisible(), true);
          await fits(page);
          await shot(page, artifacts, `${width}-${theme}-settings`);
          await page.evaluate(() => {
            window.jtsHoldReplies = true;
          });
          await fill(page, users);
          await page.locator("#jtsGenerate").click();
          await wait(page, "generating");
          assert.equal(
            await page.locator("#jtsOutput").getAttribute("aria-busy"),
            "true",
          );
          await fits(page);
          await actionsDoNotOverlap(
            page,
            "#jtsSettings",
            "#jtsInput",
            "#jtsOutput",
          );
          await shot(
            page,
            artifacts,
            `${width}-${theme}-worker-held-generating`,
          );
          await page.locator("#jtsCancel").click();
          assert.equal(
            await page.locator(root).getAttribute("data-process"),
            "cancelled",
          );
          await clean();
        },
      );
  for (const lang of langs)
    await run(
      `json-to-sql-${lang}-360-dark`,
      { viewport: { width: 360, height: 800 }, colorScheme: "dark" },
      async (page, context) => {
        await remember(context, lang);
        const clean = await monitor(page);
        await open(page, base, lang);
        await reveal(page);
        await page.keyboard.press("F2");
        await fits(page);
        await shot(page, artifacts, `${lang}-360-dark-settings`);
        await page.keyboard.press("F2");
        assert.equal(
          await page.locator(root).getAttribute("data-presentation-state"),
          "reveal",
        );
        assert.equal(await page.locator("#jtsSettings").isHidden(), true);
        assert.equal(await page.locator("#jtsGenerate").isVisible(), true);
        assert.equal(
          await page.evaluate(() => document.activeElement.id),
          "jtsSettingsToggle",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator(root).getAttribute("data-presentation-state"),
          "primary",
        );
        assert.equal(
          await page.evaluate(() => document.activeElement.id),
          "jtsInput",
        );
        await clean();
      },
    );
  await run("json-to-sql-capability-fallbacks", {}, async (page, context) => {
    await remember(context, "en");
    const clean = await monitor(page);
    await page.addInitScript(() => {
      window.Worker = class {
        constructor() {
          throw new Error("unavailable");
        }
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error("denied"));
    });
    await open(page, base, "en");
    await reveal(page);
    await fill(page, users);
    assert.equal(await generate(page), generateSql(users).value.sql);
    assert.equal(
      await page.locator(root).getAttribute("data-presentation-degraded"),
      "true",
    );
    assert.match(await page.locator("#jtsDegraded").textContent(), /Worker/);
    await page.locator("#jtsCopy").click();
    const manual = await page.locator("#jtsManual").evaluate((e) => ({
      value: e.value,
      start: e.selectionStart,
      end: e.selectionEnd,
      focused: e === document.activeElement,
    }));
    assert.equal(manual.value, await sql(page));
    assert.equal(manual.start, 0);
    assert.equal(manual.end, manual.value.length);
    assert.equal(manual.focused, true);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(root).getAttribute("data-presentation-state"),
      "degraded",
    );
    await page.keyboard.press("F10");
    await page.waitForFunction(
      () =>
        document.querySelector("#jsonToSql").dataset.presentationMode ===
        "fallback",
    );
    assert.equal(await sql(page), manual.value);
    await reveal(page);
    await shot(page, artifacts, "capability-fallbacks");
    await clean();
  });
  await run("json-to-sql-revision-and-cancel", {}, async (page, context) => {
    await remember(context, "en");
    const clean = await monitor(page);
    await page.addInitScript(() => {
      const Real = window.Worker;
      window.jtsActiveWorkers = 0;
      window.Worker = class extends Real {
        constructor(...args) {
          super(...args);
          window.jtsActiveWorkers++;
          let done = false;
          const terminate = this.terminate.bind(this);
          this.terminate = () => {
            if (!done) {
              done = true;
              window.jtsActiveWorkers--;
            }
            terminate();
          };
          Object.defineProperty(this, "onmessage", {
            set: (fn) =>
              this.addEventListener("message", (e) =>
                setTimeout(() => fn(e), 500),
              ),
          });
        }
      };
    });
    await open(page, base, "en");
    await reveal(page);
    await fill(
      page,
      JSON.stringify(
        Array.from({ length: 1000 }, (_, id) => ({ id, n: "old" })),
      ),
    );
    await page.locator("#jtsGenerate").click();
    await wait(page, "generating");
    await shot(page, artifacts, "generating");
    await page.locator("#jtsClear").click();
    await page.waitForTimeout(650);
    assert.equal(await page.locator("#jtsInput").inputValue(), "");
    assert.match(await sql(page), /^-- SQL\n-- /);
    assert.equal(
      await page.locator(root).getAttribute("data-process"),
      "empty",
    );
    await fill(page, '{"id":7,"n":"new"}');
    await page.locator("#jtsGenerate").click();
    await wait(page, "generating");
    await page.locator("#jtsCancel").click();
    await page.waitForTimeout(650);
    assert.equal(
      await page.locator(root).getAttribute("data-process"),
      "cancelled",
    );
    assert.equal(await page.evaluate(() => window.jtsActiveWorkers), 0);
    assert.equal(
      await page.locator("#jtsLive").textContent(),
      "Task cancelled",
    );
    await page.locator("#jtsGenerate").click();
    await wait(page, "generating");
    await setting(page, "jtsDialect", "mysql");
    await fill(page, '{"id":8,"n":"latest"}');
    const latest = await generate(page);
    assert.equal(
      latest,
      generateSql('{"id":8,"n":"latest"}', { dialect: "mysql" }).value.sql,
    );
    await page.waitForTimeout(650);
    assert.equal(await sql(page), latest);
    await clean();
  });
  await run(
    "json-to-sql-idle-and-settings-focus",
    {},
    async (page, context) => {
      await remember(context, "zh");
      await page.clock.install();
      await open(page, base);
      await page.mouse.move(10, 10);
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "reveal",
      );
      await page.clock.fastForward(8100);
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "primary",
      );
      await reveal(page);
      await page.locator("#jtsSettingsToggle").focus();
      await page.clock.fastForward(16000);
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "reveal",
      );
      await page.keyboard.press("F2");
      await page.clock.fastForward(16000);
      assert.equal(
        await page.locator(root).getAttribute("data-presentation-state"),
        "settingsOpen",
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#jtsSettings").isHidden(), true);
    },
  );
  const timezoneOutputs = [];
  for (const timezoneId of ["UTC", "Asia/Tokyo", "America/New_York"])
    await run(
      `json-to-sql-offline-${timezoneId.replaceAll("/", "-")}`,
      { timezoneId },
      async (page, context) => {
        await remember(context, "en");
        const clean = await monitor(page);
        await page.clock.install({ time: new Date("2026-11-21T23:59:59Z") });
        await open(page, base, "en");
        await reveal(page);
        await fill(
          page,
          '{"id":1,"d":"2024-02-29","t":"2024-03-01T00:00:00.1Z"}',
        );
        await wait(page, "ready");
        await setting(page, "jtsDialect", "mysql");
        await page.locator("#jtsDates").check();
        await wait(page, "ready");
        await context.setOffline(true);
        const before = await generate(page);
        const fields = await page.locator("#jtsFields").textContent();
        timezoneOutputs.push(before);
        const baseline = await page.evaluate(() => window.jtsNetwork.length);
        await page.clock.setFixedTime(new Date("2026-11-22T00:00:01Z"));
        assert.equal(await sql(page), before);
        assert.equal(await page.locator("#jtsFields").textContent(), fields);
        await setting(page, "jtsMode", "create");
        assert.match(await generate(page), /CREATE TABLE/);
        await setting(page, "jtsMode", "update");
        await wait(page, "ready");
        await page.locator("#jtsPrimaryKey").selectOption("id");
        assert.match(await generate(page), /WHERE `id` = 1;/);
        assert.equal(
          await page.evaluate(() => window.jtsNetwork.length),
          baseline,
        );
        await context.setOffline(false);
        await clean();
      },
    );
  assert.equal(timezoneOutputs.length, 3);
  assert.equal(timezoneOutputs[0], timezoneOutputs[1]);
  assert.equal(timezoneOutputs[1], timezoneOutputs[2]);
}
