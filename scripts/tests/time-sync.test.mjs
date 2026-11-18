import test from "node:test";
import assert from "node:assert/strict";
import {
  median,
  validateTimeResponse,
  estimateOffset,
  aggregateSamples,
  formatDelta,
  formatBeijing,
  parseHistory,
  serializeHistory,
  appendHistory,
  liveReference,
  SOURCES,
} from "../../src/lib/time-sync.ts";
const epoch = Date.UTC(2026, 10, 17),
  a = { w0: epoch, w1: epoch + 100, p0: 0, p1: 100 };
const good = (source = SOURCES[0], nowMs = epoch + 1250, extra = {}) => ({
  source,
  ok: true,
  nowMs,
  sourceSampleMs: nowMs,
  upstreamRttMs: 0,
  sampleAgeMs: 0,
  timestampResolutionMs: 1,
  cached: false,
  ...extra,
});
const measured = (d, u = 1000, source = SOURCES[0]) => ({
  source,
  offsetMs: d,
  uncertaintyMs: u,
  upstreamRttMs: 0,
  sampleAgeMs: 0,
  cached: false,
  included: true,
  reason: null,
});
const response = () => ({
  version: 1,
  ok: true,
  status: "complete",
  responseAtRuntimeMs: epoch,
  sources: SOURCES.map((s) => good(s)),
  error: null,
});
function snapshot(i = 0, deviceAtMs = epoch) {
  const sources = [measured(i), measured(i, 1000, SOURCES[1])],
    agg = aggregateSamples(sources);
  return {
    id: `round-${i}`,
    deviceAtMs,
    networkAtMs: epoch + i,
    status: agg.status,
    offsetMs: agg.offsetMs,
    uncertaintyMs: agg.uncertaintyMs,
    browserRttMs: 100,
    runtimeAtMs: epoch,
    sources,
  };
}
test("offset-positive-means-device-behind", () =>
  assert.equal(estimateOffset(good(), a).offsetMs, 1200));
test("offset-negative-means-device-ahead", () =>
  assert.equal(
    estimateOffset(good(SOURCES[0], epoch - 750), a).offsetMs,
    -800,
  ));
test("median-even-odd-empty-and-immutable", () => {
  const v = [3, 1, 2];
  assert.equal(median(v), 2);
  assert.deepEqual(v, [3, 1, 2]);
  assert.equal(median([1, 3]), 2);
  assert.equal(median([]), null);
  for (const n of [NaN, Infinity, "1", null]) assert.throws(() => median([n]));
});
test("two-sources-use-equal-weight-median", () => {
  assert.equal(
    aggregateSamples([measured(100), measured(300, 1000, SOURCES[1])]).offsetMs,
    200,
  );
  assert.throws(() =>
    aggregateSamples([
      measured(100),
      measured(100),
      measured(300, 1000, SOURCES[1]),
    ]),
  );
});
test("runtime-clock-never-enters-consensus", () => {
  const s = [measured(100), measured(300, 1000, SOURCES[1])],
    before = aggregateSamples(s);
  assert.deepEqual(
    aggregateSamples([...s, { ...measured(1e12), source: "runtime" }]),
    before,
  );
});
test("uncertainty-does-not-shrink-on-aggregation", () => {
  const s = [measured(100, 1100), measured(300, 1600, SOURCES[1])],
    agg = aggregateSamples(s);
  assert.equal(agg.uncertaintyMs, 1700);
  for (const x of s) {
    assert.ok(agg.interval[0] <= x.offsetMs - x.uncertaintyMs);
    assert.ok(agg.interval[1] >= x.offsetMs + x.uncertaintyMs);
  }
});
test("conflicting-sources-have-no-recommendation", () => {
  const agg = aggregateSamples([measured(0), measured(3000, 1000, SOURCES[1])]);
  assert.equal(agg.status, "conflict");
  assert.equal(agg.offsetMs, null);
  assert.equal(agg.interval, null);
  assert.equal(
    aggregateSamples([measured(0), measured(2000, 1000, SOURCES[1])]).status,
    "consistent",
  );
});
test("rtt-zero-boundary-and-exclusion", () => {
  for (const r of [0, 2000, 2001, -1]) {
    const anchors = { ...a, w1: epoch + r, p1: r },
      v = estimateOffset(good(), anchors);
    assert.equal(v.included, r >= 0 && r <= 2000);
    if (r >= 0) assert.ok(v.uncertaintyMs >= 1000);
    else assert.equal(v.reason, "invalid-rtt");
  }
  for (const u of [2000, 2001])
    assert.equal(
      estimateOffset(good(SOURCES[0], epoch, { upstreamRttMs: u }), a).included,
      u === 2000,
    );
});
test("wall-clock-jump-rejects-round", () => {
  const v = estimateOffset(good(), { ...a, w1: epoch + 201 });
  assert.equal(v.reason, "clock-jump");
  assert.equal(aggregateSamples([v]).status, "unavailable");
  assert.equal(
    estimateOffset(good(), { ...a, w1: epoch + 200 }).included,
    true,
  );
});
test("response-validation-rejects-malformed-fields", () => {
  assert.ok(validateTimeResponse(response()).value);
  for (const value of [
    null,
    {},
    [],
    { ...response(), version: 2 },
    { ...response(), ok: false },
    { ...response(), status: "partial" },
    { ...response(), sources: [good(), good()] },
    { ...response(), sources: [good("runtime"), good(SOURCES[1])] },
    { ...response(), sources: [good(SOURCES[0], "123"), good(SOURCES[1])] },
    {
      ...response(),
      sources: [good(SOURCES[0], Date.UTC(2100, 0, 1)), good(SOURCES[1])],
    },
    {
      ...response(),
      sources: [
        good(SOURCES[0], epoch, { upstreamRttMs: -1 }),
        good(SOURCES[1]),
      ],
    },
  ])
    assert.equal(validateTimeResponse(value).value, null);
});
test("single-and-failed-sources-retain-diagnostics", () => {
  const bad = {
    source: SOURCES[1],
    ok: false,
    error: { code: "upstream-timeout", retryable: true },
  };
  const v = { ...response(), status: "partial", sources: [good(), bad] };
  assert.ok(validateTimeResponse(v).value);
  const agg = aggregateSamples(v.sources.map((s) => estimateOffset(s, a)));
  assert.equal(agg.status, "single");
  const forged = { ...v, sources: [good(), { ...bad, nowMs: epoch }] };
  assert.equal(validateTimeResponse(forged).value, null);
});
test("history-keeps-latest-ten-in-commit-order", () => {
  let h = [];
  for (let i = 0; i < 11; i++)
    h = appendHistory(h, snapshot(i, epoch - i * 10000));
  assert.equal(h.length, 10);
  assert.equal(h[0].id, "round-10");
  assert.equal(h[9].id, "round-1");
  assert.deepEqual(parseHistory(serializeHistory(h)).records, h);
});
test("history-corruption-version-and-size", () => {
  for (const value of [
    "{",
    JSON.stringify({ version: 2, records: [] }),
    " ".repeat(65537),
    JSON.stringify({
      version: 1,
      records: [{ ...snapshot(), status: "garbage" }],
    }),
    JSON.stringify({ version: 1, records: [{ ...snapshot(), sources: [] }] }),
    JSON.stringify({ version: 1, records: [{ ...snapshot(), offsetMs: 3 }] }),
    JSON.stringify({ version: 1, records: [snapshot(), snapshot()] }),
  ]) {
    assert.equal(parseHistory(value).error, true);
    assert.equal(parseHistory(value).blocked, true);
  }
  assert.equal(parseHistory(null).error, false);
});
test("format-delta-sign-zero-and-large-values", () => {
  assert.match(formatDelta(1200, "zh"), /慢 1.2 秒/);
  assert.match(formatDelta(-800, "zh"), /快 800 毫秒/);
  assert.equal(formatDelta(-0, "zh"), "偏差小于 1 毫秒");
  assert.match(formatDelta(0.1, "en"), /less than 1/);
  for (const lang of ["zh", "tw", "en", "ja", "ko"]) {
    assert.ok(formatDelta(36000000, lang));
    assert.ok(formatDelta(-60000, lang));
    assert.ok(formatDelta(-0, lang));
  }
  assert.match(formatDelta(1200, "en"), /behind/);
  assert.match(formatDelta(-800, "ja"), /進んで/);
  assert.match(formatDelta(-800, "ko"), /빠릅니다/);
  assert.throws(() => formatDelta(NaN, "zh"));
});
test("beijing-format-crosses-midnight-independently", () => {
  for (const tz of ["UTC", "Asia/Tokyo", "America/New_York"]) {
    process.env.TZ = tz;
    for (const fallback of [true, false]) {
      assert.equal(
        formatBeijing(Date.UTC(2024, 1, 28, 16), "en", fallback).time,
        "00:00:00",
      );
      assert.match(
        formatBeijing(Date.UTC(2024, 1, 28, 16), "en", fallback).date,
        /29/,
      );
      assert.equal(
        formatBeijing(Date.UTC(2024, 1, 29, 16), "en", fallback).time,
        "00:00:00",
      );
    }
  }
});
test("expired-history-does-not-restore-live-reference", () => {
  const h = parseHistory(serializeHistory([snapshot()]));
  assert.equal(h.records.length, 1);
  assert.equal("anchor" in h.records[0], false);
  assert.equal(
    liveReference({ networkMs: epoch, monoMs: 100 }, 1100),
    epoch + 1000,
  );
  assert.equal(liveReference({ networkMs: epoch, monoMs: 100 }, 60100), null);
  assert.equal(liveReference({ networkMs: epoch, monoMs: 100 }, 99), null);
});
test("history-normalization-removes-live-anchors-and-foreign-fields", () => {
  const raw = {
    ...snapshot(),
    anchor: { networkMs: epoch, monoMs: 0 },
    translated: "discard",
  };
  raw.sources[0].rawTrace = "discard";
  const value = parseHistory(JSON.stringify({ version: 1, records: [raw] }));
  assert.equal(value.error, false);
  assert.equal("anchor" in value.records[0], false);
  assert.equal("rawTrace" in value.records[0].sources[0], false);
  assert.doesNotMatch(serializeHistory([raw]), /discard|anchor/);
});
test("direct-estimation-rejects-invalid-upstream-values", () => {
  for (const extra of [
    { upstreamRttMs: -1 },
    { upstreamRttMs: NaN },
    { sampleAgeMs: 15000 },
    { timestampResolutionMs: 0 },
  ]) {
    const s = estimateOffset(good(SOURCES[0], epoch, extra), a);
    assert.equal(s.included, false);
    assert.equal(s.reason, "upstream-invalid");
  }
});
test("beijing-fixed-offset-also-applies-to-historical-device-dates", () => {
  assert.equal(formatBeijing(Date.UTC(1991, 5, 1, 0), "en").time, "08:00:00");
  assert.equal(formatBeijing(Date.UTC(1890, 5, 1, 0), "en").time, "08:00:00");
});
