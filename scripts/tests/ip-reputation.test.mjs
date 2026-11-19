import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeSource,
  blankSource,
} from "../../functions/lib/ip-reputation.ts";
import {
  parseInput,
  comparisonRows,
  filterRows,
  signalState,
  shareFragment,
  parseShare,
  appendHistory,
  parseHistory,
  serializeHistory,
  validateResponse,
  formatUtc,
  ERROR_CODES,
  HISTORY_BYTES,
} from "../../src/lib/ip-reputation.ts";
import { ipReputationCopy } from "../../src/lib/ip-reputation-i18n.ts";
const time = "2026-11-18T16:00:00.000Z";
function fixture(ip = "8.8.8.8", enhanced = false) {
  return {
    version: 1,
    kind: "report",
    ok: true,
    status: "complete",
    responseAt: time,
    error: null,
    data: {
      ip,
      ipVersion: 4,
      enhancement: enhanced ? "enabled" : "key-required",
      sources: [
        normalizeSource(
          "ipwho.is",
          {
            ip,
            success: true,
            country: "United States",
            country_code: "US",
            connection: { asn: 15169, org: "Google" },
          },
          ip,
          time,
        ),
        normalizeSource(
          "ipapi.co",
          {
            ip,
            country_name: "Canada",
            country_code: "CA",
            asn: "AS15169",
            org: " Google ",
          },
          ip,
          time,
        ),
        enhanced
          ? normalizeSource(
              "ipapi.is",
              {
                ip,
                location: { country: "United States", country_code: "US" },
                is_datacenter: true,
                is_vpn: false,
                is_crawler: "GoogleBot",
              },
              ip,
              time,
            )
          : blankSource("ipapi.is", "key-required"),
      ],
    },
  };
}
const snapshot = (i = 0) => ({
  query: `8.8.8.${i + 1}`,
  selectedIp: `8.8.8.${i + 1}`,
  report: fixture(`8.8.8.${i + 1}`),
});
test("missing-is-not-negative", () => {
  for (const value of [undefined, null, "false", 0]) {
    const s = normalizeSource(
      "ipapi.is",
      { ip: "8.8.8.8", is_vpn: value },
      "8.8.8.8",
      time,
    );
    assert.equal(signalState(s.fields.vpn), "not-provided");
  }
  const s = normalizeSource(
    "ipapi.is",
    { ip: "8.8.8.8", is_vpn: false },
    "8.8.8.8",
    time,
  );
  assert.equal(signalState(s.fields.vpn), "not-flagged");
  assert.equal(
    signalState(blankSource("ipapi.is", "unavailable").fields.vpn),
    "unavailable",
  );
  assert.equal(
    signalState(blankSource("ipapi.is", "key-required").fields.vpn),
    "key-required",
  );
});
test("crawler-name-is-preserved", () => {
  const s = normalizeSource(
    "ipapi.is",
    { ip: "8.8.8.8", is_crawler: "GoogleBot" },
    "8.8.8.8",
    time,
  );
  assert.equal(s.crawlerName, "GoogleBot");
  assert.equal(signalState(s.fields.crawler), "flagged");
  for (const v of ["", true, 1, null])
    assert.equal(
      normalizeSource(
        "ipapi.is",
        { ip: "8.8.8.8", is_crawler: v },
        "8.8.8.8",
        time,
      ).fields.crawler.value,
      null,
    );
});
test("source-values-remain-separate", () => {
  const rows = comparisonRows(fixture().data),
    row = rows.find((r) => r.id === "countryCode");
  assert.deepEqual(
    row.values.map((v) => v.field.value),
    ["US", "CA", null],
  );
  assert.equal(row.comparison, "different");
  assert.equal(
    rows.find((r) => r.id === "country").comparison,
    "name-different",
  );
  assert.equal(rows.find((r) => r.id === "asn").comparison, "same");
});
test("single-value-is-not-consensus", () => {
  const r = fixture();
  r.data.sources[1].fields.asn = {
    value: null,
    reason: "not-provided",
    upstreamField: "asn",
  };
  assert.equal(
    comparisonRows(r.data).find((r) => r.id === "asn").comparison,
    "single",
  );
});
test("filters-do-not-change-data", () => {
  const r = fixture(),
    before = JSON.stringify(r),
    rows = comparisonRows(r.data);
  assert.deepEqual(
    filterRows(rows, "differences").map((r) => r.id),
    ["country", "countryCode"],
  );
  assert.deepEqual(
    filterRows(rows, "provided").map((r) => r.id),
    ["country", "countryCode", "asn", "asnOrg"],
  );
  assert.equal(JSON.stringify(r), before);
});
test("share-contains-only-query", () => {
  const fragment = shareFragment("EXAMPLE.com.", "2606:4700:4700:0:0:0:0:1111");
  assert.deepEqual(parseShare(fragment), {
    q: "example.com",
    ip: "2606:4700:4700::1111",
  });
  assert.deepEqual(parseShare(shareFragment("8.8.8.8", "1.1.1.1")), {
    q: "8.8.8.8",
  });
  assert.equal(parseShare("#q=8.8.8.8&key=secret"), null);
  assert.equal(parseShare("#q=8.8.8.8&q=1.1.1.1"), null);
  assert.equal(shareFragment("https://example.com"), "");
  assert.deepEqual(parseShare("#q=example.com&ip=127.0.0.1"), {
    q: "example.com",
  });
  assert.deepEqual(
    [...new URLSearchParams(fragment.slice(1)).keys()],
    ["q", "ip"],
  );
});
test("history-deduplicates-and-caps-ten", () => {
  let h = [];
  for (let i = 0; i < 11; i++) h = appendHistory(h, snapshot(i));
  assert.equal(h.length, 10);
  assert.equal(h[0].query, "8.8.8.11");
  assert.equal(h[9].query, "8.8.8.2");
  h = appendHistory(h, snapshot(4));
  assert.equal(h[0].query, "8.8.8.5");
  assert.equal(h.length, 10);
  assert.equal(parseHistory(serializeHistory(h)).entries.length, 10);
});
test("history-rejects-corruption", () => {
  for (const v of [
    "{",
    JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, entries: Array(11).fill(snapshot()) }),
    JSON.stringify({ version: 1, entries: [{ query: 3 }] }),
    " ".repeat(HISTORY_BYTES + 1),
  ])
    assert.equal(parseHistory(v).error, "history-invalid");
  const v = snapshot();
  v.report.data.sources[0].fields.vpn.value = "false";
  assert.equal(
    parseHistory(JSON.stringify({ version: 1, entries: [v] })).error,
    "history-invalid",
  );
});
test("snapshot-preserves-source-time", () => {
  const s = snapshot();
  s.report.data.secret = "not exported";
  s.report.secret = "not exported";
  const parsed = parseHistory(serializeHistory([s]));
  assert.equal(parsed.entries[0].report.data.sources[0].fetchedAt, time);
  assert.ok(!serializeHistory([s]).includes("not exported"));
  assert.match(formatUtc(time, "en"), /UTC$/);
});
test("five-language-copy-is-complete", () => {
  const en = ipReputationCopy("en");
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const c = ipReputationCopy(lang);
    assert.deepEqual(Object.keys(c.text).sort(), Object.keys(en.text).sort());
    assert.deepEqual(
      Object.keys(c.fields).sort(),
      Object.keys(en.fields).sort(),
    );
    assert.deepEqual(Object.keys(c.errors).sort(), [...ERROR_CODES].sort());
    assert.ok(
      Object.values(c.text).every((v) => typeof v === "string" && v.length > 0),
    );
    for (const f of Object.values(c.fields))
      assert.ok(f.label && f.explanation);
    if (["en", "ko"].includes(lang))
      assert.doesNotMatch(JSON.stringify(c), /[\u4e00-\u9fff]/u);
  }
  assert.match(ipReputationCopy("tw").fields.hosting.label, /資料中心/);
  assert.match(en.text.noKey, /this site has no API key configured/);
  for (const lang of ["en", "ko", "ja"]) {
    const c = JSON.parse(
      readFileSync(new URL(`../../src/lib/i18n/${lang}.json`, import.meta.url)),
    ).content["ip-reputation"];
    assert.ok(
      c.features.length >= 3 &&
        c.detail.steps.length >= 3 &&
        c.detail.examples.length >= 2 &&
        c.detail.faqs.length >= 2,
    );
    assert.ok(c.detail.privacy);
  }
});
test("response-validators-whitelist-and-reject-contradictions", () => {
  assert.ok(validateResponse(fixture()));
  assert.ok(validateResponse(fixture("8.8.8.8", true)));
  for (const mutate of [
    (r) => (r.ok = false),
    (r) => (r.data.ip = "127.0.0.1"),
    (r) => r.data.sources.reverse(),
    (r) => (r.data.sources[0].fetchedAt = "tomorrow"),
    (r) => (r.data.sources[0].fields.country.value = true),
    (r) => (r.data.sources[2].fields.vpn.value = false),
    (r) => (r.data.sources[0].fields.asn.value = "AS999999999999"),
    (r) => (r.error = { code: "unknown", retryable: true }),
  ]) {
    const r = fixture();
    mutate(r);
    assert.equal(validateResponse(r), null);
  }
});
test("input-boundaries-client-and-share", () => {
  for (const raw of [
    "",
    "8.8.8.8 1.1.1.1",
    "https://example.com",
    "8.8.8.8/24",
    "[2606:4700::1111]",
    "example.com:443",
    "a".repeat(257),
    "192.168.1.1",
    "::ffff:c0a8:101",
    "foo\u202e.com",
    "a_b.example",
    "a..example",
    "localhost",
    "foo.home.arpa",
  ])
    assert.equal(parseInput(raw).ok, false, raw);
  assert.equal(parseInput("例え.テスト").query, "xn--r8jz45g.xn--zckzah");
});

test("history-utf8-budget-trims-oldest", () => {
  let entries = [];
  for (let i = 0; i < 10; i++) {
    const ip = `8.8.8.${i + 1}`,
      r = fixture(ip, true);
    for (const s of r.data.sources)
      for (const k of ["country", "city", "asnOrg"])
        s.fields[k] = { ...s.fields[k], value: "漢".repeat(240), reason: null };
    r.data.sources[2].fields.registeredOrg = {
      ...r.data.sources[2].fields.registeredOrg,
      value: "漢".repeat(240),
      reason: null,
    };
    assert.ok(validateResponse(r));
    entries = appendHistory(entries, { query: ip, selectedIp: ip, report: r });
  }
  const text = serializeHistory(entries);
  assert.ok(new TextEncoder().encode(text).length <= HISTORY_BYTES);
  assert.ok(
    entries.length < 10 && entries.length > 0,
    `entries=${entries.length}; bytes=${new TextEncoder().encode(text).length}`,
  );
  assert.equal(entries[0].selectedIp, "8.8.8.10");
  assert.deepEqual(parseHistory(text).entries, entries);
});
