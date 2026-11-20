/**
 * Presentation-contract browser checks shared by `smoke-tool.mjs` (single tool)
 * and `tool-pipeline-cases.mjs` (CI, every managed tool). No slug branches:
 * expectations come from data/tool-presentation/<slug>.json.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { localizedPath } from '../../config/routes.mjs';
import {
  checkStateAgainstConfig,
  readPolicy,
  readPresentationConfig,
  runFirstLoadCheck,
  runPresentationState,
  snapshotInPage,
} from './presentation-check.mjs';

const shortcutFor = (config, action) => {
  const entry = Object.entries(config.interaction?.shortcuts ?? {}).find(([, value]) => value === action);
  return entry ? entry[0] : null;
};

const pathFor = (category, slug) => localizedPath(`/tools/${category}/${slug}/`, 'zh');

export function presentationContractIssues({ slug, registeredSlugs }) {
  const config = readPresentationConfig(slug);
  const policy = readPolicy();
  if (!config) {
    if ((policy.legacyDryRunSlugs ?? []).includes(slug)) return [];
    return [`tool "${slug}" has no data/tool-presentation/${slug}.json`];
  }
  if (registeredSlugs && !registeredSlugs.includes(slug)) return [`tool "${slug}" is not in the registry`];
  return [];
}

/**
 * Run the presentation suite for one tool.
 * `run`/`remember`/`base`/`artifacts` mirror the smoke runner contract.
 */
export async function runPresentationChecks({ run, remember, base, artifacts, slug, category }) {
  const policy = readPolicy();
  const config = readPresentationConfig(slug);
  const registrySlugs = Array.isArray(arguments[0]?.registeredSlugs) ? arguments[0].registeredSlugs : null;
  const contractIssues = presentationContractIssues({ slug, registeredSlugs: registrySlugs });
  if (!config) {
    if (contractIssues.length) throw new Error(contractIssues.join('; '));
    return { skipped: true };
  }
  if (contractIssues.length) throw new Error(contractIssues.join('; '));

  const url = base + pathFor(category, slug);
  await run(`presentation-contract:${slug}`, {}, async () => {
    if (!isValid(config)) throw new Error('presentation config is not usable');
  });

  await run(`presentation-first-load:${slug}`, {}, async (page, context) => {
    await remember(context, 'zh');
    const { issues, blockedScripts } = await runFirstLoadCheck({ page, url, config });
    assert.equal(blockedScripts > 0, true, 'first-load check must block scripts to observe the SSR state');
    assert.deepEqual(issues, []);
    await page.screenshot({ path: join(artifacts, `presentation-${slug}-first-load.png`), fullPage: false });
  });

  await run(`presentation-primary:${slug}`, {}, async (page, context) => {
    await remember(context, 'zh');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const { runtime, issues } = await runPresentationState({ page, config, state: 'primary' });
    assert.deepEqual(issues, []);
    assert.ok(runtime.texts.length > 0, 'primary mode must show at least the declared slots');
    await page.screenshot({ path: join(artifacts, `presentation-${slug}-primary.png`), fullPage: false });
  });

  const revealTrigger = (config.interaction?.revealTriggers ?? []).includes('pointer') ? 'pointer' : null;
  await run(`presentation-reveal:${slug}`, {}, async (page, context) => {
    await remember(context, 'zh');
    await page.clock.install();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await runPresentationState({ page, config, state: 'primary' });
    if (revealTrigger === 'pointer') await page.mouse.move(20, 20);
    const { issues } = await runPresentationState({ page, config, state: 'reveal' });
    assert.deepEqual(issues, []);
    const autoHide = Number(config.interaction?.autoHideMs ?? 0);
    if (autoHide > 0) {
      await page.clock.fastForward(autoHide + 100);
      await runPresentationState({ page, config, state: 'primary' });
    }
  });

  const settingsKey = shortcutFor(config, 'settings');
  await run(`presentation-settings:${slug}`, {}, async (page, context) => {
    await remember(context, 'zh');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await runPresentationState({ page, config, state: 'primary' });
    if (!settingsKey) throw new Error('config must declare a settings shortcut');
    await page.keyboard.press(settingsKey);
    const { runtime, issues } = await runPresentationState({ page, config, state: 'settingsOpen' });
    assert.deepEqual(issues, []);
    await page.keyboard.press(settingsKey);
    await runPresentationState({ page, config, state: 'primary' });
    assert.ok(runtime.announcements.every((text) => typeof text === 'string'));
  });

  await run(`presentation-degraded:${slug}`, {}, async (page, context) => {
    await remember(context, 'zh');
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'wakeLock', {
        value: { request: () => Promise.reject(new Error('denied')) },
        configurable: true,
      });
    });
    await page.route('**/api/**', (route) => route.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const before = await page.evaluate(snapshotInPage);
    await page.waitForTimeout(300);
    const runtime = await page.evaluate(snapshotInPage);
    const issues = checkStateAgainstConfig({ config, state: 'primary', runtime });
    assert.deepEqual(issues, []);
    assert.ok(runtime.texts.length <= before.texts.length + 1, 'degraded mode may not add visible copy to the primary view');
  });

  const fullscreenKey = shortcutFor(config, 'fullscreen');
  if (fullscreenKey) {
    await run(`presentation-fullscreen:${slug}`, {}, async (page, context) => {
      await remember(context, 'zh');
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await runPresentationState({ page, config, state: 'primary' });
      await page.keyboard.press(fullscreenKey);
      const mode = await page.evaluate(() => document.querySelector('[data-presentation-state]')?.getAttribute('data-presentation-mode'));
      assert.ok(mode === 'fullscreen' || mode === 'fallback', `expected fullscreen or fallback mode, got "${mode}"`);
      const state = await page.evaluate(() => document.querySelector('[data-presentation-state]')?.getAttribute('data-presentation-state'));
      if (state === 'fullscreen') {
        const { issues } = await runPresentationState({ page, config, state: 'fullscreen' });
        assert.deepEqual(issues, []);
      }
    });
  }

  return { skipped: false };
}

function isValid(config) {
  return Boolean(config?.version === 1 && config.primary?.root && config.states?.primary);
}
