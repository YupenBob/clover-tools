import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeTraffic, validateTrafficSnapshot, shiftDate, todayUtc } from '../traffic/schema.mjs';

const day = (date, pageViews, uniqueVisitors = Math.round(pageViews / 4), requests = pageViews * 3) => ({
  date,
  pageViews,
  uniqueVisitors,
  requests,
});

function makeSnapshot(history, extra = {}) {
  return {
    source: 'cloudflare-zone-analytics',
    generatedAt: '2026-11-15T07:00:00.000Z',
    timezone: 'UTC',
    includesBots: true,
    history,
    cumulative: { pageViews: history.reduce((total, entry) => total + entry.pageViews, 0), since: history[0].date, seedPageViews: 0 },
    ...extra,
  };
}

const now = new Date('2026-11-15T07:30:00.000Z');

test('valid snapshot passes validation', () => {
  const snapshot = makeSnapshot([day('2026-11-12', 10), day('2026-11-13', 20), day('2026-11-14', 30)]);
  assert.deepEqual(validateTrafficSnapshot(snapshot, { now }), { ok: true, errors: [] });
});

test('validation rejects tampered or malformed snapshots', () => {
  const base = makeSnapshot([day('2026-11-13', 10), day('2026-11-14', 20)]);
  const cases = [
    [{ ...base, source: 'manual' }, 'source must be'],
    [{ ...base, includesBots: false }, 'includesBots'],
    [{ ...base, cumulative: { ...base.cumulative, pageViews: 1 } }, 'cumulative.pageViews must equal'],
    [{ ...base, history: [day('2026-11-14', 10), day('2026-11-13', 20)] }, 'ascending'],
    [{ ...base, history: [day('2026-11-14', -1)] }, 'non-negative integer'],
    [{ ...base, generatedAt: '2999-01-01T00:00:00.000Z' }, 'future'],
    [{ ...base, history: [day(todayUtc(now), 5)] }, 'complete UTC days'],
    [{ ...base, history: [] }, 'non-empty'],
  ];
  for (const [snapshot, expected] of cases) {
    const result = validateTrafficSnapshot(snapshot, { now });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), `expected "${expected}", got: ${result.errors.join('; ')}`);
  }
});

test('summary uses the last seven complete days, averages daily visitors and builds a chart', () => {
  const history = Array.from({ length: 10 }, (_, index) => day(shiftDate('2026-11-04', index), (index + 1) * 100, 10 + index));
  const summary = summarizeTraffic(makeSnapshot(history), { now });
  assert.ok(summary);
  assert.equal(summary.windowDays, 7);
  assert.equal(summary.windowStart, '2026-11-07');
  assert.equal(summary.windowEnd, '2026-11-13');
  assert.equal(summary.pageViews7d, 400 + 500 + 600 + 700 + 800 + 900 + 1000);
  assert.equal(summary.pageViews7d, 4900);
  // Last seven entries have uniqueVisitors 13..19, so the daily average is 16.
  assert.equal(summary.dailyVisitors, 16);
  assert.equal(summary.cumulativePageViews, history.reduce((total, entry) => total + entry.pageViews, 0));
  assert.equal(summary.chart.length, 7);
  assert.equal(summary.chart.at(-1).heightPct, 100);
  assert.ok(summary.chart.every((bar) => bar.heightPct >= 2 && bar.heightPct <= 100));
  assert.equal(summary.stale, false);
});

test('summary marks old snapshots as stale and hides very old ones', () => {
  const snapshot = makeSnapshot([day('2026-11-13', 10), day('2026-11-14', 20)]);
  const stale = summarizeTraffic({ ...snapshot, generatedAt: '2026-11-13T00:00:00.000Z' }, { now });
  assert.equal(stale?.stale, true);
  const gone = summarizeTraffic({ ...snapshot, generatedAt: '2026-10-30T00:00:00.000Z' }, { now });
  assert.equal(gone, null);
});

test('summary returns null for missing or invalid snapshots', () => {
  assert.equal(summarizeTraffic(null, { now }), null);
  assert.equal(summarizeTraffic(makeSnapshot([day('2026-11-14', 10)], { includesBots: false }), { now }), null);
});

test('zero-page-view days keep a visible baseline bar', () => {
  const summary = summarizeTraffic(makeSnapshot([day('2026-11-13', 0), day('2026-11-14', 10)]), { now });
  assert.ok(summary);
  assert.equal(summary.chart[0].heightPct, 2);
  assert.equal(summary.chart[1].heightPct, 100);
});

test('committed snapshot is valid and consistent', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../../data/site-traffic.json', import.meta.url), 'utf8'));
  const result = validateTrafficSnapshot(snapshot);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(snapshot.history.length >= 8, 'snapshot should keep enough history for the 7-day window');
  assert.equal(snapshot.cumulative.since, snapshot.history[0].date);
});
