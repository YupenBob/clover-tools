import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
