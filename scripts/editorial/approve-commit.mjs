#!/usr/bin/env node
/**
 * 手工批准一个引导提交，使其可以随流水线一起推送（通常只用于初始化）。
 * 用法：node scripts/editorial/approve-commit.mjs --sha <sha> [--sha2 ...]
 */
import { saveConfig, loadConfig } from './lib/config.mjs';
import { commitsAhead } from './lib/git.mjs';

function main() {
  const argv = process.argv.slice(2);
  const shas = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--sha') shas.push(argv[index + 1]);
    else if (argv[index] === '--all-pending') {
      const config = loadConfig();
      for (const commit of commitsAhead(undefined, config.git.remote, config.git.branch)) shas.push(commit.sha);
    }
  }
  if (shas.length === 0) throw new Error('用法：approve-commit.mjs --sha <sha> | --all-pending');
  const config = loadConfig();
  const approved = new Set(config.git.approvedCommits ?? []);
  for (const sha of shas.filter(Boolean)) approved.add(sha);
  config.git.approvedCommits = [...approved];
  saveConfig(config);
  console.log(JSON.stringify({ ok: true, approved: config.git.approvedCommits }, null, 2));
}

main();
