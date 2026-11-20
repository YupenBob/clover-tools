#!/usr/bin/env node
/**
 * 工作区越权对账：确认 `git status` 里出现的每个路径都在允许范围内（且本趟没有多出来的文件）。
 *
 * 用法：
 *   node scripts/editorial/check-workspace-scope.mjs [--run <runKey>] [--json] [--quiet]
 *
 * 判定顺序：
 * 1. 若 `.editorial/runs/<runKey>/touched.json` 存在，则 staged/unstaged 改动必须 ∈ 该精确清单（多一个都算越权）；
 * 2. 否则退回 `config.git.allowedPaths` 前缀校验（兼容旧流程与维护提交）。
 * 退出码：0 合规｜1 越权｜6 参数/环境错误。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';

function parseArgs(argv) {
  const options = { json: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** git status --porcelain -z → [{ path, state }] */
function statusEntries() {
  const raw = git(['status', '--porcelain', '-z', '-uall']);
  const parts = raw.split('\0');
  const entries = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part || part.length < 4) continue;
    const code = part.slice(0, 2);
    const path = part.slice(3);
    if (code.startsWith('R') || code.startsWith('C')) {
      // rename 后紧跟原路径
      const from = parts[index + 1];
      index += 1;
      entries.push({ path, from, state: code });
    } else {
      entries.push({ path, state: code });
    }
  }
  return entries;
}

function stagedEntries() {
  const raw = git(['diff', '--cached', '--name-only', '-z']);
  return raw.split('\0').filter(Boolean);
}

function matchesAllowed(path, allowedPaths) {
  return allowedPaths.some((prefix) => (prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/editorial/check-workspace-scope.mjs [--run <runKey>] [--json] [--quiet]');
    return 0;
  }
  const config = loadConfig();
  const allowedPaths = config.git?.allowedPaths ?? [];
  const touchedFile = options.run ? join(STATE_PATHS.runs, options.run, 'touched.json') : null;
  const touched = touchedFile && existsSync(touchedFile) ? readJson(touchedFile, null) : null;
  const exact = touched?.files ? new Set(touched.files) : null;

  const entries = statusEntries();
  const staged = stagedEntries();
  const unexpected = [];
  for (const entry of entries) {
    const path = entry.path.split('\\').join('/');
    const okAllowed = matchesAllowed(path, allowedPaths);
    if (!okAllowed) {
      unexpected.push({ path, state: entry.state, reason: '不在 allowedPaths' });
      continue;
    }
    if (exact && !exact.has(path)) {
      unexpected.push({ path, state: entry.state, reason: '不在本趟精确清单 touched.json' });
    }
  }
  for (const path of staged) {
    const normalized = path.split('\\').join('/');
    if (!matchesAllowed(normalized, allowedPaths)) {
      unexpected.push({ path: normalized, state: 'staged', reason: '已暂存但不在 allowedPaths' });
    } else if (exact && !exact.has(normalized)) {
      unexpected.push({ path: normalized, state: 'staged', reason: '已暂存但不在本趟精确清单' });
    }
  }

  const result = {
    ok: unexpected.length === 0,
    run: options.run ?? null,
    mode: exact ? 'exact-manifest' : 'prefix',
    allowedPaths,
    changedCount: entries.length,
    stagedCount: staged.length,
    unexpected,
    checkedAt: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.quiet) {
    console.log(`工作区对账（${result.mode}）：改动 ${result.changedCount} 项、已暂存 ${result.stagedCount} 项 → ${result.ok ? '合规' : `越权 ${unexpected.length} 项`}`);
    for (const entry of unexpected.slice(0, 20)) console.log(`  ✗ ${entry.path}（${entry.reason}）`);
  }
  return result.ok ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`check-workspace-scope 失败：${error.message}`);
  process.exit(6);
}
