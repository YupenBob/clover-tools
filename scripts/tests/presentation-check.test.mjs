import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAppearance, checkStateAgainstConfig } from '../lib/presentation-check.mjs';

const config = {
  slug: 'fixture-tool',
  profile: 'projector',
  primary: {
    root: '#root',
    slots: [{ id: 'time', kind: 'time', selector: '#time', format: { pattern: '^\\d{2}:\\d{2}$' } }],
  },
  controls: [{ id: 'exit', role: 'exit', selector: '#exit', persistent: true, iconOnly: true }],
  appearance: { maxBackgroundLuminance: 0.02, minPrimaryFontVh: 20 },
  states: {
    primary: { slots: ['time'], controls: ['exit'] },
    settingsOpen: { slots: ['time'], controls: ['exit'], allowText: true },
  },
  renderSurfaces: [{ kind: 'text', selector: '#time' }],
};

const runtime = (overrides = {}) => ({
  state: 'primary',
  background: 'rgb(0, 0, 0)',
  texts: [{ text: '09:30', selector: 'span#time', rect: { h: 240 } }],
  interactives: [{ selector: 'button#exit', text: '', ariaLabel: '退出大屏' }],
  surfaces: [{ kind: 'text', selector: 'span#time' }],
  scroll: { width: 1280, height: 720, viewportWidth: 1280, viewportHeight: 720 },
  announcements: [],
  ...overrides,
});

test('a compliant primary snapshot passes', () => {
  assert.deepEqual(checkStateAgainstConfig({ config, state: 'primary', runtime: runtime() }), []);
});

test('extra visible text fails the primary state', () => {
  const issues = checkStateAgainstConfig({
    config,
    state: 'primary',
    runtime: runtime({ texts: [...runtime().texts, { text: '考试进行中', selector: 'p#note', rect: { h: 20 } }] }),
  });
  assert.ok(issues.some((issue) => issue.includes('unexpected visible text "考试进行中"')));
});

test('extra interactive elements fail the primary state', () => {
  const issues = checkStateAgainstConfig({
    config,
    state: 'primary',
    runtime: runtime({ interactives: [...runtime().interactives, { selector: 'button#settings', text: '' }] }),
  });
  assert.ok(issues.some((issue) => issue.includes('unexpected interactive element button#settings')));
});

test('an undeclared render surface fails even when the DOM text is clean', () => {
  const issues = checkStateAgainstConfig({
    config,
    state: 'primary',
    runtime: runtime({ surfaces: [...runtime().surfaces, { kind: 'canvas', selector: 'canvas#c' }] }),
  });
  assert.ok(issues.some((issue) => issue.includes('undeclared render surface canvas')));
});

test('a blank primary view fails because the declared slot is empty', () => {
  const issues = checkStateAgainstConfig({ config, state: 'primary', runtime: runtime({ texts: [], surfaces: [] }) });
  assert.ok(issues.some((issue) => issue.includes('has no visible text')));
});

test('a wrong time format fails', () => {
  const issues = checkStateAgainstConfig({
    config,
    state: 'primary',
    runtime: runtime({ texts: [{ text: '9:30:05', selector: 'span#time', rect: { h: 240 } }] }),
  });
  assert.ok(issues.some((issue) => issue.includes('does not match')));
});

test('settingsOpen may show explanatory text but still forbids undeclared surfaces', () => {
  const base = runtime({ state: 'settingsOpen', texts: [...runtime().texts, { text: '设置', selector: 'h2#settings', rect: { h: 24 } }] });
  assert.deepEqual(checkStateAgainstConfig({ config, state: 'settingsOpen', runtime: base }), []);
  const issues = checkStateAgainstConfig({ config, state: 'settingsOpen', runtime: { ...base, surfaces: [...base.surfaces, { kind: 'img', selector: 'img#logo' }] } });
  assert.ok(issues.some((issue) => issue.includes('undeclared render surface img')));
});

test('a bright background or small clock fails the appearance check', () => {
  const bright = checkAppearance({ config, runtime: runtime({ background: 'rgb(255, 255, 255)' }), viewportHeight: 720 });
  assert.ok(bright.some((issue) => issue.includes('background luminance')));
  const small = checkAppearance({ config, runtime: runtime({ texts: [{ text: '09:30', selector: 'span#time', rect: { h: 100 } }] }), viewportHeight: 720 });
  assert.ok(small.some((issue) => issue.includes('below 20vh')));
});

test('scrolling pages fail the projector profile', () => {
  const issues = checkAppearance({ config, runtime: runtime({ scroll: { width: 1280, height: 2000, viewportWidth: 1280, viewportHeight: 720 } }), viewportHeight: 720 });
  assert.ok(issues.some((issue) => issue.includes('page scrolls')));
});
