#!/usr/bin/env node
/**
 * 浏览器能力探针 / 文章截图捕获（**受控执行**）。
 *   node scripts/editorial/capture-tool.mjs --probe
 *   node scripts/editorial/capture-tool.mjs --slug <slug> [--timeout-min 6]
 *
 * 安全模型（2026-11-20 评审驱动）：
 * 1. 静态闸门 `lib/case-guard.mjs`：拒绝 require/import()/process.env/child_process/fs/net/eval 等能力；
 * 2. 子进程隔离：`unshare -Urfpm --mount-proc --kill-child=SIGKILL`（独立 PID/mount namespace），
 *    在 namespace 内用 tmpfs 覆盖 `.editorial/secrets`，使用例代码读不到 PAT；
 * 3. Node permission 模型：只允许写草稿目录与 /tmp，其它写入直接 ERR_ACCESS_DENIED；
 * 4. 环境变量白名单：不传任何 token/密钥变量；
 * 5. 结束/超时后按图片目录扫 /proc 清理残留进程（含浏览器子进程）。
 */
import { existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig } from './lib/config.mjs';
import { ensureStateDirs } from './lib/state.mjs';
import { launchBrowser, resolveExecutable, startDevServer, waitForServer } from './lib/browser.mjs';
import { loadConfig } from './lib/config.mjs';
import { scanCaseFile } from './lib/case-guard.mjs';
import { killEverything, readStartTicks } from './lib/proc-tree.mjs';

const SAFE_ENV_KEYS = [
  'PATH',
  'LANG',
  'LC_ALL',
  'TZ',
  'TMPDIR',
  'DISPLAY',
  'PLAYWRIGHT_BROWSERS_PATH',
  'PLAYWRIGHT_EXECUTABLE_PATH',
  'NODE_ENV',
  'CI',
];

function parseArgs(argv) {
  const options = { probe: false, timeoutMinutes: 6 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--probe') options.probe = true;
    else if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--timeout-min') options.timeoutMinutes = Number(argv[++index]);
  }
  return options;
}

function safeEnv() {
  const env = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.HOME = '/tmp/clovertools-capture-home';
  env.NO_COLOR = '1';
  return env;
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

function runCaptureChild(slug, baseUrl, timeoutMinutes) {
  const draftDir = join(STATE_PATHS.drafts, slug);
  const imagesDir = join(draftDir, 'images');
  const childScript = join(ROOT, 'scripts', 'editorial', 'capture-child.mjs');
  const sandboxScript = [
    `mount -t tmpfs tmpfs "${join(ROOT, '.editorial', 'secrets')}" 2>/dev/null || true`,
    `exec "${process.execPath}" --permission --allow-fs-read=/ --allow-fs-write="${draftDir}" --allow-fs-write=/tmp --allow-child-process "${childScript}" --slug "${slug}" --base "${baseUrl}"`,
  ].join('; ');
  const argv = ['-Urfpm', '--mount-proc', '--kill-child=SIGKILL', 'bash', '-c', sandboxScript];
  const child = spawn('unshare', argv, { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: safeEnv() });
  const minStartTicks = readStartTicks(child.pid);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
    if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => {
      killEverything({ pid: child.pid, pgid: child.pid, marker: imagesDir, minStartTicks }).then(() =>
        finish({ ok: false, code: 124, timedOut: true, stdout, stderr, survivors: [] }),
      );
    }, timeoutMinutes * 60_000);
    child.on('close', async (code) => {
      clearTimeout(timer);
      const cleanup = await killEverything({ pid: child.pid, pgid: child.pid, marker: imagesDir, minStartTicks, graceMs: 1000 });
      finish({ ok: code === 0, code, timedOut: false, stdout, stderr, survivors: cleanup.survivors, killed: cleanup.killed });
    });
    child.on('error', async (error) => {
      clearTimeout(timer);
      await killEverything({ pid: child.pid, pgid: child.pid, marker: imagesDir, minStartTicks, graceMs: 0 });
      finish({ ok: false, code: 127, timedOut: false, stdout, stderr: String(error.message), survivors: [] });
    });
  });
}

async function capture(slug, timeoutMinutes) {
  ensureStateDirs();
  ensureDefaultConfig();
  const casePath = join(ROOT, 'scripts', 'editorial', 'cases', `${slug}.mjs`);
  if (!existsSync(casePath)) throw new Error(`截图用例不存在：scripts/editorial/cases/${slug}.mjs`);

  const guard = scanCaseFile(casePath);
  if (!guard.ok) {
    console.error(`截图用例未通过静态闸门（${guard.violations.length} 项）：`);
    for (const violation of guard.violations.slice(0, 10)) {
      console.error(`  ✗ 第 ${violation.line} 行：${violation.reason}｜${violation.text}`);
    }
    process.exit(3);
  }

  rmSync('/tmp/clovertools-capture-home', { recursive: true, force: true });
  // dev server 在沙箱外启动（它需要写 astro/vite 缓存，不能进受限进程）
  const config = loadConfig();
  const server = startDevServer({ port: config.capture.devServerPort });
  let result;
  try {
    await waitForServer(config.capture.baseUrl, { timeoutMs: 90000 });
    result = await runCaptureChild(slug, config.capture.baseUrl, timeoutMinutes);
  } catch (error) {
    result = { ok: false, code: 1, timedOut: false, stdout: '', stderr: `${String(error.message ?? error)}\n${server.logs.join('').slice(-3000)}` };
  } finally {
    server.stop();
  }
  if (result.timedOut) {
    console.error(`截图超时（${timeoutMinutes} 分钟），已清理残留进程`);
    process.exit(124);
  }
  if ((result.survivors ?? []).length > 0) {
    console.error(`警告：仍有残留进程：${JSON.stringify(result.survivors)}`);
    process.exit(3);
  }
  if (!result.ok) {
    console.error(`截图失败（退出码 ${result.code}）：${result.stderr.trim().split('\n').slice(-6).join(' | ')}`);
    process.exit(1);
  }
  return 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    if (options.probe) await probe();
    else if (options.slug) await capture(options.slug, options.timeoutMinutes);
    else throw new Error('用法：capture-tool.mjs --probe | --slug <slug> [--timeout-min 6]');
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}

main();
