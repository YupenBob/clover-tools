/** 运行记录与对话摘要。 */
import { writeJsonAtomic } from './state.mjs';
import { join } from 'node:path';
import { STATE_PATHS } from './paths.mjs';

export function buildRunRecord({
  runKey,
  date,
  slot,
  type,
  slug,
  title,
  startedAt = new Date().toISOString(),
  status = 'running',
  steps = [],
  metrics = {},
  evidence = {},
  commits = [],
  push = null,
  deploy = null,
  reviewer = null,
  errors = [],
  warnings = [],
}) {
  return {
    version: 1,
    runKey,
    date,
    slot,
    type,
    slug,
    title,
    startedAt,
    finishedAt: null,
    status,
    steps,
    metrics,
    evidence,
    commits,
    push,
    deploy,
    reviewer,
    errors,
    warnings,
  };
}

export function writeRun(run) {
  return writeJsonAtomic(join(STATE_PATHS.runs, `${run.runKey}.json`), run);
}

export function formatDigest(run) {
  const lines = [];
  const statusLabel = {
    published: '已发布',
    drafted: '已生成本地分支',
    'local-commit': '已本地提交（未推送）',
    failed: '失败',
    reverted: '已回滚',
    skipped: '跳过',
  };
  lines.push(`【内容流水线】${statusLabel[run.status] ?? run.status}：${run.title ?? run.slug ?? run.runKey}`);
  if (run.metrics?.cjk) {
    lines.push(
      `篇幅：${run.metrics.cjk} 汉字 / ${run.metrics.h2 ?? '?'} 个 H2 / 来源 ${run.metrics.sources ?? '?'} 条 / 内链 ${run.metrics.internalToolLinks ?? '?'} 个 / 最大相似度 ${run.metrics.maxSimilarity ?? '?'}`,
    );
  }
  if (run.reviewer) lines.push(`独立复核：${run.reviewer.verdict}（confidence ${run.reviewer.confidence ?? '?'}）`);
  if (run.push) lines.push(`推送：${run.push.ok ? '成功' : `失败（${run.push.error}）`}${run.push.sha ? ` · ${run.push.sha.slice(0, 8)}` : ''}`);
  if (run.deploy) lines.push(`部署验证：${run.deploy.status}${run.deploy.url ? ` · ${run.deploy.url}` : ''}`);
  if (run.errors?.length) lines.push(`问题：${run.errors.slice(0, 3).join('；')}`);
  if (run.warnings?.length) lines.push(`提醒：${run.warnings.slice(0, 2).join('；')}`);
  if (run.steps?.length) {
    const last = run.steps[run.steps.length - 1];
    if (last?.durationMs) lines.push(`耗时：${(run.steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0) / 1000).toFixed(0)} 秒`);
  }
  return lines.join('\n');
}

export function summarizeSteps(steps) {
  return (steps ?? []).map((step) => `${step.name}${step.ok ? '✓' : '✗'}${step.durationMs ? ` ${(step.durationMs / 1000).toFixed(0)}s` : ''}`).join(' → ');
}
