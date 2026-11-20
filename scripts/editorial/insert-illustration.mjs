#!/usr/bin/env node
/**
 * AI 示意图落盘与注入（P4）。
 *
 * 用法：node scripts/editorial/insert-illustration.mjs --run <runKey> --slug <slug> [--force] [--json]
 *
 * 输入：`.editorial/runs/<runKey>/illustration-candidate.json`
 *   { "source": "/绝对路径/图.png", "prompt": "...", "labels": ["..."], "caption": "可选" }
 *
 * 行为：
 * 1. 校验候选路径归属（只接受 ~/.codex/generated_images/ 或 /tmp 下的 PNG），解码尺寸 ≥1400px 宽、比例 16:10 或 4:3；
 * 2. sharp 转 JPEG（宽 ≤1600、质量 82 起，超 400KB 逐级降质）→ `public/article-assets/<YYYY-MM>/<slug>.jpg`；
 * 3. 在草稿 `guide.json` 的第一个 H2 之后注入 `<figure>`（alt 前缀 + caption 后缀必须合规）；
 * 4. 记录 `.editorial/drafts/<slug>/illustrations.json`，每篇最多 1 张。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import {
  AI_ILLUSTRATION_ALT_PREFIX,
  AI_ILLUSTRATION_CAPTION_SUFFIX,
  AI_ILLUSTRATION_MAX_BYTES,
} from './lib/quality.mjs';

const ALLOWED_SOURCE_ROOTS = [join(homedir(), '.codex', 'generated_images'), '/tmp'];
const MIN_WIDTH = 1400;
const ASPECTS = [16 / 10, 4 / 3];

function parseArgs(argv) {
  const options = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--force') options.force = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function monthNow() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' });
  return formatter.format(new Date());
}

function firstH2Index(html) {
  const match = /<\/h2>/i.exec(html);
  return match ? match.index + match[0].length : -1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/editorial/insert-illustration.mjs --run <runKey> --slug <slug> [--force] [--json]');
    return 0;
  }
  if (!options.run || !options.slug) throw new Error('缺少 --run 或 --slug');
  const draftDir = join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(draftDir, 'guide.json');
  if (!existsSync(guideFile)) throw new Error(`草稿不存在：${guideFile}`);
  const guide = readJson(guideFile, null);
  if (!guide?.content) throw new Error('guide.json 缺少 content');

  const candidateFile = join(STATE_PATHS.runs, options.run, 'illustration-candidate.json');
  const candidate = readJson(candidateFile, null);
  if (!candidate?.source) throw new Error(`缺少候选图：${candidateFile}`);

  const source = resolve(candidate.source);
  if (!existsSync(source)) throw new Error(`候选图不存在：${source}`);
  const allowedRoot = ALLOWED_SOURCE_ROOTS.some((root) => source.startsWith(`${resolve(root)}/`));
  if (!allowedRoot) throw new Error(`候选图路径不在允许范围（~/.codex/generated_images 或 /tmp）：${source}`);

  const state = readJson(join(draftDir, 'illustrations.json'), { illustrations: [] });
  if ((state.illustrations ?? []).length > 0 && !options.force) {
    throw new Error(`已有 ${state.illustrations.length} 张示意图（每篇 ≤1），如确需替换加 --force`);
  }

  const sharp = (await import('sharp')).default;
  const meta = await sharp(source).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < MIN_WIDTH) throw new Error(`候选图宽度 ${width} < ${MIN_WIDTH}`);
  const aspect = height > 0 ? width / height : 0;
  if (!ASPECTS.some((expected) => Math.abs(aspect - expected) / expected <= 0.03)) {
    throw new Error(`候选图比例 ${aspect.toFixed(3)} 不是 16:10 或 4:3`);
  }

  const month = monthNow();
  const targetDir = join(ROOT, 'public', 'article-assets', month);
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, `${options.slug}.jpg`);

  const maxWidth = Math.min(1600, width);
  let quality = 82;
  let size = Number.POSITIVE_INFINITY;
  let finalWidth = maxWidth;
  let finalHeight = Math.round((height / width) * maxWidth);
  while (quality >= 55) {
    const buffer = await sharp(source)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, progressive: false })
      .toBuffer();
    if (buffer.byteLength <= AI_ILLUSTRATION_MAX_BYTES) {
      writeFileSync(target, buffer);
      const outMeta = await sharp(buffer).metadata();
      finalWidth = outMeta.width;
      finalHeight = outMeta.height;
      size = buffer.byteLength;
      break;
    }
    size = buffer.byteLength;
    quality -= 5;
  }
  if (!Number.isFinite(size) || size > AI_ILLUSTRATION_MAX_BYTES) {
    throw new Error(`转码后仍超过 ${AI_ILLUSTRATION_MAX_BYTES} 字节（最后 ${size}）`);
  }

  const labels = Array.isArray(candidate.labels) ? candidate.labels.filter(Boolean).slice(0, 4) : [];
  const concept = String(candidate.concept ?? candidate.prompt ?? options.slug).slice(0, 40);
  const altConcept = labels.length > 0 ? labels.join('、') : concept;
  const alt = `${AI_ILLUSTRATION_ALT_PREFIX}${altConcept}`;
  const captionBase = String(candidate.caption ?? `示意图：${altConcept}`).replace(AI_ILLUSTRATION_CAPTION_SUFFIX, '').trim();
  const caption = `${captionBase}${AI_ILLUSTRATION_CAPTION_SUFFIX}`;

  const figure =
    `<figure><img src="/article-assets/${month}/${options.slug}.jpg" alt="${alt}" width="${finalWidth}" height="${finalHeight}" loading="lazy" decoding="async">` +
    `<figcaption>${caption}</figcaption></figure>`;

  const index = firstH2Index(guide.content);
  if (index < 0) throw new Error('正文里没有 H2，无法放置示意图');
  if (guide.content.includes(`/article-assets/${month}/${options.slug}.jpg`)) throw new Error('正文里已存在该示意图');
  guide.content = `${guide.content.slice(0, index)}\n${figure}\n${guide.content.slice(index)}`;
  writeFileSync(guideFile, `${JSON.stringify(guide, null, 2)}\n`);

  const record = {
    slug: options.slug,
    run: options.run,
    source,
    target: `public/article-assets/${month}/${options.slug}.jpg`,
    width: finalWidth,
    height: finalHeight,
    bytes: size,
    quality,
    alt,
    caption,
    prompt: candidate.prompt ?? null,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    join(draftDir, 'illustrations.json'),
    `${JSON.stringify({ illustrations: [...(state.illustrations ?? []).filter((entry) => entry.target !== record.target), record] }, null, 2)}\n`,
  );

  const result = { ok: true, ...record };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(`已注入示意图：${record.target}（${finalWidth}×${finalHeight}，${size} 字节，质量 ${quality}）`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`insert-illustration 失败：${error.message}`);
    process.exit(1);
  });
