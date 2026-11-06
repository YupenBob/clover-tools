#!/usr/bin/env node
/**
 * CI 持久门禁：校验 data/editorial-guides/ 下的自动文章满足质量规范。
 * 运行于 `npm run check`（构建之后），不依赖 .editorial/ 本地状态。
 * 非 auto（从旧版迁移的）文章只做基础结构校验。
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT, REPO_PATHS } from './editorial/lib/paths.mjs';
import { DEFAULT_CONFIG } from './editorial/lib/config.mjs';
import {
  loadCsdnCorpus,
  loadExistingCategories,
  loadImageRegistry,
  loadSiteCorpus,
  loadToolIndex,
  listAutoGuideFiles,
} from './editorial/lib/corpus.mjs';
import { validateGuideStatic, stripHtml, cjkCount } from './editorial/lib/quality.mjs';
import { readImageInfo } from './editorial/lib/images.mjs';
import { buildAutoIndex } from './editorial/build-auto-index.mjs';
import { buildTranslationArtifacts } from './editorial/build-translation-index.mjs';
import {
  scanTranslationFiles,
  validateTranslationStatic,
  countTranslations,
} from './lib/guide-i18n-audit.mjs';

const errors = [];
const warnings = [];
const config = DEFAULT_CONFIG;
const guidesDir = join(ROOT, REPO_PATHS.guidesDir);

/** 校验译文文件、translations.json 与生成产物是否一致。返回汇总行。 */
function checkTranslations() {
  const scan = scanTranslationFiles(guidesDir);
  for (const message of scan.errors) errors.push(message);
  const counts = countTranslations(scan.translations);

  for (const entry of scan.translations) {
    let source;
    try {
      source = JSON.parse(
        readFileSync(join(guidesDir, `${entry.slug}.json`), 'utf8'),
      );
    } catch (error) {
      errors.push(`${basename(entry.file)}: 无法读取简体源（${error.message}）`);
      continue;
    }
    const result = validateTranslationStatic(entry.data, source, entry.lang);
    for (const message of result.errors)
      errors.push(`${basename(entry.file)}: ${message}`);
    for (const message of result.warnings)
      warnings.push(`${basename(entry.file)}: ${message}`);
  }

  let artifacts = null;
  try {
    artifacts = buildTranslationArtifacts({ check: true });
  } catch (error) {
    errors.push(`多语言指南清单生成失败：${error.message}`);
  }
  if (artifacts?.changed) {
    errors.push(
      'translations.json 或 src/lib/guides-translated.ts 未与译文文件同步（运行 node scripts/editorial/build-translation-index.mjs 后提交）',
    );
  }

  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(join(guidesDir, 'translations.json'), 'utf8'));
  } catch (error) {
    errors.push(`translations.json 缺失或无法解析：${error.message}`);
  }
  const manifestSlugs = manifest?.slugs ?? {};
  for (const entry of scan.translations) {
    const list = manifestSlugs[entry.slug]?.translations;
    if (!Array.isArray(list) || !list.includes(entry.lang)) {
      errors.push(
        `translations.json 缺少译文记录：${entry.slug}.${entry.lang}`,
      );
    }
  }
  for (const [slug, value] of Object.entries(manifestSlugs)) {
    for (const lang of Array.isArray(value?.translations) ? value.translations : []) {
      if (
        !scan.translations.some(
          (entry) => entry.slug === slug && entry.lang === lang,
        )
      ) {
        errors.push(`translations.json 列出的译文缺少文件：${slug}.${lang}.json`);
      }
    }
    if (value?.zh && !existsSync(join(guidesDir, `${slug}.json`))) {
      errors.push(`translations.json 列出的简体源缺少文件：${slug}.json`);
    }
  }

  const total = scan.translations.length;
  return `多语言指南检查通过：${total} 篇译文（tw ${counts.tw}, en ${counts.en}, ko ${counts.ko}, ja ${counts.ja}）`;
}

function printAndExit() {
  if (warnings.length > 0)
    console.warn(
      warnings.slice(0, 10).map((warning) => `提醒：${warning}`).join('\n'),
    );
  if (errors.length > 0) {
    console.error(
      errors.slice(0, 40).map((error) => `错误：${error}`).join('\n'),
    );
    if (errors.length > 40) console.error(`……另有 ${errors.length - 40} 条错误`);
    process.exit(1);
  }
}

async function main() {
  const files = listAutoGuideFiles(ROOT);
  const translationSummary = checkTranslations();
  if (files.length === 0) {
    printAndExit();
    console.log('自动指南检查通过：当前没有自动文章（目录为空）');
    console.log(translationSummary);
    return;
  }
  const toolIndex = await loadToolIndex(ROOT);
  const corpus = await loadSiteCorpus(ROOT);
  const csdnCorpus = loadCsdnCorpus(ROOT);
  const categories = await loadExistingCategories(ROOT);
  const imageRegistry = loadImageRegistry(ROOT);

  const seenSlugs = new Set();
  const seenQueries = new Set();
  const strict = [];
  const basic = [];

  for (const file of files) {
    let guide;
    try {
      guide = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${basename(file)} 不是合法 JSON：${error.message}`);
      continue;
    }
    const name = basename(file, '.json');
    if (guide.slug !== name) errors.push(`${basename(file)} 的 slug (${guide.slug}) 与文件名不一致`);
    if (seenSlugs.has(guide.slug)) errors.push(`自动文章 slug 重复：${guide.slug}`);
    seenSlugs.add(guide.slug);

    // 基础字段（所有迁移/自动文章）
    for (const field of ['slug', 'title', 'description', 'category', 'toolSlug', 'published', 'updated', 'content', 'readingMinutes']) {
      if (guide[field] === undefined || guide[field] === null || guide[field] === '') errors.push(`${guide.slug}: 缺少字段 ${field}`);
    }
    if (!Array.isArray(guide.sources)) errors.push(`${guide.slug}: sources 必须是数组`);
    if (!Array.isArray(guide.faqs)) errors.push(`${guide.slug}: faqs 必须是数组`);

    if (guide._meta?.auto !== true) {
      basic.push(guide.slug);
      continue;
    }
    strict.push(guide.slug);
    if (!guide._meta.runId) errors.push(`${guide.slug}: _meta.runId 缺失`);
    if (!guide._meta.reviewerVerdict) errors.push(`${guide.slug}: _meta.reviewerVerdict 缺失`);
    if (guide._meta.reviewerVerdict !== 'pass') errors.push(`${guide.slug}: 复核结论不是 pass`);
    if (!(Number(guide._meta.reviewerConfidence) >= config.quality.minReviewerConfidence)) {
      errors.push(`${guide.slug}: 复核信心不足或缺失`);
    }
    if (!guide._meta.verifiedAt || Number.isNaN(Date.parse(guide._meta.verifiedAt))) errors.push(`${guide.slug}: _meta.verifiedAt 无效`);
    const queryKey = String(guide._meta.primaryQuery ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');
    if (queryKey) {
      if (seenQueries.has(queryKey)) errors.push(`${guide.slug}: 目标查询与已发布文章重复：${guide._meta.primaryQuery}`);
      seenQueries.add(queryKey);
    }

    const result = validateGuideStatic(guide, {
      mode: guide._meta.mode ?? 'new-guide',
      config,
      today: new Date().toISOString().slice(0, 10),
      toolIndex,
      categories,
      corpus,
      csdnCorpus,
      imageRegistry,
      fileExists: (repoPath) => existsSync(join(ROOT, repoPath)),
    });
    for (const message of result.errors) errors.push(`${guide.slug}: ${message}`);
    for (const message of result.warnings) warnings.push(`${guide.slug}: ${message}`);

    // 图片实际字节与登记一致
    const images = [...String(guide.content).matchAll(/<img\b[^>]*src=["'](\/article-images\/[^"']+)["']/gi)].map((match) => match[1]);
    for (const src of images) {
      const file = src.split('/').pop();
      const registryEntry = imageRegistry.get(file);
      if (!registryEntry) {
        errors.push(`${guide.slug}: 图片未登记 ${src}`);
        continue;
      }
      const absolute = join(ROOT, registryEntry.path);
      if (!existsSync(absolute)) {
        errors.push(`${guide.slug}: 图片文件缺失 ${registryEntry.path}`);
        continue;
      }
      const info = readImageInfo(absolute);
      if (registryEntry.sha256 && info.sha256 !== registryEntry.sha256) errors.push(`${guide.slug}: 图片哈希不一致 ${file}`);
      if (registryEntry.width && info.width !== registryEntry.width) errors.push(`${guide.slug}: 图片宽度不一致 ${file}`);
      if (registryEntry.height && info.height !== registryEntry.height) errors.push(`${guide.slug}: 图片高度不一致 ${file}`);
    }
  }

  const barrel = buildAutoIndex({ check: true });
  if (barrel.changed) errors.push('src/lib/guides-auto.ts 未与 data/editorial-guides/ 同步（运行 build-auto-index 后提交）');

  const summary = {
    files: files.length,
    strict: strict.length,
    migratedBasicOnly: basic.length,
    totalCjk: strict.reduce((sum, slug) => {
      const guide = JSON.parse(readFileSync(join(ROOT, REPO_PATHS.guidesDir, `${slug}.json`), 'utf8'));
      return sum + cjkCount(stripHtml(guide.content));
    }, 0),
    errors: errors.length,
    warnings: warnings.length,
  };
  if (warnings.length > 0) console.warn(warnings.slice(0, 10).map((warning) => `提醒：${warning}`).join('\n'));
  if (errors.length > 0) {
    console.error(errors.slice(0, 40).map((error) => `错误：${error}`).join('\n'));
    if (errors.length > 40) console.error(`……另有 ${errors.length - 40} 条错误`);
    process.exit(1);
  }
  console.log(`自动指南检查通过：${summary.files} 个文件（严格 ${summary.strict} 篇、迁移 ${summary.migratedBasicOnly} 篇），共 ${summary.totalCjk} 汉字`);
  console.log(translationSummary);
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(1);
});
