/**
 * 异常修复（incident repair）的纯逻辑：只做对象/字符串处理，不读写仓库、
 * 不调用 codex、不访问网络，方便单测覆盖。
 */

export const REPAIRABLE_VERIFY_STATUSES = ['ci-failed', 'production-failed', 'reverted'];
export const BAD_VERIFY_STATUSES = [...REPAIRABLE_VERIFY_STATUSES, 'deploy-failed'];

export function repairableStatus(status) {
  return REPAIRABLE_VERIFY_STATUSES.includes(String(status ?? ''));
}

/**
 * 前置资格检查。所有环境事实（git/磁盘）由调用方采集后传入，保持本函数可单测。
 * 返回 { ok, status, reason }。
 */
export function incidentEligibility({
  verifyStatus = '',
  item = null,
  incidentRepairs = 0,
  maxIncidentRepairs = 1,
  clean = true,
  branch = 'main',
  synced = true,
  freeDiskGb = Number.POSITIVE_INFINITY,
  minFreeDiskGb = 5,
} = {}) {
  if (!repairableStatus(verifyStatus)) {
    const hint = BAD_VERIFY_STATUSES.includes(verifyStatus)
      ? '（deploy-failed 属基础设施问题，不自动修复）'
      : '';
    return {
      ok: false,
      status: 'skipped',
      reason: `verify.status=${verifyStatus || 'none'} 不在可修复范围${hint}`,
    };
  }
  if (!item) return { ok: false, status: 'skipped', reason: 'queue 中找不到对应 item' };
  if (Number(incidentRepairs) >= Number(maxIncidentRepairs)) {
    return {
      ok: false,
      status: 'skipped',
      reason: `同一被修 run 已有 ${incidentRepairs} 次异常修复（上限 ${maxIncidentRepairs}）`,
    };
  }
  if (!clean) return { ok: false, status: 'skipped', reason: '主 checkout 不干净' };
  if (branch !== 'main') {
    return { ok: false, status: 'skipped', reason: `主 checkout 不在 main（${branch || 'unknown'}）` };
  }
  if (!synced) return { ok: false, status: 'skipped', reason: '本地 main 与 origin/main 不一致' };
  if (Number(freeDiskGb) < Number(minFreeDiskGb)) {
    return { ok: false, status: 'skipped', reason: `磁盘仅剩 ${Number(freeDiskGb).toFixed(1)}G` };
  }
  return { ok: true, status: 'eligible', reason: '' };
}

/**
 * 修复轮模型升级：既往失败修复轮 >= 2 次时，下一轮使用 repairEscalation
 * （缺失时回退 repair），reasoning 同理。
 */
export function escalatedRepair(config = {}, rounds = []) {
  const list = Array.isArray(rounds) ? rounds : [];
  const failedRounds = list.filter((round) => round && round.ok === false).length;
  const escalated = failedRounds >= 2;
  const models = config.models ?? {};
  const reasoning = config.reasoning ?? {};
  return {
    escalated,
    failedRounds,
    model: escalated ? models.repairEscalation ?? models.repair : models.repair,
    reasoning: escalated
      ? reasoning.repairEscalation ?? reasoning.repair
      : reasoning.repair,
  };
}

/** 把上一次坏的 verify 结果压成一句可放进队列/日志的摘要。 */
export function verifyFailureReason(result = {}) {
  const parts = [];
  if (result.reason) parts.push(`reason=${result.reason}`);
  if (result.conclusion) parts.push(`conclusion=${result.conclusion}`);
  if (result.detail) parts.push(String(result.detail));
  if (result.workflow?.url) parts.push(`workflow=${result.workflow.url}`);
  if (result.revert && result.revert.ok === false) {
    parts.push(`revert 失败：${result.revert.reason ?? 'unknown'}`);
  }
  const checks = Array.isArray(result.failed)
    ? result.failed
    : (result.checks ?? []).filter((check) => !check?.result?.ok);
  for (const check of checks) {
    const label = [check.kind, check.locale, check.url].filter(Boolean).join(' ');
    const detail = check.result?.failures?.length
      ? check.result.failures.join('；')
      : check.result?.status ?? check.result?.error ?? '未通过';
    parts.push(`${label}: ${detail}`);
  }
  return parts.join('；').slice(0, 2000);
}

/** 下一次常规 builder prompt 自动附带的失败摘要。 */
export function formatLastFailure(lastFailure) {
  if (!lastFailure) return '';
  const reason = String(lastFailure.reason ?? '').slice(0, 1500) || '未记录原因';
  return [
    `- 上一次发布失败 run ${lastFailure.runKey ?? '?'}（${lastFailure.status ?? 'bad'}）：${reason}`,
    `- 证据：${lastFailure.evidencePath || '无'}`,
    '- 必须在本轮最小 diff 内修掉同一问题，并在回复里说明对应哪条失败。',
  ].join('\n');
}

export function incidentCommit(run = {}) {
  return run.publish?.commit ?? run.verify?.revert?.commit ?? '';
}

/**
 * 生成写入新 run 目录的 incident.md：失败检查/原因/链接 + 被回滚提交的
 * git show stat+patch + spec 路径。
 */
export function buildIncidentEvidence({
  run = {},
  commitShow = '',
  specPath = '',
  previousIncidentRepairs = 0,
  at = new Date().toISOString(),
} = {}) {
  const verify = run.verify ?? {};
  const item = run.item ?? {};
  const commit = incidentCommit(run);
  const lines = [];
  lines.push(`# 异常修复证据 · ${run.runKey ?? 'unknown'}`);
  lines.push('');
  lines.push(`- 被修 run：${run.runKey ?? 'unknown'}`);
  lines.push(`- 原状态：${run.status ?? 'unknown'} · verify.status=${verify.status ?? 'none'}`);
  lines.push(`- 选题：${item.title ?? item.slug ?? '?'}（${item.slug ?? '?'}）· ${item.category ?? '?'}`);
  lines.push(`- 生成时间：${at}`);
  if (previousIncidentRepairs) lines.push(`- 既往异常修复次数：${previousIncidentRepairs}`);
  lines.push('');
  lines.push('## 失败材料');
  lines.push('');
  const reason = verifyFailureReason(verify);
  if (reason) lines.push(`- 原因：${reason}`);
  if (verify.workflow?.url) lines.push(`- CI run：${verify.workflow.url}`);
  const failed = Array.isArray(verify.failed)
    ? verify.failed
    : (verify.checks ?? []).filter((check) => !check?.result?.ok);
  if (failed.length) {
    lines.push('');
    lines.push('### 失败检查');
    for (const check of failed) {
      const label = [check.kind, check.locale, check.url].filter(Boolean).join(' ');
      const detail = check.result?.failures?.length
        ? check.result.failures.join('；')
        : check.result?.status ?? check.result?.error ?? '未通过';
      lines.push(`- ${label}: ${detail}`);
    }
  }
  if (verify.revert) {
    lines.push('');
    lines.push(
      `- 回滚：${verify.revert.ok ? `已回滚 ${verify.revert.commit ?? ''}` : `失败（${verify.revert.reason ?? 'unknown'}）`}`,
    );
  }
  lines.push('');
  lines.push('## 被回滚提交');
  lines.push('');
  lines.push(`- commit：${commit || '未记录'}`);
  if (specPath) lines.push(`- spec：${specPath}`);
  lines.push('');
  if (commitShow.trim()) {
    lines.push('```diff');
    lines.push(commitShow.trim());
    lines.push('```');
  } else {
    lines.push('（没有可用的 git show 输出）');
  }
  lines.push('');
  lines.push('## 修复要求');
  lines.push('');
  lines.push('- 只修导致本次发布失败的最小范围，不要新增无关功能或重写架构。');
  lines.push('- 不得删除/放宽测试与门禁，不得把失败改成 skip。');
  lines.push('- 修复后仍必须通过门禁与独立 verifier 才能发布。');
  return `${lines.join('\n')}\n`;
}
