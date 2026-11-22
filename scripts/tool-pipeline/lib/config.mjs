import { CONFIG_FILE } from './paths.mjs';
import { readJson } from './util.mjs';

const REQUIRED = [
  'timezone',
  'publishMode',
  'author',
  'models',
  'timeoutsMinutes',
  'budget',
  'guard',
  'caps',
  'diff',
  'gates',
  'verify',
];

export function loadConfig() {
  const config = readJson(CONFIG_FILE, null);
  if (!config) {
    throw new Error(`missing ${CONFIG_FILE}`);
  }
  for (const key of REQUIRED) {
    if (!(key in config)) throw new Error(`tool-pipeline.config.json missing "${key}"`);
  }
  if (!config.diff.allowed?.length) throw new Error('config.diff.allowed must not be empty');
  return config;
}

export function itemVars(item) {
  return {
    cat: item.category,
    slug: item.slug,
    tool: item.slug,
  };
}

export function codexModel(config, role) {
  return config.models?.[role] ?? config.models?.builder ?? 'gpt-6.2-sol';
}

export function codexReasoning(config, role) {
  return config.reasoning?.[role] ?? 'high';
}

export function timeoutMs(config, role) {
  const minutes = config.timeoutsMinutes?.[role] ?? 30;
  return minutes * 60 * 1000;
}

export function budgetDeadline(config, runStartedAt) {
  const start = new Date(runStartedAt).getTime();
  return start + (config.budget?.maxTotalMinutes ?? 330) * 60 * 1000;
}
