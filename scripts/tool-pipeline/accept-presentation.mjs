#!/usr/bin/env node
/**
 * Presentation-contract acceptance.
 *
 * Proves the gate is config driven and cannot be bypassed by deleting cases or
 * loosening numbers. Writes data/tool-presentation/acceptance.json only when
 * every check passes (invalidating the previous artifact first).
 *
 * Usage:
 *   node scripts/tool-pipeline/accept-presentation.mjs            # run, print
 *   node scripts/tool-pipeline/accept-presentation.mjs --write    # run + write artifact
 *   node scripts/tool-pipeline/accept-presentation.mjs --check    # verify current artifact
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { REPO } from './lib/paths.mjs';
import {
  POLICY_FILE,
  SCHEMA_FILE,
  CONFIG_DIR,
  loadPolicy,
  loadSchema,
  validatePresentationContract,
} from './lib/presentation.mjs';
import { registeredToolSlugs } from './lib/tool-registry.mjs';
import { checkStateAgainstConfig, readPresentationConfig, snapshotInPage } from '../lib/presentation-check.mjs';
import { findChromium } from '../lib/browser.mjs';

const FIXTURES = join(REPO, 'scripts/tests/fixtures/presentation');
const ARTIFACT = join(REPO, CONFIG_DIR, 'acceptance.json');

const hashes = () => ({
  policy: sha(join(REPO, POLICY_FILE)),
  schema: sha(join(REPO, SCHEMA_FILE)),
  checker: sha(join(REPO, 'scripts/lib/presentation-check.mjs')),
  cases: sha(join(REPO, 'scripts/lib/presentation-cases.mjs')),
  validator: sha(join(REPO, 'scripts/tool-pipeline/lib/presentation.mjs')),
  fixtures: Object.fromEntries(
    readFileSync(join(FIXTURES, 'manifest.json'), 'utf8')
      ? JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8')).fixtures.map((entry) => [entry.file, sha(join(FIXTURES, entry.file))])
      : [],
  ),
});

function sha(path) {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

function fakeRepo({ config = {}, policyOverride = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'clover-accept-'));
  mkdirSync(join(dir, 'config', 'schemas'), { recursive: true });
  mkdirSync(join(dir, 'data', 'tool-presentation'), { recursive: true });
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  writeFileSync(join(dir, POLICY_FILE), JSON.stringify(policyOverride ?? { ...loadPolicy(REPO), legacyDryRunSlugs: [] }));
  writeFileSync(join(dir, SCHEMA_FILE), JSON.stringify(loadSchema(REPO)));
  writeFileSync(join(dir, 'src/lib/fake-i18n.ts'), 'export const t = { exitProjection: "exit", zone: "z", fullscreen: "f" };\n');
  if (config && Object.keys(config).length) {
    writeFileSync(join(dir, CONFIG_DIR, `${config.slug}.json`), JSON.stringify(config));
  }
  return dir;
}

const fakeConfig = (patch = {}) => ({
  version: 1,
  slug: 'fake-tool',
  profile: 'projector',
  i18n: { module: 'src/lib/fake-i18n.ts', requiredKeys: ['exitProjection'] },
  primary: {
    root: '#fakeRoot',
    slots: [{ id: 'time', kind: 'time', selector: '#fakeTime', required: true, format: { pattern: '^\\d{2}:\\d{2}$', hourCycle: 'h23', showSeconds: false, timeZone: 'Asia/Shanghai', withinMs: 60000 } }],
  },
  controls: [{ id: 'exit', role: 'exit', selector: '#fakeExit', persistent: true, iconOnly: true, i18nKey: 'exitProjection', minHitTargetPx: 44, placement: 'top-right' }],
  appearance: { maxBackgroundLuminance: 0.02, minPrimaryFontVh: 20, foreground: '#ffffff', background: '#000000' },
  interaction: { autoHideMs: 3000, revealTriggers: ['pointer'], settingsInitiallyOpen: false, shortcuts: { F: 'fullscreen', C: 'settings' } },
  timing: { readyWithinMs: 3000, requireAdvancingTime: true },
  errors: { visualChannel: 'hidden', announcement: 'aria-live', interruptPrimary: false },
  states: {
    firstLoad: { slots: ['time'], controls: ['exit'] },
    primary: { slots: ['time'], controls: ['exit'] },
    reveal: { slots: ['time'], controls: ['exit'] },
    settingsOpen: { slots: ['time'], controls: ['exit'], allowText: true },
    degraded: { slots: ['time'], controls: ['exit'] },
    fullscreen: { slots: ['time'], controls: ['exit'] },
  },
  renderSurfaces: [{ kind: 'text', selector: '#fakeTime', purpose: 'content' }],
  ...patch,
});

function checkA() {
  const dir = fakeRepo({ config: fakeConfig() });
  try {
    const issues = validatePresentationContract({ repo: dir, toolSlugs: ['fake-tool'] });
    assert.deepEqual(issues, [], `fake tool should validate without touching gate code: ${issues.join('; ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkB() {
  const dir = fakeRepo({
    config: fakeConfig({ appearance: { maxBackgroundLuminance: 0.9, minPrimaryFontVh: 2 } }),
  });
  try {
    const issues = validatePresentationContract({ repo: dir, toolSlugs: ['fake-tool'] });
    assert.ok(issues.some((issue) => issue.includes('background luminance')), 'loosened luminance must fail');
    assert.ok(issues.some((issue) => issue.includes('primary font')), 'loosened font size must fail');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkD() {
  const modules = [
    'scripts/lib/presentation-check.mjs',
    'scripts/lib/presentation-cases.mjs',
    'scripts/tool-pipeline/lib/presentation.mjs',
  ];
  const issues = [];
  for (const file of modules) {
    const source = readFileSync(join(REPO, file), 'utf8');
    if (/slug\s*===\s*['"]/.test(source)) issues.push(`${file}: per-tool slug branch`);
    if (/assert\.[a-z]+\([^)]*[\u4e00-\u9fff]/u.test(source)) issues.push(`${file}: localized assertion text`);
    if (/\b(3000|0\.05|20)\b/.test(source) && !/autoHideMs|minPrimaryFontVh|maxBackgroundLuminance|timeout|1000|600/.test(source))
      issues.push(`${file}: suspicious threshold literal`);
  }
  assert.deepEqual(issues, []);
}

async function checkFixtures() {
  const manifest = JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8'));
  const executablePath = findChromium();
  assert.ok(executablePath, 'Chromium is required for acceptance (install browsers or set PLAYWRIGHT_EXECUTABLE_PATH)');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const config = fakeConfig();
  const results = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    for (const fixture of manifest.fixtures) {
      const html = readFileSync(join(FIXTURES, fixture.file), 'utf8');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const runtime = await page.evaluate(snapshotInPage);
      const issues = checkStateAgainstConfig({ config, state: 'primary', runtime });
      const failed = issues.length > 0;
      results[fixture.file] = failed;
      assert.equal(failed, fixture.expect === 'fail', `${fixture.file}: expected ${fixture.expect}, got ${failed ? 'fail' : 'pass'} (${issues.join('; ')})`);
    }
    await page.close();
  } finally {
    await browser.close();
  }
  return results;
}

function checkC() {
  const dir = fakeRepo({ config: fakeConfig({ primary: { ...fakeConfig().primary, slots: [{ ...fakeConfig().primary.slots[0], format: { pattern: '^\\d{2}:\\d{2}Z$', hourCycle: 'h23', timeZone: 'Asia/Shanghai', withinMs: 60000 } }] } }) });
  try {
    const issues = validatePresentationContract({ repo: dir, toolSlugs: ['fake-tool'] });
    assert.deepEqual(issues, [], 'changing declared format must stay valid as long as it is within policy');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  const current = hashes();
  if (check) {
    assert.ok(existsSync(ARTIFACT), 'acceptance artifact missing');
    const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
    assert.equal(artifact.valid, true, 'acceptance artifact is invalidated');
    for (const [key, value] of Object.entries(current.sources ?? {})) assert.equal(artifact.hashes?.[key], value, `hash drift on ${key}`);
    console.log('acceptance artifact is current');
    return;
  }
  // Invalidate the previous credential before running anything.
  if (existsSync(ARTIFACT)) {
    const previous = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
    writeFileSync(ARTIFACT, JSON.stringify({ ...previous, valid: false, invalidatedAt: new Date().toISOString() }, null, 2) + '\n');
  }
  checkD();
  checkA();
  checkB();
  checkC();
  const fixtures = await checkFixtures();
  const registry = registeredToolSlugs();
  const contract = validatePresentationContract({ toolSlugs: registry });
  assert.deepEqual(contract, [], `shipped contract: ${contract.join('; ')}`);
  const artifact = {
    version: 1,
    valid: true,
    contractVersion: loadPolicy(REPO).version,
    policyVersion: loadPolicy(REPO).version,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
    passedAt: new Date().toISOString(),
    checks: { fakeTool: true, loosenedConfigRejected: true, configDriven: true, fixtureMatrix: true, shippedContract: true, registryCoverage: true },
    fixtures,
    hashes: { sources: { policy: current.policy, schema: current.schema, checker: current.checker, cases: current.cases, validator: current.validator }, fixtures: current.fixtures },
  };
  if (write) {
    const tmp = `${ARTIFACT}.tmp`;
    writeFileSync(tmp, JSON.stringify(artifact, null, 2) + '\n');
    renameSync(tmp, ARTIFACT);
    console.log(`acceptance written: ${ARTIFACT}`);
  } else {
    console.log(JSON.stringify(artifact, null, 2));
  }
}

main().catch((error) => {
  console.error(`ACCEPTANCE FAILED: ${error.message ?? error}`);
  process.exit(1);
});
