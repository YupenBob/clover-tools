/** Run against a temporary preview, or an explicit TEST_BASE_URL. No external services required. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { root } from './lib/build-config.mjs';
import { LOCALES, localizedPath } from '../config/routes.mjs';
import { LEGAL } from '../config/site.mjs';
import { runFpsChecks } from './lib/fps-browser-cases.mjs';
import { runToolWorkspaceChecks } from './lib/tool-workspace-browser-cases.mjs';
import { runToolDetailChecks } from './lib/tool-detail-browser-cases.mjs';
import { runDailyToolChecks } from './lib/daily-tool-browser-cases.mjs';
import { runFunToolChecks } from './lib/fun-tool-browser-cases.mjs';
import { runFocusFlightChecks } from './lib/focus-flight-browser-cases.mjs';

let server;
let browser;
let serverOutput = '';
let base = process.env.TEST_BASE_URL;
let passed = 0;
const timeout = Number(process.env.TEST_TIMEOUT_MS || 15000);

async function temporaryPort() {
  const probe = createServer();
  await new Promise((resolve, reject) =>
    probe.listen(0, '127.0.0.1', resolve).on('error', reject),
  );
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function run(name, options, action) {
  const context = await browser.newContext({ locale: 'zh-CN', ...options });
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
    passed++;
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
    const port = process.env.TEST_PORT || (await temporaryPort());
    base = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [
        join(root, 'node_modules/astro/astro.js'),
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
      ],
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
    for (const stream of [server.stdout, server.stderr])
      stream.on('data', (data) => {
        serverOutput += data;
      });
    const deadline =
      Date.now() + Number(process.env.TEST_STARTUP_TIMEOUT_MS || 60000);
    while (true) {
      if (
        await fetch(base, { signal: AbortSignal.timeout(1000) })
          .then((response) => response.ok)
          .catch(() => false)
      )
        break;
      if (Date.now() > deadline || server.exitCode !== null)
        throw new Error(`Preview failed to start: ${serverOutput}`);
      await delay(250);
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    channel:
      process.env.PLAYWRIGHT_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true,
  });

  for (const [locale, lang] of [
    ['en-US', 'en'],
    ['zh-TW', 'tw'],
    ['ko-KR', 'ko'],
    ['ja-JP', 'ja'],
    ['fr-FR', 'en'],
    ['zh-CN', 'zh'],
  ]) {
    await run(`first visit ${locale}`, { locale }, async (page) => {
      await page.goto(base + '/?q=json#tools', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForURL(base + localizedPath('/', lang) + '?q=json#tools');
      await page.locator('h1').waitFor();
      assert.equal(
        await page.locator('html').getAttribute('lang'),
        LOCALES[lang].htmlLang,
      );
    });
  }

  await run(
    'home search keeps matching tools ahead of guide discovery',
    {},
    async (page, context) => {
      await remember(context, 'zh');
      await page.goto(base + '/?q=json');
      assert.equal(await page.inputValue('#toolSearch'), 'json');
      assert.equal(await page.locator('.home-guides').isVisible(), false);
      assert.equal(
        await page
          .locator('.tool-card[href="/tools/dev/json-formatter/"]')
          .isVisible(),
        true,
      );
      await page.click('#searchClear');
      assert.equal(await page.locator('.home-guides').isVisible(), true);
    },
  );

  for (const lang of Object.keys(LOCALES)) {
    for (const kind of LEGAL.kinds) {
      await run(`${lang} ${kind} route`, {}, async (page, context) => {
        await remember(context, lang);
        const path = localizedPath(`/${kind}/`, lang);
        const response = await page.goto(base + path);
        assert.equal(response.status(), 200);
        assert.equal(new URL(page.url()).pathname, path);
        assert.equal(
          await page.locator('html').getAttribute('lang'),
          LOCALES[lang].htmlLang,
        );
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(
          await page.locator('script[src*="adsbygoogle"]').count(),
          0,
        );
      });
    }
  }

  await run(
    'untranslated guide stays readable and language switch reaches a real page',
    { locale: 'en-US' },
    async (page) => {
      const path = '/guides/json-formatting-validation/';
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200);
      assert.equal(new URL(page.url()).pathname, path);
      assert.ok((await page.locator('.article-sources a').count()) > 0);
      await page.selectOption('#langSelect', '/en/');
      await page.waitForURL(base + '/en/');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      await page.locator('.footer-links a[href="/guides/"]').click();
      await page.waitForURL(base + '/guides/');
      assert.ok((await page.locator('.guide-card').count()) > 0);
    },
  );

  await run(
    'guide to JSON tool, exact output, FAQ, and return link',
    {},
    async (page, context) => {
      await remember(context, 'zh');
      await page.goto(base + '/guides/json-formatting-validation/');
      await page.locator('.article-tool-link').click();
      await page.waitForURL(base + '/tools/dev/json-formatter/');
      await page.fill('#jsonInput', '{"user":{"id":7}}');
      await page.click('#formatBtn');
      assert.deepEqual(JSON.parse(await page.inputValue('#jsonOutput')), {
        user: { id: 7 },
      });
      const faq = page.locator('.tool-guide details').first();
      assert.deepEqual(
        JSON.parse(
          await page.locator('.example-output pre code').first().innerText(),
        ),
        { user: { id: 7, roles: ['editor'] } },
      );
      await faq.locator('summary').click();
      assert.equal(await faq.getAttribute('open'), '');
      await page
        .locator(
          '.related-guides a[href="/guides/json-formatting-validation/"]',
        )
        .click();
      await page.waitForURL(base + '/guides/json-formatting-validation/');
    },
  );

  await run(
    'translated tool metadata and traditional Chinese guide labels',
    {},
    async (page, context) => {
      await remember(context, 'tw');
      await page.goto(base + '/zh-hant/tools/dev/json-formatter/');
      assert.match(await page.locator('.tool-guide').innerText(), /使用步驟/);
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        'noindex,follow',
      );
      assert.equal(await page.locator('link[hreflang="en"]').count(), 0);
    },
  );

  const artifacts = join(root, 'output/playwright');
  mkdirSync(artifacts, { recursive: true });
  for (const [name, path] of [
    ['guides', '/guides/'],
    ['article', '/guides/json-formatting-validation/'],
    ['tool', '/tools/dev/json-formatter/'],
    ['privacy', '/privacy/'],
  ]) {
    await run(
      `mobile ${name}, theme and overflow`,
      { viewport: { width: 390, height: 844 } },
      async (page, context) => {
        await remember(context, 'zh');
        await page.goto(base + path);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
        );
        await page.click('#themeToggle');
        assert.equal(
          await page.locator('html').getAttribute('data-theme'),
          'dark',
        );
        await page.waitForFunction(() => {
          const probe = document.createElement('div');
          probe.style.color = getComputedStyle(
            document.documentElement,
          ).getPropertyValue('--bg');
          return (
            getComputedStyle(document.body).backgroundColor ===
            probe.style.color
          );
        });
        if (['article', 'tool'].includes(name))
          await page.screenshot({
            path: join(artifacts, `growth-${name}-mobile.png`),
            fullPage: true,
          });
      },
    );
  }
  await runToolWorkspaceChecks({ run, remember, base, artifacts });
  await runToolDetailChecks({ run, remember, base, artifacts });
  await runDailyToolChecks({ run, remember, base, artifacts });
  await runFunToolChecks({ run, remember, base, artifacts });
  await runFocusFlightChecks({ run, remember, base, artifacts });
  await runFpsChecks({ run, remember, base, artifacts });
  console.log(`Browser growth checks passed: ${passed} scenarios`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
