import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaults,
  validateDuration,
  validateTask,
  transition,
  advance,
  aggregate,
  splitByDate,
  dateKey,
  weekDates,
  restore,
  serialize,
  commitRecord,
  acceptRevision,
  TASK_LIMIT,
  RECORD_LIMIT,
} from "../../src/lib/focus-timer.ts";
import { focusText } from "../../src/lib/focus-timer-i18n.ts";
const minute = 60000;
const wall = Date.UTC(2026, 10, 16, 10);
let sequence = 0;
const sample = (mono = 0, time = wall, timeZone = "UTC") => ({
  mono,
  wall: time,
  timeZone,
  id: `phase-${++sequence}`,
  sessionId: `session-${sequence}`,
});
const start = (s = defaults(), now = sample()) =>
  transition(s, "start", now).state;
const tick = (s, mono, time = wall + mono) =>
  transition(s, "tick", sample(mono, time)).state;
function complete(s = defaults()) {
  return tick(start(s), s.settings.focus * minute);
}
function early(ms = 10 * minute) {
  return transition(start(), "early", sample(ms, wall + ms)).state;
}

test("duration-validation", () => {
  for (const n of ["1", "25", "180"])
    assert.equal(validateDuration(n, "focus").value, Number(n));
  for (const n of [
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "181",
    "abc",
    "Infinity",
    "NaN",
    "1e2",
    "9".repeat(400),
  ])
    assert.equal(validateDuration(n, "focus").ok, false, n);
  for (const [field, min, max] of [
    ["short", 1, 30],
    ["long", 1, 60],
    ["interval", 2, 8],
  ]) {
    for (const n of [min, max])
      assert.equal(validateDuration(String(n), field).ok, true);
    for (const n of [min - 1, max + 1])
      assert.equal(validateDuration(String(n), field).ok, false);
  }
});
test("task-name-validation", () => {
  assert.equal(validateTask("  Cafe\u0301  ").value, "Café");
  assert.equal(validateTask("😀".repeat(80)).ok, true);
  assert.equal(validateTask("😀".repeat(81)).error, "taskLong");
  for (const value of ["a\nb", "\na", "b\r", "x\u0000", "x\u0085", "a\u2028b"])
    assert.equal(validateTask(value).error, "taskControl");
  assert.equal(validateTask("  ").error, "taskEmpty");
  assert.equal(
    validateTask("<script>alert(1)</script>").value,
    "<script>alert(1)</script>",
  );
});
test("pause-resume-excludes-paused-time", () => {
  let s = start();
  s = transition(s, "pause", sample(10 * minute)).state;
  assert.equal(s.stage.remainingMs, 15 * minute);
  assert.equal(s.stage.focusMs, 10 * minute);
  s = tick(s, 15 * minute);
  assert.equal(s.stage.remainingMs, 15 * minute);
  s = transition(s, "start", sample(15 * minute, wall + 15 * minute)).state;
  s = tick(s, 30 * minute);
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].actualMs, 25 * minute);
  assert.equal(
    s.records[0].allocations.reduce((n, a) => n + a.ms, 0),
    25 * minute,
  );
  assert.equal(tick(s, 60 * minute).records.length, 1);
  let resumed = transition(
    start(),
    "pause",
    sample(10 * minute, wall + 10 * minute),
  ).state;
  resumed = transition(
    resumed,
    "start",
    sample(20 * minute, wall + 20 * minute),
  ).state;
  resumed = transition(
    resumed,
    "early",
    sample(21 * minute, wall + 21 * minute),
  ).state;
  assert.equal(resumed.records[0].actualMs, 11 * minute);
  assert.equal(resumed.records[0].endedAt, wall + 21 * minute);
});
test("monotonic-clock-ignores-wall-jump", () => {
  const s = start();
  for (const jump of [-3600000, 0, 3600000]) {
    const next = tick(s, 10 * minute, wall + 10 * minute + jump);
    assert.equal(next.stage.remainingMs, 15 * minute);
    assert.equal(next.stage.lastAt, wall + 10 * minute);
    assert.deepEqual(next.stage.allocations, [
      { date: "2026-11-16", ms: 10 * minute, timeZone: "UTC" },
    ]);
  }
});
test("natural-completion-and-long-break", () => {
  let s = defaults();
  for (let n = 1; n <= 4; n++) {
    s = complete(s);
    assert.equal(s.cycle, n);
    assert.equal(s.nextPhase, n === 4 ? "long" : "short");
    if (n < 4) {
      s = start(s);
      s = tick(s, s.settings.short * minute);
      assert.equal(s.nextPhase, "focus");
    }
  }
  const long = start(s);
  assert.equal(long.stage.phase, "long");
  assert.equal(tick(long, 15 * minute).cycle, 0);
  assert.equal(transition(long, "skip", sample()).state.cycle, 0);
  assert.equal(transition(s, "skip", sample()).state.cycle, 0);
  assert.equal(early().cycle, 0);
});
test("early-end-skip-reset", () => {
  const s = early();
  assert.equal(s.records[0].actualMs, 10 * minute);
  assert.equal(s.cycle, 0);
  assert.equal(s.nextPhase, "focus");
  const a = aggregate(s.records, ["2026-11-16"]);
  assert.equal(a.totalMs, 10 * minute);
  assert.equal(a.completed, 0);
  assert.equal(
    transition(start(), "skip", sample(600000)).state.records.length,
    0,
  );
  assert.equal(
    transition(start(), "reset", sample(600000)).state.records.length,
    0,
  );
  assert.equal(
    transition(start(s), "reset", sample(600000)).state.records.length,
    1,
  );
  let paused = transition(
    start(),
    "pause",
    sample(600000, wall + 600000),
  ).state;
  paused = transition(paused, "early", sample(900000, wall + 900000)).state;
  assert.equal(paused.records[0].endedAt, wall + 600000);
});
test("completion-is-idempotent", () => {
  let s = start();
  const id = s.stage.sessionId;
  s = tick(s, 25 * minute);
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].sessionId, id);
  assert.equal(tick(s, 26 * minute).records.length, 1);
  assert.equal(
    transition(s, "pause", sample(26 * minute)).state.status,
    "finished",
  );
  assert.equal(commitRecord(s.records, s.records[0]).length, 1);
  const collision = transition(start(), "pause", sample(25 * minute));
  assert.equal(collision.state.status, "finished");
  assert.equal(collision.effects.length, 1);
  const reset = transition(start(), "reset", sample(25 * minute));
  assert.equal(reset.state.records.length, 1);
  assert.equal(reset.state.status, "finished");
});
test("delayed-tick-does-not-replay-rounds", () => {
  const s = tick(start(), 24 * 60 * minute);
  assert.equal(s.records.length, 1);
  assert.equal(s.cycle, 1);
  assert.equal(s.stage.remainingMs, 0);
  assert.equal(s.status, "finished");
  assert.equal(s.records[0].endedAt, wall + 25 * minute);
});
test("restore-paused-checkpoint", () => {
  const running = tick(start(), 10 * minute),
    text = serialize(running);
  assert.equal(JSON.parse(text).stage.anchor, null);
  const restored = restore(text);
  assert.equal(restored.ok, true);
  assert.equal(restored.value.status, "paused");
  assert.equal(restored.value.stage.remainingMs, 15 * minute);
  assert.equal(tick(restored.value, 86400000).stage.focusMs, 10 * minute);
  assert.equal(restore(serialize(restored.value)).value.status, "paused");
  const resumed = transition(
    restored.value,
    "start",
    sample(100, wall + 86400000),
  ).state;
  assert.equal(
    tick(resumed, 100 + 15 * minute, wall + 86400000 + 15 * minute).records[0]
      .actualMs,
    25 * minute,
  );
});
test("daily-and-task-aggregation", () => {
  const task = {
    id: "task",
    name: "Write <b>plain</b>",
    createdAt: wall,
    completedAt: null,
  };
  let s = defaults();
  s.tasks = [task];
  s.selectedTaskId = "task";
  s = complete(s);
  s = transition(s, "skip", sample()).state;
  s = transition(
    start(s),
    "early",
    sample(10 * minute, wall + 10 * minute),
  ).state;
  const a = aggregate(s.records, ["2026-11-16"], []);
  assert.equal(a.totalMs, 35 * minute);
  assert.equal(a.completed, 1);
  assert.equal(a.tasks[0].deleted, true);
  assert.equal(a.tasks[0].name, task.name);
  assert.equal(s.records[0].taskName, task.name);
  assert.equal(a.days[0].ms, 35 * minute);
});
test("midnight-split", () => {
  const startAt = Date.UTC(2026, 10, 16, 23, 50);
  const s = tick(
    start(defaults(), sample(0, startAt)),
    25 * minute,
    startAt + 25 * minute,
  );
  assert.deepEqual(
    s.records[0].allocations.map((x) => x.ms),
    [10 * minute, 15 * minute],
  );
  assert.equal(s.records[0].endDate, "2026-11-17");
  const a = aggregate(s.records, ["2026-11-16", "2026-11-17"]);
  assert.deepEqual(
    a.days.map((x) => x.completed),
    [0, 1],
  );
  assert.equal(a.totalMs, 25 * minute);
});
test("week-year-and-dst-boundaries", () => {
  assert.deepEqual(weekDates("2027-01-01"), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
  assert.equal(weekDates("2026-11-22")[0], "2026-11-16");
  assert.equal(weekDates("2026-11-23")[0], "2026-11-23");
  for (const [at, hours, date] of [
    ["2026-03-08T05:00:00Z", 23, "2026-03-08"],
    ["2026-11-01T04:00:00Z", 25, "2026-11-01"],
  ]) {
    const rows = splitByDate(
      Date.parse(at),
      (hours + 1) * 3600000,
      "America/New_York",
    );
    assert.equal(rows[0].date, date);
    assert.equal(rows[0].ms, hours * 3600000);
    assert.equal(rows[1].ms, 3600000);
  }
  const days = weekDates("2026-11-17");
  assert.equal(new Set(days).size, 7);
  const a = aggregate(complete().records, days);
  assert.equal(
    a.days.reduce((n, d) => n + d.ms, 0),
    a.totalMs,
  );
  assert.equal(dateKey(Date.UTC(2026, 10, 16, 23), "Asia/Tokyo"), "2026-11-17");
});
test("storage-schema-validation", () => {
  const good = JSON.parse(serialize(tick(start(), 60000)));
  for (const value of [
    "bad",
    "null",
    JSON.stringify({ ...good, schemaVersion: 2 }),
    JSON.stringify({ ...good, stage: { ...good.stage, remainingMs: -1 } }),
    JSON.stringify({ ...good, status: "unknown" }),
    JSON.stringify({
      ...good,
      tasks: [
        { id: "x", name: "one", createdAt: wall, completedAt: null },
        { id: "x", name: "two", createdAt: wall, completedAt: null },
      ],
    }),
    JSON.stringify({ ...good, selectedTaskId: "missing" }),
    JSON.stringify({ ...good, stage: { ...good.stage, focusMs: 0 } }),
  ]) {
    const result = restore(value);
    assert.equal(result.ok, false, value);
    assert.equal("value" in result, false);
  }
  assert.equal(
    restore(JSON.stringify({ ...good, schemaVersion: 2 })).error,
    "version",
  );
  const missingRequired = structuredClone(good);
  delete missingRequired.settings.focus;
  assert.equal(restore(JSON.stringify(missingRequired)).ok, false);
  delete good.settings.volume;
  delete good.settings.sound;
  assert.equal(restore(JSON.stringify(good)).value.settings.volume, 30);
  const s = complete();
  s.records.push({ ...s.records[0] });
  assert.equal(restore(serialize(s)).ok, false);
});
test("revision-and-capacity", () => {
  assert.equal(acceptRevision(5, 4), false);
  assert.equal(acceptRevision(5, 5), false);
  assert.equal(acceptRevision(5, 6), true);
  const s = defaults();
  s.tasks = Array.from({ length: TASK_LIMIT }, (_, i) => ({
    id: `task-${i}`,
    name: "Task",
    createdAt: wall,
    completedAt: null,
  }));
  assert.equal(restore(serialize(s)).ok, true);
  s.tasks.push({ ...s.tasks[0], id: "extra" });
  assert.equal(restore(serialize(s)).ok, false);
  const record = complete().records[0],
    history = defaults();
  history.records = Array.from({ length: RECORD_LIMIT - 1 }, (_, i) => ({
    ...record,
    sessionId: `record-${i}`,
  }));
  const last = complete(history);
  assert.equal(last.records.length, RECORD_LIMIT);
  assert.equal(start({ ...last, status: "idle", stage: null }).status, "idle");
  assert.equal(restore(serialize(last)).ok, true);
  assert.throws(
    () => commitRecord(last.records, { ...record, sessionId: "overflow" }),
    /record-capacity/,
  );
  const extra = {
    ...last,
    records: [...last.records, { ...record, sessionId: "extra" }],
  };
  assert.equal(restore(serialize(extra)).ok, false);
});
test("invalid-time-samples-and-zero-record", () => {
  for (const invalid of [
    { ...sample(), mono: NaN },
    { ...sample(), mono: Infinity },
    { ...sample(), wall: Infinity },
    { ...sample(), wall: 1e308 },
  ])
    assert.throws(
      () => transition(defaults(), "start", invalid),
      /invalid-sample/,
    );
  const zero = transition(start(), "early", sample()).state;
  assert.equal(zero.records.length, 1);
  assert.equal(zero.records[0].actualMs, 0);
  assert.equal(aggregate(zero.records, ["2026-11-16"]).records.length, 1);
});

test("locale-coverage", () => {
  const keys = Object.keys(focusText("zh")).sort();
  for (const lang of ["zh", "tw", "en", "ja", "ko"]) {
    const t = focusText(lang);
    assert.deepEqual(Object.keys(t).sort(), keys);
    assert.ok(Object.values(t).every((x) => typeof x === "string" && x.trim()));
  }
  assert.match(focusText("tw").wake, /螢幕/);
  assert.match(focusText("tw").dateRule, /本週/);
  for (const lang of ["en", "ja", "ko"]) {
    const x = JSON.parse(
      readFileSync(
        new URL(`../../src/lib/i18n/${lang}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.ok(x.tools["focus-timer"].keywords.length >= 4);
    const d = x.content["focus-timer"].detail;
    assert.ok(d.steps.length >= 3);
    assert.ok(d.examples.length >= 2);
    assert.ok(d.faqs.length >= 2);
    assert.ok(d.principles.length >= 2);
    assert.ok(d.pitfalls.length >= 2);
    assert.ok(d.privacy.length > 40);
    if (lang !== "ja") {
      assert.doesNotMatch(JSON.stringify(d), /[\u3400-\u9fff]/);
      assert.doesNotMatch(JSON.stringify(focusText(lang)), /[\u3400-\u9fff]/);
    }
  }
});

test("integration-contract", () => {
  const read = (file) =>
    readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const source = read("src/lib/tool-seo/daily.ts")
    .split("'focus-timer': {")[1]
    .split("  },")[0];
  const title = source.match(/title: '([^']+)'/)[1],
    description = source.match(/description: '([^']+)'/)[1];
  assert.ok([...title].length >= 50 && [...title].length <= 60);
  assert.match(title, / - CloverTools$/);
  assert.ok([...description].length >= 150 && [...description].length <= 160);
  const manifest = JSON.parse(read("data/i18n-tool-pages.json"));
  assert.deepEqual(
    new Set(manifest.tools["focus-timer"].langs),
    new Set(["zh", "tw", "en", "ja", "ko"]),
  );
  for (const prefix of ["", "zh-hant/", "en/", "ja/", "ko/"]) {
    const route = read(`src/pages/${prefix}tools/daily/focus-timer.astro`);
    assert.match(route, /@shared-tool-ui/);
    assert.match(route, /workspace="dashboard"/);
    assert.match(route, /layout="wide"/);
    assert.match(route, /<FocusTimer lang=/);
    assert.ok(
      JSON.parse(read(`public/${prefix}search-index.json`)).some(
        (x) => x.slug === "focus-timer",
      ),
    );
  }
  const core = read("src/lib/focus-timer.ts");
  assert.doesNotMatch(
    core,
    /Date\.now\(|performance\.now\(|Math\.random\(|localStorage[.[]|document\./,
  );
  const corrupt = JSON.parse(serialize(tick(start(), 60000)));
  corrupt.unrelated = "ignored";
  corrupt.settings.account = "ignored";
  corrupt.stage.identity = "ignored";
  const clean = restore(JSON.stringify(corrupt));
  assert.equal(clean.ok, true);
  assert.equal("unrelated" in clean.value, false);
  assert.equal("account" in clean.value.settings, false);
  assert.equal("identity" in clean.value.stage, false);
});
