import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localizedPath } from "../../config/routes.mjs";

async function fits(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "fun tool must fit the viewport",
  );
}
async function download(page, button, path) {
  const pending = page.waitForEvent("download");
  await page.click(button);
  const file = await pending;
  assert.equal(await file.failure(), null);
  await file.saveAs(path);
  return { name: file.suggestedFilename(), bytes: await readFile(path) };
}
function pngSize(bytes) {
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.ok(bytes.length > 300);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
async function uploadFixture(page, empty = false) {
  const data = await page.evaluate((empty) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const c = canvas.getContext("2d");
    if (!empty) {
      c.fillStyle = "#FF0000";
      c.fillRect(0, 0, 8, 16);
      c.fillStyle = "rgba(0,0,255,0.498)";
      c.fillRect(8, 0, 8, 8);
      c.fillStyle = "rgba(0,0,255,0.502)";
      c.fillRect(8, 8, 8, 8);
    }
    return canvas.toDataURL().split(",")[1];
  }, empty);
  return Buffer.from(data, "base64");
}
async function cspRoute(page, slug, csp) {
  await page.route(`**/tools/fun/${slug}/`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
}
async function screenshot(page, artifacts, lang, name) {
  if (lang === "zh")
    await page.screenshot({
      path: join(artifacts, `fun-${name}.png`),
      animations: "disabled",
    });
}

export async function runFunToolChecks({ run, remember, base, artifacts }) {
  const headers = await readFile(
    new URL("../../public/_headers", import.meta.url),
    "utf8",
  );
  const csp = headers.match(/Content-Security-Policy:\s*(.+)/)[1].trim();
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    await run(
      `bead upload, numbered exports, invalidation and print ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await cspRoute(page, "perler-beads", csp);
        await context.addInitScript(() => {
          const original = window.createImageBitmap.bind(window);
          window.createImageBitmap = async (...args) => {
            const bitmap = await original(...args);
            if (args[0]?.name === "slow.png")
              await new Promise((resolve) => setTimeout(resolve, 350));
            return bitmap;
          };
        });
        await page.goto(base + localizedPath("/tools/fun/perler-beads/", lang));
        await page.waitForFunction(
          () => !document.getElementById("bpPng").disabled,
        );
        assert.equal(await page.textContent("#bpDimensions"), "32 × 32");
        await page.selectOption("#bpMode", "custom");
        await page.fill("#bpCustom", "#FF0000, #0000FF");
        await page.evaluate(() => {
          const input = document.getElementById("bpGrid");
          input.value = "16";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const fixture = await uploadFixture(page);
        await page.setInputFiles("#bpFile", {
          name: "fixture.png",
          mimeType: "image/png",
          buffer: fixture,
        });
        await page.waitForFunction(
          () => document.getElementById("bpTotal").textContent === "192",
        );
        assert.equal(await page.textContent("#bpDimensions"), "16 × 16");
        assert.equal(await page.textContent("#bpColorCount"), "2");
        const colors = await page
          .locator(".bead-color-entry")
          .evaluateAll((rows) =>
            Object.fromEntries(
              rows.map((row) => [
                row.querySelector("code").textContent,
                Number(row.querySelector("strong").textContent),
              ]),
            ),
          );
        assert.deepEqual(colors, { "#0000FF": 64, "#FF0000": 128 });
        await page.click("#bpCopy");
        const clipboard = await page.evaluate(() =>
          navigator.clipboard.readText(),
        );
        assert.match(clipboard, /#FF0000\s+× 128/);
        assert.match(clipboard, /#0000FF\s+× 64/);
        const csv = await download(
          page,
          "#bpCsv",
          join(artifacts, `beads-${lang}.csv`),
        );
        assert.equal(csv.name, "clover-bead-materials.csv");
        assert.equal(
          csv.bytes.toString(),
          "code,hex,beads\r\n01,#0000FF,64\r\n02,#FF0000,128\r\n",
        );
        await page.uncheck("#bpCodes");
        const chart = await download(
          page,
          "#bpPng",
          join(artifacts, `beads-${lang}.png`),
        );
        assert.equal(chart.name, "clover-bead-pattern.png");
        const [width, height] = pngSize(chart.bytes);
        assert.ok(width >= 620 && height > 16 * 24);
        await page.evaluate(() =>
          window.dispatchEvent(new Event("beforeprint")),
        );
        await page.emulateMedia({ media: "print" });
        assert.equal(await page.locator(".bead-print-sheet").isVisible(), true);
        assert.equal(await page.locator(".bead-studio").isVisible(), false);
        assert.equal(await page.locator(".tool-hero").isVisible(), false);
        assert.equal(await page.locator(".tool-about").isVisible(), false);
        assert.deepEqual(
          await page
            .locator("#bpPrintCanvas")
            .evaluate((canvas) => [canvas.width, canvas.height]),
          [width, height],
        );
        await page.emulateMedia({ media: "screen" });
        await page.fill("#bpCustom", "#bad");
        assert.equal(await page.locator("#bpPng").isDisabled(), true);
        assert.equal(await page.textContent("#bpTotal"), "—");
        assert.equal(await page.locator(".bead-color-entry").count(), 0);
        assert.match(
          await page.locator("#bpStatus").getAttribute("class"),
          /show error/,
        );
        await page.fill("#bpCustom", "#FF0000, #0000FF");
        assert.equal(await page.textContent("#bpTotal"), "192");
        await page.setInputFiles("#bpFile", {
          name: "broken.png",
          mimeType: "image/png",
          buffer: Buffer.from("not a png"),
        });
        await page.waitForFunction(() =>
          document.getElementById("bpStatus").classList.contains("error"),
        );
        assert.equal(await page.locator("#bpCopy").isDisabled(), true);
        assert.equal(await page.textContent("#bpTotal"), "—");
        await page.setInputFiles("#bpFile", {
          name: "empty.png",
          mimeType: "image/png",
          buffer: await uploadFixture(page, true),
        });
        await page.waitForFunction(() =>
          document.getElementById("bpStatus").classList.contains("info"),
        );
        assert.equal(await page.locator("#bpPng").isDisabled(), true);
        await page.setInputFiles("#bpFile", {
          name: "slow.png",
          mimeType: "image/png",
          buffer: fixture,
        });
        await page.click("#bpDemo");
        await page.waitForTimeout(450);
        assert.equal(
          await page.textContent("#bpDimensions"),
          "32 × 32",
          "late decode must not replace the selected example",
        );
        assert.equal(await page.locator("#bpPng").isDisabled(), false);
        await page.selectOption("#bpZoom", "3");
        await fits(page);
        await page.setViewportSize({ width: 360, height: 1200 });
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await fits(page);
        const settings = await page
            .locator(".bead-studio .fun-settings")
            .boundingBox(),
          paper = await page.locator(".bead-paper").boundingBox();
        assert.ok(settings.y < paper.y, "mobile inputs precede the chart");
        await page.selectOption("#bpZoom", "1");
        await page.check("#bpCodes");
        await screenshot(page, artifacts, lang, "beads");
      },
    );

    await run(
      `original avatars, SVG, transparent PNG and seed recovery ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await cspRoute(page, "avatar-generator", csp);
        await page.goto(
          base + localizedPath("/tools/fun/avatar-generator/", lang),
        );
        await page.waitForFunction(
          () => document.getElementById("avImage").naturalWidth === 320,
        );
        assert.equal(await page.locator(".avatar-variant").count(), 6);
        const original = await page.locator("#avImage").getAttribute("src");
        await page.fill("#avSeed", "Another seed");
        assert.notEqual(
          await page.locator("#avImage").getAttribute("src"),
          original,
        );
        await page.fill("#avSeed", "Clover");
        assert.equal(
          await page.locator("#avImage").getAttribute("src"),
          original,
        );
        for (const style of [1, 2, 0]) {
          await page.locator(".avatar-style-choices label").nth(style).click();
          await page.waitForFunction(
            () =>
              document.getElementById("avImage").complete &&
              document.getElementById("avImage").naturalWidth === 320,
          );
          assert.ok(
            await page
              .locator(".avatar-variant img")
              .evaluateAll((images) =>
                images.every((image) =>
                  image.src.startsWith("data:image/svg+xml"),
                ),
              ),
          );
        }
        await page.locator(".avatar-variant").nth(2).click();
        assert.equal(await page.inputValue("#avSeed"), "Clover / 3");
        await page.locator(".avatar-mood").nth(1).click();
        assert.equal(
          (await page.inputValue("#avAccent")).toUpperCase(),
          "#7FB9A2",
        );
        await page.check("#avTransparent");
        assert.equal(await page.locator("#avBackground").isDisabled(), true);
        await page.selectOption("#avSize", "1024");
        await page.click("#avCopy");
        const settings = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        assert.equal(settings.seed, "Clover / 3");
        assert.equal(settings.transparent, true);
        assert.equal(settings.style, "orbit");
        const exportedSvg = await download(
          page,
          "#avSvg",
          join(artifacts, `avatar-${lang}.svg`),
        );
        assert.equal(exportedSvg.name, "clover-avatar.svg");
        const svg = exportedSvg.bytes.toString();
        assert.doesNotMatch(svg, /fill="#E7F1E8"/i);
        assert.equal(
          await page.evaluate(
            (value) =>
              new DOMParser()
                .parseFromString(value, "image/svg+xml")
                .querySelectorAll("parsererror").length,
            svg,
          ),
          0,
        );
        const exportedPng = await download(
          page,
          "#avPng",
          join(artifacts, `avatar-${lang}.png`),
        );
        assert.deepEqual(pngSize(exportedPng.bytes), [1024, 1024]);
        const alpha = await page.evaluate(async (data) => {
          const image = new Image();
          image.src = "data:image/png;base64," + data;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1024;
          const c = canvas.getContext("2d");
          c.drawImage(image, 0, 0);
          return [
            c.getImageData(2, 512, 1, 1).data[3],
            c.getImageData(512, 512, 1, 1).data[3],
          ];
        }, exportedPng.bytes.toString("base64"));
        assert.deepEqual(
          alpha,
          [0, 255],
          "PNG must preserve real transparency and visible artwork",
        );
        await page.fill("#avSeed", "</svg><script>alert(1)</script>");
        const safeSvg = decodeURIComponent(
          (await page.locator("#avImage").getAttribute("src")).split(",")[1],
        );
        assert.doesNotMatch(safeSvg, /<script|alert\(1\)/);
        await page.fill("#avSeed", "");
        assert.equal(await page.locator("#avPng").isDisabled(), true);
        assert.equal(await page.locator("#avImage").isVisible(), false);
        await page.click("#avReset");
        assert.equal(await page.inputValue("#avSeed"), "Clover");
        assert.equal(await page.locator("#avTransparent").isChecked(), false);
        assert.equal(
          await page.locator("#avImage").getAttribute("src"),
          original,
        );
        await page.click("#avRandom");
        assert.notEqual(await page.inputValue("#avSeed"), "Clover");
        await page.setViewportSize({ width: 360, height: 1200 });
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await fits(page);
        const previousAvatar = await page
          .locator("#avImage")
          .getAttribute("src");
        const scrollTarget = await page.evaluate(() => {
          const accent = document.getElementById("avAccent");
          accent.value = "#966DC1";
          accent.dispatchEvent(new Event("input", { bubbles: true }));
          const settings = document.querySelector(".avatar-settings");
          const target = settings.getBoundingClientRect().top + scrollY + 120;
          scrollTo(0, target);
          return target;
        });
        await page.waitForFunction(
          (target) => Math.abs(scrollY - target) < 2,
          scrollTarget,
        );
        await page.locator("#avMiniImage").evaluate((image) => image.decode());
        assert.equal(await page.locator("#avMiniPreview").isVisible(), true);
        assert.equal(
          await page.locator("#avMiniImage").getAttribute("src"),
          await page.locator("#avImage").getAttribute("src"),
        );
        assert.notEqual(
          await page.locator("#avImage").getAttribute("src"),
          previousAvatar,
        );
        const sticky = await page
          .locator(".avatar-settings-head")
          .boundingBox();
        assert.ok(
          sticky.y >= 70 && sticky.y <= 74,
          "mobile avatar preview follows the settings while scrolling",
        );
        await screenshot(page, artifacts, lang, "avatar");
      },
    );

    await run(
      `preference answers, ties, edits and sharing card ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await cspRoute(page, "personality-test", csp);
        await page.goto(
          base + localizedPath("/tools/fun/personality-test/", lang),
        );
        await page.click("#pqStart");
        await page.click("#pqNext");
        assert.match(
          await page.locator("#pqStatus").getAttribute("class"),
          /show error/,
        );
        await page.locator(".quiz-choice").nth(2).click();
        await page.locator("#pqNext").press("Control+Enter");
        assert.equal(await page.textContent("#pqCounter"), "02 / 24");
        await page.click("#pqPrevious");
        assert.equal(
          await page.locator('input[name="pqAnswer"][value="0"]').isChecked(),
          true,
        );
        for (let i = 0; i < 24; i++) {
          await page.locator(".quiz-choice").nth(2).click();
          await page.click("#pqNext");
        }
        assert.equal(await page.textContent("#pqCode"), "XXXX");
        assert.equal(await page.locator(".quiz-axis").count(), 4);
        assert.ok(
          (await page.locator(".quiz-axis-labels").allTextContents()).every(
            (label) => (label.match(/50%/g) || []).length === 2,
          ),
        );
        await page.click("#pqCopy");
        assert.match(
          await page.evaluate(() => navigator.clipboard.readText()),
          /XXXX/,
        );
        const card = await download(
          page,
          "#pqSave",
          join(artifacts, `preferences-${lang}.png`),
        );
        assert.equal(card.name, "clover-preferences-XXXX.png");
        assert.deepEqual(pngSize(card.bytes), [1000, 1340]);
        await page.click("#pqEdit");
        assert.equal(await page.locator("#pqSave").isDisabled(), true);
        assert.equal(
          await page.locator('input[name="pqAnswer"][value="0"]').isChecked(),
          true,
        );
        await page.locator(".quiz-choice").nth(0).click();
        for (let i = 0; i < 24; i++) await page.click("#pqNext");
        assert.equal(await page.textContent("#pqCode"), "EXXX");
        assert.match(
          await page.locator(".quiz-axis-labels").first().textContent(),
          /58%/,
        );
        assert.match(
          await page.locator(".quiz-axis-labels").first().textContent(),
          /42%/,
        );
        await page.setViewportSize({ width: 360, height: 1200 });
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await fits(page);
        await screenshot(page, artifacts, lang, "preferences");
        await page.click("#pqRestart");
        assert.equal(
          await page.locator('input[name="pqAnswer"]:checked').count(),
          0,
        );
        assert.equal(
          await page.locator("#pqProgress").getAttribute("value"),
          "0",
        );
        assert.equal(await page.textContent("#pqCounter"), "01 / 24");
        assert.equal(await page.locator("#pqPrevious").isDisabled(), true);
        assert.equal(await page.locator("#pqCopy").isDisabled(), true);
        assert.equal(
          await page.evaluate(
            () =>
              Object.keys(localStorage).filter((key) =>
                /personality|quiz|answer/i.test(key),
              ).length,
          ),
          0,
        );
        await page.locator(".quiz-choice").nth(0).click();
        await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
        assert.equal(await page.locator("#pqIntro").isVisible(), true);
        await page.click("#pqStart");
        assert.equal(
          await page.locator('input[name="pqAnswer"]:checked').count(),
          0,
        );
        assert.equal(
          await page.locator("#pqProgress").getAttribute("value"),
          "0",
        );
        await fits(page);
      },
    );

    await run(
      `fun tool category and search discovery ${lang}`,
      { viewport: { width: 390, height: 1000 } },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/fun/", lang));
        assert.equal(await page.locator(".tool-card").count(), 18);
        for (const [slug, query] of [
          ['focus-flight', lang === 'zh' ? '专注' : lang === 'tw' ? '專注' : lang === 'en' ? 'focus flight' : lang === 'ko' ? '집중' : '集中フライト'],
          [
            "perler-beads",
            lang === "zh" || lang === "tw"
              ? "拼豆"
              : lang === "en"
                ? "bead"
                : lang === "ko"
                  ? "비즈"
                  : "ビーズ",
          ],
          ["personality-test", "mbti"],
          [
            "avatar-generator",
            lang === "zh"
              ? "头像"
              : lang === "tw"
                ? "頭像"
                : lang === "en"
                  ? "avatar"
                  : lang === "ko"
                    ? "아바타"
                    : "アバター",
          ],
        ]) {
          await page.goto(base + localizedPath("/", lang));
          await page.fill("#toolSearch", query);
          await page.waitForFunction(
            (href) => {
              const card = document.querySelector(`.tool-card[href="${href}"]`);
              return (
                card &&
                getComputedStyle(card).display !== "none" &&
                !card.closest("[hidden]")
              );
            },
            localizedPath(`/tools/fun/${slug}/`, lang),
          );
          const card = page.locator(
            `.tool-card[href="${localizedPath(`/tools/fun/${slug}/`, lang)}"]`,
          );
          assert.equal(await card.isVisible(), true);
          await card.click();
          await page.waitForURL(
            base + localizedPath(`/tools/fun/${slug}/`, lang),
          );
          assert.equal(await page.locator(".tool-guide").isVisible(), true);
          await fits(page);
        }
      },
    );
  }
}
