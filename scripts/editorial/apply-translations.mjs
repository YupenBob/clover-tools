#!/usr/bin/env node
/**
 * 把多语言译文草稿落到仓库：校验 → 写 data/editorial-guides/<slug>.<lang>.json
 * → 重建 translations.json 与 src/lib/guides-translated.ts。
 * 失败时按写入前快照回滚，不发布部分语言。
 *
 * 用法：node scripts/editorial/apply-translations.mjs --slug <slug> --run <runKey> [--langs tw,en,ko,ja]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REPO_PATHS, STATE_PATHS } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { readJson, writeJsonAtomic } from './lib/state.mjs';
import { rollbackSnapshot, snapshotPaths } from './lib/workspace.mjs';
import { buildTranslationArtifacts } from './build-translation-index.mjs';
import { TRANSLATED_LANGS, validateTranslationStatic } from './lib/translate.mjs';

const MANIFEST_PATH = `${REPO_PATHS.guidesDir}translations.json`;
const BARREL_PATH = 'src/lib/guides-translated.ts';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--run') options.run = argv[index + 1];
    else if (arg === '--langs') options.langs = argv[index + 1];
    else if (arg.startsWith('--langs=')) options.langs = arg.slice('--langs='.length);
  }
  return options;
}

function requestedLanguages(options, config) {
  const configured = Array.isArray(config.translation?.languages)
    ? config.translation.languages
    : TRANSLATED_LANGS;
  const raw = options.langs ? String(options.langs).split(',') : configured;
  return [...new Set(raw.map((lang) => String(lang).trim()).filter(Boolean))];
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function main() {
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug || !options.run) {
    throw new Error('用法：apply-translations.mjs --slug <slug> --run <runKey> [--langs tw,en,ko,ja]');
  }
  const langs = requestedLanguages(options, config);
  if (langs.length === 0) throw new Error('没有要应用的译文语言（检查 --langs 或 config.translation.languages）');
  const invalid = langs.filter((lang) => !TRANSLATED_LANGS.includes(lang));
  if (invalid.length > 0) {
    throw new Error(`不支持的语言：${invalid.join('、')}（可选 ${TRANSLATED_LANGS.join('/')}）`);
  }

  const zhPath = `${REPO_PATHS.guidesDir}${options.slug}.json`;
  const zhFile = join(ROOT, zhPath);
  if (!existsSync(zhFile)) throw new Error(`简体文章未落盘：${zhPath}（先运行 apply-draft.mjs）`);
  const zhGuide = readJson(zhFile, null);
  if (!zhGuide || zhGuide.slug !== options.slug) throw new Error(`简体文章解析失败或 slug 不一致：${zhPath}`);

  const errors = [];
  const warnings = [];
  const metrics = {};
  const drafts = {};
  const configuredLangs = Array.isArray(config.translation?.languages)
    ? config.translation.languages
    : TRANSLATED_LANGS;
  if (config.translation?.requireAll !== false) {
    const notApplied = configuredLangs.filter((lang) => !langs.includes(lang));
    if (notApplied.length > 0) {
      warnings.push(`本次只应用 ${langs.join('/')}；verify-article 仍会要求 ${notApplied.join('/')}`);
    }
  }
  if (zhGuide._meta?.runId && zhGuide._meta.runId !== options.run) {
    errors.push(`简体文章 _meta.runId (${zhGuide._meta.runId}) 与 --run (${options.run}) 不一致`);
  } else if (!zhGuide._meta?.runId) {
    warnings.push('简体文章缺少 _meta.runId，无法确认译文属于本次运行');
  }

  for (const lang of langs) {
    const draftPath = join(STATE_PATHS.drafts, options.slug, 'translations', `${lang}.json`);
    if (!existsSync(draftPath)) {
      errors.push(`缺少 ${lang} 译文草稿：${join('.editorial', 'drafts', options.slug, 'translations', `${lang}.json`)}`);
      continue;
    }
    const translation = readJson(draftPath, null);
    if (!translation) {
      errors.push(`${lang} 译文草稿解析失败`);
      continue;
    }
    const checked = validateTranslationStatic(translation, zhGuide, lang);
    errors.push(...checked.errors.map((message) => `[${lang}] ${message}`));
    warnings.push(...checked.warnings.map((message) => `[${lang}] ${message}`));
    metrics[lang] = checked.metrics;
    const meta = translation._meta?.translation ?? {};
    const verdict = String(meta.reviewerVerdict ?? '').toLowerCase();
    const confidence = meta.reviewerConfidence;
    if (verdict !== 'pass') errors.push(`[${lang}] reviewerVerdict 必须为 pass：${meta.reviewerVerdict ?? '(空)'}`);
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0.7) {
      errors.push(`[${lang}] reviewerConfidence ${confidence} 低于 0.7 或类型无效`);
    }
    drafts[lang] = translation;
  }

  if (errors.length > 0) {
    fail({
      ok: false,
      slug: options.slug,
      run: options.run,
      langs,
      metrics,
      errors,
      warnings,
      written: [],
    });
  }

  const targetPaths = langs.map((lang) => `${REPO_PATHS.guidesDir}${options.slug}.${lang}.json`);
  const snapshot = snapshotPaths([...targetPaths, MANIFEST_PATH, BARREL_PATH]);
  // 生成物（translations.json / barrel）首次提交前是 untracked，rollbackSnapshot 无法用 git 还原；
  // 额外保存原字节，失败时按内容恢复。
  const previousContents = new Map();
  for (const entry of snapshot) {
    if (entry.existed) previousContents.set(entry.path, readFileSync(join(ROOT, entry.path)));
  }
  let artifacts;
  try {
    for (const [index, lang] of langs.entries()) {
      writeJsonAtomic(join(ROOT, targetPaths[index]), drafts[lang]);
    }
    artifacts = buildTranslationArtifacts();
  } catch (error) {
    const rollback = rollbackSnapshot(snapshot);
    for (const entry of snapshot) {
      if (entry.existed && !entry.tracked && previousContents.has(entry.path)) {
        writeFileSync(join(ROOT, entry.path), previousContents.get(entry.path));
      }
    }
    fail({
      ok: false,
      slug: options.slug,
      run: options.run,
      langs,
      metrics,
      errors: [`写入或重建索引失败：${String(error.message ?? error)}`],
      warnings,
      rollback,
      written: [],
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: options.slug,
        run: options.run,
        langs,
        metrics,
        manifest: {
          path: MANIFEST_PATH,
          changed: artifacts.manifestChanged,
          translatedCount: artifacts.translatedCount,
        },
        barrel: {
          path: BARREL_PATH,
          changed: artifacts.barrelChanged,
        },
        files: targetPaths,
        warnings,
      },
      null,
      2,
    ),
  );
}

main();
