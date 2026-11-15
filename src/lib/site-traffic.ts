/**
 * Build-time summary of the committed site-traffic snapshot.
 *
 * The snapshot is fetched from Cloudflare edge analytics by
 * `scripts/traffic/fetch-cloudflare.mjs` and validated by `scripts/check-traffic.mjs`.
 * This module only derives display values; it never invents numbers. When the
 * snapshot is missing, invalid or too old, `TRAFFIC` is `null` and the sidebar
 * renders a transparent "not connected yet" state.
 */
import { summarizeTraffic } from '../../scripts/traffic/schema.mjs';

// Glob (rather than a static JSON import) so a missing snapshot degrades to the
// fallback UI instead of failing the build.
const snapshots = import.meta.glob('../../data/site-traffic.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const raw = Object.values(snapshots)[0];

export const TRAFFIC = raw && typeof raw === 'object' ? summarizeTraffic(raw as never, { now: new Date() }) : null;

export type TrafficSummary = NonNullable<typeof TRAFFIC>;
