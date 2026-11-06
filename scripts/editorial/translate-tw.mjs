#!/usr/bin/env node
/**
 * 简体草稿 → 繁体译文（机械转换，无需 reviewer）。
 * 读取 .editorial/drafts/<slug>/guide.json，写 .editorial/drafts/<slug>/translations/tw.json。
 * 用法：node scripts/editorial/translate-tw.mjs --slug <slug> --run <runKey>
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { ensureStateDirs, readJson, writeJsonAtomic } from './lib/state.mjs';
import { buildTranslation, convertGuideToTw, validateTranslationStatic } from './lib/translate.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--run') options.run = argv[index + 1];
  }
  return options;
}

function main() {
  ensureStateDirs();
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug || !options.run) throw new Error('用法：translate-tw.mjs --slug <slug> --run <runKey>');
  const draftDir = join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(draftDir, 'guide.json');
  if (!existsSync(guideFile)) throw new Error(`草稿不存在：${guideFile}`);
  const guide = readJson(guideFile, null);
  if (!guide) throw new Error('guide.json 解析失败');

  const errors = [];
  const warnings = [];
  if (guide.slug !== options.slug) errors.push(`guide.slug (${guide.slug}) 与 --slug (${options.slug}) 不一致`);
  if (guide._meta?.auto !== true) warnings.push('_meta.auto 不为 true（请确认是流水线草稿）');
  if (!guide._meta?.runId) errors.push('_meta.runId 缺失，无法确认草稿属于本次运行');
  else if (guide._meta.runId !== options.run) {
    errors.push(`_meta.runId (${guide._meta.runId}) 与 --run (${options.run}) 不一致`);
  }
  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, slug: options.slug, run: options.run, lang: 'tw', errors, warnings }, null, 2));
    process.exit(1);
  }

  const converted = convertGuideToTw(guide);
  const translation = buildTranslation(guide, 'tw', {
    ...converted,
    _meta: { translation: { reviewerVerdict: 'pass', reviewerConfidence: 1 } },
  });
  const checked = validateTranslationStatic(translation, guide, 'tw');
  const targetFile = join(draftDir, 'translations', 'tw.json');
  if (checked.errors.length === 0) writeJsonAtomic(targetFile, translation);
  const result = {
    ok: checked.errors.length === 0,
    slug: options.slug,
    run: options.run,
    lang: 'tw',
    file: join('.editorial', 'drafts', options.slug, 'translations', 'tw.json'),
    written: checked.errors.length === 0,
    title: translation.title,
    metrics: checked.metrics,
    warnings: [...warnings, ...checked.warnings],
    errors: checked.errors,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main();
