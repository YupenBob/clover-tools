import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  globToRegExp,
  matchAny,
  parseTimeToMinutes,
  zonedNow,
  formatDuration,
} from '../tool-pipeline/lib/util.mjs';
import { selectNext } from '../tool-pipeline/lib/select.mjs';
import { lintSpec, parseVerifierJson, VERIFIER_SCHEMA } from '../tool-pipeline/lib/prompt.mjs';
import { auditDiff } from '../tool-pipeline/lib/diff-guard.mjs';
import { checkApi } from '../tool-pipeline/lib/verify-deploy.mjs';
import { publishWithRebase } from '../tool-pipeline/lib/publish.mjs';
import {
  buildIncidentEvidence,
  escalatedRepair,
  formatLastFailure,
  incidentCommit,
  incidentEligibility,
  repairableStatus,
  verifyFailureReason,
} from '../tool-pipeline/lib/incident.mjs';

const repo = join(import.meta.dirname, '../..');

test('glob matching supports placeholders, one-segment stars and double stars', () => {
  assert.equal(globToRegExp('src/pages/tools/daily/exam-clock.astro').test('src/pages/tools/daily/exam-clock.astro'), true);
  assert.equal(globToRegExp('src/lib/*.ts').test('src/lib/a/b.ts'), false);
  assert.equal(globToRegExp('src/lib/**/*.ts').test('src/lib/a/b.ts'), true);
  assert.equal(matchAny('src/lib/tool-content.ts', ['src/lib/tool-content.ts']), 'src/lib/tool-content.ts');
  assert.equal(matchAny('src/lib/exam-clock.ts', ['src/lib/{slug}.ts'], { slug: 'exam-clock' }), 'src/lib/{slug}.ts');
  assert.equal(matchAny('src/lib/exam-clock.ts', ['src/lib/{slug}.ts'], { slug: 'other' }), null);
});

test('timezone helper is independent from the host TZ', () => {
  const value = zonedNow('Asia/Shanghai', new Date('2026-11-15T16:00:00.000Z'));
  assert.equal(value.date, '2026-11-16');
  assert.equal(value.time, '00:00:00');
  assert.equal(value.hour, 0);
  assert.equal(parseTimeToMinutes('05:30'), 330);
  assert.equal(formatDuration(90_000), '1m30s');
});

test('selection is priority-first and respects registry, cooldown, attempts and secrets', () => {
  const now = new Date('2026-11-15T00:00:00.000Z');
  const items = [
    { id: 'low', slug: 'low', category: 'daily', status: 'ready', priority: 1, attempts: 0 },
    { id: 'high', slug: 'high', category: 'daily', status: 'ready', priority: 9, attempts: 0 },
    { id: 'published', slug: 'published', category: 'daily', status: 'ready', priority: 99, attempts: 0 },
    { id: 'cool', slug: 'cool', category: 'daily', status: 'ready', priority: 98, attempts: 0, cooldownUntil: '2026-11-16T00:00:00.000Z' },
    { id: 'failed', slug: 'failed', category: 'daily', status: 'failed', priority: 97, attempts: 2 },
    { id: 'secret', slug: 'secret', category: 'daily', status: 'ready', priority: 96, attempts: 0, requiresSecrets: ['KEY'], secretPolicy: 'required' },
  ];
  const registry = new Set(['published']);
  const selected = selectNext({ items }, { registry, env: {}, now });
  assert.equal(selected.item.id, 'high');
  assert.equal(selected.skipped.find((entry) => entry.id === 'published').reason, 'already-in-registry');
  assert.equal(selected.skipped.find((entry) => entry.id === 'cool').reason, 'cooldown');
  assert.equal(selected.skipped.find((entry) => entry.id === 'failed').reason, 'attempts-exhausted');
  assert.equal(selected.skipped.find((entry) => entry.id === 'secret').reason, 'missing-secrets');

  const env = { KEY: '1' };
  assert.equal(selectNext({ items }, { registry, env, now }).item.id, 'secret');
});

test('optional secrets do not block selection', () => {
  const selected = selectNext(
    {
      items: [
        {
          id: 'optional',
          slug: 'optional',
          category: 'daily',
          status: 'ready',
          priority: 5,
          requiresSecrets: ['MISSING'],
          secretPolicy: 'optional',
        },
      ],
    },
    { registry: new Set(), env: {}, now: new Date() },
  );
  assert.equal(selected.item.id, 'optional');
});

test('spec lint accepts a complete spec and rejects placeholders/missing sections', () => {
  const valid = `# 工具规格

## 用户与场景
用户在真实场景里使用这个工具。

## 核心功能
1. 功能一。

## 边界与错误
非法输入、空值、超时。

## 文件清单
src/lib/tool.ts。

## 测试计划
单测与浏览器用例。

## 验收标准
npm test 通过。

## i18n
zh/tw/en/ko/ja。

## SEO
标题与描述。
${'内容'.repeat(700)}
`;
  assert.equal(lintSpec(valid, { network: false }).ok, true);
  const missing = lintSpec('# 短 spec\nTODO', { network: true });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.length >= 2);
});

test('verifier JSON parsing enforces pass/confidence/blocking rules', () => {
  const pass = parseVerifierJson(
    JSON.stringify({
      verdict: 'pass',
      confidence: 0.85,
      blockingIssues: [],
      nonBlocking: [],
      rubric: { features: 0.9 },
    }),
  );
  assert.equal(pass.verdict, 'pass');
  const low = parseVerifierJson(
    JSON.stringify({ verdict: 'pass', confidence: 0.5, blockingIssues: [], nonBlocking: [], rubric: {} }),
  );
  assert.equal(low.verdict, 'fail');
  const blocking = parseVerifierJson(
    JSON.stringify({ verdict: 'pass', confidence: 0.9, blockingIssues: ['x'], nonBlocking: [], rubric: {} }),
  );
  assert.equal(blocking.verdict, 'fail');
  assert.equal(parseVerifierJson('not json').verdict, 'fail');
  assert.equal(VERIFIER_SCHEMA.required.includes('verdict'), true);
});

test('incident repair only accepts post-publish failures it can fix', () => {
  for (const status of ['ci-failed', 'production-failed', 'reverted']) {
    assert.equal(repairableStatus(status), true, `${status} should be repairable`);
  }
  for (const status of ['deploy-failed', 'verified', 'skipped', 'pending', '']) {
    assert.equal(repairableStatus(status), false, `${status} should not be repairable`);
  }
});

test('incident eligibility enforces cap, clean main, sync and disk', () => {
  const item = { slug: 'demo', category: 'daily' };
  const base = { verifyStatus: 'reverted', item, incidentRepairs: 0, maxIncidentRepairs: 1 };
  assert.deepEqual(incidentEligibility(base), { ok: true, status: 'eligible', reason: '' });
  assert.equal(incidentEligibility({ ...base, verifyStatus: 'deploy-failed' }).ok, false);
  assert.match(incidentEligibility({ ...base, verifyStatus: 'deploy-failed' }).reason, /deploy-failed/);
  assert.match(incidentEligibility({ ...base, item: null }).reason, /queue/);
  assert.match(incidentEligibility({ ...base, incidentRepairs: 1 }).reason, /上限 1/);
  assert.equal(incidentEligibility({ ...base, clean: false }).ok, false);
  assert.equal(incidentEligibility({ ...base, synced: false }).ok, false);
  assert.equal(incidentEligibility({ ...base, branch: 'feature' }).ok, false);
  assert.equal(incidentEligibility({ ...base, freeDiskGb: 1, minFreeDiskGb: 5 }).ok, false);
});

test('repair escalation kicks in after two failed repair rounds', () => {
  const config = {
    models: { repair: 'gpt-6.2-sol', repairEscalation: 'gpt-6-astra' },
    reasoning: { repair: 'high', repairEscalation: 'xhigh' },
  };
  const one = escalatedRepair(config, [{ ok: false }, { ok: true }]);
  assert.equal(one.escalated, false);
  assert.equal(one.model, 'gpt-6.2-sol');
  assert.equal(one.reasoning, 'high');
  const two = escalatedRepair(config, [{ ok: false }, { ok: false }]);
  assert.equal(two.escalated, true);
  assert.equal(two.failedRounds, 2);
  assert.equal(two.model, 'gpt-6-astra');
  assert.equal(two.reasoning, 'xhigh');
  const fallback = escalatedRepair(
    { models: { repair: 'gpt-6.2-sol' }, reasoning: { repair: 'medium' } },
    [{ ok: false }, { ok: false }],
  );
  assert.equal(fallback.model, 'gpt-6.2-sol');
  assert.equal(fallback.reasoning, 'medium');
});

test('incident evidence carries failure checks, rolled-back commit and spec path', () => {
  const run = {
    runKey: '2026-11-21T00',
    status: 'reverted',
    item: { slug: 'demo', title: 'Demo', category: 'dev', specPath: 'specs/demo.md' },
    publish: { commit: 'abc1234' },
    verify: {
      status: 'reverted',
      reason: 'production-verification-failed',
      workflow: { url: 'https://github.com/x/actions/runs/1' },
      failed: [
        {
          kind: 'api',
          url: 'https://clovertools.cn/api/demo',
          result: { failures: ['fields ok'] },
        },
      ],
      revert: { ok: true, commit: 'def5678' },
    },
  };
  const text = buildIncidentEvidence({
    run,
    commitShow: ' src/lib/demo.ts | 2 +-\n+ export const x = 1;',
    specPath: 'scripts/tool-pipeline/specs/demo.md',
  });
  assert.match(text, /2026-11-21T00/);
  assert.match(text, /production-verification-failed/);
  assert.match(text, /api https:\/\/clovertools\.cn\/api\/demo: fields ok/);
  assert.match(text, /abc1234/);
  assert.match(text, /src\/lib\/demo\.ts/);
  assert.match(text, /scripts\/tool-pipeline\/specs\/demo\.md/);
  assert.match(text, /失败材料/);
  assert.equal(incidentCommit(run), 'abc1234');
  assert.equal(incidentCommit({ verify: { revert: { commit: 'def5678' } } }), 'def5678');
});

test('last failure summary is compact and cleared when absent', () => {
  const summary = formatLastFailure({
    runKey: '2026-11-21T00',
    status: 'reverted',
    reason: 'CI 质量检查失败',
    evidencePath: '.editorial/tool-runs/2026-11-21T00/report.md',
  });
  assert.match(summary, /2026-11-21T00/);
  assert.match(summary, /CI 质量检查失败/);
  assert.match(summary, /最小 diff/);
  assert.equal(formatLastFailure(null), '');
  const reason = verifyFailureReason({
    status: 'ci-failed',
    conclusion: 'failure',
    workflow: { url: 'https://github.com/x/y' },
    failed: [{ kind: 'page', locale: 'en', url: 'https://x/en', result: { status: 500 } }],
  });
  assert.match(reason, /conclusion=failure/);
  assert.match(reason, /https:\/\/x\/en: 500/);
});

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'clover-pipeline-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  mkdirSync(join(dir, 'src/lib'), { recursive: true });
  writeFileSync(join(dir, 'src/lib/old.ts'), 'export {};\n');
  writeFileSync(join(dir, 'package.json'), '{}\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: dir });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  return { dir, base };
}

const diffConfig = {
  diff: {
    allowed: [
      'src/lib/{slug}.ts',
      'scripts/tests/{slug}.test.mjs',
      'src/components/*.astro',
      'package.json',
    ],
    allowedNewOnly: ['src/lib/{slug}.ts', 'scripts/tests/{slug}.test.mjs'],
    forbidden: ['package.json'],
    maxFileBytes: 1024 * 1024,
    maxChangedFiles: 20,
  },
};

test('diff guard is default-deny and blocks forbidden, rewrites and oversized changes', () => {
  const { dir, base } = makeRepo();
  mkdirSync(join(dir, 'scripts/tests'), { recursive: true });
  writeFileSync(join(dir, 'scripts/tests/demo.test.mjs'), 'test("x", () => {});\n');
  const item = { slug: 'demo', category: 'daily' };
  writeFileSync(join(dir, 'package.json'), '{"changed":true}\n');
  let result = auditDiff({ worktree: dir, base, item, config: diffConfig });
  assert.equal(result.ok, false, 'package.json must be forbidden when changed');
  // remove the forbidden change, then add the allowed new file
  execFileSync('git', ['checkout', '--', 'package.json'], { cwd: dir });
  result = auditDiff({ worktree: dir, base, item, config: diffConfig });
  assert.equal(result.ok, true);
  writeFileSync(join(dir, 'src/lib/other.ts'), 'export {};\n');
  result = auditDiff({ worktree: dir, base, item, config: diffConfig });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'not-allowed'), true);
});

const timeSpec = {
  fields: [
    'ok',
    'serverNowMs',
    'source',
    'sourceUrl',
    'sourceSampleMs',
    'sampleAgeMs',
    'upstreamRttMs',
    'uncertaintyMs',
    'cached',
  ],
  types: {
    ok: 'boolean-true',
    serverNowMs: 'number',
    source: 'string',
    sourceUrl: 'string',
    sourceSampleMs: 'number',
    sampleAgeMs: 'number',
    upstreamRttMs: 'number',
    uncertaintyMs: 'number',
    cached: 'boolean',
  },
  max: { sampleAgeMs: 15000 },
  plausible: { field: 'serverNowMs', withinMs: 60000 },
  source: 'cloudflare-trace',
  sourceUrl: 'https://www.cloudflare.com/cdn-cgi/trace',
  advanceField: 'serverNowMs',
  noStore: true,
  methodGuards: true,
};

function timeServer(sample) {
  const server = http.createServer((request, response) => {
    if (request.url.includes('?probe=1')) {
      response.writeHead(400, { 'content-type': 'application/json' });
      return response.end('{}');
    }
    if (request.method === 'POST') {
      response.writeHead(405, { 'content-type': 'application/json' });
      return response.end('{}');
    }
    const body = sample();
    const headers = {
      'content-type': 'application/json',
      'cache-control': body.cacheControl ?? 'no-store',
    };
    delete body.cacheControl;
    response.writeHead(200, headers);
    response.end(JSON.stringify(body));
  });
  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/api/time` }),
    ),
  );
}

const liveSample = () => ({
  ok: true,
  serverNowMs: Date.now(),
  source: 'cloudflare-trace',
  sourceUrl: 'https://www.cloudflare.com/cdn-cgi/trace',
  sourceSampleMs: Date.now(),
  sampleAgeMs: 0,
  upstreamRttMs: 0,
  uncertaintyMs: 1000,
  cached: false,
});

test('production API deep check accepts a live, uncached clock', async () => {
  const { server, url } = await timeServer(liveSample);
  try {
    const result = await checkApi(url, timeSpec);
    assert.deepEqual(result.failures, []);
    assert.equal(result.ok, true);
  } finally {
    server.close();
  }
});

test('production API deep check rejects a malformed second sample', async () => {
  let calls = 0;
  const { server, url } = await timeServer(() => {
    calls += 1;
    if (calls === 1) return liveSample();
    return { ...liveSample(), sampleAgeMs: '15000' };
  });
  try {
    const result = await checkApi(url, timeSpec);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((item) => item.includes('second sample: sampleAgeMs')));
  } finally {
    server.close();
  }
});

test('production API deep check rejects malformed or cached replies', async () => {
  const stringNumbers = await timeServer(() => ({ ...liveSample(), sampleAgeMs: '0' }));
  try {
    const result = await checkApi(stringNumbers.url, timeSpec);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((item) => item.includes('sampleAgeMs')));
  } finally {
    stringNumbers.server.close();
  }
  const cacheable = await timeServer(() => ({ ...liveSample(), cacheControl: 'public, max-age=60' }));
  try {
    const result = await checkApi(cacheable.url, timeSpec);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((item) => item.includes('cache-control')));
  } finally {
    cacheable.server.close();
  }
  const frozen = await timeServer(() => ({ ...liveSample(), serverNowMs: Date.UTC(2026, 0, 1) }));
  try {
    const result = await checkApi(frozen.url, timeSpec);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((item) => item.includes('advanced')));
  } finally {
    frozen.server.close();
  }
});

test('deploy verification only trusts runs of the configured quality workflow', async () => {
  const { findQualityRun } = await import('../tool-pipeline/lib/verify-deploy.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'clover-gh-stub-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = join(bin, 'gh');
  writeFileSync(stub, '#!/usr/bin/env bash\nprintf \'%s\' "$GH_STUB_JSON"\n');
  execFileSync('chmod', ['+x', stub]);
  const savedPath = process.env.PATH;
  const savedJson = process.env.GH_STUB_JSON;
  try {
    process.env.PATH = `${bin}:${savedPath}`;
    process.env.GH_STUB_JSON = JSON.stringify([
      { databaseId: 1, status: 'completed', conclusion: 'failure', workflowName: 'Cloudflare crawler audit', headSha: 'abc' },
      { databaseId: 2, status: 'completed', conclusion: 'success', workflowName: 'Quality checks', headSha: 'abc' },
    ]);
    assert.equal(findQualityRun('abc', 'Quality checks', dir)?.databaseId, 2);

    process.env.GH_STUB_JSON = JSON.stringify([
      { databaseId: 1, status: 'completed', conclusion: 'failure', workflowName: 'Cloudflare crawler audit', headSha: 'abc' },
      { databaseId: 3, status: 'completed', conclusion: 'skipped', workflowName: 'Search engine submission', headSha: 'abc' },
    ]);
    assert.equal(findQualityRun('abc', 'Quality checks', dir), null);
  } finally {
    process.env.PATH = savedPath;
    if (savedJson === undefined) delete process.env.GH_STUB_JSON;
    else process.env.GH_STUB_JSON = savedJson;
  }
});

const gitIn = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const writeFile = (dir, rel, text) => {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
};

function rebaseFixture({ overlapping }) {
  const root = mkdtempSync(join(tmpdir(), 'clover-publish-'));
  const bare = join(root, 'remote.git');
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', bare], { cwd: root });
  const main = join(root, 'main');
  execFileSync('git', ['clone', '-q', bare, main], { cwd: root });
  gitIn(main, 'config', 'user.email', 'main@example.com');
  gitIn(main, 'config', 'user.name', 'Main');
  writeFile(main, 'README.md', 'base\n');
  writeFile(main, 'src/tool.ts', 'old\n');
  gitIn(main, 'add', '.');
  gitIn(main, 'commit', '-qm', 'base');
  gitIn(main, 'push', '-q', 'origin', 'main');
  const base = gitIn(main, 'rev-parse', 'HEAD');

  const worktree = join(root, 'wt');
  gitIn(main, 'worktree', 'add', '-q', '--detach', worktree, base);
  gitIn(worktree, 'config', 'user.email', 'bot@example.com');
  gitIn(worktree, 'config', 'user.name', 'Bot');
  writeFile(worktree, 'src/focus.ts', 'new tool\n');
  writeFile(worktree, 'docs/FOCUS.md', 'doc\n');
  gitIn(worktree, 'add', '.');
  gitIn(worktree, 'commit', '-qm', 'feat(tool): add focus');
  const sha = gitIn(worktree, 'rev-parse', 'HEAD');

  writeFile(main, overlapping ? 'src/focus.ts' : 'content/guide.json', 'moved\n');
  gitIn(main, 'add', '.');
  gitIn(main, 'commit', '-qm', 'content: concurrent change');
  gitIn(main, 'push', '-q', 'origin', 'main');
  return { main, worktree, base, sha };
}

test('publish rebases onto a concurrently advanced main when paths do not overlap', () => {
  const { main, worktree, base, sha } = rebaseFixture({ overlapping: false });
  const result = publishWithRebase({ mainRepo: main, base, sha, worktree });
  assert.equal(result.ok, true);
  assert.equal(result.rebased, true);
  const files = gitIn(main, 'ls-tree', '-r', '--name-only', 'origin/main').split('\n');
  for (const file of ['content/guide.json', 'docs/FOCUS.md', 'src/focus.ts']) {
    assert.equal(files.includes(file), true, `${file} should be on origin/main`);
  }
});

test('publish refuses to rebase when the concurrent commit overlaps tool paths', () => {
  const { main, worktree, base, sha } = rebaseFixture({ overlapping: true });
  const result = publishWithRebase({ mainRepo: main, base, sha, worktree });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'main-moved-conflict');
  assert.match(result.detail, /src\/focus\.ts/);
  // 未发布：远端仍只有并发提交，工具提交留在 worktree 里。
  assert.equal(gitIn(main, 'rev-parse', 'origin/main'), gitIn(main, 'rev-parse', 'HEAD'));
  const files = gitIn(main, 'ls-tree', '-r', '--name-only', 'origin/main').split('\n');
  assert.equal(files.includes('docs/FOCUS.md'), false);
  assert.equal(gitIn(worktree, 'rev-parse', 'HEAD'), sha);
});
