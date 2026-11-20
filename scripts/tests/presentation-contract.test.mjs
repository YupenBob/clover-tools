import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { registeredToolSlugs } from '../tool-pipeline/lib/tool-registry.mjs';
import {
  loadPolicy,
  loadSchema,
  validatePresentationContract,
  validateAgainstPolicy,
  validateCoverage,
  requireManaged,
} from '../tool-pipeline/lib/presentation.mjs';

const repoRoot = join(import.meta.dirname, '..', '..');
const policy = loadPolicy(repoRoot);
const schema = loadSchema(repoRoot);

function fixtureRepo({ configs = {}, i18n = 'export const t = { exitProjection: "x", zone: "y", fullscreen: "z" };\n', policyOverride = null, legacy = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'clover-presentation-'));
  mkdirSync(join(dir, 'config', 'schemas'), { recursive: true });
  mkdirSync(join(dir, 'data', 'tool-presentation'), { recursive: true });
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  const effectivePolicy = policyOverride ?? { ...policy, legacyDryRunSlugs: legacy ?? policy.legacyDryRunSlugs };
  writeFileSync(join(dir, 'config', 'presentation-policy.json'), JSON.stringify(effectivePolicy));
  writeFileSync(join(dir, 'config', 'schemas', 'tool-presentation.schema.json'), JSON.stringify(schema));
  writeFileSync(join(dir, 'src', 'lib', 'exam-clock-i18n.ts'), i18n);
  for (const [slug, config] of Object.entries(configs)) {
    writeFileSync(join(dir, 'data', 'tool-presentation', `${slug}.json`), JSON.stringify(config));
  }
  return dir;
}

const baseConfig = () => JSON.parse(readFileSync(join(repoRoot, 'data/tool-presentation/exam-clock.json'), 'utf8'));

test('the shipped exam-clock contract validates against policy', () => {
  assert.deepEqual(validatePresentationContract({ repo: repoRoot, toolSlugs: registeredToolSlugs(repoRoot) }), []);
});

test('unknown keys are rejected', () => {
  const config = baseConfig();
  config.primary.slotz = [];
  const dir = fixtureRepo({ configs: { 'exam-clock': config }, legacy: [] });
  const issues = validatePresentationContract({ repo: dir, toolSlugs: ['exam-clock'] });
  assert.ok(issues.some((issue) => issue.includes('unexpected key "slotz"')), issues.join('\n'));
});

test('a tool cannot loosen the shared thresholds', () => {
  const config = baseConfig();
  config.appearance.maxBackgroundLuminance = 0.5;
  config.appearance.minPrimaryFontVh = 4;
  const issues = validateAgainstPolicy(config, policy);
  assert.ok(issues.some((issue) => issue.includes('background luminance')), issues.join('\n'));
  assert.ok(issues.some((issue) => issue.includes('primary font')), issues.join('\n'));
});

test('projector profile allows only one icon-only persistent control', () => {
  const config = baseConfig();
  config.controls.push({ id: 'sync', role: 'submit', selector: '#ecSync', persistent: true, minHitTargetPx: 44 });
  const issues = validateAgainstPolicy(config, policy);
  assert.ok(issues.some((issue) => issue.includes('only one persistent control')), issues.join('\n'));
  assert.ok(issues.some((issue) => issue.includes('control role "submit" not allowed')), issues.join('\n'));
});

test('missing i18n keys fail the contract', () => {
  const config = baseConfig();
  const dir = fixtureRepo({ configs: { 'exam-clock': config }, i18n: 'export const t = { zone: "y" };\n', legacy: [] });
  const issues = validatePresentationContract({ repo: dir, toolSlugs: ['exam-clock'] });
  assert.ok(issues.some((issue) => issue.includes('i18n key "exitProjection" not found')), issues.join('\n'));
});

test('declared slugs must be registered tools', () => {
  const config = baseConfig();
  const dir = fixtureRepo({ configs: { 'exam-clock': config }, legacy: [] });
  const issues = validateCoverage({ repo: dir, policy, toolSlugs: [] });
  assert.ok(issues.some((issue) => issue.includes('is not a registered tool')), issues.join('\n'));
});

test('legacy slugs cannot also declare a config and must be registered', () => {
  const config = baseConfig();
  const dir = fixtureRepo({
    configs: { 'exam-clock': config },
    policyOverride: { ...policy, legacyDryRunSlugs: ['exam-clock', 'not-a-tool'] },
  });
  const issues = validateCoverage({ repo: dir, policy: { ...policy, legacyDryRunSlugs: ['exam-clock', 'not-a-tool'] }, toolSlugs: ['exam-clock'] });
  assert.ok(issues.some((issue) => issue.includes('is declared but still listed in legacyDryRunSlugs')), issues.join('\n'));
  assert.ok(issues.some((issue) => issue.includes('legacy slug "not-a-tool" is not a registered tool')), issues.join('\n'));
});

test('pipeline output cannot rely on a legacy exemption', () => {
  const dir = fixtureRepo({
    configs: {},
    policyOverride: { ...policy, legacyDryRunSlugs: ['new-tool'] },
  });
  assert.ok(requireManaged({ repo: dir, policy: { ...policy, legacyDryRunSlugs: ['new-tool'] }, slug: 'new-tool' }).length === 0);
  const fresh = fixtureRepo({ configs: {}, legacy: [] });
  assert.ok(requireManaged({ repo: fresh, policy: { ...policy, legacyDryRunSlugs: [] }, slug: 'new-tool' }).length > 0);
});

test('duplicate slot/control ids are rejected', () => {
  const config = baseConfig();
  config.primary.slots.push({ id: 'time', kind: 'date', selector: '#ecDate' });
  const issues = validateAgainstPolicy(config, policy);
  assert.ok(issues.some((issue) => issue.includes('duplicate id "time"')), issues.join('\n'));
});

test('state views may only reference declared slots and controls', () => {
  const config = baseConfig();
  config.states.primary.slots.push('missing-slot');
  config.states.primary.controls.push('missing-control');
  const issues = validateAgainstPolicy(config, policy);
  assert.ok(issues.some((issue) => issue.includes('unknown slot "missing-slot"')), issues.join('\n'));
  assert.ok(issues.some((issue) => issue.includes('unknown control "missing-control"')), issues.join('\n'));
});

test('every policy state must be declared', () => {
  const config = baseConfig();
  delete config.states.degraded;
  const issues = validateAgainstPolicy(config, policy);
  assert.ok(issues.some((issue) => issue.includes('state "degraded" must be declared')), issues.join('\n'));
});
