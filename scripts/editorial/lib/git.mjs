/** git / GitHub 操作：干净检查、允许路径、提交、推送、Actions 查询、回滚。 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ROOT, STATE_PATHS } from './paths.mjs';

export function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(opts.env ?? {}) },
  });
  const stdout = (result.stdout ?? '').trim();
  const stderr = (result.stderr ?? '').trim();
  if (result.status !== 0 && !opts.allowFailure) {
    throw new Error(`git ${args.join(' ')} 失败（exit ${result.status}）：${stderr || stdout}`);
  }
  return { status: result.status ?? 1, stdout, stderr };
}

export function statusPorcelain(cwd) {
  const { stdout } = git(['status', '--porcelain'], { cwd });
  return stdout ? stdout.split('\n').filter(Boolean) : [];
}

export function assertClean(cwd) {
  const dirty = statusPorcelain(cwd);
  if (dirty.length > 0) {
    throw new Error(`工作区不干净，拒绝执行流水线：\n${dirty.slice(0, 10).join('\n')}`);
  }
}

export function headSha(cwd) {
  return git(['rev-parse', 'HEAD'], { cwd }).stdout;
}

export function fetchOrigin(remote = 'origin', cwd) {
  git(['fetch', '--quiet', remote, 'main'], { cwd, allowFailure: true });
}

export function remoteInfo(cwd) {
  const url = git(['remote', 'get-url', 'origin'], { cwd }).stdout;
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) return { url, owner: null, repo: null };
  return { url, owner: match[1], repo: match[2] };
}

export function readToken() {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) return process.env.GITHUB_TOKEN.trim();
  if (existsSync(STATE_PATHS.githubToken)) {
    const token = readFileSync(STATE_PATHS.githubToken, 'utf8').trim();
    if (token) return token;
  }
  return null;
}

export function tokenUrl(token, cwd) {
  const { owner, repo } = remoteInfo(cwd);
  if (!owner || !repo) throw new Error('无法解析 origin 仓库地址');
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}

function pathAllowed(path, allowedPaths) {
  return allowedPaths.some((prefix) => (prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix));
}

/** 读取 origin/main..HEAD 的提交及其改动路径。 */
export function commitsAhead(cwd, remote = 'origin', branch = 'main') {
  const { stdout } = git(['log', '--reverse', '--format=%H%x1f%ae%x1f%s', `${remote}/${branch}..HEAD`], { cwd });
  if (!stdout) return [];
  return stdout.split('\n').filter(Boolean).map((line) => {
    const [sha, authorEmail, subject] = line.split('\x1f');
    const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha], { cwd }).stdout;
    return { sha, authorEmail, subject, paths: changed ? changed.split('\n').filter(Boolean) : [] };
  });
}

/** 待推送提交是否全部由流水线产生且只改允许路径。 */
export function pendingCommitsSafe(config, cwd) {
  const allowed = config.git.allowedPaths;
  const commits = commitsAhead(cwd, config.git.remote, config.git.branch);
  const offenders = commits.filter((commit) => {
    if (commit.authorEmail !== config.git.authorEmail) return true;
    return commit.paths.some((path) => !pathAllowed(path, allowed));
  });
  return { safe: offenders.length === 0, total: commits.length, offenders };
}

export function pushMain(token, config, cwd) {
  const url = tokenUrl(token, cwd);
  return git(['push', url, `HEAD:${config.git.branch}`], { cwd, env: { GIT_TERMINAL_PROMPT: '0' } });
}

export function pushBranch(token, branchName, cwd) {
  const url = tokenUrl(token, cwd);
  return git(['push', url, `HEAD:${branchName}`], { cwd });
}

export function isProtectedPushError(stderr) {
  return /protected branch|GH006|refusing to allow|403|Permission denied|not authorized/i.test(stderr);
}

export function commitPaths(paths, message, config, cwd) {
  git(['add', '--', ...paths], { cwd });
  return git(
    [
      '-c',
      `user.name=${config.git.authorName}`,
      '-c',
      `user.email=${config.git.authorEmail}`,
      'commit',
      '--no-verify',
      '-m',
      message,
    ],
    { cwd },
  );
}

export function revertCommit(sha, config, cwd) {
  return git(
    ['-c', `user.name=${config.git.authorName}`, '-c', `user.email=${config.git.authorEmail}`, 'revert', '--no-edit', sha],
    { cwd },
  );
}

export function isCommitOnBranch(sha, branch, cwd) {
  const result = git(['merge-base', '--is-ancestor', sha, branch], { cwd, allowFailure: true });
  return result.status === 0;
}

export function filesTouchedBetween(fromSha, toSha, cwd) {
  const { stdout } = git(['diff', '--name-only', fromSha, toSha], { cwd });
  return stdout ? stdout.split('\n').filter(Boolean) : [];
}

/** GitHub REST API（只读查询，用于部署验证与 PR 降级）。 */
export async function githubApi(token, method, apiPath, body) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'clover-editorial-pipeline',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

export async function workflowRunForSha(token, owner, repo, sha) {
  const { status, json } = await githubApi(token, 'GET', `/repos/${owner}/${repo}/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=10`);
  if (status !== 200 || !json) return { status, run: null };
  const runs = (json.workflow_runs ?? []).filter((run) => run.head_sha === sha);
  const quality = runs.find((run) => /quality/i.test(run.name ?? '')) ?? runs[0] ?? null;
  return { status, run: quality, runs };
}

export async function createPullRequest(token, owner, repo, { title, head, base, body }) {
  return githubApi(token, 'POST', `/repos/${owner}/${repo}/pulls`, { title, head, base, body });
}

export function fetchText(url, { timeoutMs = 20000 } = {}) {
  return fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
