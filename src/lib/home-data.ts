import { getAllTools } from './tools.ts';
import { GUIDES } from './guides.ts';
import { SITE_DEFAULTS } from '../../config/site.mjs';

/** Astro evaluates this at build time. Count published source entries once,
 * independent of translations. Dates come from guide metadata and site config,
 * never the build clock, filesystem mtime, or a made-up traffic counter. */
export const HOME_DATA = {
  toolCount: getAllTools().length,
  guideCount: new Set(GUIDES.map(guide => guide.slug)).size,
  updated: [SITE_DEFAULTS.updated, ...GUIDES.map(guide => guide.updated)].sort().at(-1)!,
};

/** Editorial selections, not popularity or traffic rankings. */
export const HOME_TOOL_SLUGS = ['json-formatter', 'timestamp', 'diff'] as const;
export const HOME_GUIDE_SLUGS = [
  'json-unexpected-token-html',
  'fetch-failed-to-fetch',
  'base-converter-large-integers',
] as const;
