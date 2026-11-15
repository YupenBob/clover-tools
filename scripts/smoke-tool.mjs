#!/usr/bin/env node
/**
 * Single-tool browser regression used by the nightly tool pipeline.
 *
 * It boots a preview of the current build, loads the new tool in all five
 * languages, and runs scripts/lib/tool-cases/<slug>.mjs (written by the Builder).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { root } from './lib/build-config.mjs';
import { LOCALES, localizedPath } from '../config/routes.mjs';

function parseArgs(argv) {
  const options = { slug: '', artifacts: '', port: '', timeout: '', category: 'daily' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[++index] ?? '';
    else if (arg === '--artifacts') options.artifacts = argv[++index] ?? '';
    else if (arg === '--port') options.port = argv[++index] ?? '';
    else if (arg === '--timeout') options.timeout = argv[++index] ?? '';
    else if (arg === '--category') options.category = argv[++index] ?? 'daily';
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.slug) throw new Error('smoke-tool requires --slug');
  return options;
}

function findChromium() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH && existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }
  const base = join(root, '.playwright-browsers');
  if (existsSync(base)) {
    for (const entry of readdirSync(base)) {
      const candidate = join(base, entry, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  for (const candidate of ['/usr/bin/chromium', '/snap/bin/chromium']) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) =>
    probe.listen(0, '127.0.0.1', resolve).on('error', reject),
  );
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const options = parseArgs(process.argv.slice(2));
const artifacts =
  options.artifacts || join(root, 'output/tool-pipeline', options.slug);
mkdirSync(artifacts, { recursive: true });
const timeout = Number(options.timeout || process.env.TEST_TIMEOUT_MS || 20000);
let base = process.env.TEST_BASE_URL;
let server;
let browser;
let passed = 0;
let serverOutput = '';

async function run(name, contextOptions, action) {
  const context = await browser.newContext({ locale: 'zh-CN', ...contextOptions });
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await action(page, context);
    assert.deepEqual(errors, [], 'unexpected browser script errors');
    console.log(`PASS ${name}`);
    passed += 1;
  } catch (error) {
    try {
      await page.screenshot({ path: join(artifacts, `FAIL-${name.replace(/[^\w.-]+/g, '_')}.png`) });
    } catch {
      /* screenshot is best effort */
    }
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  } finally {
    await context.close();
  }
}

async function remember(context, lang) {
  await context.addInitScript(
    (value) => localStorage.setItem('clover-lang', value),
    lang,
  );
}

try {
  if (!base) {
    const port = options.port || process.env.TEST_PORT || (await freePort());
    base = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [join(root, 'node_modules/astro/astro.js'), 'preview', '--host', '127.0.0.1', '--port', String(port)],
      {
        cwd: root,
        windowsHide: true,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    server.on('error', (error) => {
      serverOutput += error.message;
    });
    for (const stream of [server.stdout, server.stderr]) {
      stream.on('data', (data) => {
        serverOutput += data;
      });
    }
    const deadline = Date.now() + Number(process.env.TEST_STARTUP_TIMEOUT_MS || 60000);
    while (true) {
      if (
        await fetch(base, { signal: AbortSignal.timeout(1000) })
          .then((response) => response.ok)
          .catch(() => false)
      ) {
        break;
      }
      if (Date.now() > deadline || server.exitCode !== null) {
        throw new Error(`Preview failed to start: ${serverOutput}`);
      }
      await delay(250);
    }
  }

  const executablePath = findChromium();
  browser = await chromium.launch({
    ...(executablePath
      ? { executablePath }
      : { channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  });

  const category = options.category || 'daily';
  const toolModule = join(root, 'scripts/lib/tool-cases', `${options.slug}.mjs`);
  if (!existsSync(toolModule)) {
    throw new Error(`missing browser case: ${toolModule}`);
  }
  const module = await import(pathToFileURL(toolModule).href);
  if (typeof module.run !== 'function') {
    throw new Error(`${toolModule} must export run({ run, remember, base, artifacts })`);
  }

  for (const lang of Object.keys(LOCALES)) {
    const path = localizedPath(`/tools/${category}/${options.slug}/`, lang);
    await run(`${lang} page loads with canonical and metadata`, { locale: LOCALES[lang].htmlLang }, async (page, context) => {
      await remember(context, lang);
      const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      const langAttr = await page.locator('html').getAttribute('lang');
      assert.equal(langAttr, LOCALES[lang].htmlLang);
      const title = await page.title();
      assert.ok(title.length > 0, 'title is empty');
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      assert.ok(description && description.length > 0, 'description is empty');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.ok(canonical && canonical.endsWith(path), `canonical mismatch: ${canonical}`);
      await page.screenshot({
        path: join(artifacts, `tool-${lang}-desktop.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  await run('mobile 360px fits the viewport', { viewport: { width: 360, height: 800 } }, async (page, context) => {
    await remember(context, 'zh');
    await page.goto(base + localizedPath(`/tools/${category}/${options.slug}/`, 'zh'));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    assert.equal(overflow, false, 'horizontal overflow at 360px');
    await page.screenshot({ path: join(artifacts, 'tool-zh-mobile.png'), fullPage: true });
  });

  await module.run({ run, remember, base, artifacts });
  console.log(`Tool browser checks passed: ${passed} scenarios (${options.slug})`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
