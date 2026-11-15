import { spawnSync } from 'node:child_process';
import { sleep } from './util.mjs';
import { REPO } from './paths.mjs';
import { revertPublished } from './publish.mjs';
import { pause } from './state.mjs';

function gh(args, cwd = REPO) {
  const result = spawnSync('gh', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, GH_PROMPT_DISABLED: '1' },
  });
  if (result.error) throw result.error;
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function ghJson(args, cwd = REPO) {
  const result = gh(args, cwd);
  if (result.code !== 0) throw new Error(result.stderr || `gh ${args.join(' ')} failed`);
  return JSON.parse(result.stdout || '[]');
}

export function findQualityRun(sha, workflow, cwd = REPO) {
  let runs;
  try {
    runs = ghJson(
      [
        'run',
        'list',
        '--commit',
        sha,
        '--limit',
        '30',
        '--json',
        'databaseId,status,conclusion,workflowName,headSha,url',
      ],
      cwd,
    );
  } catch (error) {
    return { status: 'error', reason: error.message };
  }
  const exact = runs.find((run) => run.headSha === sha && run.workflowName === workflow);
  const any = runs.find((run) => run.headSha === sha);
  return exact ?? any ?? null;
}

export function runJobs(runId, cwd = REPO) {
  try {
    const data = ghJson(['run', 'view', String(runId), '--json', 'jobs'], cwd);
    return data.jobs ?? [];
  } catch {
    return [];
  }
}

async function checkPage(url, expectedLang) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'cache-control': 'no-cache' },
    });
    const text = await response.text();
    const lang = /<html[^>]*\blang="([^"]+)"/i.exec(text)?.[1] ?? '';
    const title = /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1]?.trim() ?? '';
    return {
      ok: response.status === 200 && (!expectedLang || lang === expectedLang) && Boolean(title),
      status: response.status,
      lang,
      title: title.slice(0, 120),
      bytes: text.length,
    };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function readJson(url, init = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    ...init,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    cacheControl: response.headers.get('cache-control') ?? '',
    bytes: text.length,
    json,
  };
}

// Deep production check for a tool API. The generic gate only tells whether the
// endpoint answers; an API that freezes, caches or drifts would still read as
// "ok", so a configured schema verifies the field set, the no-store contract and
// that the reported clock keeps moving between two samples.
export async function checkApi(url, spec = {}) {
  const startedAt = performance.now();
  const failures = [];
  // Every sample goes through the same inspection, so the second response can
  // never be looser than the first one.
  const inspect = (sample, label) => {
    const prefix = label ? `${label}: ` : '';
    if (sample.status !== 200) failures.push(`${prefix}status ${sample.status}`);
    if (spec.noStore && !/no-store/i.test(sample.cacheControl))
      failures.push(`${prefix}cache-control ${sample.cacheControl || '(missing)'}`);
    if (sample.json === null) {
      failures.push(`${prefix}response is not JSON`);
      return;
    }
    const body = sample.json;
    if (spec.fields) {
      const actual = Object.keys(body).sort();
      const expected = [...spec.fields].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        failures.push(`${prefix}fields ${actual.join(',')}`);
      const types = spec.types ?? {};
      for (const field of expected) {
        const kind = types[field];
        const value = body[field];
        if (kind === 'number') {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
            failures.push(`${prefix}${field} must be a finite non-negative number`);
        } else if (kind === 'boolean') {
          if (typeof value !== 'boolean')
            failures.push(`${prefix}${field} must be a boolean`);
        } else if (kind === 'boolean-true') {
          if (value !== true) failures.push(`${prefix}${field} must be true`);
        } else if (kind === 'string') {
          if (typeof value !== 'string' || !value)
            failures.push(`${prefix}${field} must be a non-empty string`);
        }
      }
      for (const [field, max] of Object.entries(spec.max ?? {})) {
        if (typeof body[field] === 'number' && body[field] > max)
          failures.push(`${prefix}${field} ${body[field]} exceeds ${max}`);
      }
      for (const [field, limit] of Object.entries(spec.below ?? {})) {
        if (typeof body[field] === 'number' && body[field] >= limit)
          failures.push(`${prefix}${field} ${body[field]} must stay below ${limit}`);
      }
      if (spec.plausible) {
        const value = body[spec.plausible.field];
        if (
          typeof value === 'number' &&
          Math.abs(value - Date.now()) > spec.plausible.withinMs
        )
          failures.push(`${prefix}${spec.plausible.field} is implausible`);
      }
      if (spec.source && body.source !== spec.source)
        failures.push(`${prefix}source ${body.source} !== ${spec.source}`);
      if (spec.sourceUrl && body.sourceUrl !== spec.sourceUrl)
        failures.push(`${prefix}sourceUrl ${body.sourceUrl} !== ${spec.sourceUrl}`);
    }
  };
  try {
    const first = await readJson(url);
    inspect(first, '');
    if (spec.advanceField && first.json) {
      const before = performance.now();
      await sleep(2100);
      const second = await readJson(url);
      const elapsed = performance.now() - before;
      inspect(second, 'second sample');
      const from = first.json[spec.advanceField];
      const to = second.json?.[spec.advanceField];
      if (!Number.isFinite(from) || !Number.isFinite(to))
        failures.push(`second sample missing ${spec.advanceField}`);
      else if (Math.abs(to - from - elapsed) > 1000)
        failures.push(
          `${spec.advanceField} advanced ${Math.round(to - from)}ms in ${Math.round(elapsed)}ms`,
        );
    }
    if (spec.methodGuards) {
      const query = await fetch(`${url}?probe=1`, {
        signal: AbortSignal.timeout(20000),
      });
      await query.body?.cancel();
      if (query.status !== 400) failures.push(`query parameter status ${query.status}`);
      const post = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
      });
      await post.body?.cancel();
      if (post.status !== 405) failures.push(`POST status ${post.status}`);
    }
    return {
      ok: failures.length === 0,
      status: first.status,
      contentType: first.contentType,
      bytes: first.bytes,
      failures,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
      failures: [...failures, error.message],
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }
}

export async function verifyDeploy({ run, config, mainRepo, autoRevert = true }) {
  const publish = run.publish ?? {};
  if (publish.status !== 'pushed' || !publish.commit) {
    return { status: 'skipped', reason: 'not-pushed' };
  }
  const quality = findQualityRun(publish.commit, config.verify.qualityWorkflow, mainRepo);
  if (!quality) return { status: 'pending', reason: 'no-workflow-run' };
  if (!quality.status || quality.status !== 'completed') {
    return { status: 'pending', reason: 'workflow-running', workflow: quality };
  }
  if (quality.conclusion !== 'success') {
    const result = {
      status: 'ci-failed',
      conclusion: quality.conclusion,
      workflow: quality,
    };
    if (autoRevert && config.verify.autoRevertOnQualityFailure !== false) {
      result.revert = revertPublished({
        mainRepo,
        sha: publish.commit,
        reason: 'ci-quality-failed',
      });
      if (result.revert.ok) {
        pause('工具流水线 CI 质量检查失败，已自动 revert');
        result.status = 'reverted';
      }
    }
    return result;
  }

  const jobs = runJobs(quality.databaseId, mainRepo);
  const deploy = jobs.find((job) => /deploy production/i.test(job.name ?? ''));
  if (!deploy) {
    return { status: 'pending', reason: 'deploy-job-not-found', workflow: quality };
  }
  if (deploy.status && deploy.status !== 'completed') {
    return { status: 'pending', reason: 'deploy-running', workflow: quality };
  }
  if (deploy.conclusion && deploy.conclusion !== 'success') {
    return { status: 'deploy-failed', conclusion: deploy.conclusion, workflow: quality };
  }

  const base = config.verify.productionBase.replace(/\/$/, '');
  const checks = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    checks.length = 0;
    for (const locale of config.verify.productionLanguages ?? ['zh']) {
      const prefix = locale === 'zh' ? '' : locale === 'tw' ? '/zh-hant' : `/${locale}`;
      const url = `${base}${prefix}/tools/${run.item.category}/${run.item.slug}/`;
      checks.push({
        kind: 'page',
        locale,
        url,
        result: await checkPage(url, LANG_FOR[locale]),
      });
    }
    if (run.apiPath) {
      const url = `${base}${run.apiPath}`;
      checks.push({
        kind: 'api',
        url,
        result: await checkApi(url, config.verify.apiChecks?.[run.apiPath] ?? {}),
      });
    }
    if (checks.every((check) => check.result.ok)) break;
    if (attempt < 3) await sleep(15000);
  }
  const failed = checks.filter((check) => !check.result.ok);
  if (failed.length) {
    const result = { status: 'production-failed', checks, failed };
    if (autoRevert) {
      result.revert = revertPublished({
        mainRepo,
        sha: publish.commit,
        reason: 'production-verification-failed',
      });
      if (result.revert.ok) {
        pause('工具生产页面/API 校验失败，已自动 revert');
        result.status = 'reverted';
      }
    }
    return result;
  }
  return { status: 'verified', checks, workflow: quality };
}
