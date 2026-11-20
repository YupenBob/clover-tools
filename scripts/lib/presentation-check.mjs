/**
 * Browser-side scanner for the "primary mode" presentation contract.
 *
 * Used by every entry point (single-tool smoke, CI smoke-growth, pipeline gates)
 * so a tool cannot pass one runner and fail another. Tool specific expectations
 * come from data/tool-presentation/<slug>.json; nothing here branches by slug.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { root } from './build-config.mjs';

export const PRESENTATION_DIR = join(root, 'data/tool-presentation');
export const POLICY_PATH = join(root, 'config/presentation-policy.json');

export const hasPresentationConfig = (slug) => existsSync(join(PRESENTATION_DIR, `${slug}.json`));
export const readPresentationConfig = (slug) =>
  existsSync(join(PRESENTATION_DIR, `${slug}.json`))
    ? JSON.parse(readFileSync(join(PRESENTATION_DIR, `${slug}.json`), 'utf8'))
    : null;
export const readPolicy = () => JSON.parse(readFileSync(POLICY_PATH, 'utf8'));

/** Executed inside the page: enumerate everything that can be seen or clicked. */
export function snapshotInPage() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'TITLE', 'LINK']);
  const view = window.innerWidth && window.innerHeight ? { w: window.innerWidth, h: window.innerHeight } : { w: 1280, h: 720 };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.getAttribute('class');
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls.split(/\s+/).filter(Boolean).join('.')}` : ''}`;
  };
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= view.w || rect.top >= view.h) return false;
    return true;
  };
  const covered = (el, rect) => {
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), view.w - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 0), view.h - 1);
    const top = document.elementFromPoint(x, y);
    if (!top) return false;
    return !(top === el || el.contains(top) || top.contains(el));
  };
  const texts = [];
  const interactives = [];
  const surfaces = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? '';
    if (!value.trim()) continue;
    const parent = node.parentElement;
    if (!parent || SKIP.has(parent.tagName)) continue;
    if (!visible(parent)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    const rect = rects.find((r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < view.w && r.top < view.h);
    if (!rect) continue;
    if (covered(parent, rect)) continue;
    texts.push({ text: value.trim(), selector: describe(parent), rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) } });
    range.detach?.();
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [tabindex], [contenteditable="true"]')) {
    if (!visible(el)) continue;
    interactives.push({
      selector: describe(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      text: (el.textContent ?? '').trim().slice(0, 40),
      ariaLabel: el.getAttribute('aria-label'),
      testId: el.getAttribute('data-presentation-control'),
      rect: (() => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    });
  }
  for (const el of document.querySelectorAll('svg text, svg tspan')) {
    if (visible(el) && (el.textContent ?? '').trim()) surfaces.push({ kind: 'svgText', selector: describe(el) });
  }
  for (const el of document.querySelectorAll('img, svg image, canvas')) {
    if (visible(el)) surfaces.push({ kind: el.tagName.toLowerCase() === 'img' ? 'img' : el.tagName.toLowerCase() === 'canvas' ? 'canvas' : 'svgImage', selector: describe(el) });
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const style = getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none') surfaces.push({ kind: 'backgroundImage', selector: describe(el) });
    for (const pseudo of ['::before', '::after']) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== 'none' && content !== 'normal' && !['""', "''"].includes(content)) surfaces.push({ kind: 'pseudoContent', selector: `${describe(el)}${pseudo}` });
    }
  }
  const background = getComputedStyle(document.body).backgroundColor;
  const root = document.querySelector('[data-presentation-state]');
  return {
    state: root?.getAttribute('data-presentation-state') ?? null,
    mode: root?.getAttribute('data-presentation-mode') ?? null,
    background,
    texts,
    interactives,
    surfaces,
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: view.w, viewportHeight: view.h },
    announcements: [...document.querySelectorAll('[aria-live]')].map((el) => (el.textContent ?? '').trim()).filter(Boolean),
  };
}

const luminance = (color) => {
  const match = String(color).match(/[\d.]+/g);
  if (!match || match.length < 3) return null;
  const [r, g, b] = match.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const selectorFor = (token) => (token.startsWith('#') || token.startsWith('.') ? token : `#${token}`);
/** Runtime descriptions are `tag#id.class`; config selectors are `#id`. */
const matchesSelector = (runtimeSelector, configSelector) =>
  runtimeSelector === configSelector ||
  runtimeSelector.endsWith(configSelector) ||
  runtimeSelector.includes(`${configSelector}::`) ||
  (configSelector.startsWith('#') && runtimeSelector.includes(configSelector));

/**
 * Assert one presentation state against its declaration.
 * `state` is the state name in the config; `runtime` is snapshotInPage output.
 */
export function checkStateAgainstConfig({ config, state, runtime, allowStateNames = null }) {
  const issues = [];
  const fail = (message) => issues.push(`${config.slug}/${state}: ${message}`);
  const view = config.states?.[state];
  if (!view) return [`${config.slug}: state "${state}" is not declared`];
  const acceptedStates = allowStateNames ?? [state];
  if (!acceptedStates.includes(runtime.state)) fail(`page reports data-presentation-state="${runtime.state}"`);
  const slots = (view.slots ?? []).map((id) => config.primary.slots.find((slot) => slot.id === id)).filter(Boolean);
  const controls = (view.controls ?? []).map((id) => (config.controls ?? []).find((control) => control.id === id)).filter(Boolean);
  const slotSelectors = new Set(slots.map((slot) => selectorFor(slot.selector ?? slot.id)));
  const controlSelectors = new Set(controls.map((control) => selectorFor(control.selector)));
  const allowedText = new Set();
  for (const slot of slots) {
    const selector = selectorFor(slot.selector ?? slot.id);
    const matches = runtime.texts.filter((entry) => matchesSelector(entry.selector, selector));
    if (!matches.length) fail(`slot "${slot.id}" (${selector}) has no visible text`);
    for (const match of matches) {
      allowedText.add(match.text);
      if (slot.format?.pattern && !new RegExp(slot.format.pattern, 'u').test(match.text)) fail(`slot "${slot.id}" text "${match.text}" does not match ${slot.format.pattern}`);
    }
  }
  if (!view.allowText) {
    for (const entry of runtime.texts) if (!allowedText.has(entry.text)) fail(`unexpected visible text "${entry.text}" in ${entry.selector}`);
  }
  if (!view.allowInteractives) {
    for (const item of runtime.interactives) {
      const declared = [...controlSelectors].some((selector) => matchesSelector(item.selector, selector));
      if (!declared) fail(`unexpected interactive element ${item.selector}`);
    }
  }
  for (const control of controls) {
    const selector = selectorFor(control.selector);
    const found = runtime.interactives.some((item) => matchesSelector(item.selector, selector));
    if (!found) fail(`declared control "${control.id}" (${selector}) is not visible`);
  }
  const declaredSurfaces = new Set((config.renderSurfaces ?? []).map((surface) => surface.kind));
  const policy = readPolicy();
  const profile = policy.profiles?.[config.profile] ?? {};
  const allowedSurfaces = new Set([...(profile.allowedRenderSurfaces ?? []), ...declaredSurfaces]);
  for (const surface of runtime.surfaces) {
    if (!allowedSurfaces.has(surface.kind)) fail(`undeclared render surface ${surface.kind} at ${surface.selector}`);
  }
  return issues;
}

export function checkAppearance({ config, runtime, viewportHeight }) {
  const issues = [];
  const profile = (readPolicy().profiles ?? {})[config.profile] ?? {};
  const maxLuminance = Math.min(
    Number(config.appearance?.maxBackgroundLuminance ?? 1),
    Number(profile.appearance?.maxBackgroundLuminance ?? 1),
  );
  const actual = luminance(runtime.background);
  if (actual === null) issues.push(`${config.slug}: unreadable background color "${runtime.background}"`);
  else if (actual > maxLuminance) issues.push(`${config.slug}: background luminance ${actual.toFixed(3)} exceeds ${maxLuminance}`);
  const minFontVh = Math.max(
    Number(config.appearance?.minPrimaryFontVh ?? 0),
    Number(profile.appearance?.minPrimaryFontVh ?? 0),
  );
  const primarySlot = config.primary.slots.find((slot) => slot.kind === 'time');
  if (primarySlot && viewportHeight) {
    const selector = selectorFor(primarySlot.selector);
    const entry = runtime.texts.find((item) => matchesSelector(item.selector, selector));
    if (entry) {
      const ratio = (entry.rect.h / viewportHeight) * 100;
      if (ratio + 0.5 < minFontVh) issues.push(`${config.slug}: primary time is ${ratio.toFixed(1)}vh, below ${minFontVh}vh`);
    }
  }
  if (profile.appearance?.forbidScroll && (runtime.scroll.width > runtime.scroll.viewportWidth || runtime.scroll.height > runtime.scroll.viewportHeight)) {
    issues.push(`${config.slug}: page scrolls (${runtime.scroll.width}x${runtime.scroll.height} vs ${runtime.scroll.viewportWidth}x${runtime.scroll.viewportHeight})`);
  }
  return issues;
}

/** Full deterministic state check for one page instance. */
export async function runPresentationState({ page, config, state, timeoutMs = 5000 }) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-presentation-state]')?.getAttribute('data-presentation-state') === expected,
    state,
    { timeout: timeoutMs },
  );
  const runtime = await page.evaluate(snapshotInPage);
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  return {
    runtime,
    issues: [...checkStateAgainstConfig({ config, state, runtime }), ...(state === 'primary' ? checkAppearance({ config, runtime, viewportHeight: viewport.height }) : [])],
  };
}

/** Capture the SSR state with JS disabled (first paint / no hydration). */
export async function runFirstLoadCheck({ page, url, config }) {
  const blocked = [];
  await page.route('**/*', (route) => {
    const request = route.request();
    if (request.resourceType() === 'script') {
      blocked.push(request.url());
      return route.abort();
    }
    return route.continue();
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response?.status() ?? 0;
  const marker = await page.evaluate(
    (selector) => Boolean(document.querySelector(selector)?.getAttribute('data-presentation-state')),
    config.primary.root,
  );
  const runtime = await page.evaluate(snapshotInPage);
  const issues = [];
  if (status !== 200) issues.push(`${config.slug}/firstLoad: HTTP ${status}`);
  if (!marker) issues.push(`${config.slug}/firstLoad: primary root has no data-presentation-state in SSR`);
  issues.push(...checkStateAgainstConfig({ config, state: 'firstLoad', runtime, allowStateNames: ['firstLoad', 'primary'] }));
  await page.unroute('**/*');
  return { runtime, issues, blockedScripts: blocked.length };
}
