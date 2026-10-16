/** Read the last V2 Git tree; never execute the archived generator. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { getAllTools, getToolHref } from '../src/lib/tools.ts';

const ref = execFileSync('git', ['rev-parse', '098c422^'], { encoding: 'utf8' }).trim();
const gitText = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const gitJson = (path) => JSON.parse(gitText(path));
const keywords = gitJson('keywords.json');
const articles = gitJson('articles.json').articles;
// -z preserves Chinese filenames; Git's default quoted output is not a filename.
const paths = execFileSync('git', ['ls-tree', '-rz', '--name-only', ref, '--', 'article_contents'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const contents = new Map(paths.map((path) => [path.slice('article_contents/'.length, -5), gitText(path)]));
const articleMap = new Map(articles.map((article) => [article.slug, {
  ...article,
  body: contents.has(article.slug) ? contents.get(article.slug) : article.content,
  source: contents.has(article.slug) ? `article_contents/${article.slug}.html` : `articles.json#${article.slug}`,
}]));
const oldTools = new Map();
for (const path of ['tools.json', 'plugins/tools.json']) {
  for (const category of gitJson(path)) {
    for (const tool of category.tools) oldTools.set(tool.path, tool);
  }
}
const replacements = new Map();
for (const tool of getAllTools()) {
  for (const path of [tool.legacyPath, ...(tool.legacyAliases || [])].filter(Boolean)) {
    replacements.set(path, getToolHref(tool.category, tool.slug));
  }
}

const entries = keywords.map((entry, index) => {
  // These are the actual lookup and filename rules in generateBlogPosts().
  const slug = entry.keyword.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const custom = articleMap.get(entry.keyword);
  const selected = custom?.body?.trim() ? {
    source: custom.source, articleSlug: custom.slug,
  } : contents.has(slug) ? {
    source: `article_contents/${slug}.html`, articleSlug: articleMap.has(slug) ? slug : '',
  } : { source: 'intent-template', articleSlug: '' };
  return {
    entry: index + 1, keyword: entry.keyword, slug,
    declaredSlug: entry.slug || '', intent: entry.intent || '', category: entry.category || '',
    source: selected.source, articleSlug: selected.articleSlug,
    oldTool: entry.tool || '', toolResolved: oldTools.has(entry.tool),
    candidateTool: replacements.get(`/tools/${entry.tool}`) || '',
  };
});
// writeFileSync overwrites previous entries with the same normalized slug.
const final = new Map(entries.map((entry) => [entry.slug, entry]));
const pages = [...final.values()].sort((a, b) => a.entry - b.entry);
const usedArticles = new Set(pages.map((page) => page.articleSlug).filter(Boolean));
const countBy = (items, key) => items.reduce((counts, item) => {
  const value = key(item);
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});
const summary = {
  sourceRef: ref,
  method: 'Static reproduction of generateBlogPosts lookup and overwrite order; no historical deployment or traffic measurement.',
  keywordEntries: entries.length,
  uniqueArticleUrls: pages.length,
  overwrittenEntries: entries.length - pages.length,
  articleRecords: articles.length,
  dedicatedHtmlFiles: contents.size,
  finalBodySources: countBy(pages, (page) => page.source === 'intent-template' ? 'intent-template' : 'dedicated-body'),
  sourceFiles: countBy(pages, (page) => page.source === 'intent-template' ? 'intent-template' : page.source.startsWith('article_contents/') ? 'article_contents' : 'articles.json'),
  articleRecordsSelectedInFinalPages: usedArticles.size,
  articleRecordsNotSelectedInFinalPages: articles.length - usedArticles.size,
  finalTemplateIntents: countBy(pages.filter((page) => page.source === 'intent-template'), (page) => page.intent || 'missing (falls back to error-fix)'),
  declaredSlugDifferentFromFilename: entries.filter((entry) => entry.declaredSlug !== entry.slug).length,
  distinctDeclaredSlugsWithoutGeneratedArticle: new Set(entries.filter((entry) => entry.declaredSlug && !final.has(entry.declaredSlug)).map((entry) => entry.declaredSlug)).size,
  keywordToolMappings: countBy(entries, (entry) => !entry.oldTool ? 'absent' : entry.toolResolved ? 'resolved' : 'unknown'),
  regexToolKeywordEntries: entries.filter((entry) => entry.oldTool === 'code/regex-tester.html').length,
  interpretation: 'A dedicated body does not establish correctness or quality. A missing declared slug is a potential broken link target; it is not a measured 404 request.',
};
const csv = (rows) => '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
const out = new URL('../docs/audits/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('legacy-content-summary.json', out), JSON.stringify(summary, null, 2) + '\n');
await writeFile(new URL('legacy-blog-urls.csv', out), csv([
  ['keyword', 'old_path', 'html_alias', 'intent', 'category', 'body_source', 'article_record', 'old_tool', 'old_tool_resolved', 'candidate_tool_requires_review', 'current_redirect_rule'],
  ...pages.map((page) => [page.keyword, `/blog/${page.slug}`, `/blog/${page.slug}.html`, page.intent, page.category, page.source, page.articleSlug, page.oldTool, page.toolResolved, page.candidateTool, '/blog/* -> / (301)']),
]));
await writeFile(new URL('legacy-article-records.csv', out), csv([
  ['slug', 'title', 'keyword', 'body_source', 'selected_by_final_v2_pages', 'dedicated_file_exists'],
  ...articles.map((article) => [article.slug, article.title, article.keyword, articleMap.get(article.slug).source, usedArticles.has(article.slug), contents.has(article.slug)]),
]));
console.log(JSON.stringify(summary, null, 2));
