#!/usr/bin/env node
/**
 * 部署验证：检查本次提交对应的 GitHub Actions 质量任务与生产页面。
 * 由下一次 tick 或人工调用；不需要长时间阻塞等待。
 * 用法：node scripts/editorial/deploy-verify.mjs --run <runKey>
 * 退出码：0 已通过 / 1 待定 / 2 失败（需要回滚）/ 3 缺少凭证。
 */
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { readJson, writeJsonAtomic } from './lib/state.mjs';
import { githubApi, readToken, remoteInfo, resolveSha, workflowRunForSha } from './lib/git.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') options.run = argv[index + 1];
  }
  return options;
}

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://clovertools.cn').replace(/\/$/, '');

async function checkProduction(slug) {
  const url = `${SITE_URL}/guides/${slug}/`;
  const checks = {};
  let status = 0;
  let body = '';
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)' },
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    return { ok: false, url, status: 0, error: String(error.message ?? error), checks };
  }
  checks.statusOk = status === 200;
  checks.canonical = body.includes(`${SITE_URL}/guides/${slug}/`);
  checks.articleJsonLd = body.includes('"@type":"Article"') || body.includes('"@type": "Article"');
  checks.notNoindex = !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(body);
  const ok = Object.values(checks).every(Boolean);
  return { ok, url, status, checks, bytes: body.length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.run) throw new Error('用法：deploy-verify.mjs --run <runKey>');
  const recordFile = join(STATE_PATHS.runs, `${options.run}.json`);
  const record = readJson(recordFile, null);
  if (!record) throw new Error(`运行记录不存在：.editorial/runs/${options.run}.json`);
  const slug = record.slug;
  const sha = resolveSha(record.push?.sha);
  if (!slug || !sha) {
    console.log(JSON.stringify({ status: 'unknown', reason: '运行记录缺少 slug 或推送 sha' }, null, 2));
    process.exit(1);
  }
  const token = readToken();
  if (!token) {
    const result = { status: 'pending', reason: '缺少 GITHUB_TOKEN，无法查询 Actions', run: options.run, sha, slug };
    console.log(JSON.stringify(result, null, 2));
    process.exit(3);
  }
  const { owner, repo } = remoteInfo();
  const { run, runs } = await workflowRunForSha(token, owner, repo, sha);
  if (!run) {
    record.deploy = { status: 'pending', reason: '尚未看到该提交的 Actions 运行', checkedAt: new Date().toISOString() };
    writeJsonAtomic(recordFile, record);
    console.log(JSON.stringify({ status: 'pending', reason: record.deploy.reason, sha, runsSeen: runs?.length ?? 0 }, null, 2));
    process.exit(1);
  }
  if (run.status !== 'completed') {
    record.deploy = { status: 'pending', reason: `Actions 运行中：${run.status}`, workflowUrl: run.html_url, checkedAt: new Date().toISOString() };
    writeJsonAtomic(recordFile, record);
    console.log(JSON.stringify({ status: 'pending', runStatus: run.status, workflowUrl: run.html_url }, null, 2));
    process.exit(1);
  }
  if (run.conclusion !== 'success') {
    record.deploy = { status: 'failed', reason: `Actions 结论：${run.conclusion}`, workflowUrl: run.html_url, checkedAt: new Date().toISOString() };
    writeJsonAtomic(recordFile, record);
    console.log(JSON.stringify({ status: 'failed', conclusion: run.conclusion, workflowUrl: run.html_url }, null, 2));
    process.exit(2);
  }
  const production = await checkProduction(slug);
  record.deploy = {
    status: production.ok ? 'verified' : 'failed',
    reason: production.ok ? null : '生产页面校验未通过',
    url: production.url,
    production,
    workflowUrl: run.html_url,
    checkedAt: new Date().toISOString(),
  };
  writeJsonAtomic(recordFile, record);
  console.log(JSON.stringify({ status: production.ok ? 'verified' : 'failed', sha, production }, null, 2));
  process.exit(production.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(2);
});
