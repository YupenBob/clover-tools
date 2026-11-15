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

async function checkApi(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: response.status === 200 && json !== null,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      bytes: text.length,
    };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

const LANG_FOR = { zh: 'zh-CN', tw: 'zh-Hant', en: 'en', ko: 'ko', ja: 'ja' };

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
      checks.push({ kind: 'api', url, result: await checkApi(url) });
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
