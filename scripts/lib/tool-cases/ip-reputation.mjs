import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { localizedPath, LOCALES } from "../../../config/routes.mjs";
import {
  normalizeSource,
  blankSource,
} from "../../../functions/lib/ip-reputation.ts";
import {
  validateResponse,
  parseInput,
  STORAGE_KEY,
  parseHistory,
} from "../../../src/lib/ip-reputation.ts";
import { ipReputationCopy } from "../../../src/lib/ip-reputation-i18n.ts";
const at = "2026-11-18T16:00:00.000Z";
const path = (lang) => localizedPath("/tools/dev/ip-reputation/", lang);
function report(ip = "8.8.8.8", mode = "basic") {
  const enhanced = mode !== "basic",
    sources = [
      normalizeSource(
        "ipwho.is",
        {
          ip,
          success: true,
          country: "United States",
          country_code: "US",
          city: "Mountain View",
          connection: {
            asn: 15169,
            org: "Example organization with a long original name",
          },
        },
        ip,
        at,
      ),
      normalizeSource(
        "ipapi.co",
        {
          ip,
          country_name: "Canada",
          country_code: "CA",
          city: "Toronto",
          asn: "AS13335",
          org: "Different organization",
        },
        ip,
        at,
      ),
      enhanced
        ? normalizeSource(
            "ipapi.is",
            {
              ip,
              location: { country: "United States", country_code: "US" },
              asn: {
                asn: 15169,
                org: "Example ASN",
                abuser_score: "0.001 (Low)",
              },
              company: {
                name: "Original company",
                abuser_score: "0.002 (Low)",
              },
              is_datacenter: true,
              is_vpn: false,
              is_proxy: "false",
              is_tor: null,
              is_crawler: "GoogleBot",
              is_abuser: false,
            },
            ip,
            at,
          )
        : blankSource("ipapi.is", "key-required"),
    ];
  if (["partial", "all"].includes(mode)) {
    sources[0] = blankSource("ipwho.is", "unavailable", {
      code: "upstream-timeout",
      retryable: true,
      sourceId: "ipwho.is",
    });
    sources[0].status = "timeout";
  }
  if (["auth", "rate"].includes(mode)) {
    sources[2] = blankSource("ipapi.is", "unavailable", {
      code: mode === "auth" ? "auth-failed" : "rate-limited",
      retryable: mode === "rate",
      sourceId: "ipapi.is",
      ...(mode === "rate" ? { retryAfterSeconds: 30 } : {}),
    });
    sources[2].status = mode === "auth" ? "auth-failed" : "rate-limited";
  }
  if (mode === "all") {
    for (let i = 1; i < 3; i++) {
      sources[i] = blankSource(sources[i].id, "unavailable", {
        code: "upstream-http",
        retryable: true,
        sourceId: sources[i].id,
      });
      sources[i].status = "failed";
    }
  }
  const count = sources.filter((s) => s.status === "success").length,
    enabled = sources.filter((s) => s.status !== "disabled").length;
  const value = {
    version: 1,
    kind: "report",
    ok: count > 0,
    status: count === enabled ? "complete" : count ? "partial" : "unavailable",
    responseAt: at,
    data: {
      ip,
      ipVersion: ip.includes(":") ? 6 : 4,
      enhancement: enhanced ? "enabled" : "key-required",
      sources,
    },
    error: count ? null : { code: "upstreams-unavailable", retryable: true },
  };
  assert.ok(validateResponse(value));
  return value;
}
function resolution(query = "example.com", partial = false) {
  return {
    version: 1,
    kind: "resolution",
    ok: true,
    status: partial ? "partial" : "complete",
    responseAt: at,
    error: null,
    data: {
      query,
      addresses: [
        { ip: "8.8.8.8", ipVersion: 4 },
        { ip: "2606:4700:4700::1111", ipVersion: 6 },
      ],
      filteredCount: 1,
      truncated: false,
      families: ["A", "AAAA"].map((type) => ({
        type,
        status: partial && type === "AAAA" ? "failed" : "success",
        error:
          partial && type === "AAAA"
            ? { code: "upstream-timeout", retryable: true }
            : null,
        fetchedAt: partial && type === "AAAA" ? null : at,
        cacheHit: false,
        cacheAgeMs: 0,
      })),
    },
  };
}
async function state(page, value) {
  await page.waitForFunction(
    (value) => document.querySelector("#ipReputation")?.dataset.state === value,
    value,
    { timeout: 9000 },
  );
}
function monitor(page) {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/ip-reputation") requests.push(r);
  });
  return {
    requests,
    check() {
      assert.deepEqual(errors, []);
    },
  };
}
async function mock(page, getMode = () => "basic") {
  const bodies = [];
  await page.route("**/api/ip-reputation", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const mode = getMode();
    if (mode === "hang") return;
    let value =
      body.action === "resolve"
        ? resolution(body.query, mode === "dns-partial")
        : report(body.query, mode);
    if (mode === "malformed")
      value = { version: 1, kind: "report", ok: true, data: {} };
    await route.fulfill({
      status: value.ok ? 200 : 503,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  return bodies;
}
async function submit(page, q = "8.8.8.8", expected = "complete") {
  await page.locator("#iprQuery").fill(q);
  await page.locator("#iprSubmit").click();
  await state(page, expected);
}
async function shot(page, artifacts, name) {
  await page.screenshot({
    path: join(artifacts, `ip-reputation-${name}-mock.png`),
    fullPage: true,
  });
}
async function fit(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no horizontal document overflow",
  );
}
export async function run({ run, remember, base, artifacts }) {
  const csp = readFileSync(
    new URL("../../../public/_headers", import.meta.url),
    "utf8",
  ).match(/Content-Security-Policy:\s*([^\r\n]+)/)[1];
  for (const lang of ["zh", "tw", "en", "ko", "ja"])
    await run(`ip-reputation-${lang}-core-csp`, {}, async (page, context) => {
      const m = monitor(page),
        { text: t } = ipReputationCopy(lang);
      await remember(context, lang);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.addInitScript(() => {
        window.iprViolations = [];
        document.addEventListener("securitypolicyviolation", (e) => {
          if (/script-src|connect-src/.test(e.violatedDirective))
            window.iprViolations.push(e.violatedDirective);
        });
      });
      await page.route("**/tools/dev/ip-reputation/", async (route) => {
        const r = await route.fetch();
        await route.fulfill({
          response: r,
          headers: { ...r.headers(), "content-security-policy": csp },
        });
      });
      let mode = "basic";
      const calls = await mock(page, () => mode);
      await page.goto(base + path(lang));
      await page.locator("#iprSubmit").waitFor();
      assert.equal(calls.length, 0);
      assert.equal(await page.locator("h1").textContent(), t.title);
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
      assert.ok(await page.locator(".ipr-privacy").isVisible());
      assert.ok(await page.locator("label[for=iprQuery]").isVisible());
      assert.ok(
        await page.locator("#iprQuery").getAttribute("aria-describedby"),
      );
      for (const slug of ["ip-lookup", "http-tester", "ua-parser"])
        assert.equal(
          await page
            .locator(
              `.ipr-related a[href="${localizedPath("/tools/dev/" + slug + "/", lang)}"]`,
            )
            .count(),
          1,
        );
      await page.locator('[data-example="8.8.8.8"]').click();
      assert.equal(calls.length, 0);
      await page.locator("#iprSubmit").click();
      await state(page, "complete");
      assert.equal(calls.length, 1);
      assert.match(
        await page.locator("#iprSources").textContent(),
        new RegExp(t.noKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert.equal(await page.locator("#iprSourceHeaders>div").count(), 3);
      assert.equal(
        (await page.locator("#iprJson").inputValue()).includes("key-required"),
        true,
      );
      mode = "enhanced";
      await page.locator("#iprQuery").focus();
      await page.keyboard.press("Control+Enter");
      await state(page, "complete");
      assert.equal(calls.length, 2);
      assert.equal(
        await page.locator("[data-field=hosting] dd").last().textContent(),
        t.flagged,
      );
      assert.equal(
        await page.locator("[data-field=vpn] dd").last().textContent(),
        t["not-flagged"],
      );
      assert.equal(
        await page.locator("[data-field=proxy] dd").last().textContent(),
        t["not-provided"],
      );
      assert.match(
        await page.locator("#iprSources").textContent(),
        /GoogleBot/,
      );
      const detail = page.locator("[data-field=tor] summary");
      await detail.focus();
      await page.keyboard.press("Enter");
      assert.equal(await detail.evaluate((e) => e.parentElement.open), true);
      await page.locator("input[name=iprFilter][value=differences]").check();
      assert.equal(calls.length, 2);
      assert.ok(await page.locator("[data-field=countryCode]").isVisible());
      assert.equal(await page.locator("[data-field=vpn]").count(), 0);
      await page.locator("#iprCopy").click();
      const exported = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      assert.ok(validateResponse(exported));
      await page.locator("input[name=iprFilter][value=all]").check();
      await shot(page, artifacts, lang + "-enhanced-csp");
      await page.locator("#iprShare").click();
      const link = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(new URL(link).hash, "#q=8.8.8.8");
      const other = await context.newPage(),
        otherMonitor = monitor(other);
      await other.goto(link);
      await other.locator("#iprSubmit").waitFor();
      assert.equal(await other.locator("#iprQuery").inputValue(), "8.8.8.8");
      assert.equal(otherMonitor.requests.length, 0);
      assert.equal(
        await other.locator("#ipReputation").getAttribute("data-state"),
        "idle",
      );
      otherMonitor.check();
      await other.close();
      await page.reload();
      await state(page, "snapshot");
      assert.equal(calls.length, 2);
      assert.ok(await page.locator("#iprSnapshotBanner").isVisible());
      assert.equal(await page.locator("#iprHistory>li").count(), 1);
      await page.locator("#iprClearHistory").click();
      await page.locator("#iprConfirmClear").click();
      assert.equal(await page.locator("#iprHistory>li").count(), 0);
      await page.reload();
      await state(page, "idle");
      assert.equal(await page.locator("#iprHistory>li").count(), 0);
      assert.deepEqual(await page.evaluate(() => window.iprViolations), []);
      await shot(page, artifacts, lang + "-core-csp");
      m.check();
    });
  await run("ip-reputation-domain-selection", {}, async (page, context) => {
    await remember(context, "en");
    const m = monitor(page),
      calls = await mock(page);
    await page.goto(base + path("en") + "#q=example.com&ip=1.1.1.1");
    await page.locator("#iprSubmit").click();
    await state(page, "selecting");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, "resolve");
    assert.equal(
      await page.locator("input[name=iprAddress]:checked").inputValue(),
      "8.8.8.8",
    );
    assert.match(await page.locator("#iprDnsNote").textContent(), /1/);
    await page.locator("input[name=iprAddress]").first().focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.locator("input[name=iprAddress]:checked").inputValue(),
      "2606:4700:4700::1111",
    );
    await page.locator("#iprSelectedLookup").click();
    await state(page, "complete");
    assert.deepEqual(calls[1], {
      action: "lookup",
      query: "2606:4700:4700::1111",
    });
    assert.match(await page.locator("#iprSummary").textContent(), /IPv6/);
    await page.goto(
      base + path("en") + "#q=example.com&ip=2606%3A4700%3A4700%3A%3A1111",
    );
    await state(page, "idle");
    assert.equal(calls.length, 2);
    assert.equal(await page.locator("#iprQuery").inputValue(), "example.com");
    assert.ok(await page.locator("#iprCopy").isDisabled());
    assert.equal(await page.locator("#iprJson").inputValue(), "");
    assert.equal(await page.locator("#iprHistory>li").count(), 1);
    await page.locator("#iprSubmit").click();
    await state(page, "selecting");
    assert.equal(calls.length, 3);
    assert.equal(
      await page.locator("input[name=iprAddress]:checked").inputValue(),
      "2606:4700:4700::1111",
    );
    await page.locator("#iprSelectedLookup").click();
    await state(page, "complete");
    assert.equal(calls.length, 4);
    assert.deepEqual(calls[3], {
      action: "lookup",
      query: "2606:4700:4700::1111",
    });
    await shot(page, artifacts, "domain-selection");
    m.check();
  });
  await run("ip-reputation-invalid-never-requests", {}, async (page) => {
    const m = monitor(page),
      calls = await mock(page);
    await page.goto(base + path("zh"));
    for (const q of [
      "",
      "not an address",
      "https://example.com",
      "8.8.8.8/24",
      "127.0.0.1",
      "169.254.169.254",
      "::ffff:192.168.1.1",
      "::ffff:c0a8:0101",
      "2001:db8::1",
      "3fff::1",
      "example.com:443",
      "a".repeat(257),
    ]) {
      await submit(page, q, "invalid");
      assert.equal(await page.locator("#iprCopy").isDisabled(), true);
      assert.equal(
        await page.locator("#iprQuery").getAttribute("aria-invalid"),
        "true",
      );
    }
    assert.equal(calls.length, 0);
    m.check();
  });
  for (const mode of [
    "partial",
    "all",
    "auth",
    "rate",
    "malformed",
    "dns-partial",
  ])
    await run(`ip-reputation-${mode}-response`, {}, async (page) => {
      const m = monitor(page);
      await mock(page, () => mode);
      await page.goto(base + path("en"));
      const expected =
        mode === "all" || mode === "malformed"
          ? "unavailable"
          : mode === "dns-partial"
            ? "selecting"
            : "partial";
      await submit(
        page,
        mode === "dns-partial" ? "example.com" : "8.8.8.8",
        expected,
      );
      if (mode === "all" || mode === "malformed") {
        assert.equal(await page.locator("#iprCopy").isDisabled(), true);
        assert.equal(await page.locator("#iprHistory>li").count(), 0);
      }
      if (mode === "auth" || mode === "rate") {
        const text = await page.locator("#iprSources").textContent();
        assert.match(
          text,
          mode === "auth" ? /authentication failed/i : /rate limit/i,
        );
        assert.ok(!text.includes(ipReputationCopy("en").text.noKey));
      }
      m.check();
    });
  await run("ip-reputation-timeout-cancel-clear", {}, async (page) => {
    const m = monitor(page);
    await mock(page, () => "hang");
    await page.goto(base + path("en"));
    await page.locator("#iprQuery").fill("8.8.8.8");
    await page.locator("#iprSubmit").click();
    await state(page, "querying");
    assert.equal(
      await page.locator("#iprResults").getAttribute("aria-busy"),
      "true",
    );
    await page.locator("#iprCancel").click();
    await state(page, "cancelled");
    await page.locator("#iprSubmit").click();
    await state(page, "querying");
    await page.locator("#iprClear").click();
    await state(page, "idle");
    assert.equal(await page.locator("#iprQuery").inputValue(), "");
    await submit(page, "1.1.1.1", "unavailable");
    assert.match(await page.locator("#iprStatus").textContent(), /timed out/i);
    assert.equal(await page.locator("#iprHistory>li").count(), 0);
    m.check();
  });
  for (const action of ["replace", "clear", "cancel"])
    await run(`ip-reputation-race-${action}`, {}, async (page) => {
      const m = monitor(page);
      let first;
      let releaseFirst;
      const firstReady = new Promise((resolve) => {
        releaseFirst = resolve;
      });
      await page.route("**/api/ip-reputation", async (route) => {
        const body = route.request().postDataJSON();
        if (body.query === "8.8.8.8") {
          first = route;
          releaseFirst();
          return;
        }
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(report(body.query)),
        });
      });
      await page.goto(base + path("en"));
      await page.locator("#iprQuery").fill("8.8.8.8");
      await page.locator("#iprSubmit").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#ipReputation").dataset.state === "querying",
      );
      await firstReady;
      if (action === "replace") await submit(page, "1.1.1.1");
      else
        await page
          .locator(action === "clear" ? "#iprClear" : "#iprCancel")
          .click();
      await first
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify(report("8.8.8.8")),
        })
        .catch(() => {});
      await delay(100);
      if (action === "replace") {
        assert.match(
          await page.locator("#iprSummary").textContent(),
          /1\.1\.1\.1/,
        );
        assert.equal(await page.locator("#iprHistory>li").count(), 1);
        assert.equal(
          parseHistory(
            await page.evaluate(
              (key) => localStorage.getItem(key),
              STORAGE_KEY,
            ),
          ).entries[0].selectedIp,
          "1.1.1.1",
        );
      } else assert.equal(await page.locator("#iprHistory>li").count(), 0);
      m.check();
    });
  for (const issue of ["denied", "quota", "corrupt", "version"])
    await run(`ip-reputation-storage-${issue}`, {}, async (page) => {
      const m = monitor(page);
      await page.addInitScript(
        ({ issue, key }) => {
          if (issue === "denied") {
            Storage.prototype.getItem = () => {
              throw Error("denied");
            };
            Storage.prototype.setItem = () => {
              throw Error("denied");
            };
          } else if (issue === "quota")
            Storage.prototype.setItem = () => {
              throw Error("quota");
            };
          else
            localStorage.setItem(
              key,
              issue === "corrupt"
                ? "{"
                : JSON.stringify({ version: 99, entries: [] }),
            );
        },
        { issue, key: STORAGE_KEY },
      );
      await mock(page);
      await page.goto(base + path("en"));
      if (["corrupt", "version"].includes(issue))
        assert.match(
          await page.locator("#iprStorageNotice").textContent(),
          /could not be restored/,
        );
      await submit(page);
      assert.equal(await page.locator("#iprHistory>li").count(), 1);
      if (["denied", "quota"].includes(issue))
        assert.match(
          await page.locator("#iprStorageNotice").textContent(),
          /lost on refresh/,
        );
      m.check();
    });
  await run(
    "ip-reputation-keyboard-clipboard-offline",
    {},
    async (page, context) => {
      const m = monitor(page);
      await remember(context, "en");
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async () => {
              throw Error("denied");
            },
          },
        });
      });
      const calls = await mock(page);
      await page.goto(base + path("en"));
      await page.locator("#iprQuery").focus();
      await page.keyboard.type("8.8.8.8");
      await page.keyboard.press("Control+Enter");
      await state(page, "complete");
      await page.locator("input[name=iprFilter][value=all]").focus();
      await page.keyboard.press("ArrowRight");
      await page.locator("[data-field=countryCode] summary").focus();
      await page.keyboard.press("Enter");
      await page.locator("#iprCopy").focus();
      await page.keyboard.press("Enter");
      assert.ok(await page.locator("#iprManual").isVisible());
      assert.ok(JSON.parse(await page.locator("#iprManual").inputValue()));
      await context.setOffline(true);
      await page.locator("#iprSubmit").click();
      await state(page, "unavailable");
      assert.equal(calls.length, 1);
      await page.locator("#iprHistory button").first().click();
      await state(page, "snapshot");
      await context.setOffline(false);
      await page.locator("#iprClearHistory").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#iprHistory>li").count(), 0);
      m.check();
    },
  );
  for (const width of [1440, 360])
    for (const theme of ["light", "dark"])
      await run(
        `ip-reputation-layout-${width}-${theme}`,
        { viewport: { width, height: 900 }, colorScheme: theme },
        async (page) => {
          const m = monitor(page);
          await page.addInitScript(
            (theme) =>
              document.addEventListener("DOMContentLoaded", () =>
                document.documentElement.setAttribute("data-theme", theme),
              ),
            theme,
          );
          let mode = "enhanced";
          await mock(page, () => mode);
          await page.goto(base + path("en"));
          await fit(page);
          await shot(page, artifacts, `${width}-${theme}-empty`);
          await submit(page, "2606:4700:4700::1111");
          await fit(page);
          await shot(page, artifacts, `${width}-${theme}-enhanced`);
          mode = "all";
          await page.locator("#iprSubmit").click();
          await state(page, "unavailable");
          await fit(page);
          await shot(page, artifacts, `${width}-${theme}-error`);
          m.check();
        },
      );
}
/** Independent live probe: never use capability success as lookup evidence. */
export async function verifyLiveIpReputation(base, fetcher = fetch) {
  const call = async (body) => {
    const response = await fetcher(
      new URL("/api/ip-reputation", base),
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(7000),
          }
        : { signal: AbortSignal.timeout(7000) },
    );
    const text = await response.text();
    assert.ok(new TextEncoder().encode(text).length <= 128 * 1024);
    const data = validateResponse(JSON.parse(text));
    assert.ok(data, "valid live contract");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    return { response, data };
  };
  const capability = await call();
  assert.equal(capability.response.status, 200);
  assert.equal(capability.data.kind, "capabilities");
  const observations = [];
  for (const ip of ["1.1.1.1", "2606:4700:4700::1111"]) {
    const { response, data } = await call({ action: "lookup", query: ip });
    assert.equal(response.status, 200);
    assert.equal(data.kind, "report");
    assert.equal(data.ok, true);
    assert.equal(data.data.ip, ip);
    const basic = data.data.sources
      .slice(0, 2)
      .filter((s) => s.status === "success");
    assert.ok(
      basic.length >= 1,
      "at least one basic source must actually succeed",
    );
    assert.equal(data.data.enhancement, capability.data.data.enhancement);
    observations.push({
      ip,
      status: data.status,
      basicSources: basic.map((s) => s.id),
      crossChecked: basic.length === 2,
      enhancement: data.data.enhancement,
      sources: data.data.sources.map((s) => ({
        id: s.id,
        status: s.status,
        fetchedAt: s.fetchedAt,
        error: s.error?.code ?? null,
      })),
    });
  }
  const resolved = await call({ action: "resolve", query: "example.com" });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.data.kind, "resolution");
  assert.equal(resolved.data.ok, true);
  const selected = resolved.data.data.addresses[0];
  assert.ok(selected && parseInput(selected.ip).ok);
  const domain = await call({ action: "lookup", query: selected.ip });
  assert.equal(domain.response.status, 200);
  assert.equal(domain.data.data.ip, selected.ip);
  assert.ok(
    domain.data.data.sources.slice(0, 2).some((s) => s.status === "success"),
  );
  for (const query of [
    "",
    "https://example.com",
    "127.0.0.1",
    "::ffff:c0a8:1",
    "3fff::1",
  ]) {
    const { response, data } = await call({ action: "lookup", query });
    assert.equal(response.status, 400);
    assert.equal(data.kind, "error");
    assert.equal(data.ok, false);
    assert.equal(data.data, null);
  }
  return {
    environment: base,
    capabilities: capability.data.data,
    observations,
    domain: {
      query: "example.com",
      selectedIp: selected.ip,
      status: domain.data.status,
    },
    note: "Only these live queries were checked. Missing enhanced signals remain unavailable.",
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
        await verifyLiveIpReputation(
          process.argv[3] ?? "https://clovertools.cn",
        ),
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(
      "ip-reputation live verification failed:",
      e instanceof Error ? e.message : "unknown error",
    );
    process.exitCode = 1;
  }
}
