#!/usr/bin/env node
/**
 * 首次上线助手：把本地待推送提交推到 origin/main，等待 GitHub Actions 质量检查+部署，
 * 再校验生产页面；失败时输出回滚建议（不自动 revert，交给人工确认）。
 *
 * 用法：node scripts/editorial/publish-pending.mjs [--timeout 1800] [--slug <slug>] [--dry-run]
 * 前置：`.editorial/secrets/github-token` 存在（设备授权写入）或环境变量 GITHUB_TOKEN。
 */
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { commitsAhead, githubApi, pendingCommitsSafe, pushMain, readToken, remoteInfo, revertCommit } from './lib/git.mjs';

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://clovertools.cn').replace(/\/$/, '');

function parseArgs(argv) {
  const options = { timeout: 1800, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--timeout') options.timeout = Number(argv[index + 1]);
    else if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkProduction(slug) {
  const url = `${SITE_URL}/guides/${slug}/`;
  let status = 0;
  let body = '';
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)' } });
    status = response.status;
    body = await response.text();
  } catch (error) {
    return { ok: false, url, status: 0, error: String(error.message ?? error) };
  }
  const checks = {
    statusOk: status === 200,
    canonical: body.includes(`${SITE_URL}/guides/${slug}/`),
    articleJsonLd: body.includes('"@type":"Article"') || body.includes('"@type": "Article"'),
    notNoindex: !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(body),
  };
  return { ok: Object.values(checks).every(Boolean), url, status, checks };
}

async function main() {
  ensureDefaultConfig();
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));
  const token = readToken();
  if (!token) {
    console.log(JSON.stringify({ ok: false, reason: 'missing-token', hint: '先运行 github-device-login.mjs 完成设备授权' }, null, 2));
    process.exit(3);
  }
  const pending = pendingCommitsSafe(config);
  if (!pending.safe) {
    console.log(JSON.stringify({ ok: false, reason: 'unsafe-pending-commits', offenders: pending.offenders.map((commit) => ({ sha: commit.sha, subject: commit.subject })), hint: '先 approve-commit.mjs --sha <sha> 逐个批准初始化提交' }, null, 2));
    process.exit(2);
  }
  if (pending.total === 0) {
    console.log(JSON.stringify({ ok: true, pushed: 0, reason: 'nothing-to-push' }, null, 2));
    return;
  }
  const slug = options.slug ?? inferSlugFromPending(pending.commits);
  const { owner, repo } = remoteInfo();
  if (options.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, wouldPush: pending.commits.map((commit) => ({ sha: commit.sha, subject: commit.subject })), slug }, null, 2));
    return;
  }
  pushMain(token, config);
  const pushed = pending.commits[pending.commits.length - 1];
  console.log(JSON.stringify({ ok: true, stage: 'pushed', sha: pushed.sha, commits: pending.total, slug }, null, 2));

  const deadline = Date.now() + options.timeout * 1000;
  let run = null;
  while (Date.now() < deadline) {
    await sleep(8000);
    const { status, json } = await githubApi(token, 'GET', `/repos/${owner}/${repo}/actions/runs?head_sha=${pushed.sha}&per_page=10`);
    if (status !== 200 || !json) continue;
    run = (json.workflow_runs ?? []).find((entry) => /quality/i.test(entry.name ?? '')) ?? (json.workflow_runs ?? [])[0] ?? null;
    if (!run) continue;
    if (run.status === 'completed') break;
  }
  if (!run || run.status !== 'completed') {
    console.log(JSON.stringify({ ok: false, stage: 'ci-timeout', sha: pushed.sha, hint: '可用 deploy-verify.mjs --run <runKey> 或手动查看 Actions' }, null, 2));
    process.exit(1);
  }
  if (run.conclusion !== 'success') {
    const revert = revertCommit(pushed.sha, config);
    console.log(
      JSON.stringify(
        {
          ok: false,
          stage: 'ci-failed',
          conclusion: run.conclusion,
          workflowUrl: run.html_url,
          localRevert: revert.stdout.split('\n')[0],
          hint: '确认后运行 push-main.mjs 推送回滚提交；未推送前生产仍是旧版本',
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  let production = null;
  if (slug) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      production = await checkProduction(slug);
      if (production.ok) break;
      await sleep(15000);
    }
  }
  console.log(
    JSON.stringify(
      {
        ok: Boolean(production?.ok ?? true),
        stage: 'deployed',
        sha: pushed.sha,
        workflowUrl: run.html_url,
        production,
        slug,
      },
      null,
      2,
    ),
  );
  if (production && !production.ok) process.exit(1);
}

function inferSlugFromPending(commits) {
  for (const commit of [...commits].reverse()) {
    if (!/^content:/.test(commit.subject ?? '')) continue;
    const jsonPath = commit.paths.find((path) => path.startsWith('data/editorial-guides/') && path.endsWith('.json'));
    if (jsonPath) return jsonPath.split('/').pop().replace(/\.json$/, '');
  }
  return null;
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(1);
});
