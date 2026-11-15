import {
  commitPaths,
  currentBranch,
  fetchOrigin,
  headSha,
  isClean,
  mergeFfOnly,
  pushMain,
  remoteHead,
  resetHard,
  revertCommit,
} from './git.mjs';

export function commitTool({ worktree, paths, item, author }) {
  if (!paths.length) throw new Error('no changed paths to commit');
  const kind = item.type === 'upgrade-tool' ? 'upgrade' : 'add';
  const title = item.title ?? item.slug;
  const message = `feat(tool): ${kind} ${title} (${item.slug})`;
  const sha = commitPaths(paths, message, { cwd: worktree, author });
  return { sha, message };
}

/**
 * Publish the already-verified worktree commit by fast-forwarding the clean main
 * checkout and pushing. The main checkout is the one the content pipeline uses,
 * so it must be at the same base and clean.
 */
export function publishToMain({ mainRepo, base, sha }) {
  if (!isClean(mainRepo)) {
    return { ok: false, reason: 'main-dirty', detail: '主 checkout 有未提交改动' };
  }
  if (currentBranch(mainRepo) !== 'main') {
    return { ok: false, reason: 'main-not-checked-out', detail: currentBranch(mainRepo) };
  }
  if (headSha(mainRepo) !== base) {
    return {
      ok: false,
      reason: 'main-moved',
      detail: `main ${headSha(mainRepo).slice(0, 8)} != base ${base.slice(0, 8)}`,
    };
  }
  fetchOrigin(mainRepo);
  if (remoteHead(mainRepo) !== base) {
    return {
      ok: false,
      reason: 'origin-moved',
      detail: `origin/main ${remoteHead(mainRepo).slice(0, 8)} != base ${base.slice(0, 8)}`,
    };
  }
  try {
    mergeFfOnly(sha, mainRepo);
    pushMain(mainRepo);
  } catch (error) {
    try {
      resetHard(base, mainRepo);
    } catch {
      /* surface the original failure */
    }
    return { ok: false, reason: 'push-failed', detail: error.message };
  }
  return { ok: true, reason: 'pushed', commit: sha, mainHead: headSha(mainRepo) };
}

export function revertPublished({ mainRepo, sha, reason }) {
  if (!isClean(mainRepo)) {
    return { ok: false, reason: 'main-dirty', detail: '主 checkout 有未提交改动，无法自动 revert' };
  }
  try {
    fetchOrigin(mainRepo);
    const revertSha = revertCommit(sha, mainRepo);
    pushMain(mainRepo);
    return { ok: true, commit: revertSha, reason };
  } catch (error) {
    return { ok: false, reason: 'revert-failed', detail: error.message };
  }
}
