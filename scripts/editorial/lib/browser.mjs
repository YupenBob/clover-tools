/** 浏览器能力封装：Playwright Chromium 启动、本地 dev server、截图记录。 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';
import { loadConfig } from './config.mjs';

let playwrightModule = null;

export async function loadPlaywright() {
  if (!playwrightModule) playwrightModule = await import('playwright-core');
  return playwrightModule;
}

/** 解析可用 Chromium：优先环境变量，其次工作区内 Playwright headless shell，最后 Playwright 默认路径。 */
export async function resolveExecutable() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH && process.env.PLAYWRIGHT_EXECUTABLE_PATH.trim()) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH.trim();
  }
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || join(ROOT, loadConfig().capture.browsersPath);
  try {
    const { readdirSync } = await import('node:fs');
    const headlessDirs = readdirSync(browsersPath).filter((name) => name.startsWith('chromium_headless_shell-'));
    for (const dir of headlessDirs.sort().reverse()) {
      const candidate = join(browsersPath, dir, 'chrome-linux', 'headless_shell');
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // 目录不存在或不可读时继续尝试 Playwright 默认路径
  }
  try {
    const { chromium } = await loadPlaywright();
    const candidate = chromium.executablePath();
    if (candidate && existsSync(candidate)) return candidate;
  } catch {
    // 未安装浏览器时继续走 null
  }
  return null;
}

export async function launchBrowser() {
  const executablePath = await resolveExecutable();
  if (!executablePath) {
    throw new Error(
      '未找到可用的 Chromium。请先运行 `node node_modules/playwright-core/cli.js install chromium`（配合 PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers），或设置 PLAYWRIGHT_EXECUTABLE_PATH。',
    );
  }
  const { chromium } = await loadPlaywright();
  return chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  });
}

export function startDevServer({ port }) {
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr?.on('data', (chunk) => logs.push(String(chunk)));
  let stopped = false;
  return {
    child,
    logs,
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // 已退出
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // 已退出
        }
      }, 3000).unref?.();
    },
  };
}

export async function waitForServer(url, { timeoutMs = 90000, intervalMs = 500 } = {}) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`dev server 未在 ${timeoutMs}ms 内就绪：${url}（${lastError?.message ?? 'unknown'}）`);
}

/** 截图并写入文章目录；返回 captures 记录（宽高、字节、sha256）。 */
export async function captureShot(page, locator, filePath, meta = {}) {
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await locator.screenshot({ path: filePath, type: filePath.endsWith('.png') ? 'png' : 'jpeg', quality: 88, animations: 'disabled' });
  const bytes = readFileSync(filePath);
  const dimensions = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = data;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, `data:image/${filePath.endsWith('.png') ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`);
  return {
    file: meta.file ?? filePath.split('/').pop(),
    width: dimensions.width,
    height: dimensions.height,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    capturedAt: new Date().toISOString(),
    source: meta.source ?? '',
    purpose: meta.purpose ?? '',
    alt: meta.alt ?? '',
    caption: meta.caption ?? '',
    slug: meta.slug ?? '',
  };
}

export function writeJsonFile(file, data) {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
