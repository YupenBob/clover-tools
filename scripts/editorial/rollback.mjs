#!/usr/bin/env node
/**
 * 回滚一篇已推送的文章：git revert + 推送 + 更新队列状态。
 * 用法：node scripts/editorial/rollback.mjs --slug <slug> [--dry-run]
 *       node scripts/editorial/rollback.mjs --sha <commit>
 */
import { join } from 'node:path';
import { STATE_PATHS, REPO_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { loadQueue, saveQueue, writeJsonAtomic } from './lib/state.mjs';
import { git, pushMain, readToken, revertCommit, tokenUrl } from './lib/git.mjs';

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--sha') options.sha = argv[index + 1];
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

function findCommit(options) {
  if (options.sha) return options.sha;
  const path = `${REPO_PATHS.guidesDir}${options.slug}.json`;
  const found = git(['log', '-1', '--format=%H', 'HEAD', '--', path], { allowFailure: true });
  return found.status === 0 && found.stdout ? found.stdout.split('\n')[0] : null;
}

async function main() {
  ensureDefaultConfig();
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug && !options.sha) throw new Error('用法：rollback.mjs --slug <slug> 或 --sha <commit>');
  const sha = findCommit(options);
  if (!sha) throw new Error('未找到对应提交');
  const subject = git(['show', '-s', '--format=%s', sha], { allowFailure: true }).stdout;

  if (options.dryRun) {
    console.log(JSON.stringify({ dryRun: true, sha, subject }, null, 2));
    return;
  }

  const revert = revertCommit(sha, config);
  let push = { ok: false, attempted: false };
  if (config.publishMode === 'push-main') {
    const token = readToken();
    if (token) {
      push.attempted = true;
      try {
        tokenUrl(token);
        pushMain(token, config);
        push.ok = true;
      } catch (error) {
        push.error = String(error.message ?? error).slice(0, 400);
      }
    } else push.error = '缺少 GITHUB_TOKEN，回滚提交仅存在于本地';
  }

  // 更新队列状态
  const queue = loadQueue();
  const item = queue.items.find((entry) => entry.slug === options.slug);
  if (item) {
    item.status = 'reverted';
    item.lastError = `已回滚 ${sha.slice(0, 8)}`;
    item.updatedAt = new Date().toISOString();
    saveQueue(queue);
  }
  const result = { ok: push.ok || config.publishMode !== 'push-main', sha, subject, revert: revert.stdout.split('\n')[0], push };
  writeJsonAtomic(join(STATE_PATHS.dir, 'last-rollback.json'), { ...result, at: new Date().toISOString() });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(1);
});
