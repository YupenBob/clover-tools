import {
  commitPaths,
  currentBranch,
  fetchOrigin,
  git,
  gitOut,
  headSha,
  isClean,
  mergeFfOnly,
  pushMain,
  remoteHead,
  resetHard,
  revertCommit,
  statusPorcelain,
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

function changedPathList(from, to, cwd) {
  return gitOut(['diff', '--name-only', `${from}..${to}`], { cwd })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Publish, tolerating a main checkout that moved while the tool was building.
 * The reviewed commit is rebased onto the new main only when the moved commits
 * and the tool commit touch completely disjoint paths — otherwise the publish is
 * refused so that no concurrent content change can be silently reverted.
 */
export function publishWithRebase({ mainRepo, base, sha, worktree }) {
  const first = publishToMain({ mainRepo, base, sha });
  if (first.ok || !['main-moved', 'origin-moved'].includes(first.reason)) return first;
  const fail = (reason, detail) => ({ ok: false, reason, detail });
  try {
    fetchOrigin(mainRepo);
    const newBase = remoteHead(mainRepo);
    if (!newBase || newBase === base) return first;
    // The worktree clone may predate the concurrent commits; fetch them so the
    // path comparison and the rebase can see the new base.
    git(['fetch', '--quiet', 'origin', 'main'], { cwd: worktree, allowFailure: true });
    const mine = changedPathList(base, sha, worktree);
    const theirs = changedPathList(base, newBase, worktree);
    const overlap = mine.filter((path) => theirs.includes(path));
    if (overlap.length) {
      return fail(
        'main-moved-conflict',
        `并发提交与本次工具改动重叠：${overlap.slice(0, 8).join(', ')}`,
      );
    }
    if (currentBranch(mainRepo) !== 'main') return fail('main-not-checked-out', currentBranch(mainRepo));
    if (!isClean(mainRepo)) return fail('main-dirty', statusPorcelain(mainRepo).slice(0, 200).join('\n'));
    if (headSha(mainRepo) !== newBase && git(['merge', '--ff-only', newBase], { cwd: mainRepo, allowFailure: true }).code !== 0) {
      return fail('main-not-fast-forwardable', `main ${headSha(mainRepo).slice(0, 8)} / origin ${newBase.slice(0, 8)}`);
    }
    const rebase = git(['rebase', '--onto', newBase, base, sha], { cwd: worktree, allowFailure: true });
    if (rebase.code !== 0) {
      git(['rebase', '--abort'], { cwd: worktree, allowFailure: true });
      return fail('rebase-conflict', (rebase.stderr || '').trim().slice(0, 300));
    }
    const rebased = headSha(worktree);
    const published = publishToMain({ mainRepo, base: newBase, sha: rebased });
    if (!published.ok) return published;
    return { ...published, rebased: true, previousBase: base, base: newBase, sha: rebased };
  } catch (error) {
    return fail('rebase-error', String(error.message ?? error).slice(0, 300));
  }
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
