#!/usr/bin/env node
/**
 * 把 Writer 的草稿落到仓库：复制截图、登记 captures.json、写指南 JSON、重建 barrel。
 * 失败时按写入前快照精确回滚。
 * 用法：node scripts/editorial/apply-draft.mjs --slug <slug> --run <runKey>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { ensureDefaultConfig, loadConfig } from './lib/config.mjs';
import { ensureStateDirs, loadQueue, readJson, writeJsonAtomic } from './lib/state.mjs';
import { loadImageRegistry, loadSiteCorpus, loadCsdnCorpus, loadToolIndex, loadExistingCategories } from './lib/corpus.mjs';
import { validateGuideStatic } from './lib/quality.mjs';
import { readImageInfo } from './lib/images.mjs';
import { snapshotPaths, rollbackSnapshot } from './lib/workspace.mjs';
import { buildAutoIndex } from './build-auto-index.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[index + 1];
    else if (arg === '--run') options.run = argv[index + 1];
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

function monthOf(date) {
  return String(date ?? '').slice(0, 7) || new Date().toISOString().slice(0, 7);
}

async function main() {
  ensureStateDirs();
  ensureDefaultConfig();
  const config = loadConfig();
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug || !options.run) throw new Error('用法：apply-draft.mjs --slug <slug> --run <runKey>');
  const draftDir = join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(draftDir, 'guide.json');
  if (!existsSync(guideFile)) throw new Error(`草稿不存在：${guideFile}`);
  const guide = readJson(guideFile);
  if (!guide) throw new Error('guide.json 解析失败');
  if (guide.slug !== options.slug) throw new Error(`guide.slug (${guide.slug}) 与 --slug (${options.slug}) 不一致`);

  const queue = loadQueue();
  const item = queue.items.find((entry) => entry.runId === options.run || entry.slug === options.slug);
  const mode = guide._meta?.type ?? item?.type ?? 'new-guide';

  const month = monthOf(guide.updated);
  const imageTargetDir = join(ROOT, 'public', 'article-images', month);
  const capturesFile = join(imageTargetDir, 'captures.json');
  const guideTarget = join(ROOT, 'data', 'editorial-guides', `${options.slug}.json`);
  const caseTarget = join(ROOT, 'scripts', 'editorial', 'cases', `${options.slug}.mjs`);

  // 1. 先复制图片并登记，得到最新 registry 供静态校验
  const capturesSource = join(draftDir, 'captures.json');
  const draftCaptures = existsSync(capturesSource) ? readJson(capturesSource, []) : [];
  const touchedPaths = ['data/editorial-guides/', 'src/lib/guides-auto.ts', 'public/article-images/', 'scripts/editorial/cases/'];
  const snapshot = snapshotPaths([
    `data/editorial-guides/${options.slug}.json`,
    'src/lib/guides-auto.ts',
    `public/article-images/${month}/captures.json`,
    `scripts/editorial/cases/${options.slug}.mjs`,
  ]);

  try {
    if (draftCaptures.length > 0) {
      mkdirSync(imageTargetDir, { recursive: true });
      const existing = existsSync(capturesFile) ? readJson(capturesFile, []) : [];
      const seen = new Set(existing.map((entry) => entry.file));
      for (const entry of draftCaptures) {
        const draftImage = join(draftDir, 'images', entry.file);
        if (!existsSync(draftImage)) throw new Error(`截图缺失：${draftImage}`);
        const info = readImageInfo(draftImage);
        if (entry.sha256 && entry.sha256 !== info.sha256) throw new Error(`截图哈希不一致：${entry.file}`);
        if (entry.width && entry.width !== info.width) throw new Error(`截图宽度不一致：${entry.file}`);
        if (entry.height && entry.height !== info.height) throw new Error(`截图高度不一致：${entry.file}`);
        copyFileSync(draftImage, join(imageTargetDir, entry.file));
        if (!seen.has(entry.file)) existing.push({ ...entry, ...info, file: entry.file, slug: options.slug });
        else Object.assign(existing.find((itemEntry) => itemEntry.file === entry.file), { ...entry, ...info });
      }
      writeJsonAtomic(capturesFile, existing);
    }

    // 2. 静态校验（含图片登记）
    const toolIndex = await loadToolIndex(ROOT);
    const corpus = await loadSiteCorpus(ROOT);
    const csdnCorpus = loadCsdnCorpus(ROOT);
    const categories = await loadExistingCategories(ROOT);
    const imageRegistry = loadImageRegistry(ROOT);
    const ctx = {
      mode,
      config,
      today: new Date().toISOString().slice(0, 10),
      toolIndex,
      categories,
      corpus,
      csdnCorpus,
      imageRegistry,
      fileExists: (repoPath) => existsSync(join(ROOT, repoPath)),
    };
    const validation = validateGuideStatic(guide, ctx);
    if (validation.errors.length > 0) {
      throw new Error(`静态校验失败：\n- ${validation.errors.join('\n- ')}`);
    }

    // 3. 写入指南 JSON 与 barrel
    const persisted = { ...guide };
    persisted._meta = {
      ...(guide._meta ?? {}),
      auto: true,
      mode,
      runId: options.run,
      verifiedAt: new Date().toISOString(),
      primaryQuery: guide._meta?.primaryQuery ?? item?.primaryQuery ?? null,
    };
    if (mode === 'upgrade-guide') {
      const original = readJson(guideTarget, null);
      if (original?.published) {
        persisted.published = original.published;
        persisted._meta.originalPublished = original.published;
        if (guide.published !== original.published) {
          persisted._meta.publishedAdjustedFrom = guide.published;
        }
        if (guide.updated === original.updated) {
          throw new Error('升级模式的 updated 必须变化（本次有实质修改才更新日期）');
        }
      }
    }
    writeJsonAtomic(guideTarget, persisted);
    const barrel = buildAutoIndex();

    // 4. 图片清单必须只在自动目录内
    const changed = [];
    for (const entry of draftCaptures) {
      if (!/^[a-z0-9-]+\.(jpe?g|png|webp|gif)$/i.test(entry.file)) throw new Error(`截图文件名不合法：${entry.file}`);
    }

    const plan = {
      run: options.run,
      slug: options.slug,
      mode,
      month,
      captures: draftCaptures.map((entry) => entry.file),
      barrel: barrel.target,
      touchedPaths,
      snapshot,
      guideTarget: `data/editorial-guides/${options.slug}.json`,
      createdAt: new Date().toISOString(),
    };
    writeJsonAtomic(join(STATE_PATHS.runs, options.run, 'apply.json'), plan);
    console.log(
      JSON.stringify(
        {
          ok: true,
          slug: options.slug,
          mode,
          images: plan.captures,
          barrel,
          validation: validation.metrics,
          dryRun: Boolean(options.dryRun),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const rolled = rollbackSnapshot(snapshot);
    writeJsonAtomic(join(STATE_PATHS.runs, options.run, 'apply-error.json'), {
      error: String(error.message ?? error),
      rolled,
      at: new Date().toISOString(),
    });
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}

main();
