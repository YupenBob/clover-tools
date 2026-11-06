/** 语料与工具索引加载（供脚本与 CI 门禁共用）。 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripHtml } from './quality.mjs';

const cache = new Map();

async function importTs(root, relativePath) {
  const url = pathToFileURL(join(root, relativePath)).href;
  return import(url);
}

/** 工具索引：slug / 公开 href / 分类 / 关键词。 */
export async function loadToolIndex(root) {
  if (cache.has('tools')) return cache.get('tools');
  const { getAllTools, getToolHref, CATEGORIES } = await importTs(root, 'src/lib/tools.ts');
  const tools = getAllTools();
  const slugs = new Set(tools.map((tool) => tool.slug));
  const hrefs = new Map(tools.map((tool) => [tool.slug, getToolHref(tool.category, tool.slug)]));
  const categories = (CATEGORIES ?? []).map((category) => category.name);
  const index = {
    tools,
    slugs,
    hrefs,
    categories,
    byKeyword: tools,
    hrefSet: new Set(hrefs.values()),
  };
  cache.set('tools', index);
  return index;
}

/** 站内指南语料（含自动文章，调用方自行排除候选 slug）。 */
export async function loadSiteCorpus(root) {
  if (cache.has('guides')) return cache.get('guides');
  const { GUIDES } = await importTs(root, 'src/lib/guides.ts');
  const corpus = GUIDES.map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    description: guide.description,
    toolSlug: guide.toolSlug,
    category: guide.category,
    text: stripHtml(guide.content),
    sources: guide.sources ?? [],
    auto: Boolean(guide._meta?.auto),
  }));
  cache.set('guides', corpus);
  return corpus;
}

/** 既有（非自动、非本次升级目标）指南的分类集合与 slug 集合。 */
export async function loadExistingCategories(root) {
  const corpus = await loadSiteCorpus(root);
  const { DEFAULT_CONFIG } = await import('./config.mjs');
  const categories = new Set(DEFAULT_CONFIG.contentCategories);
  for (const entry of corpus) if (entry.category) categories.add(entry.category);
  return [...categories];
}

/** CSDN 语料（data/articles.json 的正文 HTML）。 */
export function loadCsdnCorpus(root) {
  if (cache.has('csdn')) return cache.get('csdn');
  let corpus = [];
  const file = join(root, 'data/articles.json');
  if (existsSync(file)) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      corpus = (data.articles ?? []).map((article) => ({
        slug: article.slug,
        title: article.title,
        text: stripHtml(article.content ?? ''),
      }));
    } catch {
      corpus = [];
    }
  }
  cache.set('csdn', corpus);
  return corpus;
}

/** 图片登记表：public/article-images 下各月份的 captures.json 与 diagrams.json。 */
export function loadImageRegistry(root) {
  if (cache.has('images')) return cache.get('images');
  const registry = new Map();
  const base = join(root, 'public', 'article-images');
  if (existsSync(base)) {
    for (const dir of readdirSync(base, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      for (const name of ['captures.json', 'diagrams.json']) {
        const file = join(base, dir.name, name);
        if (!existsSync(file)) continue;
        try {
          const entries = JSON.parse(readFileSync(file, 'utf8'));
          for (const entry of entries) {
            if (!entry?.file) continue;
            registry.set(entry.file, {
              file: entry.file,
              dir: dir.name,
              path: `public/article-images/${dir.name}/${entry.file}`,
              width: entry.width,
              height: entry.height,
              sha256: entry.sha256,
              bytes: entry.bytes,
            });
          }
        } catch {
          // 登记文件损坏时由调用方以"未登记"处理
        }
      }
    }
  }
  cache.set('images', registry);
  return registry;
}

/** 自动文章数据文件列表（data/editorial-guides/*.json）。 */
export function listAutoGuideFiles(root) {
  const dir = join(root, 'data', 'editorial-guides');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    // 只读简体源文件 `<slug>.json`；跳过 translations.json 与译文 `<slug>.<lang>.json`
    .filter((name) => name !== 'translations.json')
    .filter((name) => !/\.(tw|en|ko|ja)\.json$/.test(name))
    .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name))
    .sort()
    .map((name) => join(dir, name));
}

export function readJsonFile(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function clearCorpusCache() {
  cache.clear();
}
