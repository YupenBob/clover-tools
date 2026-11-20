/**
 * Presentation contract loader / validator.
 *
 * Single source of truth for "primary mode" declarations:
 *   - config/presentation-policy.json    (trusted baseline; tools may only tighten)
 *   - config/schemas/tool-presentation.schema.json (strict structure)
 *   - data/tool-presentation/<slug>.json (per-tool declaration)
 *
 * No per-tool branches live here: everything tool specific comes from the files
 * above, so adding a tool never requires editing this module.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO } from './paths.mjs';

export const POLICY_FILE = 'config/presentation-policy.json';
export const SCHEMA_FILE = 'config/schemas/tool-presentation.schema.json';
export const CONFIG_DIR = 'data/tool-presentation';
const policySlugLabel = POLICY_FILE;

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Minimal JSON-Schema subset validator (type/const/enum/required/properties/items/...). */
export function validateSchema(value, schema, root = schema, path = '$') {
  const issues = [];
  const fail = (message) => issues.push(`${path}: ${message}`);
  if (schema === true) return issues;
  if (schema.$ref) {
    const ref = schema.$ref.startsWith('#/') ? schema.$ref.slice(2).split('/') : null;
    if (!ref) return [`${path}: unsupported $ref ${schema.$ref}`];
    let target = root;
    for (const key of ref) target = target?.[key];
    if (!target) return [`${path}: unresolved $ref ${schema.$ref}`];
    return validateSchema(value, target, root, path);
  }
  if (schema.type) {
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    const ok =
      schema.type === type ||
      (schema.type === 'number' && type === 'number') ||
      (schema.type === 'integer' && Number.isInteger(value));
    if (!ok) {
      fail(`expected ${schema.type}, got ${type}`);
      return issues;
    }
  }
  if ('const' in schema && value !== schema.const) fail(`expected const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`expected one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail(`does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`shorter than ${schema.minLength}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail(`below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length)
      fail('items must be unique');
    if (schema.items) value.forEach((item, index) => issues.push(...validateSchema(item, schema.items, root, `${path}[${index}]`)));
  }
  if (isObject(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) fail(`missing required key "${key}"`);
    const props = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in props)) fail(`unexpected key "${key}"`);
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in value) issues.push(...validateSchema(value[key], childSchema, root, `${path}.${key}`));
    }
  }
  return issues;
}

export function presentationPaths(repo = REPO) {
  return {
    policy: join(repo, POLICY_FILE),
    schema: join(repo, SCHEMA_FILE),
    dir: join(repo, CONFIG_DIR),
  };
}

export function loadPolicy(repo = REPO) {
  const paths = presentationPaths(repo);
  if (!existsSync(paths.policy)) throw new Error(`missing policy: ${POLICY_FILE}`);
  return readJson(paths.policy);
}

export function loadSchema(repo = REPO) {
  const paths = presentationPaths(repo);
  if (!existsSync(paths.schema)) throw new Error(`missing schema: ${SCHEMA_FILE}`);
  return readJson(paths.schema);
}

/** All declared tool configs, keyed by slug. Duplicate slugs are reported by validateAll. */
export function loadToolConfigs(repo = REPO) {
  const dir = join(repo, CONFIG_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ file: join(dir, name), slugFromFile: name.replace(/\.json$/, ''), config: readJson(join(dir, name)) }));
}

const keyExists = (repo, moduleFile, key) => {
  const full = join(repo, moduleFile);
  if (!existsSync(full)) return false;
  const source = readFileSync(full, 'utf8');
  return new RegExp(`(^|[^A-Za-z0-9_])${key}\\s*:`, 'm').test(source);
};

/** Policy-bound semantic checks: a tool config may only tighten the baseline. */
export function validateAgainstPolicy(config, policy) {
  const issues = [];
  const profile = policy.profiles?.[config.profile];
  if (!profile) return [`profile "${config.profile}" is not defined in ${POLICY_FILE}`];
  const fail = (message) => issues.push(`${config.slug}: ${message}`);
  const caps = profile.caps ?? {};
  const slots = config.primary?.slots ?? [];
  if (caps.maxSlots !== undefined && slots.length > caps.maxSlots) fail(`declares ${slots.length} slots (max ${caps.maxSlots})`);
  for (const slot of slots) {
    if (caps.allowedSlotKinds && !caps.allowedSlotKinds.includes(slot.kind)) fail(`slot kind "${slot.kind}" not allowed for ${config.profile}`);
  }
  const ids = new Set();
  for (const item of [...slots, ...(config.controls ?? [])]) {
    if (ids.has(item.id)) fail(`duplicate id "${item.id}"`);
    ids.add(item.id);
  }
  const controls = config.controls ?? [];
  if (caps.maxControls !== undefined && controls.length > caps.maxControls) fail(`declares ${controls.length} controls (max ${caps.maxControls})`);
  const persistent = controls.filter((c) => c.persistent);
  if (caps.maxPersistentControls !== undefined && persistent.length > caps.maxPersistentControls)
    fail(`declares ${persistent.length} persistent controls (max ${caps.maxPersistentControls})`);
  if (caps.singlePersistentControl && persistent.length > 1) fail('only one persistent control is allowed');
  for (const control of controls) {
    if (caps.allowedControlRoles && !caps.allowedControlRoles.includes(control.role)) fail(`control role "${control.role}" not allowed`);
    if (caps.requireIconOnlyPersistentControl && control.persistent && control.iconOnly !== true) fail('persistent control must be icon-only');
    if (caps.minHitTargetPx !== undefined && (control.minHitTargetPx ?? 0) < caps.minHitTargetPx)
      fail(`control "${control.id}" hit target below ${caps.minHitTargetPx}px`);
  }
  const appearance = config.appearance ?? {};
  const baseAppearance = profile.appearance ?? {};
  if (appearance.maxBackgroundLuminance !== undefined && baseAppearance.maxBackgroundLuminance !== undefined &&
      appearance.maxBackgroundLuminance > baseAppearance.maxBackgroundLuminance)
    fail(`background luminance ${appearance.maxBackgroundLuminance} looser than policy ${baseAppearance.maxBackgroundLuminance}`);
  if (appearance.minPrimaryFontVh !== undefined && baseAppearance.minPrimaryFontVh !== undefined &&
      appearance.minPrimaryFontVh < baseAppearance.minPrimaryFontVh)
    fail(`primary font ${appearance.minPrimaryFontVh}vh below policy minimum ${baseAppearance.minPrimaryFontVh}vh`);
  const interaction = config.interaction ?? {};
  if (profile.interaction?.settingsInitiallyOpen === false && interaction.settingsInitiallyOpen === true)
    fail('settings may not open by default');
  if (profile.interaction?.autoHideMs !== undefined && interaction.autoHideMs !== undefined &&
      interaction.autoHideMs > profile.interaction.autoHideMs)
    fail(`autoHideMs looser than policy`);
  const errors = config.errors ?? {};
  if (profile.errors?.visualChannel && errors.visualChannel && errors.visualChannel !== profile.errors.visualChannel)
    fail(`error channel must stay "${profile.errors.visualChannel}"`);
  if (profile.errors?.interruptPrimary === false && errors.interruptPrimary === true)
    fail('errors may not interrupt the primary view');
  const surfaces = config.renderSurfaces ?? [];
  const forbidden = new Set(profile.forbiddenRenderSurfaces ?? []);
  for (const surface of surfaces) {
    if (forbidden.has(surface.kind)) fail(`render surface "${surface.kind}" is forbidden for ${config.profile}`);
    if (profile.allowedRenderSurfaces && !profile.allowedRenderSurfaces.includes(surface.kind))
      fail(`render surface "${surface.kind}" is not in the allowed list`);
  }
  const declaredStates = Object.keys(config.states ?? {});
  for (const required of profile.states ?? []) {
    if (!declaredStates.includes(required)) fail(`state "${required}" must be declared`);
  }
  for (const [state, view] of Object.entries(config.states ?? {})) {
    for (const slotId of view.slots ?? []) if (!slots.some((slot) => slot.id === slotId)) fail(`state "${state}" references unknown slot "${slotId}"`);
    for (const controlId of view.controls ?? [])
      if (!controls.some((control) => control.id === controlId)) fail(`state "${state}" references unknown control "${controlId}"`);
  }
  return issues;
}

export function validateToolConfig({ repo = REPO, schema = loadSchema(repo), config, file = '' }) {
  const issues = validateSchema(config, schema).map((issue) => `${file || config?.slug}: ${issue}`);
  const knownSlugs = config?.slug !== undefined;
  if (knownSlugs && file && !file.endsWith(`${config.slug}.json`)) issues.push(`${file}: filename must match slug "${config.slug}"`);
  for (const key of config?.i18n?.requiredKeys ?? []) {
    if (!keyExists(repo, config.i18n.module, key)) issues.push(`${file || config.slug}: i18n key "${key}" not found in ${config.i18n.module}`);
  }
  return issues;
}

/**
 * Coverage rules:
 *  - every declared config must belong to a registered tool;
 *  - every legacy slug must be a registered tool and must not also have a config;
 *  - a tool that the pipeline builds or upgrades must declare a config (`requireManaged`),
 *    so deleting a case/config file can never silently skip the check.
 */
export function validateCoverage({ repo = REPO, policy = loadPolicy(repo), toolSlugs }) {
  const issues = [];
  const configs = loadToolConfigs(repo);
  const declared = new Set(configs.map((entry) => entry.config?.slug ?? entry.slugFromFile));
  const legacy = new Set(policy.legacyDryRunSlugs ?? []);
  for (const entry of configs) {
    const slug = entry.config?.slug ?? entry.slugFromFile;
    if (!toolSlugs.includes(slug)) issues.push(`${entry.file}: slug "${slug}" is not a registered tool`);
  }
  for (const slug of legacy) {
    if (!toolSlugs.includes(slug)) issues.push(`${policySlugLabel}: legacy slug "${slug}" is not a registered tool`);
    if (declared.has(slug)) issues.push(`${policySlugLabel}: slug "${slug}" is declared but still listed in legacyDryRunSlugs`);
  }
  return issues;
}

/** Post-build requirement: the tool this run produced must have a declared config. */
export function requireManaged({ repo = REPO, policy = loadPolicy(repo), slug }) {
  const declared = loadToolConfigs(repo).map((entry) => entry.config?.slug ?? entry.slugFromFile);
  if (declared.includes(slug)) return [];
  if ((policy.legacyDryRunSlugs ?? []).includes(slug)) return [];
  return [`tool "${slug}" must declare ${CONFIG_DIR}/${slug}.json (no legacy exemption for pipeline output)`];
}

/** Full contract validation used by tick guard, CI and local checks. */
export function validatePresentationContract({ repo = REPO, toolSlugs }) {
  const issues = [];
  if (!Array.isArray(toolSlugs) || !toolSlugs.length) issues.push('registered tool slugs are required');
  if (issues.length) return issues;
  let policy, schema;
  try {
    policy = loadPolicy(repo);
    schema = loadSchema(repo);
  } catch (error) {
    return [String(error.message ?? error)];
  }
  if (policy.version !== 1) issues.push(`${POLICY_FILE}: unsupported policy version ${policy.version}`);
  const configs = loadToolConfigs(repo);
  for (const entry of configs) {
    issues.push(...validateToolConfig({ repo, schema, config: entry.config, file: `${CONFIG_DIR}/${entry.slugFromFile}.json` }));
    if (entry.config?.slug) issues.push(...validateAgainstPolicy(entry.config, policy));
  }
  issues.push(...validateCoverage({ repo, policy, toolSlugs }));
  return issues;
}

if (process.argv[1]?.endsWith('presentation.mjs')) {
  const { execSync } = await import('node:child_process');
  let slugs = [];
  try {
    const out = execSync('node scripts/tool-pipeline/lib/tool-registry.mjs', { cwd: REPO, encoding: 'utf8' });
    slugs = JSON.parse(out).slugs;
  } catch {
    slugs = [];
  }
  const issues = validatePresentationContract({ repo: REPO, toolSlugs: slugs });
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exit(1);
  }
  console.log(`presentation contract OK (${slugs.length} tools)`);
}
