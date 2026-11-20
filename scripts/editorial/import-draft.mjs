#!/usr/bin/env node
/**
 * 把隔离工作区（/tmp/clovertools-codex/<runKey>）里的产物**按精确白名单**导入主仓。
 *
 * 用法：node scripts/editorial/import-draft.mjs --run <runKey> --slug <slug> [--attempt 1] [--check-only]
 *
 * 原则（2026-11-20 双模型评审驱动）：
 * 1. 只接受两个位置：`.editorial/drafts/<slug>/` 与 `scripts/editorial/cases/<slug>.mjs`；
 * 2. 先 staging 复制 + 逐文件 sha256 复验，再原子替换；失败回滚，主仓不出现半份稿；
 * 3. 越权文件不删除、不导入，列出来报错（现场留在 worktree 供排查）。
 */
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';

const RUN_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function parseArgs(argv) {
  const options = { attempt: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--attempt') options.attempt = Number(argv[++index]);
    else if (arg === '--check-only') options.checkOnly = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function walk(dir) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) files.push({ absolute, rel: relative(dir, absolute).split(sep).join('/'), symlink: true });
      else if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push({ absolute, rel: relative(dir, absolute).split(sep).join('/'), symlink: false });
    }
  };
  visit(dir);
  return files;
}

const DRAFT_FILE_PATTERN =
  /^\.editorial\/drafts\/[a-z0-9][a-z0-9-]*\/(guide\.json|evidence\.json|reproduce\.md|fix-notes\.md|captures\.json|capture-log\.json|illustrations\.json|style\.json|precheck-zh\.json|numbers-allow\.json|[A-Za-z0-9._-]+\.mjs|outputs\/[A-Za-z0-9._-]+\.(json|txt|log)|images\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)|translations\/(tw|en|ko|ja)\.json|[A-Za-z0-9._-]+\.md)$/;

function isAllowedPath(rel, slug) {
  if (rel.startsWith(`.editorial/drafts/${slug}/`)) return true;
  return rel === `scripts/editorial/cases/${slug}.mjs`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/editorial/import-draft.mjs --run <runKey> --slug <slug> [--attempt 1] [--check-only]');
    return 0;
  }
  if (!options.run || !RUN_KEY_PATTERN.test(options.run)) throw new Error('缺少或非法 --run');
  if (!options.slug || !SLUG_PATTERN.test(options.slug)) throw new Error('缺少或非法 --slug');

  const worktreeFile = join(STATE_PATHS.runs, options.run, 'worktree.json');
  const record = readJson(worktreeFile, null);
  if (!record) throw new Error(`缺少 worktree.json：${worktreeFile}（先跑 codex-worktree --prepare）`);
  const wt = record.dir;
  if (!existsSync(wt)) throw new Error(`隔离工作区不存在（可能被 /tmp 清理）：${wt}`);

  const current = new Map(walk(wt).map((entry) => [entry.rel, entry]));
  const changed = [];
  for (const [rel, entry] of current) {
    if (rel === 'AGENTS.md') continue;
    const before = record.baseline?.[rel];
    if (before === undefined) changed.push({ ...entry, change: 'added' });
    else if (before !== (entry.symlink ? `symlink:${entry.rel}` : sha256File(entry.absolute))) changed.push({ ...entry, change: 'modified' });
  }
  for (const [rel, hash] of Object.entries(record.baseline ?? {})) {
    if (rel === 'AGENTS.md') continue;
    if (!current.has(rel) && !String(hash).startsWith('symlink:')) changed.push({ rel, absolute: join(wt, rel), change: 'deleted', symlink: false });
  }

  const violations = [];
  const ignored = [];
  const accepted = [];
  for (const entry of changed) {
    if (entry.symlink) {
      violations.push(`${entry.rel}：符号链接不允许导入`);
      continue;
    }
    if (!isAllowedPath(entry.rel, options.slug)) {
      violations.push(`${entry.rel}：不在允许导入范围（仅 .editorial/drafts/${options.slug}/ 与 scripts/editorial/cases/${options.slug}.mjs）`);
      continue;
    }
    if (entry.change !== 'deleted') {
      const size = statSync(entry.absolute).size;
      if (size > MAX_FILE_BYTES) {
        violations.push(`${entry.rel}：文件超过 ${MAX_FILE_BYTES / 1024 / 1024}MB`);
        continue;
      }
      if (lstatSync(entry.absolute).isFile() === false) {
        violations.push(`${entry.rel}：不是普通文件`);
        continue;
      }
    }
    if (entry.rel.startsWith(`.editorial/drafts/${options.slug}/`) && !DRAFT_FILE_PATTERN.test(entry.rel)) {
      ignored.push({ path: entry.rel, reason: '草稿目录内的非清单文件（不导入，保留在 worktree）' });
      continue;
    }
    accepted.push(entry);
  }
  if (!accepted.some((entry) => entry.rel === `.editorial/drafts/${options.slug}/guide.json`)) {
    violations.push(`缺少必需产物 .editorial/drafts/${options.slug}/guide.json`);
  }

  const summary = {
    run: options.run,
    slug: options.slug,
    attempt: options.attempt,
    worktree: wt,
    changed: changed.map((entry) => entry.rel),
    accepted: accepted.map((entry) => ({ path: entry.rel, change: entry.change })),
    ignored,
    violations,
    applied: [],
    ok: false,
    checkedAt: new Date().toISOString(),
  };

  if (violations.length > 0) {
    writeJson(join(STATE_PATHS.runs, options.run, 'import.json'), summary);
    console.error(`导入被拒绝（${violations.length} 项越界/缺失）：`);
    for (const violation of violations.slice(0, 20)) console.error(`  ✗ ${violation}`);
    console.error(`现场保留：${wt}`);
    return 1;
  }
  if (options.checkOnly) {
    summary.ok = true;
    summary.dryRun = true;
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  // staging：完整复制 + 逐文件复验
  const staging = join(STATE_PATHS.dir, 'staging', options.run, String(options.attempt));
  rmSync(staging, { recursive: true, force: true });
  const staged = [];
  for (const entry of accepted) {
    if (entry.change === 'deleted') {
      staged.push({ path: entry.rel, change: 'deleted', sha256: null });
      continue;
    }
    const target = join(staging, entry.rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(entry.absolute, target);
    const expected = sha256File(entry.absolute);
    const actual = sha256File(target);
    if (expected !== actual) {
      violations.push(`${entry.rel}：staging 复验失败`);
      continue;
    }
    staged.push({ path: entry.rel, change: entry.change, sha256: actual });
  }
  if (violations.length > 0) {
    summary.violations = violations;
    writeJson(join(STATE_PATHS.runs, options.run, 'import.json'), summary);
    console.error(`staging 失败：${violations.join('；')}`);
    return 1;
  }

  // 备份现有目标
  const backup = join(STATE_PATHS.dir, 'backups', options.run, String(options.attempt));
  const draftTarget = join(STATE_PATHS.drafts, options.slug);
  const caseTarget = join(ROOT, 'scripts', 'editorial', 'cases', `${options.slug}.mjs`);
  const backups = [];
  const backupPath = (target) => {
    if (!existsSync(target)) return null;
    const dest = join(backup, relative(ROOT, target).split(sep).join('/'));
    mkdirSync(dirname(dest), { recursive: true });
    if (statSync(target).isDirectory()) {
      cpSync(target, dest, { recursive: true });
    } else {
      copyFileSync(target, dest);
    }
    backups.push({ path: relative(ROOT, target), backup: dest });
    return dest;
  };

  try {
    // 草稿目录：整目录原子替换
    const stagedDraft = join(staging, '.editorial', 'drafts', options.slug);
    if (existsSync(stagedDraft)) {
      backupPath(draftTarget);
      rmSync(draftTarget, { recursive: true, force: true });
      mkdirSync(dirname(draftTarget), { recursive: true });
      renameSync(stagedDraft, draftTarget);
    }
    // case 脚本：同目录临时文件 + rename
    const stagedCase = join(staging, 'scripts', 'editorial', 'cases', `${options.slug}.mjs`);
    if (existsSync(stagedCase)) {
      backupPath(caseTarget);
      mkdirSync(dirname(caseTarget), { recursive: true });
      const temp = `${caseTarget}.importing-${options.attempt}`;
      copyFileSync(stagedCase, temp);
      renameSync(temp, caseTarget);
    }
    // 应用后复验
    for (const entry of staged) {
      if (entry.change === 'deleted') continue;
      const target = join(ROOT, entry.path);
      if (!existsSync(target) || sha256File(target) !== entry.sha256) {
        throw new Error(`应用后复验失败：${entry.path}`);
      }
      summary.applied.push(entry.path);
    }
  } catch (error) {
    // 回滚
    rmSync(draftTarget, { recursive: true, force: true });
    for (const entry of backups) {
      const target = join(ROOT, entry.path);
      rmSync(target, { recursive: true, force: true });
      mkdirSync(dirname(target), { recursive: true });
      cpSync(entry.backup, target, { recursive: true });
    }
    summary.violations = [String(error.message)];
    writeJson(join(STATE_PATHS.runs, options.run, 'import.json'), summary);
    console.error(`导入失败并已回滚：${error.message}`);
    return 1;
  }

  summary.ok = true;
  summary.backups = backups;
  summary.staging = staging;
  writeJson(join(STATE_PATHS.runs, options.run, 'import.json'), summary);
  writeJson(join(STATE_PATHS.runs, options.run, 'touched.json'), {
    run: options.run,
    slug: options.slug,
    files: summary.applied,
    updatedAt: new Date().toISOString(),
  });
  console.log(`已导入 ${summary.applied.length} 个文件（attempt ${options.attempt}）：`);
  for (const path of summary.applied) console.log(`  ✓ ${path}`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`import-draft 失败：${error.message}`);
  process.exit(6);
}
