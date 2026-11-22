#!/usr/bin/env node
/**
 * Codex 隔离工作区：把「写稿」放进仓库外的干净 git worktree，输入（prompts/tools/digests）显式装配。
 *
 * 用法：
 *   node scripts/editorial/codex-worktree.mjs --prepare --run <runKey> --slug <slug> [--base HEAD]
 *   node scripts/editorial/codex-worktree.mjs --cleanup --run <runKey>
 *   node scripts/editorial/codex-worktree.mjs --status  --run <runKey>
 *
 * 约定：
 * - 工作区固定为 /tmp/clovertools-codex/<runKey>（仓库外，避免沙箱逃逸直接命中主仓）；
 * - 装配：.editorial/prompts、.editorial/tools、.editorial/runs/<runKey>/source-digests|source-manifest.json、
 *   node_modules 只读软链、AGENTS.md 硬规则；草稿目录留空；
 * - 记录 baseline（路径→sha256），供 import-draft 精确比对。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';

const WORKTREE_ROOT = '/tmp/clovertools-codex';
const RUN_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

export function worktreePath(runKey) {
  if (!RUN_KEY_PATTERN.test(runKey)) throw new Error(`非法 runKey：${runKey}`);
  return join(WORKTREE_ROOT, runKey);
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** 枚举工作区文件（跳过 .git 与 node_modules 软链），返回相对路径→sha256。 */
export function snapshotWorktree(dir) {
  const out = {};
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        out[relative(dir, absolute)] = `symlink:${entry.name}`;
        continue;
      }
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) out[relative(dir, absolute).split(sep).join('/')] = sha256File(absolute);
    }
  };
  walk(dir);
  return out;
}

function git(args, options = {}) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function parseArgs(argv) {
  const options = { action: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prepare') options.action = 'prepare';
    else if (arg === '--cleanup') options.action = 'cleanup';
    else if (arg === '--status') options.action = 'status';
    else if (arg === '--run') options.run = argv[++index];
    else if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--base') options.base = argv[++index];
    else if (arg === '--force') options.force = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function prepare(options) {
  if (!options.run || !RUN_KEY_PATTERN.test(options.run)) throw new Error('缺少或非法 --run');
  if (!options.slug || !SLUG_PATTERN.test(options.slug)) throw new Error('缺少或非法 --slug');
  const dir = worktreePath(options.run);
  const base = options.base ?? 'HEAD';
  if (existsSync(dir)) {
    if (!options.force) throw new Error(`工作区已存在：${dir}（先 --cleanup，或加 --force）`);
    rmSync(dir, { recursive: true, force: true });
    try {
      git(['worktree', 'prune']);
    } catch {
      // 忽略
    }
  }
  mkdirSync(dirname(dir), { recursive: true });
  git(['worktree', 'add', '--detach', dir, base]);

  const copyIfExists = (from, to) => {
    if (!existsSync(from)) return false;
    cpSync(from, to, { recursive: true });
    return true;
  };
  const inputs = [];
  if (copyIfExists(join(STATE_PATHS.dir, 'prompts'), join(dir, '.editorial', 'prompts'))) inputs.push('.editorial/prompts');
  if (copyIfExists(join(STATE_PATHS.dir, 'tools'), join(dir, '.editorial', 'tools'))) inputs.push('.editorial/tools');
  const runInputs = join(STATE_PATHS.runs, options.run);
  for (const name of ['source-digests', 'source-manifest.json', 'brief.md', 'item.json', 'draft-prompt.md']) {
    if (copyIfExists(join(runInputs, name), join(dir, '.editorial', 'runs', options.run, name))) {
      inputs.push(`.editorial/runs/${options.run}/${name}`);
    }
  }
  if (existsSync(join(ROOT, 'node_modules')) && !existsSync(join(dir, 'node_modules'))) {
    symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  }
  // 已有草稿（zh 定稿/证据）复制进工作区：translate / polish / altVerify 阶段需要读
  const existingDraft = join(STATE_PATHS.drafts, options.slug);
  if (existsSync(existingDraft)) {
    for (const name of ['guide.json', 'evidence.json', 'captures.json', 'illustrations.json']) {
      const from = join(existingDraft, name);
      if (existsSync(from)) {
        cpSync(from, join(dir, '.editorial', 'drafts', options.slug, name));
        inputs.push(`.editorial/drafts/${options.slug}/${name}`);
      }
    }
    if (existsSync(join(existingDraft, 'images'))) {
      cpSync(join(existingDraft, 'images'), join(dir, '.editorial', 'drafts', options.slug, 'images'), { recursive: true });
      inputs.push(`.editorial/drafts/${options.slug}/images`);
    }
  }
  mkdirSync(join(dir, '.editorial', 'drafts', options.slug), { recursive: true });
  mkdirSync(join(dir, 'scripts', 'editorial', 'cases'), { recursive: true });
  writeFileSync(
    join(dir, 'AGENTS.md'),
    [
      '# 本次任务的硬边界（自动化流水线生成，必须遵守）',
      '',
      `- 你可以写四处：\`.editorial/drafts/${options.slug}/\`、\`scripts/editorial/cases/${options.slug}.mjs\`、\`.editorial/runs/${options.run}/source-manifest.json\`（登记你选的来源）、\`.editorial/runs/${options.run}/source-digests/\` 与 \`source-digest.json\`（source-digest.mjs 的产出，宿主之后会用同样的 URL 重新生成一份权威摘录）。`,
      '- 禁止 `git add/commit/push/checkout/reset/stash` 等任何 git 写操作；禁止改 `src/`、`data/`、`public/`、`scripts/editorial/` 下其他文件。',
      '- 禁止下载、禁止安装依赖、禁止在仓库外写文件；除本目录外的一切写入都视为越界，会被导入步骤丢弃。',
      '- 选源后先写 `.editorial/runs/' + options.run + '/source-manifest.json`，再跑 `node scripts/editorial/source-digest.mjs --run ' + options.run + '` 冻结摘录。',
      '- 引用来源只能来自 `.editorial/runs/' + options.run + '/source-digests/`；digest 里没有的原话不得引用。',
      '- 运行目录（`.editorial/runs/' + options.run + '/`）里除 `source-manifest.json` 外的文件都由宿主维护，不要写、不要删。',
      '- 所有数字、报错、限制都要写进 `evidence.json`，并标注来源 digest 的编号（如 `[S2]`）。',
      '- 交付前自检（必须全部 exit 0）：',
      '  `node .editorial/tools/precheck-zh.mjs --slug ' + options.slug + ' --draft .editorial/drafts/' + options.slug + ' --strict`',
      '  `node scripts/editorial/tools/precheck-style.mjs --slug ' + options.slug + ' --draft-dir .editorial/drafts/' + options.slug + ' --strict`',
      '  `node --check scripts/editorial/cases/' + options.slug + '.mjs`',
      '',
    ].join('\n'),
  );

  const baseline = snapshotWorktree(dir);
  const record = {
    run: options.run,
    slug: options.slug,
    dir,
    base,
    preparedAt: new Date().toISOString(),
    inputs,
    baseline,
    baselineCount: Object.keys(baseline).length,
  };
  writeJson(join(STATE_PATHS.runs, options.run, 'worktree.json'), record);
  console.log(`已准备隔离工作区：${dir}（基线 ${record.baselineCount} 个文件，输入：${inputs.join('、') || '无'}）`);
  return 0;
}

function cleanup(options) {
  if (!options.run || !RUN_KEY_PATTERN.test(options.run)) throw new Error('缺少或非法 --run');
  const dir = worktreePath(options.run);
  if (!dir.startsWith(`${WORKTREE_ROOT}/`)) throw new Error(`拒绝删除非工作区路径：${dir}`);
  // 保留现场：失败诊断副本放仓库外
  if (options.keep) {
    const diagnostics = join(WORKTREE_ROOT, '_diagnostics', options.run);
    rmSync(diagnostics, { recursive: true, force: true });
    cpSync(join(dir, '.editorial', 'drafts'), join(diagnostics, 'drafts'), { recursive: true });
  }
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  try {
    git(['worktree', 'prune']);
  } catch {
    // 忽略
  }
  console.log(`已清理隔离工作区：${dir}`);
  return 0;
}

function status(options) {
  const dir = worktreePath(options.run);
  const recordFile = join(STATE_PATHS.runs, options.run, 'worktree.json');
  const record = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : null;
  if (!record) {
    console.log(JSON.stringify({ run: options.run, exists: existsSync(dir), record: null }, null, 2));
    return 0;
  }
  const current = existsSync(dir) ? snapshotWorktree(dir) : {};
  const changed = [];
  for (const [path, hash] of Object.entries(current)) {
    if (!(path in record.baseline)) changed.push({ path, change: 'added' });
    else if (record.baseline[path] !== hash) changed.push({ path, change: 'modified' });
  }
  for (const path of Object.keys(record.baseline)) {
    if (!(path in current)) changed.push({ path, change: 'deleted' });
  }
  console.log(JSON.stringify({ run: options.run, exists: existsSync(dir), slug: record.slug, changed }, null, 2));
  return 0;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.action) {
    console.log('用法：codex-worktree.mjs --prepare|--cleanup|--status --run <runKey> [--slug <slug>]');
    process.exit(options.action ? 0 : 6);
  }
  const code = options.action === 'prepare' ? prepare(options) : options.action === 'cleanup' ? cleanup(options) : status(options);
  process.exit(code);
} catch (error) {
  console.error(`codex-worktree 失败：${error.message}`);
  process.exit(6);
}
