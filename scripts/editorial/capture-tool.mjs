#!/usr/bin/env node
/**
 * 浏览器能力探针 / 文章截图捕获。
 *   node scripts/editorial/capture-tool.mjs --probe
 *   node scripts/editorial/capture-tool.mjs --slug <slug>
 * 截图用例脚本位于 scripts/editorial/cases/<slug>.mjs（默认导出 async 函数）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { ensureStateDirs } from './lib/state.mjs';
import { captureShot, launchBrowser, resolveExecutable, startDevServer, waitForServer } from './lib/browser.mjs';

function parseArgs(argv) {
  const options = { probe: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--probe') options.probe = true;
    else if (arg === '--slug') options.slug = argv[index + 1];
  }
  return options;
}

async function probe() {
  const executablePath = await resolveExecutable();
  if (!executablePath) throw new Error('未找到 Chromium；请先安装到 .playwright-browsers 或设置 PLAYWRIGHT_EXECUTABLE_PATH');
  const browser = await launchBrowser();
  try {
    const version = browser.version();
    console.log(JSON.stringify({ ok: true, executablePath, version }, null, 2));
  } finally {
    await browser.close();
  }
}

async function capture(slug) {
  ensureStateDirs();
  ensureDefaultConfig();
  const config = loadConfig();
  const draftDir = join(STATE_PATHS.drafts, slug);
  const imagesDir = join(draftDir, 'images');
  mkdirSync(imagesDir, { recursive: true });
  const casePath = join(ROOT, 'scripts', 'editorial', 'cases', `${slug}.mjs`);
  if (!existsSync(casePath)) throw new Error(`截图用例不存在：scripts/editorial/cases/${slug}.mjs`);

  const server = startDevServer({ port: config.capture.devServerPort });
  let browser = null;
  let context = null;
  const entries = [];
  try {
    await waitForServer(config.capture.baseUrl, { timeoutMs: 90000 });
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: config.capture.viewport,
      locale: 'zh-CN',
      colorScheme: 'light',
      acceptDownloads: false,
    });
    await context.addInitScript(() => {
      localStorage.setItem('clover-lang', 'zh');
      localStorage.setItem('clover-theme', 'light');
      localStorage.setItem('ct-sfx', 'off');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const shot = async (locator, name, meta = {}) => {
      const file = `${slug}-${name}`;
      const filePath = join(imagesDir, file);
      const entry = await captureShot(page, locator, filePath, { file, slug, ...meta });
      entries.push(entry);
      return entry;
    };
    const module = await import(pathToFileURL(casePath).href);
    if (typeof module.default !== 'function') throw new Error(`${casePath} 需要默认导出一个 async 函数`);
    await module.default({ page, browser, base: config.capture.baseUrl, shot, config });
    if (entries.length === 0) throw new Error('用例未产生任何截图');
    writeFileSync(join(draftDir, 'captures.json'), `${JSON.stringify(entries, null, 2)}\n`);
    writeFileSync(
      join(draftDir, 'capture-log.json'),
      `${JSON.stringify({ ok: true, finishedAt: new Date().toISOString(), captures: entries, serverLog: server.logs.join('').slice(-4000) }, null, 2)}\n`,
    );
    console.log(JSON.stringify({ ok: true, slug, captures: entries.map((entry) => ({ file: entry.file, width: entry.width, height: entry.height })) }, null, 2));
  } catch (error) {
    writeFileSync(
      join(draftDir, 'capture-log.json'),
      `${JSON.stringify({ ok: false, finishedAt: new Date().toISOString(), error: String(error.message ?? error), serverLog: server.logs.join('').slice(-6000) }, null, 2)}\n`,
    );
    throw error;
  } finally {
    try {
      await context?.close();
    } catch {
      // ignore
    }
    try {
      await browser?.close();
    } catch {
      // ignore
    }
    server.stop();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    if (options.probe) await probe();
    else if (options.slug) await capture(options.slug);
    else throw new Error('用法：capture-tool.mjs --probe | --slug <slug>');
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}

main();
