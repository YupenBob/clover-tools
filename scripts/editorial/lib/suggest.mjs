/** 公开搜索建议（autocomplete）采集：无凭证的需求代理数据。 */
import { normalizeForShingles } from './quality.mjs';

const PROVIDERS = {
  bing: async (query) => {
    const response = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`bing HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  },
  google: async (query) => {
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`google HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  },
  baidu: async (query) => {
    const response = await fetch(`https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloverToolsEditorialBot/1.0)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`baidu HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.g) ? data.g.map((item) => item?.q).filter(Boolean) : [];
  },
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

function cleanSuggestion(value) {
  const text = String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length >= 2 && text.length <= 60 ? text : null;
}

/** 采集一个种子词在全部 provider 下的建议；单个 provider 失败不影响其他。 */
export async function gatherSuggestions(seed, { providers = listProviders(), timeoutMs = 12000 } = {}) {
  const results = {};
  const errors = {};
  for (const provider of providers) {
    try {
      const suggestions = await PROVIDERS[provider](seed);
      results[provider] = [...new Set(suggestions.map(cleanSuggestion).filter(Boolean))].slice(0, 10);
    } catch (error) {
      errors[provider] = String(error.message ?? error).slice(0, 120);
      results[provider] = [];
    }
  }
  return { seed, results, errors };
}

/** 建议词的稳定指纹，用于跨 provider 去重。 */
export function suggestionKey(text) {
  return normalizeForShingles(text);
}

/**
 * 把多轮采集结果聚合成候选：
 * - 出现在 n 个 provider 的同一建议视为更强需求信号；
 * - 记录最佳名次（越靠前越强）。
 */
export function aggregateSuggestions(batches) {
  const map = new Map();
  for (const batch of batches) {
    for (const [provider, suggestions] of Object.entries(batch.results ?? {})) {
      suggestions.forEach((suggestion, index) => {
        const key = suggestionKey(suggestion);
        if (!key) return;
        const existing = map.get(key) ?? { text: suggestion, providers: new Set(), bestRank: 999, seeds: new Set() };
        existing.text = suggestion.length < existing.text.length ? suggestion : existing.text;
        existing.providers.add(provider);
        existing.bestRank = Math.min(existing.bestRank, index + 1);
        existing.seeds.add(batch.seed);
        map.set(key, existing);
      });
    }
  }
  return [...map.values()].sort((a, b) => b.providers.size - a.providers.size || a.bestRank - b.bestRank || a.text.localeCompare(b.text));
}

export function suggestionPriority(entry, { informational = false, gap = false } = {}) {
  const providerScore = entry.providers.size * 120;
  const rankScore = Math.max(0, 60 - entry.bestRank * 6);
  const intentScore = informational ? 50 : 0;
  const gapScore = gap ? 40 : 0;
  return Math.round(providerScore + rankScore + intentScore + gapScore);
}

/** 工具页类型的导航查询（"xxx 在线/工具/下载"）不适合写成指南。 */
export function looksToolPageQuery(query, tool) {
  const normalize = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '');
  const q = normalize(query);
  const names = [tool?.name, tool?.slug, ...(tool?.keywords ?? [])].map(normalize).filter(Boolean);
  for (const name of names) {
    if (!q.startsWith(name)) continue;
    const rest = q.slice(name.length);
    if (!rest || /^(在线|工具|器|生成器|转换器|下载|官网|免费|网站|app|软件|入口|地址|怎么用)$/.test(rest)) return true;
  }
  return false;
}

/** 同一工具只保留最强的若干条候选，避免同义变体淹没队列。 */
export function clusterByTool(candidates, perTool = 2) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidate.toolSlug ?? candidate.id;
    const list = groups.get(key) ?? [];
    list.push(candidate);
    groups.set(key, list);
  }
  const kept = [];
  let dropped = 0;
  for (const list of groups.values()) {
    list.sort((a, b) => b.priority - a.priority);
    kept.push(...list.slice(0, perTool));
    dropped += Math.max(0, list.length - perTool);
  }
  return { kept: kept.sort((a, b) => b.priority - a.priority), dropped };
}
