#!/usr/bin/env node
/**
 * 推送本地 main 到 origin（带 PAT），推送前再次校验提交作者、允许路径与人工批准列表。
 * 用法：node scripts/editorial/push-main.mjs [--dry-run]
 */
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { commitsAhead, pendingCommitsSafe, readToken, remoteInfo, pushMain } from './lib/git.mjs';

async function main() {
  ensureDefaultConfig();
  const config = loadConfig();
  const dryRun = process.argv.includes('--dry-run');
  const token = readToken();
  if (!token) {
    console.log(JSON.stringify({ ok: false, reason: 'missing-token', hint: '设置 GITHUB_TOKEN 或写入 .editorial/secrets/github-token' }, null, 2));
    process.exit(3);
  }
  const pending = pendingCommitsSafe(config);
  if (!pending.safe) {
    console.log(JSON.stringify({ ok: false, reason: 'unsafe-pending-commits', offenders: pending.offenders }, null, 2));
    process.exit(2);
  }
  if (pending.total === 0) {
    console.log(JSON.stringify({ ok: true, pushed: 0, reason: 'nothing-to-push' }, null, 2));
    return;
  }
  const { owner, repo } = remoteInfo();
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, wouldPush: commitsAhead(undefined, config.git.remote, config.git.branch).map((commit) => ({ sha: commit.sha, subject: commit.subject, paths: commit.paths.length })), remote: `${owner}/${repo}` }, null, 2));
    return;
  }
  pushMain(token, config);
  const remaining = commitsAhead(undefined, config.git.remote, config.git.branch);
  console.log(JSON.stringify({ ok: true, pushed: pending.total, remaining: remaining.length, remote: `${owner}/${repo}` }, null, 2));
}

main().catch((error) => {
  console.error(String(error.message ?? error));
  process.exit(1);
});
