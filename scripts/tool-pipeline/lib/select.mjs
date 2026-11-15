import { loadQueue, saveQueue, seedQueue, updateQueueItem } from './state.mjs';

export async function loadRegistrySlugs() {
  const module = await import(new URL('../../../src/lib/tools.ts', import.meta.url));
  return new Set(module.getAllTools().map((tool) => tool.slug));
}

/**
 * Deterministic selection: highest priority ready item that is not already in the
 * registry, not cooling down, and whose required secrets are present.
 */
export function selectNext(queue, { registry, env = process.env, now = new Date() } = {}) {
  const skipped = [];
  const eligible = [];
  for (const item of queue.items ?? []) {
    if (!item?.slug || !item?.category) {
      skipped.push({ id: item?.id, reason: 'invalid-item' });
      continue;
    }
    if (registry?.has(item.slug)) {
      skipped.push({ id: item.id, reason: 'already-in-registry' });
      continue;
    }
    if (item.status === 'published' || item.status === 'skipped') {
      skipped.push({ id: item.id, reason: `status-${item.status}` });
      continue;
    }
    if (item.status !== 'ready' && item.status !== 'failed') {
      skipped.push({ id: item.id, reason: `status-${item.status}` });
      continue;
    }
    const attempts = Number(item.attempts ?? 0);
    const maxAttempts = Number(item.maxAttempts ?? 2);
    if (item.status === 'failed' && attempts >= maxAttempts) {
      skipped.push({ id: item.id, reason: 'attempts-exhausted' });
      continue;
    }
    if (item.cooldownUntil && new Date(item.cooldownUntil) > now) {
      skipped.push({ id: item.id, reason: 'cooldown' });
      continue;
    }
    const missing = (item.requiresSecrets ?? []).filter((name) => !env[name]);
    if (missing.length && (item.secretPolicy ?? 'optional') === 'required') {
      skipped.push({ id: item.id, reason: 'missing-secrets', missing });
      continue;
    }
    eligible.push(item);
  }
  eligible.sort((a, b) => {
    const priority = Number(b.priority ?? 0) - Number(a.priority ?? 0);
    if (priority) return priority;
    return String(a.id).localeCompare(String(b.id));
  });
  return { item: eligible[0] ?? null, skipped };
}

/** Mark items that are already shipped; keeps a fresh clone from rebuilding them. */
export function syncPublished(queue, registry) {
  let changed = false;
  for (const item of queue.items ?? []) {
    if (registry.has(item.slug) && item.status !== 'published') {
      item.status = 'published';
      item.publishedAt = item.publishedAt ?? new Date().toISOString();
      item.updatedAt = new Date().toISOString();
      item.reason = 'already-in-registry';
      changed = true;
    }
  }
  if (changed) saveQueue(queue);
  return changed;
}

export function prepareQueue() {
  const queue = seedQueue(loadQueue());
  saveQueue(queue);
  return queue;
}

export function markInProgress(queue, item, runId) {
  return updateQueueItem(queue, item.id, {
    status: 'in_progress',
    attempts: Number(item.attempts ?? 0) + 1,
    runId,
    startedAt: new Date().toISOString(),
    lastError: null,
  });
}

export function markPublished(queue, item, { runId, commit }) {
  return updateQueueItem(queue, item.id, {
    status: 'published',
    runId,
    commit,
    publishedAt: new Date().toISOString(),
    lastError: null,
  });
}

export function markFailed(queue, item, { runId, error, cooldownHours = 0 }) {
  return updateQueueItem(queue, item.id, {
    status: 'failed',
    runId,
    lastError: String(error ?? 'unknown').slice(0, 2000),
    cooldownUntil:
      cooldownHours > 0
        ? new Date(Date.now() + cooldownHours * 3600 * 1000).toISOString()
        : null,
  });
}

export function markStalled(queue, item, { runId, error }) {
  return updateQueueItem(queue, item.id, {
    status: 'stalled',
    runId,
    lastError: String(error ?? 'unknown').slice(0, 2000),
  });
}

export function findItem(queue, { id, slug }) {
  return (
    queue.items.find((item) => item.id === id) ??
    queue.items.find((item) => item.slug === slug) ??
    null
  );
}
