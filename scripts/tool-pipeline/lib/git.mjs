import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './paths.mjs';

const WORKTREE_OWNED = new Set(['node_modules', '.playwright-browsers', '.env', '.env.local']);

function isWorktreeOwned(path) {
  return WORKTREE_OWNED.has(String(path).split('/')[0]);
}

const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.quotepath',
  GIT_CONFIG_VALUE_0: 'false',
};

export function git(args, { cwd = REPO, allowFailure = false, input, timeoutMs = 180000 } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    input,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: GIT_ENV,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed (${result.status}): ${detail}`);
  }
  return {
    code: result.status ?? 1,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function gitOut(args, options) {
  return git(args, options).stdout;
}

export function repoRoot(cwd = REPO) {
  return gitOut(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

export function headSha(cwd = REPO) {
  return gitOut(['rev-parse', 'HEAD'], { cwd }).trim();
}

export function currentBranch(cwd = REPO) {
  return gitOut(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).trim();
}

export function statusPorcelain(cwd = REPO) {
  return gitOut(['status', '--porcelain'], { cwd })
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export function isClean(cwd = REPO) {
  return statusPorcelain(cwd).length === 0;
}

export function fetchOrigin(cwd = REPO, remote = 'origin', branch = 'main') {
  return git(['fetch', '--quiet', remote, branch], { cwd, allowFailure: true });
}

export function remoteHead(cwd = REPO, remote = 'origin', branch = 'main') {
  return gitOut(['rev-parse', `${remote}/${branch}`], { cwd }).trim();
}

export function commitsAhead(cwd = REPO, remote = 'origin', branch = 'main') {
  return Number(
    gitOut(['rev-list', '--count', `${remote}/${branch}..HEAD`], { cwd }).trim() || 0,
  );
}

export function commitsBehind(cwd = REPO, remote = 'origin', branch = 'main') {
  return Number(
    gitOut(['rev-list', '--count', `HEAD..${remote}/${branch}`], { cwd }).trim() || 0,
  );
}

/** Both tracked modifications and untracked new files, relative to `base`. */
export function changedPaths(base, cwd = REPO) {
  const tracked = gitOut(['diff', '--name-only', '-z', '--diff-filter=ACMR', base], { cwd })
    .split('\0')
    .filter(Boolean);
  const deleted = gitOut(['diff', '--name-only', '-z', '--diff-filter=D', base], { cwd })
    .split('\0')
    .filter(Boolean);
  const untracked = gitOut(['ls-files', '--others', '--exclude-standard', '-z'], { cwd })
    .split('\0')
    .filter(Boolean)
    .filter((path) => !isWorktreeOwned(path));
  return {
    tracked: [...new Set(tracked)],
    deleted: [...new Set(deleted)],
    untracked: [...new Set(untracked)],
    all: [...new Set([...tracked, ...untracked])],
  };
}

/** Parsed `git diff --name-status -z` entries (rename/copy pairs included). */
export function nameStatus(base, cwd = REPO) {
  const tokens = gitOut(['diff', '--name-status', '-z', '--find-renames', base], { cwd }).split('\0');
  const entries = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      entries.push({ status, from: tokens[index++], to: tokens[index++] });
    } else {
      entries.push({ status, path: tokens[index++] });
    }
  }
  return entries;
}

export function pathsAt(base, cwd = REPO) {
  return new Set(
    gitOut(['ls-tree', '-r', '--name-only', '-z', base], { cwd })
      .split('\0')
      .filter(Boolean),
  );
}

export function pathExistsAt(base, path, cwd = REPO) {
  return git(['cat-file', '-e', `${base}:${path}`], { cwd, allowFailure: true }).code === 0;
}

export function diffStat(base, cwd = REPO) {
  return gitOut(['diff', '--stat', base], { cwd }).trim();
}

export function diffText(base, cwd = REPO) {
  return gitOut(['diff', base], { cwd });
}

export function stagedPaths(cwd = REPO) {
  return gitOut(['diff', '--cached', '--name-only', '-z'], { cwd })
    .split('\0')
    .filter(Boolean);
}

export function addPaths(paths, cwd = REPO) {
  if (!paths.length) return;
  git(['add', '--', ...paths], { cwd });
}

export function commitPaths(paths, message, { cwd = REPO, author } = {}) {
  addPaths(paths, cwd);
  const args = [];
  if (author?.name) args.push('-c', `user.name=${author.name}`);
  if (author?.email) args.push('-c', `user.email=${author.email}`);
  args.push('commit', '-m', message);
  git(args, { cwd });
  return headSha(cwd);
}

export function resetSoft(sha, cwd = REPO) {
  git(['reset', '--soft', sha], { cwd });
}

export function mergeFfOnly(sha, cwd = REPO) {
  git(['merge', '--ff-only', sha], { cwd });
}

export function pushMain(cwd = REPO, remote = 'origin', branch = 'main') {
  git(['push', remote, `${branch}:${branch}`], { cwd, timeoutMs: 180000 });
}

export function resetHard(sha, cwd = REPO) {
  git(['reset', '--hard', sha], { cwd });
}

export function revertCommit(sha, cwd = REPO) {
  git(['revert', '--no-edit', sha], { cwd });
  return headSha(cwd);
}

export function addWorktree(path, base, cwd = REPO) {
  git(['worktree', 'add', '--detach', path, base], { cwd });
  return path;
}

export function removeWorktree(path, cwd = REPO) {
  git(['worktree', 'remove', '--force', path], { cwd, allowFailure: true });
  git(['worktree', 'prune'], { cwd, allowFailure: true });
}

export function worktreeExists(path) {
  return existsSync(join(path, '.git')) || existsSync(path);
}

export function readBlobAt(base, path, cwd = REPO) {
  return gitOut(['show', `${base}:${path}`], { cwd });
}

export function addedLines(base, path, cwd = REPO) {
  const result = git(['diff', '-U0', base, '--', path], { cwd, allowFailure: true });
  if (result.code !== 0) return [];
  return result.stdout
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

export function untrackedText(path, cwd = REPO) {
  try {
    return readFileSync(join(cwd, path), 'utf8');
  } catch {
    return '';
  }
}
