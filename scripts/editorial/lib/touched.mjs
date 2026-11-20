/**
 * 本趟「精确改动清单」：apply-draft / apply-translations / import-draft 都往同一个清单里追加文件，
 * 提交阶段由 stage-changes.mjs 只暂存这些文件，并校验 index 与清单完全一致。
 *
 * 为什么要精确清单（2026-11-20 评审驱动）：
 * - allowedPaths 是目录级前缀，`public/article-images/` 能覆盖别的文章；
 * - zh-only 分支原来漏了 `public/article-assets/`，导致示意图「本地有、main 没有」；
 * - 目录级 `git add` 会把工作区里与本趟无关的改动一并提交。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { STATE_PATHS } from './paths.mjs';

export function touchedFile(run) {
  return join(STATE_PATHS.runs, run, 'touched.json');
}

export function readTouched(run) {
  try {
    return JSON.parse(readFileSync(touchedFile(run), 'utf8'));
  } catch {
    return { run, files: [], updatedAt: null };
  }
}

export function normalizePath(path) {
  return String(path).replace(/\\/g, '/').replace(/^\.\//, '');
}

/** 追加文件（去重、排序），返回合并后的清单。 */
export function addTouched(run, files) {
  const record = readTouched(run);
  const merged = new Set((record.files ?? []).map(normalizePath));
  for (const file of files) {
    if (file) merged.add(normalizePath(file));
  }
  const next = {
    run,
    files: [...merged].sort(),
    updatedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(touchedFile(run)), { recursive: true });
  writeFileSync(touchedFile(run), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function writeTouched(run, files) {
  const next = { run, files: [...new Set(files.map(normalizePath))].sort(), updatedAt: new Date().toISOString() };
  mkdirSync(dirname(touchedFile(run)), { recursive: true });
  writeFileSync(touchedFile(run), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function touchedExists(run) {
  return existsSync(touchedFile(run));
}
