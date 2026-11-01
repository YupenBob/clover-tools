/** 工作区写入的安全回滚：记录写入前状态，失败时精确恢复。 */
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';
import { git, statusPorcelain } from './git.mjs';

export function isTracked(repoPath) {
  const result = git(['ls-files', '--error-unmatch', '--', repoPath], { allowFailure: true });
  return result.status === 0;
}

/** 记录若干路径在写入前的状态。路径相对仓库根。 */
export function snapshotPaths(paths) {
  return paths.map((path) => {
    const absolute = join(ROOT, path);
    const existed = existsSync(absolute);
    return {
      path,
      existed,
      tracked: existed ? isTracked(path) : false,
      isDirectory: existed ? statSync(absolute).isDirectory() : false,
    };
  });
}

/** 按快照恢复：新增的删除；已存在且被跟踪的用 git checkout 还原。 */
export function rollbackSnapshot(snapshot) {
  const restored = [];
  const removed = [];
  for (const entry of [...snapshot].reverse()) {
    const absolute = join(ROOT, entry.path);
    if (!entry.existed) {
      if (existsSync(absolute)) {
        rmSync(absolute, { recursive: true, force: true });
        removed.push(entry.path);
      }
      continue;
    }
    if (entry.tracked) {
      git(['checkout', '--', entry.path], { allowFailure: true });
      restored.push(entry.path);
    }
  }
  return { restored, removed };
}

/** 校验当前 git status 只包含允许路径；返回不允许的条目。 */
export function unexpectedChanges(allowedPaths) {
  return statusPorcelain().filter((line) => {
    const path = line.slice(3).trim().replace(/^"|"$/g, '');
    return !allowedPaths.some((prefix) => (prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix));
  });
}

/** 确保仓库内目录存在。 */
export function ensureDirectory(repoPath) {
  mkdirSync(join(ROOT, repoPath), { recursive: true });
}
