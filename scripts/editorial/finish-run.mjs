#!/usr/bin/env node
/**
 * 结束一次运行：汇总产物写运行记录、更新队列状态与安全计数、输出对话摘要。
 * 用法：node scripts/editorial/finish-run.mjs --run <runKey> --status published|local-commit|failed|reverted [--slug <slug>]
 *        [--title "标题"] [--commit <sha>] [--push-ok [--push-sha <sha>]] [--push-error "…"]
 *        [--deploy-status pending|verified|failed] [--error "…"]... [--warning "…"]...
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { ensureStateDirs, loadQueue, loadState, readJson, recordOutcome, saveQueue, saveState, writeRunRecord } from './lib/state.mjs';
import { buildRunRecord, formatDigest } from './lib/report.mjs';

const SINGLE_FLAGS = ['run', 'status', 'slug', 'title', 'commit', 'push-sha', 'push-error', 'deploy-status'];

function parseArgs(argv) {
  const options = { errors: [], warnings: [], pushOk: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--push-ok') {
      options.pushOk = true;
      continue;
    }
    if (arg === '--error') {
      options.errors.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--warning') {
      options.warnings.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (!SINGLE_FLAGS.includes(key)) continue;
    options[key] = argv[index + 1];
    index += 1;
  }
  return options;
}

function main() {
  ensureStateDirs();
  const options = parseArgs(process.argv.slice(2));
  if (!options.run || !options.status) throw new Error('用法：finish-run.mjs --run <runKey> --status <status>');
  const runDir = join(STATE_PATHS.runs, options.run);
  const review = readJson(join(runDir, 'review.json'), null);
  const verify = readJson(join(runDir, 'verify.json'), null);
  const sources = readJson(join(runDir, 'sources.json'), []);
  const request = readJson(join(STATE_PATHS.drafts, options.slug ?? '', 'draft-request.json'), null);

  const record = buildRunRecord({
    runKey: options.run,
    date: options.run.slice(0, 10),
    slot: options.run.includes('Tmanual') ? 'manual' : options.run.slice(11, 13),
    type: request?.type ?? verify?.mode ?? null,
    slug: options.slug ?? verify?.slug ?? null,
    title: options.title ?? null,
    status: options.status,
    metrics: verify?.metrics ?? {},
    evidence: {
      claims: verify?.metrics?.evidenceClaims ?? null,
      sources: Array.isArray(sources) ? sources.map((source) => ({ url: source.url, status: source.status })) : [],
    },
    commits: options.commit ? [{ sha: options.commit }] : [],
    push: options.pushOk || options['push-error'] || options['push-sha']
      ? { ok: Boolean(options.pushOk), sha: options['push-sha'] ?? options.commit ?? null, error: options['push-error'] ?? null }
      : null,
    deploy: options['deploy-status'] ? { status: options['deploy-status'] } : verify?.ok ? { status: 'pending' } : null,
    reviewer: review ? { verdict: review.verdict, confidence: review.confidence, blocking: review.blockingIssues ?? [] } : null,
    errors: options.errors,
    warnings: options.warnings,
  });
  record.finishedAt = new Date().toISOString();

  writeRunRecord(record);

  const state = loadState();
  recordOutcome(state, {
    runKey: record.runKey,
    slug: record.slug,
    status: record.status,
    date: record.date,
    durationMs: new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime(),
  });
  saveState(state);

  const queue = loadQueue();
  const item = queue.items.find((entry) => entry.runId === options.run || entry.slug === options.slug);
  if (item) {
    item.status = options.status === 'published' || options.status === 'local-commit' ? 'published' : options.status === 'reverted' ? 'reverted' : 'failed';
    item.lastError = options.errors.length > 0 ? options.errors[0] : null;
    item.updatedAt = new Date().toISOString();
    saveQueue(queue);
  }

  console.log(formatDigest(record));
  console.log('');
  console.log(JSON.stringify({ ok: true, run: options.run, status: options.status, record: `.editorial/runs/${options.run}.json` }, null, 2));
}

main();
