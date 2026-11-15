import { join } from 'node:path';
import { readJson, writeJsonAtomic, writeTextAtomic, nowIso } from './util.mjs';
import { runDir, saveRun, writeLatest } from './state.mjs';
import { summarizeGates } from './gates.mjs';

export function phaseLine(name, phase) {
  if (!phase) return null;
  const status = phase.status ?? 'pending';
  const seconds =
    phase.durationMs != null ? `${Math.round(phase.durationMs / 1000)}s` : '';
  return `${name}: ${status}${seconds ? ` (${seconds})` : ''}`;
}

export function reportMarkdown(run) {
  const lines = [];
  lines.push(`# CloverTools 工具流水线 · ${run.runKey}`);
  lines.push('');
  lines.push(`- 状态：**${run.status}**`);
  if (run.item) {
    const flags = [
      run.item.category,
      run.item.scope,
      run.item.network ? 'network' : 'local-only',
      run.item.requiresSecrets?.length ? `secrets:${run.item.requiresSecrets.join(',')}` : null,
    ].filter(Boolean);
    lines.push(`- 选题：${run.item.title ?? run.item.slug}（${run.item.slug}）· ${flags.join(' · ')}`);
  }
  lines.push(`- 开始/结束：${run.startedAt} → ${run.finishedAt ?? '—'}`);
  if (run.baseSha) lines.push(`- base：${run.baseSha.slice(0, 12)}`);
  lines.push('');
  lines.push('## 阶段');
  for (const [name, phase] of Object.entries(run.phases ?? {})) {
    const line = phaseLine(name, phase);
    if (line) lines.push(`- ${line}${phase.detail ? ` — ${phase.detail}` : ''}`);
  }
  if (run.diff?.counts) {
    lines.push('');
    lines.push(
      `## 代码改动\n- ${run.diff.counts.total} 个文件（新增 ${run.diff.counts.added} / 修改 ${run.diff.counts.modified}）`,
    );
    if (run.diff.issues?.length) {
      for (const issue of run.diff.issues.slice(0, 10)) {
        lines.push(`- ⚠ ${issue.path}: ${issue.message}`);
      }
    }
  }
  if (run.gates?.length) {
    lines.push('');
    lines.push('## 门禁');
    lines.push(summarizeGates(run.gates));
  }
  if (run.review) {
    lines.push('');
    lines.push('## 独立复核');
    lines.push(
      `- verdict=${run.review.verdict} confidence=${run.review.confidence} model=${run.review.model ?? '—'}`,
    );
    for (const issue of run.review.blockingIssues ?? []) lines.push(`- blocking: ${issue}`);
    for (const issue of (run.review.nonBlocking ?? []).slice(0, 6)) {
      lines.push(`- non-blocking: ${issue}`);
    }
    if (run.review.rubric && Object.keys(run.review.rubric).length) {
      const rubric = Object.entries(run.review.rubric)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      lines.push(`- rubric: ${rubric}`);
    }
  }
  if (run.publish) {
    lines.push('');
    lines.push('## 发布');
    lines.push(`- status=${run.publish.status} commit=${run.publish.commit ?? '—'}`);
    if (run.publish.message) lines.push(`- message=${run.publish.message}`);
    if (run.publish.detail) lines.push(`- detail=${run.publish.detail}`);
  }
  if (run.verify) {
    lines.push('');
    lines.push('## 部署验证');
    lines.push(`- status=${run.verify.status}`);
    if (run.verify.reason) lines.push(`- reason=${run.verify.reason}`);
    if (run.verify.checks) {
      for (const check of run.verify.checks) {
        const result = check.result ?? {};
        lines.push(`- ${check.kind} ${check.locale ?? ''} ${check.url}: ${result.status ?? '?'}`);
      }
    }
  }
  if (run.queue) {
    lines.push('');
    lines.push('## 队列');
    lines.push(
      `- 剩余 ready=${run.queue.ready ?? '?'} published=${run.queue.published ?? '?'} stalled=${run.queue.stalled ?? '?'} failed=${run.queue.failed ?? '?'}`,
    );
  }
  if (run.error) {
    lines.push('');
    lines.push('## 错误');
    lines.push('```');
    lines.push(String(run.error).slice(0, 4000));
    lines.push('```');
  }
  if (run.notes?.length) {
    lines.push('');
    lines.push('## 备注');
    for (const note of run.notes) lines.push(`- ${note}`);
  }
  return `${lines.join('\n')}\n`;
}

export function writeRun(run) {
  run.updatedAt = nowIso();
  saveRun(run);
  writeTextAtomic(join(runDir(run.runKey), 'report.md'), reportMarkdown(run));
  writeLatest(run);
  return run;
}

export function readRunReport(runKey) {
  return readJson(join(runDir(runKey), 'run.json'), null);
}

export function summarizeRun(run) {
  if (!run) return { ok: false, reason: 'no-run' };
  return {
    ok: run.status === 'published' || run.status === 'verified',
    runKey: run.runKey,
    status: run.status,
    item: run.item,
    commit: run.publish?.commit ?? null,
    review: run.review
      ? { verdict: run.review.verdict, confidence: run.review.confidence }
      : null,
    verify: run.verify?.status ?? null,
    error: run.error ?? null,
    report: join(runDir(run.runKey), 'report.md'),
  };
}
