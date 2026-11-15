/**
 * Build gate for the committed traffic snapshot.
 *
 * A missing snapshot is valid (the sidebar shows a transparent "not connected
 * yet" state and never fabricated numbers). A present snapshot must satisfy the
 * schema and the cumulative/date invariants.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateTrafficSnapshot } from './traffic/schema.mjs';

const file = resolve(process.env.TRAFFIC_DATA_FILE || 'data/site-traffic.json');
if (!existsSync(file)) {
  console.log('traffic: no committed snapshot yet; sidebar renders the unavailable state (no fabricated numbers)');
  process.exit(0);
}

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`traffic: ${file} is not valid JSON: ${error.message}`);
  process.exit(1);
}

const { ok, errors } = validateTrafficSnapshot(snapshot);
if (!ok) {
  console.error(`traffic: ${file} failed validation:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const last = snapshot.history.at(-1);
const pageViews7d = snapshot.history.slice(-7).reduce((total, day) => total + day.pageViews, 0);
console.log(
  `traffic snapshot ok: ${snapshot.history.length} complete UTC days, ` +
    `last ${last.date}, PV(last 7 stored days) ${pageViews7d}, ` +
    `cumulative ${snapshot.cumulative.pageViews} since ${snapshot.cumulative.since}; ` +
    `source ${snapshot.source}, includes crawlers`,
);
