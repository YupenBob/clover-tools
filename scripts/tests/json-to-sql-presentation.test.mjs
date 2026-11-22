import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registeredToolSlugs } from "../tool-pipeline/lib/tool-registry.mjs";
import {
  loadSchema,
  loadPolicy,
  validateSchema,
  validateAgainstPolicy,
  validatePresentationContract,
} from "../tool-pipeline/lib/presentation.mjs";
const repo = new URL("../../", import.meta.url).pathname;
const c = JSON.parse(
  readFileSync(
    new URL("../../data/tool-presentation/json-to-sql.json", import.meta.url),
    "utf8",
  ),
);
test("json-to-sql schema and workspace policy", () => {
  assert.deepEqual(validateSchema(c, loadSchema(repo)), []);
  assert.deepEqual(validateAgainstPolicy(c, loadPolicy(repo)), []);
  assert.deepEqual(
    validatePresentationContract({
      repo,
      toolSlugs: registeredToolSlugs(repo),
    }),
    [],
  );
  assert.equal(c.profile, "workspace");
  assert.equal(c.interaction.autoHideMs, 8000);
  assert.equal(c.timing.requireAdvancingTime, false);
});
test("json-to-sql strict primary states and SSR structure", async () => {
  for (const state of ["firstLoad", "primary", "degraded", "fullscreen"]) {
    assert.deepEqual(c.states[state], {
      slots: ["source", "sql"],
      controls: ["editor", "exit"],
      allowText: false,
      allowInteractives: false,
    });
  }
  assert.deepEqual(
    Object.keys(c.states).sort(),
    [
      "firstLoad",
      "primary",
      "reveal",
      "settingsOpen",
      "degraded",
      "fullscreen",
    ].sort(),
  );
  assert.equal(c.primary.slots.length, 2);
  assert.equal(c.controls.length, 4);
  assert.ok(c.controls.every((v) => v.minHitTargetPx === 44));
  assert.deepEqual(c.interaction.shortcuts, {
    "Control+Enter": "generate",
    "Meta+Enter": "generate",
    F2: "settings",
    F10: "fullscreen",
    Escape: "exit",
  });
  const source = readFileSync(
    new URL("../../src/components/JsonToSql.astro", import.meta.url),
    "utf8",
  );
  const { transform } = await import("@astrojs/compiler");
  const compiled = await transform(source, {
    filename: "src/components/JsonToSql.astro",
  });
  assert.deepEqual(
    compiled.diagnostics.filter((d) => d.severity === 1),
    [],
  );
  assert.ok(source.includes('data-presentation-state="firstLoad"'));
  assert.match(source, /<div id="jtsReveal" hidden>/);
  assert.match(source, /<section id="jtsSettings" hidden inert/);
  assert.match(source, /<pre id="jtsOutput"[^>]*>\{/);
  assert.doesNotMatch(source, /innerHTML|<canvas|<img/);
  for (const locale of ["", "en/", "ja/", "ko/", "zh-hant/"]) {
    const route = readFileSync(
      new URL(
        `../../src/pages/${locale}tools/dev/json-to-sql.astro`,
        import.meta.url,
      ),
      "utf8",
    );
    assert.ok(route.includes("@shared-tool-ui"));
    assert.ok(route.includes('layout="wide" workspace="split"'));
    assert.ok(route.includes("<JsonToSql lang={lang} />"));
  }
});
