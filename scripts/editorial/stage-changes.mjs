#!/usr/bin/env node
/**
 * 只暂存「本趟精确改动清单」里的文件，并校验 index 与清单一致。
 *
 * 用法：
 *   node scripts/editorial/stage-changes.mjs --run <runKey> [--check-only] [--json]
 *
 * 依据：
 * - 清单来源 `.editorial/runs/<runKey>/touched.json`（import-draft / apply-draft / apply-translations 共同维护）；
 * - 可选 `.editorial/runs/<runKey>/pre-existing.json`：tick 开始时工作区里已经存在的无关改动（别的任务留下的），
 *   只允许它们存在但不提交、不计入越权；
 * - 提交后由 `check-workspace-scope.mjs --run` 复核。
 *
 * 退出码：0 通过｜1 清单不一致/有清单外改动｜6 参数或环境错误。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { normalizePath } from './lib/touched.mjs';

const MANIFEST_FILE = (run) => join(STATE_PATHS.runs, run, 'touched.json');
const PRE_EXISTING_FILE = (run) => join(STATE_PATHS.runs, run, 'pre-existing.json');

function parseArgs(argv) {
  const options = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--check-only') options.checkOnly = true;
    else if (arg === '--json') options.json = true;
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

function statusPaths() {
  const raw = git(['status', '--porcelain', '-z', '-uall']);
  const parts = raw.split('\0');
  const paths = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part || part.length < 4) continue;
    const code = part.slice(0, 2);
    paths.push(normalizePath(part.slice(3)));
    if (code.startsWith('R') || code.startsWith('C')) index += 1;
  }
  return paths;
}

function stagedPaths() {
  return git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean).map(normalizePath);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/editorial/stage-changes.mjs --run <runKey> [--check-only] [--json]');
    return 0;
  }
  if (!options.run) throw new Error('缺少 --run');
  const manifest = readJson(MANIFEST_FILE(options.run), null);
  if (!manifest) throw new Error(`缺少改动清单：${MANIFEST_FILE(options.run)}（先跑 import-draft/apply-draft）`);
  const config = readJson(join(STATE_PATHS.dir, 'config.json'), {});
  const allowedPrefixes = config.git?.allowedPaths ?? [];
  // 清单里可能含 .editorial/ 草稿产物（gitignored）：只暂存仓库内容路径
  const isRepoPath = (path) =>
    !path.startsWith('.editorial/') && allowedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}`));
  const listed = new Set((manifest.files ?? []).map(normalizePath).filter(isRepoPath));
  const preExisting = new Set(((readJson(PRE_EXISTING_FILE(options.run), {})?.paths ?? [])).map(normalizePath));

  const present = [...listed].filter((path) => existsSync(join(ROOT, path)));
  const deleted = [...listed].filter((path) => !existsSync(join(ROOT, path)));
  const working = statusPaths();
  const outside = working.filter((path) => !listed.has(path) && !preExisting.has(path));

  const result = {
    run: options.run,
    listed: [...listed].sort(),
    present,
    deleted,
    outsideManifest: outside,
    ok: outside.length === 0,
    checkedAt: new Date().toISOString(),
  };

  if (outside.length > 0) {
    console.error(`有 ${outside.length} 个改动不在本趟清单内（拒绝暂存）：`);
    for (const path of outside.slice(0, 20)) console.error(`  ✗ ${path}`);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  if (!options.checkOnly) {
    if (present.length > 0) git(['add', '--', ...present]);
    if (deleted.length > 0) git(['add', '-A', '--', ...deleted]);
    const staged = stagedPaths();
    const unexpectedStaged = staged.filter((path) => !listed.has(path));
    if (unexpectedStaged.length > 0) {
      result.unexpectedStaged = unexpectedStaged;
      console.error(`index 里出现了清单外文件：${unexpectedStaged.join('、')}`);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      return 1;
    }
    result.staged = staged;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`本趟改动清单：${listed.size} 项（存在 ${present.length}、删除 ${deleted.length}）→ ${options.checkOnly ? '仅校验' : '已暂存'}`);
    for (const path of [...present, ...deleted].slice(0, 30)) console.log(`  · ${path}`);
  }
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`stage-changes 失败：${error.message}`);
  process.exit(6);
}
