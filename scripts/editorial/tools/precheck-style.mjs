#!/usr/bin/env node
/**
 * 机械文风预检：把「AI 腔」里可量化的部分做成脚本，不和 LLM 审校混在一起。
 *
 * 检查项（阈值见 scripts/editorial/tools/style-rules.json，随仓库版本化）：
 *   1) 硬禁词命中数（"值得注意的是""赋能""本文将"…）
 *   2) 段落开头模板词（"首先/其次/最后/总之/综上"…）
 *   3) 句长变异系数（CV）：太整齐说明句式单一
 *   4) 超长句数量（>60 汉字）
 *   5) 段落长度对称性（最长/最短 > 3 倍算整齐划一的 AI 节奏）
 *   6) 连续同头句（3 句以上同样开头 = 排比模板）
 *   7) 每个 H2 下的段落数 ≥2（避免"标题+一句话"的空壳小节）
 *
 * 用法：
 *   node scripts/editorial/tools/precheck-style.mjs --slug <slug> [--draft-dir <dir>] [--json out.json] [--strict] [--rules path]
 * 退出码：0 通过 / 1 --strict 下有违规 / 2 参数或文件错误
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ROOT, STATE_PATHS } from '../lib/paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const CJK = /[\u4e00-\u9fff]/g;

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slug') options.slug = argv[++i];
    else if (arg === '--draft-dir') options.draftDir = argv[++i];
    else if (arg === '--json') options.json = argv[++i];
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--rules') options.rules = argv[++i];
    else if (arg === '--quiet') options.quiet = true;
    else throw new Error(`未知参数：${arg}`);
  }
  if (!options.slug) throw new Error('用法：precheck-style.mjs --slug <slug> [--json out.json] [--strict]');
  return options;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, '\n')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function cjkCount(text) {
  return (String(text).match(CJK) || []).length;
}

function splitSentences(text) {
  return String(text)
    .split(/(?<=[。！？；!?;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => cjkCount(sentence) >= 2);
}

function splitParagraphs(html) {
  const blocks = [];
  for (const match of String(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripHtml(match[1]);
    if (cjkCount(text) >= 10) blocks.push(text);
  }
  return blocks;
}

function h2Sections(html) {
  const sections = [];
  const parts = String(html).split(/<h2[^>]*>/i);
  parts.shift();
  for (const part of parts) {
    const title = stripHtml(part.slice(0, part.indexOf('</h2>') >= 0 ? part.indexOf('</h2>') : part.length));
    const rest = part.slice(part.indexOf('</h2>') + 5);
    const paragraphCount = (rest.match(/<p[^>]*>/gi) || []).length;
    sections.push({ title: title.slice(0, 40), paragraphs: paragraphCount });
  }
  return sections;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values, average) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function findBanned(text, list) {
  const hits = [];
  for (const phrase of list) {
    let index = text.indexOf(phrase);
    while (index >= 0) {
      hits.push({ phrase, index });
      index = text.indexOf(phrase, index + phrase.length);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function findOpenerViolations(paragraphs, openers) {
  const out = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    for (const opener of openers) {
      if (paragraph.startsWith(opener)) {
        out.push({ paragraph: index + 1, opener, sample: paragraph.slice(0, 30) });
        break;
      }
    }
  }
  return out;
}

function findParallelRuns(sentences, maxRun) {
  const runs = [];
  let runStart = 0;
  let runLength = 1;
  const head = (sentence) => sentence.slice(0, 3);
  for (let i = 1; i < sentences.length; i += 1) {
    if (head(sentences[i]) && head(sentences[i]) === head(sentences[i - 1])) {
      runLength += 1;
    } else {
      if (runLength > maxRun) runs.push({ start: runStart + 1, length: runLength, sample: sentences[runStart].slice(0, 30) });
      runStart = i;
      runLength = 1;
    }
  }
  if (runLength > maxRun) runs.push({ start: runStart + 1, length: runLength, sample: sentences[runStart].slice(0, 30) });
  return runs;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const draftDir = options.draftDir ? resolve(options.draftDir) : resolve(STATE_PATHS.drafts, options.slug);
  const draftGuide = resolve(draftDir, 'guide.json');
  const publishedGuide = resolve(ROOT, 'data/editorial-guides', `${options.slug}.json`);
  const guidePath = existsSync(draftGuide) ? draftGuide : publishedGuide;
  if (!existsSync(guidePath)) throw new Error(`找不到稿件：${draftGuide} 或 ${publishedGuide}`);
  const guide = JSON.parse(readFileSync(guidePath, 'utf8'));
  const rulesPath = options.rules ? resolve(options.rules) : resolve(HERE, 'style-rules.json');
  const rules = readJson(rulesPath, null);
  if (!rules) throw new Error(`规则文件缺失或损坏：${rulesPath}`);
  const thresholds = rules.thresholds || {};

  const html = String(guide.content || '');
  const text = stripHtml(html);
  const paragraphs = splitParagraphs(html);
  const sentences = splitSentences(text);
  const sections = h2Sections(html);
  const lengths = sentences.map((sentence) => cjkCount(sentence));
  const average = mean(lengths);
  const deviation = stddev(lengths, average);
  const cv = average > 0 ? Number((deviation / average).toFixed(3)) : 0;
  const paragraphLengths = paragraphs.map((paragraph) => cjkCount(paragraph));
  const longestParagraph = Math.max(...paragraphLengths, 0);
  const shortestParagraph = paragraphLengths.length > 0 ? Math.min(...paragraphLengths.filter((value) => value > 0)) : 0;
  const paragraphRatio = shortestParagraph > 0 ? Number((longestParagraph / shortestParagraph).toFixed(2)) : 0;

  const violations = [];
  const warnings = [];

  const bannedHits = findBanned(text, rules.banned || []);
  if (bannedHits.length > (thresholds.bannedMaxHits ?? 0)) {
    violations.push({
      check: 'banned-phrase',
      detail: `硬禁词命中 ${bannedHits.length} 次：${[...new Set(bannedHits.map((hit) => hit.phrase))].join('、')}`,
    });
  }

  const openerHits = findOpenerViolations(paragraphs, rules.paragraphOpenersBanned || []);
  if (openerHits.length > 0) {
    violations.push({
      check: 'paragraph-opener',
      detail: `${openerHits.length} 个段落用模板词开头：${openerHits.map((hit) => `第${hit.paragraph}段「${hit.opener}」`).join('、')}`,
    });
  }

  if (cv < (thresholds.sentenceCvMin ?? 0.35)) {
    violations.push({ check: 'sentence-variance', detail: `句长变异系数 ${cv} < ${thresholds.sentenceCvMin}（句式太整齐）` });
  }

  const longSentences = lengths.filter((value) => value > (thresholds.longSentenceMinChars ?? 60));
  if (longSentences.length > (thresholds.longSentenceMaxCount ?? 3)) {
    violations.push({
      check: 'long-sentence',
      detail: `>${thresholds.longSentenceMinChars} 汉字的超长句 ${longSentences.length} 句（上限 ${thresholds.longSentenceMaxCount}）`,
    });
  }

  if (paragraphRatio > (thresholds.paragraphRatioMax ?? 3.0)) {
    warnings.push({ check: 'paragraph-ratio', detail: `段落最长/最短 ${paragraphRatio} > ${thresholds.paragraphRatioMax}` });
  }

  const parallelRuns = findParallelRuns(sentences, thresholds.parallelRunMax ?? 2);
  if (parallelRuns.length > 0) {
    violations.push({
      check: 'parallel-run',
      detail: `${parallelRuns.length} 处连续同头句（≥3 句）：${parallelRuns.map((run) => `第${run.start}句起「${run.sample}…」`).join('；')}`,
    });
  }

  const thinSections = sections.filter((section) => section.paragraphs < (thresholds.minParagraphsPerH2 ?? 2));
  if (thinSections.length > 0) {
    warnings.push({
      check: 'thin-section',
      detail: `${thinSections.length} 个小节段落 <2：${thinSections.map((section) => `「${section.title}」${section.paragraphs} 段`).join('、')}`,
    });
  }

  const result = {
    slug: options.slug,
    checkedAt: new Date().toISOString(),
    rules: rulesPath,
    metrics: {
      cjk: cjkCount(text),
      sentences: sentences.length,
      avgSentenceCjk: Number(average.toFixed(1)),
      sentenceCv: cv,
      paragraphs: paragraphs.length,
      paragraphRatio,
      h2: sections.length,
      bannedHits: bannedHits.length,
      openerHits: openerHits.length,
    },
    violations,
    warnings,
    ok: violations.length === 0,
  };

  if (options.json) {
    mkdirSync(dirname(resolve(options.json)), { recursive: true });
    writeFileSync(resolve(options.json), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (!options.quiet) {
    const icon = result.ok ? '通过' : '不通过';
    console.log(`文风预检 ${options.slug}：${icon}`);
    console.log(
      `  句 ${result.metrics.sentences} 句｜平均 ${result.metrics.avgSentenceCjk} 汉字｜CV ${cv}` +
        `｜段落 ${result.metrics.paragraphs}｜最长/最短 ${paragraphRatio}｜H2 ${sections.length}`,
    );
    for (const violation of violations) console.log(`  ✗ [${violation.check}] ${violation.detail}`);
    for (const warning of warnings) console.log(`  · [${warning.check}] ${warning.detail}`);
  }
  if (options.strict && !result.ok) process.exit(1);
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(`文风预检失败：${error.message}`);
  process.exit(2);
}
