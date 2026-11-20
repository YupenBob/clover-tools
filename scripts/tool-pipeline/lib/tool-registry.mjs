/**
 * Registered tool slugs, derived from the site registry (single source of truth:
 * src/lib/tools.ts). The pipeline never keeps its own copy of the tool list.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO } from './paths.mjs';

const SLUG = /^\s*slug:\s*'([a-z0-9]+(?:-[a-z0-9]+)*)'\s*,?\s*$/gm;

export function registeredToolSlugs(repo = REPO) {
  const source = readFileSync(join(repo, 'src/lib/tools.ts'), 'utf8');
  const slugs = [];
  for (const match of source.matchAll(SLUG)) slugs.push(match[1]);
  return [...new Set(slugs)];
}

if (process.argv[1]?.endsWith('tool-registry.mjs')) {
  process.stdout.write(JSON.stringify({ slugs: registeredToolSlugs() }));
}
