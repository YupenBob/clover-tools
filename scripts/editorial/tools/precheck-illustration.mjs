#!/usr/bin/env node
/**
 * AI 示意图预检（P4）：数量 ≤1、路径形态、alt/caption 声明、文件存在与体积。
 *
 * 用法：node scripts/editorial/tools/precheck-illustration.mjs --slug <slug> [--draft-dir <dir>] [--strict] [--json <out>]
 * 退出码：0 通过｜1 有违规（--strict 时）｜6 参数/环境错误。
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, STATE_PATHS } from '../lib/paths.mjs';
import { validateAiIllustrations } from '../lib/quality.mjs';

function parseArgs(argv) {
  const options = { json: false, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--draft-dir') options.draftDir = argv[++index];
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.jsonFile = argv[++index];
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/editorial/tools/precheck-illustration.mjs --slug <slug> [--draft-dir <dir>] [--strict] [--json <out>]');
    return 0;
  }
  if (!options.slug) throw new Error('缺少 --slug');
  const draftDir = options.draftDir ? resolve(options.draftDir) : join(STATE_PATHS.drafts, options.slug);
  const guideFile = join(draftDir, 'guide.json');
  const target = existsSync(guideFile) ? guideFile : join(ROOT, 'data', 'editorial-guides', `${options.slug}.json`);
  if (!existsSync(target)) throw new Error(`找不到稿件：${guideFile}`);
  const guide = JSON.parse(readFileSync(target, 'utf8'));
  const errors = validateAiIllustrations(String(guide.content ?? ''), {
    fileExists: (repoPath) => existsSync(join(ROOT, repoPath)),
    fileSize: (repoPath) => {
      try {
        return statSync(join(ROOT, repoPath)).size;
      } catch {
        return null;
      }
    },
  });
  const result = { slug: options.slug, ok: errors.length === 0, errors, checkedAt: new Date().toISOString() };
  if (options.jsonFile) {
    mkdirSync(dirname(resolve(options.jsonFile)), { recursive: true });
    writeFileSync(resolve(options.jsonFile), `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(`示意图预检 ${options.slug}：${result.ok ? '通过' : `不通过（${errors.length} 项）`}`);
  for (const error of errors) console.log(`  ✗ ${error}`);
  return options.strict && !result.ok ? 1 : 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`precheck-illustration 失败：${error.message}`);
  process.exit(6);
}
