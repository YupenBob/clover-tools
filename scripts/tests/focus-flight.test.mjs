import test from "node:test";
import assert from "node:assert/strict";
import {
  createFlight,
  advanceFlight,
  pauseFlight,
  resumeFlight,
  parseFlight,
  parseFlightHistory,
  flightRecord,
  addFlightRecord,
  routeGeometry,
  mapPoint,
  FLIGHT_ROUTES,
  HISTORY_LIMIT,
} from "../../src/lib/focus-flight.ts";
import { flightText } from "../../src/lib/focus-flight-i18n.ts";
import {
  greatCircle,
  flightDistance,
  flightPhase,
  tearProgress,
} from "../../src/lib/flight-experience.ts";
import { journeyText } from "../../src/lib/flight-journey-i18n.ts";

const now = Date.UTC(2026, 9, 5, 3);
const flight = (minutes = 25) =>
  createFlight(
    "test-flight",
    FLIGHT_ROUTES[0].id,
    "Read one chapter",
    minutes,
    now,
  );

test("flight durations validate whole minutes, valid routes and bounded task text", () => {
  for (const minutes of [0, -1, 181, NaN, Infinity, 2.5])
    assert.throws(() => flight(minutes), RangeError);
  assert.equal(flight(1).durationMs, 60_000);
  assert.equal(flight(180).durationMs, 10_800_000);
  assert.throws(() => createFlight("id", "unknown", "", 25, now), RangeError);
  assert.throws(
    () => createFlight("id", FLIGHT_ROUTES[0].id, "a".repeat(81), 25, now),
    RangeError,
  );
  assert.equal(
    createFlight("id", FLIGHT_ROUTES[0].id, "  read  ", 25, now).task,
    "read",
  );
});
test("missed background callbacks land at the deadline, rather than at the delayed callback", () => {
  const value = flight();
  assert.equal(
    advanceFlight(value, now + 10 * 60_000).remainingMs,
    15 * 60_000,
  );
  const arrived = advanceFlight(value, now + 3 * 60 * 60_000);
  assert.equal(arrived.state, "landed");
  assert.equal(arrived.completedAt, now + 25 * 60_000);
  assert.equal(arrived.remainingMs, 0);
  assert.equal(arrived.deadline, null);
  assert.deepEqual(advanceFlight(arrived, now + 4 * 60 * 60_000), arrived);
});
test("pausing excludes break time and resuming preserves the remaining flight duration", () => {
  const paused = pauseFlight(flight(), now + 10 * 60_000);
  assert.equal(paused.state, "paused");
  assert.equal(paused.remainingMs, 15 * 60_000);
  assert.equal(
    advanceFlight(paused, now + 100 * 60_000).remainingMs,
    15 * 60_000,
  );
  const resumed = resumeFlight(paused, now + 15 * 60_000);
  assert.equal(resumed.deadline, now + 30 * 60_000);
  assert.equal(
    advanceFlight(resumed, now + 20 * 60_000).remainingMs,
    10 * 60_000,
  );
  assert.equal(advanceFlight(resumed, now + 30 * 60_000).state, "landed");
});
test("pause on or after the deadline cannot turn a landed flight into a paused one", () => {
  const value = flight(1);
  assert.equal(pauseFlight(value, now + 60_000).state, "landed");
  assert.equal(pauseFlight(value, now + 80_000).completedAt, now + 60_000);
  assert.equal(
    resumeFlight(advanceFlight(value, now + 60_000), now + 80_000).state,
    "landed",
  );
});
test("reload restores running and paused flights, including multiple pauses", () => {
  const value = flight();
  assert.equal(
    parseFlight(JSON.stringify(value), now + 5 * 60_000).remainingMs,
    20 * 60_000,
  );
  let paused = pauseFlight(value, now + 5 * 60_000);
  assert.equal(
    parseFlight(JSON.stringify(paused), now + 50 * 60_000).remainingMs,
    20 * 60_000,
  );
  const resumed = resumeFlight(paused, now + 50 * 60_000);
  paused = pauseFlight(resumed, now + 55 * 60_000);
  const resumedAgain = resumeFlight(paused, now + 60 * 60_000);
  assert.equal(
    parseFlight(JSON.stringify(resumedAgain), now + 62 * 60_000).remainingMs,
    13 * 60_000,
  );
  const landed = parseFlight(JSON.stringify(value), now + 90 * 60_000);
  assert.equal(landed.completedAt, now + 25 * 60_000);
  assert.deepEqual(
    parseFlight(JSON.stringify(landed), now + 100 * 60_000),
    landed,
  );
});
test("untrusted local storage rejects malformed and inconsistent session payloads", () => {
  for (const raw of [null, "null", "[]", "{bad}", "x".repeat(5000)])
    assert.equal(parseFlight(raw, now), null);
  const bad = [
    { version: 2 },
    { id: "<script>" },
    { routeId: "foreign" },
    { durationMs: Infinity },
    { startedAt: -1 },
    { remainingMs: -1 },
    { remainingMs: 1.5 },
    { remainingMs: 30 * 60_000 },
    { state: "ready" },
    { deadline: now - 1 },
    { deadline: now + 26 * 60_000 },
    { completedAt: now },
    { state: "paused", deadline: now + 60_000 },
    { state: "paused", deadline: null, remainingMs: 0 },
    { state: "landed", remainingMs: 0, deadline: null, completedAt: now + 1 },
  ];
  for (const patch of bad)
    assert.equal(
      parseFlight(JSON.stringify({ ...flight(), ...patch }), now),
      null,
      JSON.stringify(patch),
    );
});
test("moving the system clock backwards cannot increase remaining time beyond the configured duration", () => {
  assert.equal(advanceFlight(flight(), now - 60_000).remainingMs, 25 * 60_000);
});
test("only completed flights produce records and repeated arrivals are deduplicated", () => {
  const value = flight();
  assert.equal(flightRecord(value), null);
  assert.equal(flightRecord(pauseFlight(value, now + 60_000)), null);
  const record = flightRecord(advanceFlight(value, now + 25 * 60_000));
  assert.equal(record.durationMs, 25 * 60_000);
  assert.equal(record.task, "Read one chapter");
  assert.equal(addFlightRecord(addFlightRecord([], record), record).length, 1);
  assert.equal("deadline" in record, false);
});
test("history retains the latest 20 valid, unique records and strips unknown fields", () => {
  const records = Array.from({ length: 30 }, (_, i) => ({
    ...flightRecord(advanceFlight(flight(1), now + 60_000)),
    id: `flight-${i}`,
    completedAt: now + 60_000 + i * 60_000,
    unexpected: "ignored",
  }));
  const parsed = parseFlightHistory(
    JSON.stringify([
      ...records,
      { ...records[0] },
      null,
      { ...records[1], id: "bad", routeId: "bad" },
    ]),
  );
  assert.equal(parsed.length, HISTORY_LIMIT);
  assert.equal(parsed[0].id, "flight-29");
  assert.equal(parsed.at(-1).id, "flight-10");
  assert.ok(parsed.every((record) => !("unexpected" in record)));
  for (const raw of ["{}", "null", "{bad}", null])
    assert.deepEqual(parseFlightHistory(raw), []);
});
test("geographic routes put the plane at the exact endpoints and remain finite throughout", () => {
  for (const route of FLIGHT_ROUTES) {
    const start = routeGeometry(route.id, 0),
      end = routeGeometry(route.id, 1);
    assert.deepEqual([start.x, start.y], start.from);
    assert.deepEqual([end.x, end.y], end.to);
    for (const progress of [-1, 0.2, 0.5, 0.8, 2, NaN]) {
      const p = routeGeometry(route.id, progress);
      assert.ok([p.x, p.y, p.angle].every(Number.isFinite));
      assert.ok(p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 871);
    }
  }
  assert.throws(() => routeGeometry("unknown"), RangeError);
});
test("Mercator uses a uniform scale and agrees with the offline geography bounds", () => {
  assert.deepEqual(mapPoint([85, 55]), [0, 0]);
  assert.ok(Math.abs(mapPoint([155, -10])[1] - 870.673464532396) < 1e-9);
  assert.ok(Math.abs(mapPoint([155, 55])[0] - 800) < 1e-9);
  const [x, y] = mapPoint([100, 0]),
    [x2, y2] = mapPoint([100.001, 0.001]);
  assert.ok(Math.abs((x2 - x) / (y - y2) - 1) < 1e-7);
});
test("great-circle routes cross the date line on the short path", () => {
  const p = greatCircle([179, 0], [-179, 0], 0.5);
  assert.ok(Math.abs(Math.abs(p[0]) - 180) < 1e-9);
  assert.equal(p[1], 0);
  assert.ok(Math.abs(flightDistance([179, 0], [-179, 0]) - 222.38985) < 0.01);
});
test("coincident and antipodal routes stay deterministic and finite", () => {
  assert.ok(flightDistance([0, 0], [0, 0]) < 1e-6);
  for (const p of [0, 0.1, 0.5, 0.9, 1]) {
    assert.ok(greatCircle([0, 0], [180, 0], p).every(Number.isFinite));
    assert.deepEqual(
      greatCircle([0, 0], [180, 0], p),
      greatCircle([0, 0], [180, 0], p),
    );
    assert.ok(Math.abs(greatCircle([45, 20], [45, 20], p)[0] - 45) < 1e-7);
  }
  assert.throws(() => greatCircle([0, 100], [0, 0], 0.5), RangeError);
});
test("PVG to HND has a plausible airport distance and a spherical route", () => {
  const r = FLIGHT_ROUTES[0],
    distance = flightDistance(r.origin, r.destination);
  assert.ok(distance > 1700 && distance < 1800);
  const middle = greatCircle(r.origin, r.destination, 0.5);
  assert.ok(middle[1] > (r.origin[1] + r.destination[1]) / 2);
});
test("flight scenes use flight time, including a shortened takeoff for a one-minute session", () => {
  assert.equal(flightPhase(0, 0), "lounge");
  assert.equal(flightPhase(60000, 60000), "takeoff");
  assert.equal(flightPhase(60000, 55199), "cruise");
  assert.equal(flightPhase(60000, 3600), "descent");
  assert.equal(flightPhase(60000, 0), "arrived");
  assert.equal(flightPhase(1500000, 1494000), "cruise");
  assert.equal(flightPhase(1500000, 45000), "descent");
});
test("tear thresholds never accept backwards, incomplete or non-finite movement", () => {
  assert.equal(tearProgress(-100, 100), 0);
  assert.equal(tearProgress(99, 100), 0.99);
  assert.equal(tearProgress(100, 100), 1);
  assert.equal(tearProgress(120, 100), 1);
  assert.equal(tearProgress(NaN, 100), 0);
});
test("journey copy is complete in all five languages", () => {
  const keys = Object.keys(journeyText("zh")).sort();
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const copy = journeyText(lang);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(
      Object.values(copy).every(
        (value) => typeof value === "string" && value.length,
      ),
    );
  }
});
test("five languages provide complete UI copy and all route city names", () => {
  const keys = Object.keys(flightText("zh")).sort();
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const copy = flightText(lang);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.equal(copy.cities.length, 10);
    assert.equal(copy.moods.length, 6);
    assert.ok(
      Object.values(copy).every((value) =>
        typeof value === "string"
          ? value.length > 0
          : Array.isArray(value) && value.every(Boolean),
      ),
    );
    assert.ok(
      copy.complete.includes("{city}") && copy.complete.includes("{minutes}"),
    );
  }
});
