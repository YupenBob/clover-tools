/** Validate the exact source data used by Astro's build-time home modules. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HOME_DATA, HOME_TOOL_SLUGS, HOME_GUIDE_SLUGS } from '../src/lib/home-data.ts';
import { getAllTools } from '../src/lib/tools.ts';
import { GUIDES } from '../src/lib/guides.ts';
const tools = getAllTools();
assert.equal(new Set(tools.map(tool => tool.slug)).size, HOME_DATA.toolCount);
assert.equal(HOME_DATA.guideCount, GUIDES.length, 'Published guide slugs must be unique');
for (const tool of tools) {
  assert.ok(existsSync(`src/pages/tools/${tool.category}/${tool.slug}.astro`), `Missing tool route: ${tool.slug}`);
}
for (const slug of HOME_TOOL_SLUGS) assert.ok(tools.some(tool => tool.slug === slug));
for (const slug of HOME_GUIDE_SLUGS) {
  const guide = GUIDES.find(guide => guide.slug === slug);
  assert.ok(guide?.content && guide.sources.length, `Missing guide or references: ${slug}`);
  assert.ok(tools.some(tool => tool.slug === guide.toolSlug), `Invalid tool mapping: ${slug}`);
}
for (const date of [HOME_DATA.updated, ...GUIDES.map(guide => guide.updated)]) {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(date).toISOString().slice(0, 10), date);
}
console.log(`Home data verified: ${HOME_DATA.toolCount} tools, ${HOME_DATA.guideCount} source guides, metadata updated ${HOME_DATA.updated}; translations excluded; no traffic metrics.`);
