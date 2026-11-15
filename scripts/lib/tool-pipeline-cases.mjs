import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * CI entry for tools produced by the nightly pipeline. Each tool only adds
 * scripts/lib/tool-cases/<slug>.mjs; smoke-growth.mjs stays untouched.
 */
export async function runToolPipelineChecks({ run, remember, base, artifacts }) {
  const directory = fileURLToPath(new URL('./tool-cases/', import.meta.url));
  if (!existsSync(directory)) return;
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.mjs') && !name.startsWith('_'))
    .sort();
  for (const file of files) {
    const module = await import(pathToFileURL(join(directory, file)).href);
    if (typeof module.run !== 'function') {
      throw new Error(`${file} must export run({ run, remember, base, artifacts })`);
    }
    await module.run({ run, remember, base, artifacts, slug: file.replace(/\.mjs$/, '') });
  }
}
