/**
 * Site traffic snapshot schema.
 *
 * The snapshot is generated from Cloudflare's edge analytics by
 * `scripts/traffic/fetch-cloudflare.mjs` and committed to `data/site-traffic.json`.
 * It never contains per-visitor data, tokens or page-level paths: only aggregate
 * page views / unique visitors per UTC calendar day.
 */
export const TRAFFIC_SOURCE = 'cloudflare-zone-analytics';
export const TRAFFIC_TIMEZONE = 'UTC';
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_HISTORY_DAYS = 400;

export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate a committed snapshot. Returns `{ ok, errors }`; callers decide whether
 * an invalid snapshot is fatal (check gate) or should be ignored (build fallback).
 */
export function validateTrafficSnapshot(snapshot, { now = new Date() } = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);

  if (!isPlainObject(snapshot)) return { ok: false, errors: ['snapshot must be a JSON object'] };
  if (snapshot.source !== TRAFFIC_SOURCE) fail(`source must be "${TRAFFIC_SOURCE}"`);
  if (snapshot.timezone !== TRAFFIC_TIMEZONE) fail(`timezone must be "${TRAFFIC_TIMEZONE}"`);
  if (snapshot.includesBots !== true) fail('includesBots must be true (edge statistics include crawlers)');
  if (typeof snapshot.generatedAt !== 'string' || Number.isNaN(Date.parse(snapshot.generatedAt))) {
    fail('generatedAt must be an ISO timestamp');
  } else if (Date.parse(snapshot.generatedAt) > now.getTime() + 10 * 60_000) {
    fail('generatedAt must not be in the future');
  }

  if (!Array.isArray(snapshot.history) || snapshot.history.length === 0) {
    fail('history must be a non-empty array');
  } else if (snapshot.history.length > MAX_HISTORY_DAYS) {
    fail(`history must not exceed ${MAX_HISTORY_DAYS} days`);
  } else {
    let previous = '';
    for (const [index, day] of snapshot.history.entries()) {
      const label = `history[${index}]`;
      if (!isPlainObject(day)) { fail(`${label} must be an object`); continue; }
      if (typeof day.date !== 'string' || !DATE_RE.test(day.date)) { fail(`${label}.date must be YYYY-MM-DD`); continue; }
      if (previous && day.date <= previous) fail(`${label}.date must be ascending and unique`);
      previous = day.date;
      for (const field of ['pageViews', 'uniqueVisitors', 'requests']) {
        if (!Number.isInteger(day[field]) || day[field] < 0) fail(`${label}.${field} must be a non-negative integer`);
      }
    }
    const last = snapshot.history.at(-1)?.date;
    if (typeof last === 'string' && last >= todayUtc(now)) {
      fail('history must only contain complete UTC days (last date must be before today)');
    }
  }

  const cumulative = snapshot.cumulative;
  if (!isPlainObject(cumulative)) {
    fail('cumulative must be an object');
  } else {
    if (!Number.isInteger(cumulative.pageViews) || cumulative.pageViews < 0) fail('cumulative.pageViews must be a non-negative integer');
    if (!Number.isInteger(cumulative.seedPageViews ?? 0) || (cumulative.seedPageViews ?? 0) < 0) fail('cumulative.seedPageViews must be a non-negative integer');
    if (typeof cumulative.since !== 'string' || !DATE_RE.test(cumulative.since)) fail('cumulative.since must be YYYY-MM-DD');
    if (Array.isArray(snapshot.history) && snapshot.history.length > 0) {
      const sum = snapshot.history.reduce((total, day) => total + (Number.isInteger(day.pageViews) ? day.pageViews : 0), 0);
      if (cumulative.pageViews !== sum + (cumulative.seedPageViews ?? 0)) {
        fail('cumulative.pageViews must equal seedPageViews + sum(history.pageViews)');
      }
      if (cumulative.since !== snapshot.history[0]?.date) fail('cumulative.since must equal the first history date');
    }
  }

  return { ok: errors.length === 0, errors };
}
