import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validatePresentationContract, loadToolConfigs } from '../tool-pipeline/lib/presentation.mjs';
import { registeredTools } from '../tool-pipeline/lib/tool-registry.mjs';
import { runPresentationChecks } from './presentation-cases.mjs';

/**
 * CI entry for tools produced by the nightly pipeline. Each tool only adds
 * scripts/lib/tool-cases/<slug>.mjs; smoke-growth.mjs stays untouched.
 *
 * The presentation contract is validated from the registry (not from the case
 * files), so deleting a case file can never silently skip the check.
 */
export async function runToolPipelineChecks({ run, remember, base, artifacts }) {
  const tools = registeredTools();
  const contractIssues = validatePresentationContract({ toolSlugs: tools.map((tool) => tool.slug) });
  if (contractIssues.length) throw new Error(`presentation contract failed: ${contractIssues.join('; ')}`);

  const directory = fileURLToPath(new URL('./tool-cases/', import.meta.url));
  if (existsSync(directory)) {
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

  const categoryBySlug = new Map(tools.map((tool) => [tool.slug, tool.category]));
  for (const entry of loadToolConfigs()) {
    const slug = entry.config?.slug ?? entry.slugFromFile;
    const category = categoryBySlug.get(slug);
    if (!category) throw new Error(`presentation config for unregistered tool "${slug}"`);
    await runPresentationChecks({
      run,
      remember,
      base,
      artifacts,
      slug,
      category,
      registeredSlugs: tools.map((tool) => tool.slug),
    });
  }
}
