/** Regenerate public examples from real tool exports. Requires a local preview. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { createAvatar } from "../src/lib/avatar.ts";
import {
  AVATAR_CASE_OPTIONS,
  CSV_CASE_INPUT,
} from "../src/lib/case-presets.ts";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4339";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Capture examples against a local build",
);
const out = new URL("../public/examples/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "/usr/bin/chromium",
  headless: true,
});
const context = await browser.newContext({
  locale: "zh-CN",
  viewport: { width: 1440, height: 1000 },
});
await context.route("**/*", (route) =>
  new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue()
    : route.abort(),
);
const page = await context.newPage();
const files = [];
async function save(name, content) {
  await writeFile(new URL(name, out), content);
  files.push(name);
}
async function download(button, name) {
  const pending = page.waitForEvent("download");
  await page.click(button);
  const item = await pending;
  assert.equal(await item.failure(), null);
  await item.saveAs(new URL(name, out).pathname);
  files.push(name);
}
try {
  await page.goto(base + "/tools/fun/perler-beads/");
  await page.waitForFunction(() => !document.querySelector("#bpPng").disabled);
  const source = await page.locator("#bpSource").getAttribute("src");
  assert(source.startsWith("data:image/png;base64,"));
  await save("clover-source.png", Buffer.from(source.split(",")[1], "base64"));
  await download("#bpPng", "clover-chart.png");
  await download("#bpCsv", "clover-materials.csv");
  const beads = await page.evaluate(() => ({
    dimensions: document.querySelector("#bpDimensions").textContent,
    total: Number(
      document.querySelector("#bpTotal").textContent.replace(/[^0-9]/g, ""),
    ),
    colors: Number(
      document
        .querySelector("#bpColorCount")
        .textContent.replace(/[^0-9]/g, ""),
    ),
    palette: [...document.querySelectorAll("#bpMaterials > div")].map((el) => ({
      hex: el.querySelector("code").textContent,
      count: Number(
        el.querySelector("strong").textContent.replace(/[^0-9]/g, ""),
      ),
    })),
  }));
  assert.equal(
    beads.palette.reduce((sum, color) => sum + color.count, 0),
    beads.total,
  );
  await page.goto(base + "/tools/fun/avatar-generator/");
  await page.waitForFunction(() =>
    document.querySelector("#avImage").src.startsWith("data:image/svg+xml"),
  );
  await download("#avSvg", "clover-avatar.svg");
  await download("#avPng", "clover-avatar.png");
  assert.equal(
    await readFile(new URL("clover-avatar.svg", out), "utf8"),
    createAvatar(AVATAR_CASE_OPTIONS),
  );
  await page.goto(base + "/tools/dev/json-convert/");
  await page.fill("#jsonInput", JSON.stringify(CSV_CASE_INPUT, null, 2));
  await page.click("#convertBtn");
  const csv = await page.inputValue("#csvOutput");
  await download("#downloadBtn", "nested-orders.csv");
  assert.equal(
    (await readFile(new URL("nested-orders.csv", out), "utf8"))
      .replace(/^\uFEFF/, "")
      .replaceAll("\r\n", "\n"),
    csv,
  );
  await save(
    "nested-orders.json",
    JSON.stringify(CSV_CASE_INPUT, null, 2) + "\n",
  );
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(new URL(file, out)))
          .digest("hex"),
      ]),
    ),
  );
  await writeFile(
    new URL("manifest.json", out),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        toolRevision: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        beads,
        avatar: AVATAR_CASE_OPTIONS,
        csv: { rows: CSV_CASE_INPUT.length, text: csv },
        sha256: hashes,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      { files: files.length, beads, csvRows: CSV_CASE_INPUT.length },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
