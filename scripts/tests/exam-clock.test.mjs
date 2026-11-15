import test from "node:test";
import assert from "node:assert/strict";
import {
  formatClock,
  computeOffset,
  phaseFor,
  progressFor,
  validateExam,
  formatRemaining,
  anchoredNow,
  detectJump,
  advanceExam,
  defaults,
  serializeStorage,
  deserializeStorage,
  parseBeijing,
  validateTimeResponse,
} from "../../src/lib/exam-clock.ts";
const start = Date.UTC(2026, 10, 15, 1),
  end = start + 7200000;
const input = {
  name: "期末考试",
  start: "2026-11-15T09:00:00",
  end: "2026-11-15T11:00:00",
};
const exam = validateExam(input).value;
const phase = (nowMs, thresholds = [30, 15, 5, 1]) =>
  phaseFor({ nowMs, startMs: start, endMs: end, thresholds });
test("formatClock formats 24-hour midnight without hour 24", () => {
  assert.equal(
    formatClock(Date.UTC(2026, 10, 14, 16), { timeZone: "Asia/Shanghai" }).time,
    "00:00:00",
  );
});
test("formatClock supports 12-hour periods and hidden seconds", () => {
  for (const [hour, period] of [
    [0, "AM"],
    [12, "PM"],
    [15, "PM"],
  ]) {
    const c = formatClock(Date.UTC(2026, 10, 15, hour), {
      timeZone: "UTC",
      locale: "en",
      hour12: true,
      showSeconds: false,
    });
    assert.equal(c.period, period);
    assert.equal(c.second, "");
    assert.equal(c.time.split(":").length, 2);
  }
});
test("formatClock uses the requested timezone", () => {
  const t = Date.UTC(2026, 10, 14, 20);
  assert.equal(formatClock(t, { timeZone: "UTC" }).hour, "20");
  const b = formatClock(t, { timeZone: "Asia/Shanghai" });
  assert.equal(b.hour, "04");
  assert.match(b.date, /15/);
  assert.throws(() => formatClock(t, { timeZone: "bad" }), /invalid-timezone/);
  assert.throws(() => formatClock(NaN, { timeZone: "UTC" }));
});
test("computeOffset estimates midpoint offset", () => {
  assert.deepEqual(
    computeOffset({ sentAt: 1000, receivedAt: 1200, serverNowMs: 1600 }),
    { rttMs: 200, offsetMs: 500, uncertaintyMs: 100, referenceMs: 1700 },
  );
});
test("computeOffset rejects reversed and poor samples", () => {
  for (const receivedAt of [999, NaN, Infinity, 3001])
    assert.throws(() =>
      computeOffset({ sentAt: 1000, receivedAt, serverNowMs: 1600 }),
    );
  assert.equal(
    computeOffset({ sentAt: 1000, receivedAt: 3000, serverNowMs: 1600 }).rttMs,
    2000,
  );
});
test("phaseFor handles every threshold boundary", () => {
  assert.equal(phase(start - 1).status, "waiting");
  assert.equal(phase(start).status, "running");
  for (const m of [30, 15, 5, 1]) {
    assert.notEqual(phase(end - m * 60000 - 1).node, String(m));
    assert.equal(phase(end - m * 60000).node, String(m));
    assert.equal(phase(end - m * 60000).phase, m <= 5 ? "critical" : "warning");
  }
  assert.equal(phase(end).phase, "finished");
});
test("phaseFor excludes disabled and oversized thresholds", () => {
  assert.equal(phase(end - 60000, []).node, null);
  assert.equal(
    phaseFor({
      nowMs: end - 60000,
      startMs: end - 60000,
      endMs: end,
      thresholds: [30, 15, 5, 1],
    }).node,
    null,
  );
});
test("progressFor clamps before and after the exam", () => {
  assert.equal(progressFor(start - 1, start, end), 0);
  assert.equal(progressFor((start + end) / 2, start, end), 0.5);
  assert.equal(progressFor(end + 1, start, end), 1);
  assert.throws(() => progressFor(start, end, start), /invalid-interval/);
});
test("validateExam rejects invalid names and times", () => {
  const codes = (v) =>
    validateExam({ ...input, ...v }).errors.map((e) => e.code);
  assert.ok(codes({ name: "  " }).includes("missing-name"));
  assert.ok(codes({ name: "A".repeat(81) }).includes("name-too-long"));
  assert.ok(codes({ name: "a\u0001" }).includes("invalid-name"));
  for (const start of [
    "",
    "2026-02-30T09:00:00",
    "1999-01-01T00:00:00",
    "2026-11-15T24:00:00",
  ])
    assert.ok(codes({ start }).includes("invalid-time"));
  for (const end of [input.start, "2026-11-15T08:00:00"])
    assert.ok(codes({ end }).includes("end-before-start"));
});
test("validateExam rejects midnight crossing and inconsistent duration", () => {
  for (const v of [
    { end: "2026-11-16T09:00:01" },
    { durationSeconds: 0 },
    { durationSeconds: 1.5 },
    { durationSeconds: 86400 },
    { durationSeconds: 3600 },
  ]) {
    assert.equal(validateExam({ ...input, ...v }).ok, false);
  }
  assert.ok(
    validateExam({ ...input, end: "2026-11-16T09:00:01" }).errors.some(
      (e) => e.code === "cross-midnight",
    ),
  );
});
test("Beijing exam parsing ignores host timezone", () => {
  const old = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/New_York"]) {
      process.env.TZ = tz;
      assert.equal(validateExam(input).value.startMs, start);
      assert.equal(parseBeijing("2026-02-29T10:00:00"), null);
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("formatRemaining rounds without ending early", () => {
  for (const [ms, expected] of [
    [0, "00:00:00"],
    [1, "00:00:01"],
    [59999, "00:01:00"],
    [60000, "00:01:00"],
    [3900000, "01:05:00"],
    [-1, "00:00:00"],
  ])
    assert.equal(formatRemaining(ms), expected);
  assert.equal(formatRemaining(1, { style: "human" }), "不足 1 分钟");
  assert.equal(formatRemaining(3900000, { style: "human" }), "1 小时 05 分");
  assert.equal(formatRemaining(0, { style: "human" }), "0 秒");
});
test("clock anchor tolerates missed callbacks and detects jumps", () => {
  assert.equal(
    anchoredNow({ referenceMs: start, monoMs: 100 }, 60100),
    start + 60000,
  );
  assert.equal(
    detectJump({ deviceMs: 0, monoMs: 0 }, { deviceMs: 5000, monoMs: 1000 }),
    4000,
  );
  assert.equal(
    detectJump({ deviceMs: 0, monoMs: 0 }, { deviceMs: 1000, monoMs: 1000 }),
    0,
  );
});
test("reminders are consumed once across jumps and mute", () => {
  let a = { exam, thresholds: [30, 15, 5, 1], processed: [], finished: false };
  let r = advanceExam(a, end - 300000, false);
  assert.equal(r.alert, "5");
  assert.deepEqual(r.active.processed, ["30", "15", "5"]);
  a = r.active;
  r = advanceExam(a, end - 60000, true);
  assert.equal(r.alert, null);
  a = r.active;
  for (const time of [end - 120000, end - 60000, end - 1]) {
    r = advanceExam(a, time, false);
    assert.equal(r.alert, null);
    a = r.active;
  }
  r = advanceExam(a, end, true);
  assert.equal(r.alert, null);
  assert.equal(advanceExam(r.active, end + 100, false).alert, null);
});
test("storage roundtrip validates its schema", () => {
  const s = defaults();
  s.draft = { ...s.draft, ...input };
  s.presets = [{ id: 1, exam, thresholds: [5] }];
  s.nextId = 2;
  s.settings.sound = true;
  s.settings.theme = "dark";
  s.history = {
    source: "cloudflare-trace",
    at: start,
    offsetMs: 50,
    rttMs: 100,
    uncertaintyMs: 1100,
  };
  s.active = { exam, thresholds: [5], processed: [], finished: false };
  assert.deepEqual(deserializeStorage(serializeStorage(s)), s);
  for (const text of [
    "bad",
    JSON.stringify({ ...s, version: 2 }),
    JSON.stringify({ ...s, nextId: "2" }),
    JSON.stringify({ ...s, presets: Array(11).fill(s.presets[0]) }),
    JSON.stringify({ ...s, settings: { ...s.settings, sound: "yes" } }),
    JSON.stringify({ ...s, history: { ...s.history, rttMs: -1 } }),
    JSON.stringify({ ...s, active: { ...s.active, finished: true } }),
    JSON.stringify({ ...s, active: { ...s.active, thresholds: [2] } }),
    " ".repeat(65537),
  ])
    assert.throws(() => deserializeStorage(text));
});
test("finished state remains terminal until reset", () => {
  const a = advanceExam(
    { exam, thresholds: [1], processed: [], finished: false },
    end,
    false,
  ).active;
  assert.equal(advanceExam(a, start, false).phase, "finished");
  assert.equal(
    advanceExam({ ...a, finished: false, processed: [] }, start, true).status,
    "running",
  );
});
test("time response validation rejects fake and incoherent sources", () => {
  const v = {
    ok: true,
    source: "cloudflare-trace",
    sourceUrl: "https://www.cloudflare.com/cdn-cgi/trace",
    serverNowMs: start + 100,
    sourceSampleMs: start,
    sampleAgeMs: 0,
    upstreamRttMs: 200,
    uncertaintyMs: 1100,
    cached: false,
  };
  assert.equal(validateTimeResponse(v).serverNowMs, start + 100);
  for (const invalid of [
    { ...v, source: "local" },
    { ...v, uncertaintyMs: 0 },
    { ...v, serverNowMs: start + 10000 },
    { ...v, sampleAgeMs: 15000 },
  ])
    assert.throws(() => validateTimeResponse(invalid));
});

test("extreme finite inputs never produce non-finite clock arithmetic", () => {
  assert.equal(progressFor(0, -1e308, 1e308), 0.5);
  assert.equal(progressFor(1e308, -1e308, 1e308), 1);
  assert.equal(
    computeOffset({ sentAt: 1e308, receivedAt: 1e308, serverNowMs: 1e308 })
      .offsetMs,
    0,
  );
  assert.throws(
    () =>
      computeOffset({ sentAt: -1e308, receivedAt: -1e308, serverNowMs: 1e308 }),
    /invalid-sample/,
  );
  assert.throws(
    () => anchoredNow({ referenceMs: 1e308, monoMs: 0 }, 1e308),
    /invalid-anchor/,
  );
  assert.throws(
    () => detectJump({ deviceMs: 0, monoMs: 0 }, { deviceMs: NaN, monoMs: 0 }),
    /invalid-anchor/,
  );
});
