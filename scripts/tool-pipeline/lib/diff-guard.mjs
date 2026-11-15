import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { itemVars } from './config.mjs';
import {
  addedLines,
  changedPaths,
  nameStatus,
  pathsAt,
  untrackedText,
} from './git.mjs';
import { fileSize, matchAny, readText } from './util.mjs';

export const GENERATED_PATHS = new Set([
  'data/i18n-tool-pages.json',
  'public/search-index.json',
  'public/en/search-index.json',
  'public/ja/search-index.json',
  'public/ko/search-index.json',
  'public/zh-hant/search-index.json',
]);

const SECRET_PATTERNS = [
  [/\bghp_[A-Za-z0-9]{20,}\b/, 'GitHub PAT'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, 'GitHub fine-grained PAT'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\b(?:CLOUDFLARE_API_TOKEN|IPAPI_IS_KEY|API_SECRET|ACCESS_TOKEN)\s*[:=]\s*['"][^'"]+['"]/, 'hardcoded secret'],
];

const BANNED_SNIPPETS = [
  [/\b(?:Lorem ipsum|待定|占位文本)\b/i, 'placeholder text'],
];

function addedTextFor(base, path, worktree, atBase) {
  if (!atBase.has(path)) return untrackedText(path, worktree);
  return addedLines(base, path, worktree).join('\n');
}

function isSourceForEval(path) {
  return (
    path.startsWith('src/lib/') ||
    path.startsWith('src/scripts/') ||
    path.startsWith('src/components/') ||
    path.startsWith('functions/')
  );
}

/**
 * Default-deny diff audit. Anything outside the allowlist is a blocker; this is
 * deliberately stricter than a normal code review because the builder is a model.
 */
export function auditDiff({ worktree, base, item, config }) {
  const vars = itemVars(item);
  const changed = changedPaths(base, worktree);
  const atBase = pathsAt(base, worktree);
  const issues = [];
  const files = [];

  for (const path of changed.deleted) {
    issues.push({ path, code: 'deleted', message: '不允许删除已有文件' });
  }

  for (const entry of nameStatus(base, worktree)) {
    if (entry.status.startsWith('R')) {
      issues.push({
        path: entry.to,
        code: 'renamed',
        message: `不允许重命名：${entry.from} → ${entry.to}`,
      });
    }
  }

  const paths = changed.all.filter(
    (path) => !path.startsWith('.editorial/') && !path.startsWith('.tool-pipeline/'),
  );

  if (paths.length > (config.diff.maxChangedFiles ?? 80)) {
    issues.push({
      path: '*',
      code: 'too-many-files',
      message: `改动文件 ${paths.length} 超过上限 ${config.diff.maxChangedFiles}`,
    });
  }

  for (const path of paths) {
    const forbidden = matchAny(path, config.diff.forbidden, vars);
    if (forbidden) {
      issues.push({ path, code: 'forbidden', message: `命中禁止路径：${forbidden}` });
      continue;
    }
    const allowed = matchAny(path, config.diff.allowed, vars);
    if (!allowed) {
      issues.push({ path, code: 'not-allowed', message: '不在允许路径内' });
      continue;
    }
    const newOnly = matchAny(path, config.diff.allowedNewOnly, vars);
    if (newOnly && atBase.has(path)) {
      issues.push({ path, code: 'new-only', message: `该路径只允许新增：${newOnly}` });
    }
    const size = fileSize(join(worktree, path));
    if (size > (config.diff.maxFileBytes ?? 2 * 1024 * 1024)) {
      issues.push({ path, code: 'too-large', message: `文件 ${size} bytes 超过上限` });
    }
    files.push({ path, status: atBase.has(path) ? 'modified' : 'added', bytes: size });
  }

  for (const path of paths) {
    if (GENERATED_PATHS.has(path)) continue;
    let text = '';
    try {
      text = atBase.has(path)
        ? addedTextFor(base, path, worktree, atBase)
        : readFileSync(join(worktree, path), 'utf8');
    } catch {
      continue;
    }
    if (!text) continue;
    for (const [regex, label] of SECRET_PATTERNS) {
      if (regex.test(text)) {
        issues.push({ path, code: 'secret', message: `疑似硬编码密钥：${label}` });
      }
    }
    for (const [regex, label] of BANNED_SNIPPETS) {
      if (regex.test(text)) {
        issues.push({ path, code: 'banned-snippet', message: `出现禁止内容：${label}` });
      }
    }
    if (isSourceForEval(path) && /\beval\s*\(|new Function\s*\(/.test(text)) {
      issues.push({ path, code: 'csp', message: 'eval/new Function 与站点 CSP 不兼容' });
    }
    if (isSourceForEval(path) && /\b(TODO|TBD|FIXME)\b/.test(text)) {
      issues.push({ path, code: 'placeholder', message: '源码含 TODO/TBD/FIXME' });
    }
    if (
      (path.startsWith('src/') || path.startsWith('functions/')) &&
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u.test(text)
    ) {
      // Tests and docs may legitimately contain symbols/emoji as fixtures or prose;
      // only user-facing source is checked. dist/ is checked by check-emoji.
      issues.push({ path, code: 'emoji', message: '用户可见源码含 emoji' });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    files,
    counts: {
      total: files.length,
      added: files.filter((file) => file.status === 'added').length,
      modified: files.filter((file) => file.status === 'modified').length,
    },
  };
}

export function diffSummary({ worktree, base, item, config }) {
  const result = auditDiff({ worktree, base, item, config });
  return {
    ok: result.ok,
    issues: result.issues,
    lines: result.files.map(
      (file) => `${file.status === 'added' ? '+' : '~'} ${file.path} (${file.bytes}b)`,
    ),
  };
}

export function readDocChange(worktree, base, item) {
  const changed = changedPaths(base, worktree);
  return changed.all.some(
    (path) =>
      path.startsWith('docs/') &&
      path.endsWith('.md') &&
      path.toLowerCase().includes(String(item.slug).toLowerCase()),
  );
}

export function readTodo(file) {
  return readText(file, '');
}
