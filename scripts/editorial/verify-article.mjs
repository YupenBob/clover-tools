#!/usr/bin/env node
/**
 * tick 最终门禁：静态规则 + 证据包 + 来源抓取 + 独立复核 + 图片哈希 + 允许路径。
 * 用法：node scripts/editorial/verify-article.mjs --slug <slug> --run <runKey>
 * 退出码 0 通过；1 校验失败；2 运行错误。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REPO_PATHS, STATE_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { readJson, writeJsonAtomic } from './lib/state.mjs';
import {
  loadCsdnCorpus,
  loadExistingCategories,
  loadImageRegistry,
  loadSiteCorpus,
  loadToolIndex,
} from './lib/corpus.mjs';
import {
  analyzeStructure,
  cjkCount,
  expectedReadingMinutes,
  stripHtml,
  validateEvidence,
  validateGuideStatic,
  validateSourceCoverage,
} from './lib/quality.mjs';
import { readImageInfo } from './lib/images.mjs';
import { buildAutoIndex } from './build-auto-index.mjs';
import { buildTranslationArtifacts } from './build-translation-index.mjs';
import { TRANSLATED_LANGS, validateTranslationStatic } from './lib/translate.mjs';
import { git } from './lib/git.mjs';
import { unexpectedChanges } from './lib/workspace.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--run') options.run = argv[index + 1];
  }
  return options;
}

async function main() {
  ensureDefaultConfig();
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug || !options.run) throw new Error('用法：verify-article.mjs --slug <slug> --run <runKey>');
  const runDir = join(STATE_PATHS.runs, options.run);
  const draftDir = join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(ROOT, REPO_PATHS.guidesDir, `${options.slug}.json`);
  if (!existsSync(guideFile)) throw new Error(`文章未落盘：${REPO_PATHS.guidesDir}${options.slug}.json`);
  const guide = readJson(guideFile);
  const evidence = readJson(join(draftDir, 'evidence.json'), null);
  const mode = guide._meta?.mode ?? 'new-guide';
  const errors = [];
  const warnings = [];

  if (guide._meta?.auto !== true) errors.push('_meta.auto 必须为 true');
  if (!guide._meta?.runId || guide._meta.runId !== options.run) errors.push(`_meta.runId 与本次运行不一致：${guide._meta?.runId}`);
  if (!guide._meta?.reviewerVerdict) errors.push('_meta 缺少复核结论 reviewerVerdict');

  // 独立复核结果
  const review = readJson(join(runDir, 'review.json'), null);
  if (!review) errors.push('缺少独立复核结果 review.json');
  else {
    if (review.verdict !== 'pass') errors.push(`独立复核未通过：${review.verdict}`);
    if (!(Number(review.confidence) >= config.quality.minReviewerConfidence)) {
      errors.push(`复核信心 ${review.confidence} 低于 ${config.quality.minReviewerConfidence}`);
    }
    if (Array.isArray(review.blockingIssues) && review.blockingIssues.length > 0) {
      errors.push(`复核仍有阻塞问题：${review.blockingIssues.slice(0, 3).join('；')}`);
    }
  }

  // 静态规则
  const toolIndex = await loadToolIndex(ROOT);
  const corpus = await loadSiteCorpus(ROOT);
  const csdnCorpus = loadCsdnCorpus(ROOT);
  const categories = await loadExistingCategories(ROOT);
  const imageRegistry = loadImageRegistry(ROOT);
  const staticResult = validateGuideStatic(guide, {
    mode,
    config,
    today: new Date().toISOString().slice(0, 10),
    toolIndex,
    categories,
    corpus,
    csdnCorpus,
    imageRegistry,
    fileExists: (repoPath) => existsSync(join(ROOT, repoPath)),
  });
  errors.push(...staticResult.errors);
  warnings.push(...staticResult.warnings);

  // 升级模式：URL 与首发日期保持，正文必须真实改动
  if (mode === 'upgrade-guide') {
    const original = git(['show', `HEAD:${REPO_PATHS.guidesDir}${options.slug}.json`], { allowFailure: true });
    if (original.status !== 0) errors.push('升级模式找不到 HEAD 中的原始文章');
    else {
      try {
        const previous = JSON.parse(original.stdout);
        if (previous.published !== guide.published) errors.push(`升级不得修改首发日期：${previous.published} → ${guide.published}`);
        if (previous.slug !== guide.slug) errors.push('升级不得修改 slug');
        if (previous.content === guide.content) errors.push('升级模式的正文没有变化');
        const before = cjkCount(stripHtml(previous.content));
        if (cjkCount(stripHtml(guide.content)) <= before) errors.push(`升级后字数（${cjkCount(stripHtml(guide.content))}）未超过升级前（${before}）`);
      } catch (error) {
        errors.push(`解析原始文章失败：${error.message}`);
      }
    }
  }

  // 来源覆盖（Lead 实际抓取）
  const sourceResults = readJson(join(runDir, 'sources.json'), []) ?? [];
  const verifiedSources = new Map(sourceResults.map((result) => [result.url, result]));
  errors.push(...validateSourceCoverage(guide, verifiedSources).errors);

  // 证据包
  if (!evidence) errors.push('缺少证据包 .editorial/drafts/<slug>/evidence.json');
  else {
    const verifiedRuns = new Map();
    for (const run of evidence.runs ?? []) {
      const outputPath = run.outputPath ? join(draftDir, run.outputPath) : null;
      verifiedRuns.set(run.id, { ...run, exists: Boolean(outputPath && existsSync(outputPath)) });
      if (!outputPath || !existsSync(outputPath)) errors.push(`运行证据输出不存在：${run.outputPath ?? '(空)'}`);
    }
    const readLineCount = (repoPath) => {
      const absolute = join(ROOT, repoPath);
      if (!existsSync(absolute)) return 0;
      return readFileSync(absolute, 'utf8').split('\n').length;
    };
    const evidenceResult = validateEvidence(evidence, {
      config,
      verifiedSources,
      verifiedRuns,
      fileExists: (repoPath) => existsSync(join(ROOT, repoPath)),
      readLineCount,
    });
    errors.push(...evidenceResult.errors);
    for (const run of evidence.runs ?? []) {
      if (run.exitCode !== 0) errors.push(`运行证据 exitCode 非 0：${run.id}`);
    }
  }

  // 图片文件与登记一致性（实际字节）
  for (const entry of imageRegistry.values()) {
    if (entry.slug && entry.slug !== options.slug) continue;
    const absolute = join(ROOT, entry.path);
    if (!existsSync(absolute)) {
      errors.push(`登记图片缺少文件：${entry.path}`);
      continue;
    }
    const info = readImageInfo(absolute);
    if (entry.sha256 && info.sha256 !== entry.sha256) errors.push(`图片哈希与登记不一致：${entry.file}`);
    if (entry.width && info.width !== entry.width) errors.push(`图片宽度与登记不一致：${entry.file}`);
    if (entry.height && info.height !== entry.height) errors.push(`图片高度与登记不一致：${entry.file}`);
  }

  // barrel 必须已生成且最新
  const barrel = buildAutoIndex({ check: true });
  if (barrel.changed) errors.push('src/lib/guides-auto.ts 未更新，请运行 build-auto-index');

  // 多语言译文：新增自动文章必须同时产出 config.translation.languages 中的每种语言
  const translationConfig = config.translation ?? { languages: TRANSLATED_LANGS, requireAll: true };
  const requiredLangs =
    Array.isArray(translationConfig.languages) && translationConfig.languages.length > 0
      ? translationConfig.languages
      : TRANSLATED_LANGS;
  const requireAll = translationConfig.requireAll !== false;
  const translationResults = {};
  for (const lang of requiredLangs) {
    const repoPath = `${REPO_PATHS.guidesDir}${options.slug}.${lang}.json`;
    const file = join(ROOT, repoPath);
    if (!existsSync(file)) {
      if (requireAll) errors.push(`缺少 ${lang} 译文：${repoPath}`);
      else warnings.push(`缺少 ${lang} 译文（requireAll=false，跳过）：${repoPath}`);
      translationResults[lang] = {
        exists: false,
        required: requireAll,
        ok: !requireAll,
        verdict: null,
        confidence: null,
        metrics: null,
        errors: requireAll ? [`缺少译文文件：${repoPath}`] : [],
        warnings: [],
      };
      continue;
    }
    const translation = readJson(file, null);
    const checked = validateTranslationStatic(translation, guide, lang);
    const entry = {
      exists: true,
      required: requireAll,
      ok: checked.errors.length === 0,
      verdict: translation?._meta?.translation?.reviewerVerdict ?? null,
      confidence: translation?._meta?.translation?.reviewerConfidence ?? null,
      metrics: checked.metrics,
      errors: checked.errors,
      warnings: checked.warnings,
    };
    translationResults[lang] = entry;
    errors.push(...checked.errors.map((message) => `[${lang}] ${message}`));
    warnings.push(...checked.warnings.map((message) => `[${lang}] ${message}`));
  }
  const translationArtifacts = buildTranslationArtifacts({ check: true });
  if (translationArtifacts.changed) {
    errors.push('译文索引未更新：translations.json / src/lib/guides-translated.ts（请运行 build-translation-index）');
  }
  const failedTranslationLangs = requiredLangs.filter((lang) => {
    const entry = translationResults[lang];
    return Boolean(entry) && ((!entry.exists && entry.required) || (entry.exists && !entry.ok));
  });
  const translationSummary = {
    ok: failedTranslationLangs.length === 0 && !translationArtifacts.changed,
    requireAll,
    langs: requiredLangs,
    present: requiredLangs.filter((lang) => translationResults[lang]?.exists),
    failed: failedTranslationLangs,
    artifacts: {
      manifestChanged: translationArtifacts.manifestChanged,
      barrelChanged: translationArtifacts.barrelChanged,
      translatedCount: translationArtifacts.translatedCount,
    },
  };

  // 只允许改允许路径
  const unexpected = unexpectedChanges(config.git.allowedPaths);
  if (unexpected.length > 0) errors.push(`出现允许路径之外的改动：${unexpected.slice(0, 8).join('；')}`);

  const structure = analyzeStructure(guide.content);
  const cjk = cjkCount(stripHtml(guide.content));
  const result = {
    ok: errors.length === 0,
    slug: options.slug,
    run: options.run,
    mode,
    metrics: {
      ...staticResult.metrics,
      ...structure,
      cjk,
      expectedReadingMinutes: expectedReadingMinutes(cjk),
      sources: (guide.sources ?? []).length,
      evidenceClaims: evidence?.claims?.length ?? 0,
      translations: translationSummary,
    },
    reviewer: review ? { verdict: review.verdict, confidence: review.confidence } : null,
    translations: translationResults,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  };
  writeJsonAtomic(join(runDir, 'verify.json'), result);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(2);
});
