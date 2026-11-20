/**
 * Registered tool slugs, derived from the site registry (single source of truth:
 * src/lib/tools.ts). The pipeline never keeps its own copy of the tool list.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO } from './paths.mjs';

const CATEGORY = /^\s{2}([a-z]+):\s*\[\s*$/;
const SLUG = /^\s*slug:\s*'([a-z0-9]+(?:-[a-z0-9]+)*)'\s*,?\s*$/;

/** Registered tools with their category, parsed from src/lib/tools.ts. */
export function registeredTools(repo = REPO) {
  const source = readFileSync(join(repo, 'src/lib/tools.ts'), 'utf8');
  const tools = [];
  let category = null;
  for (const line of source.split('\n')) {
    const categoryMatch = CATEGORY.exec(line);
    if (categoryMatch) {
      category = categoryMatch[1];
      continue;
    }
    const slugMatch = SLUG.exec(line);
    if (slugMatch && category) tools.push({ slug: slugMatch[1], category });
  }
  const seen = new Set();
  return tools.filter((tool) => {
    if (seen.has(tool.slug)) return false;
    seen.add(tool.slug);
    return true;
  });
}

export function registeredToolSlugs(repo = REPO) {
  return registeredTools(repo).map((tool) => tool.slug);
}

if (process.argv[1]?.endsWith('tool-registry.mjs')) {
  process.stdout.write(JSON.stringify({ tools: registeredTools(), slugs: registeredToolSlugs() }));
}
