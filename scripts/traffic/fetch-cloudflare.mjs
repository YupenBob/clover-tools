/**
 * Fetch the site's aggregate traffic numbers from Cloudflare edge analytics and
 * write `data/site-traffic.json`.
 *
 * - Only complete UTC calendar days are stored; the in-progress day is skipped.
 * - Numbers are edge aggregates: page views, unique visitors (approximate daily
 *   de-duplication) and requests. They include search-engine and other crawler
 *   traffic and are labelled that way in the UI. They are not "users" or
 *   "tool runs".
 * - The snapshot keeps a daily history so the cumulative page-view counter grows
 *   monotonically across runs instead of resetting to Cloudflare's retained window.
 *
 * Environment:
 *   CLOUDFLARE_ANALYTICS_TOKEN  preferred read-only API token (Zone Analytics:Read)
 *   CLOUDFLARE_API_TOKEN        fallback when the deploy token has analytics access
 *   CLOUDFLARE_ACCOUNT_ID       account id (optional when a zone id is provided)
 *   CLOUDFLARE_ZONE_ID          zone id of clovertools.cn (optional; resolved by name)
 *   CLOUDFLARE_ZONE_NAME        zone name (default: clovertools.cn)
 *   TRAFFIC_DATA_FILE           override output path (tests)
 *   TRAFFIC_HISTORY_DAYS        days to request from Cloudflare (default: 31)
 *
 * Usage:
 *   node scripts/traffic/fetch-cloudflare.mjs            # fetch and write snapshot
 *   node scripts/traffic/fetch-cloudflare.mjs --dry-run  # fetch, validate, print
 *   node scripts/traffic/fetch-cloudflare.mjs --json     # machine-readable summary
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAFFIC_SOURCE, TRAFFIC_TIMEZONE, shiftDate, todayUtc, validateTrafficSnapshot } from './schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_FILE = process.env.TRAFFIC_DATA_FILE || join(ROOT, 'data/site-traffic.json');
const API_BASE = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_ANALYTICS_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME || 'clovertools.cn';
const HISTORY_DAYS = Math.max(8, Math.min(60, Number(process.env.TRAFFIC_HISTORY_DAYS) || 31));

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const jsonOutput = args.has('--json');

function fail(message, code = 1) {
  console.error(`traffic: ${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Site traffic snapshot\n\n**Failed**: ${message}\n`);
  }
  process.exitCode = code;
}

function authHint(status, codes) {
  if (status === 403 || status === 401 || codes.includes('10000') || codes.includes('9109') || codes.includes('9106')) {
    return [
      'Cloudflare rejected the request (HTTP ' + status + ', codes ' + (codes.join(',') || 'unknown') + ').',
      'The token needs read-only permissions: Zone → Zone: Read (to resolve the zone) and Zone → Analytics: Read (to read HTTP analytics).',
      'Add a read-only token as the repository secret CLOUDFLARE_ANALYTICS_TOKEN (or make sure CLOUDFLARE_API_TOKEN includes Zone Analytics:Read).',
      'Do not paste tokens into committed files.',
    ].join(' ');
  }
  return `Cloudflare API request failed (HTTP ${status}).`;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path, { method = 'GET', body, retries = 3 } = {}) {
  let lastError = '';
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Cloudflare returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 160)}`);
      }
      if (!response.ok || data.success !== true) {
        const codes = (data.errors || []).map((error) => String(error.code));
        const detail = (data.errors || []).map((error) => error.message).filter(Boolean).join('; ');
        const debug = `[status ${response.status}, success ${data.success}, ` +
          `errors ${JSON.stringify(data.errors ?? []).slice(0, 300)}]`;
        if (process.env.TRAFFIC_DEBUG) console.error(`traffic: debug ${method} ${path.split('?')[0]} ${debug}`);
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await sleep(attempt * 2_000);
          continue;
        }
        throw new Error(`${authHint(response.status, codes)} ${detail} ${debug}`.trim());
      }
      return data.result;
    } catch (error) {
      lastError = error.message;
      if (attempt < retries && /fetch failed|network|timeout|aborted/i.test(error.message)) {
        await sleep(attempt * 2_000);
        continue;
      }
      throw error;
    }
  }
  throw new Error(lastError || 'Cloudflare API request failed');
}

async function resolveZoneId() {
  const explicit = process.env.CLOUDFLARE_ZONE_ID;
  if (explicit) return explicit;
  const query = new URLSearchParams({ name: ZONE_NAME, per_page: '50' });
  if (ACCOUNT_ID) query.set('account.id', ACCOUNT_ID);
  const zones = await api(`/zones?${query}`);
  const matches = (Array.isArray(zones) ? zones : []).filter(
    (zone) => zone.name === ZONE_NAME && (!ACCOUNT_ID || zone.account?.id === ACCOUNT_ID),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one authorized zone for ${ZONE_NAME}; found ${matches.length}. ` +
        'Set CLOUDFLARE_ZONE_ID or grant the token Zone:Read for this account.',
    );
  }
  return matches[0].id;
}

async function fetchDaily(zoneId) {
  const until = shiftDate(todayUtc(), -1);
  const since = shiftDate(until, -(HISTORY_DAYS - 1));
  const query = `query SiteTraffic($zoneTag: string!, $since: Date!, $until: Date!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(limit: 60, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
          dimensions { date }
          sum { requests pageViews }
          uniq { uniques }
        }
      }
    }
  }`;
  const result = await api('/graphql', { method: 'POST', body: { query, variables: { zoneTag: zoneId, since, until } } });
  const groups = result?.viewer?.zones?.[0]?.httpRequests1dGroups;
  if (!Array.isArray(groups)) {
    throw new Error('Cloudflare GraphQL did not return httpRequests1dGroups; the token may lack Zone Analytics:Read.');
  }
  return groups
    .map((group) => ({
      date: group?.dimensions?.date,
      pageViews: group?.sum?.pageViews,
      requests: group?.sum?.requests,
      uniqueVisitors: group?.uniq?.uniques,
    }))
    .filter((day) => typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date));
}

function readExisting() {
  if (!existsSync(DATA_FILE)) return null;
  try {
    const candidate = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    return validateTrafficSnapshot(candidate).ok ? candidate : null;
  } catch {
    return null;
  }
}

function buildSnapshot(fetched, existing) {
  const byDate = new Map();
  for (const day of existing?.history ?? []) byDate.set(day.date, day);
  for (const day of fetched) {
    byDate.set(day.date, {
      date: day.date,
      pageViews: Number(day.pageViews) || 0,
      uniqueVisitors: Number(day.uniqueVisitors) || 0,
      requests: Number(day.requests) || 0,
    });
  }
  const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (history.length === 0) throw new Error('Cloudflare returned no complete UTC days; the site may be new or the token lacks analytics access.');
  const seedPageViews = existing?.cumulative?.seedPageViews ?? 0;
  const pageViews = history.reduce((total, day) => total + day.pageViews, 0) + seedPageViews;
  return {
    source: TRAFFIC_SOURCE,
    generatedAt: new Date().toISOString(),
    timezone: TRAFFIC_TIMEZONE,
    includesBots: true,
    history,
    cumulative: { pageViews, since: history[0].date, seedPageViews },
  };
}

function summaryOf(snapshot) {
  const windowStart = Math.max(0, snapshot.history.length - 7);
  const window = snapshot.history.slice(windowStart);
  const pageViews7d = window.reduce((total, day) => total + day.pageViews, 0);
  const dailyVisitors = window.length
    ? Math.round(window.reduce((total, day) => total + day.uniqueVisitors, 0) / window.length)
    : 0;
  return {
    source: snapshot.source,
    timezone: snapshot.timezone,
    window: { start: window[0]?.date ?? null, end: window.at(-1)?.date ?? null, days: window.length },
    pageViews7d,
    dailyVisitors,
    cumulativePageViews: snapshot.cumulative.pageViews,
    cumulativeSince: snapshot.cumulative.since,
    historyDays: snapshot.history.length,
    generatedAt: snapshot.generatedAt,
  };
}

async function main() {
  if (!TOKEN) {
    fail(
      'Missing Cloudflare analytics credential. Set CLOUDFLARE_ANALYTICS_TOKEN (read-only token with Zone:Read + Zone Analytics:Read) or CLOUDFLARE_API_TOKEN.',
      2,
    );
    return;
  }
  const zoneId = await resolveZoneId();
  const fetched = await fetchDaily(zoneId);
  const snapshot = buildSnapshot(fetched, readExisting());
  const validation = validateTrafficSnapshot(snapshot);
  if (!validation.ok) throw new Error(`Generated snapshot failed validation: ${validation.errors.join('; ')}`);
  const summary = summaryOf(snapshot);

  if (!dryRun) {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`);
    renameSync(tmp, DATA_FILE);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ wrote: !dryRun, file: relative(ROOT, DATA_FILE), ...summary }, null, 2));
  } else {
    console.log(
      `traffic: ${dryRun ? 'dry-run' : 'wrote'} ${relative(ROOT, DATA_FILE)} · ` +
        `window ${summary.window.start}..${summary.window.end} (${summary.window.days}d) · ` +
        `PV7d ${summary.pageViews7d} · daily visitors ${summary.dailyVisitors} · ` +
        `cumulative ${summary.cumulativePageViews} since ${summary.cumulativeSince}`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Site traffic snapshot\n\n- Source: ${snapshot.source} (${snapshot.timezone} calendar days, includes crawlers)\n` +
        `- Completed window: ${summary.window.start} → ${summary.window.end} (${summary.window.days} days)\n` +
        `- Page views (window): ${summary.pageViews7d}\n- Average daily unique visitors: ${summary.dailyVisitors}\n` +
        `- Cumulative page views: ${summary.cumulativePageViews} since ${summary.cumulativeSince}\n` +
        `- History days stored: ${summary.historyDays}\n- Generated at: ${summary.generatedAt}\n`,
    );
  }
}

try {
  await main();
} catch (error) {
  fail(error.message);
}
