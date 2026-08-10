/**
 * 用 DeepSeek API 把中文工具页翻译为目标语言页面（src/pages/{en|ko|ja}/tools/...）。
 * 用法：DS_LANG=ko node scripts/i18n-translate.mjs
 * 需要 .env 中配置 DEEPSEEK_API_TOKEN。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env'), 'utf8');
const token = env.match(/^\s*DEEPSEEK_API_TOKEN\s*=\s*(.+)\s*$/m)?.[1]?.trim();
if (!token) {
  console.error('未找到 DEEPSEEK_API_TOKEN（请配置 .env）');
  process.exit(1);
}

const MODEL = process.env.DS_MODEL || 'deepseek-v4-flash';
const BASE = process.env.DS_BASE_URL || 'https://api.deepseek.com';
const TARGET = process.env.DS_LANG || 'en';
const PREFIX = TARGET === 'en' ? '/en' : '/' + TARGET;
const LANG_NAME =
  TARGET === 'ko' ? 'Korean (한국어)' : TARGET === 'ja' ? 'Japanese (日本語)' : 'English';
const CONCURRENCY = Number(process.env.DS_CONCURRENCY || 3);
const ONLY = process.env.DS_ONLY
  ? process.env.DS_ONLY.split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const DONE_FILE = join(dirname(fileURLToPath(import.meta.url)), `.i18n-done-${TARGET}.txt`);
const SPLIT_THRESHOLD = 700;

function readDone() {
  try {
    return new Set(readFileSync(DONE_FILE, 'utf8').split(/\r?\n/).filter(Boolean));
  } catch {
    return new Set();
  }
}

function markDone(slug) {
  try {
    const done = readDone();
    done.add(slug);
    writeFileSync(DONE_FILE, [...done].join('\n') + '\n', 'utf8');
  } catch {
    // 忽略写入失败
  }
}

// 已人工翻译完成的页面跳过（仅英文版存在人工翻译页）
const SKIP = TARGET === 'en' ? new Set(['bmi', 'date-diff']) : new Set();

function listFiles(cat) {
  return readdirSync(join(root, 'src', 'pages', 'tools', cat))
    .filter((f) => f.endsWith('.astro'))
    .map((f) => ({ cat, slug: f.replace(/\.astro$/, '') }));
}

const files = ['dev', 'daily', 'fun']
  .flatMap(listFiles)
  .filter((f) => !SKIP.has(f.slug))
  .filter((f) => !readDone().has(f.slug))
  .filter((f) => !ONLY || ONLY.includes(f.slug));

function systemPrompt(file) {
  return `You translate Chinese Astro UI pages to ${LANG_NAME} for the CloverTools website. This is a programming task: produce a complete, valid .astro file.

Rules:
1. Output ONLY the complete .astro file content. No explanations, no markdown code fences, no extra text before or after.
2. Replace the frontmatter (the text between the first two lines that are exactly "---") with EXACTLY this:
---
import ToolLayout from '../../../../layouts/ToolLayout.astro';
import ToolPanel from '../../../../components/ToolPanel.astro';
import { getToolMeta, getRelated } from '../../../../lib/i18n';

const category = '${file.cat}' as const;
const tool = getToolMeta(category, '${file.slug}', '${TARGET}')!;
const related = getRelated(category, '${file.slug}', '${TARGET}', 6);
---
<ToolLayout category={category} tool={tool} related={related}>
   - Include the ToolPanel import line ONLY if the source file imports ToolPanel.
   - Remove the old imports, the old tool/related lookups and any categoryName prop on <ToolLayout>.
   - Any other relative import (e.g. '../../../scripts/xxx' or '../../../lib/yyy') must be deepened by exactly one level, e.g. '../../../scripts/toolkit' becomes '../../../../scripts/toolkit'.
3. Translate EVERY user-visible Chinese string to natural ${LANG_NAME}:
   - headings, panel titles, labels, placeholders, button text, option labels, aria-label, title attributes
   - all status / error / success / toast strings inside <script> blocks
   - Chinese weekday strings in date formatting (e.g. '周' + '日一二三四五六' -> use Sun,Mon,Tue,Wed,Thu,Fri,Sat)
   - placeholder rotation lists and empty-state text
4. Keep UNCHANGED: all ids, class names, the entire <style> block (CSS), all JS logic and identifiers, format tokens (YYYY-MM-DD, %s, \\n), units (ms, s, px, kg), technical names, and bi-* icon classes.
5. Internal site links must be language-prefixed: href="/" -> href="${PREFIX}/", href="/tools/..." -> href="${PREFIX}/tools/...".
6. Chinese characters that are DATA may stay (for example Chinese sample text a user would type in the pinyin / jianfan / lunar / Chinese-specific tools, Chinese calendar data, example strings inside code). All UI chrome must be ${LANG_NAME}.
7. The output must be the complete file — never truncate, never omit the <style> or <script> blocks.`;
}

async function callApi(messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(BASE + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 20000,
          temperature: 0.2,
          thinking: { type: 'disabled' },
        }),
      });
      if (r.status === 429 || r.status >= 500) {
        const t = await r.text();
        if (i < retries - 1) {
          await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
          continue;
        }
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      return await r.json();
    } catch (e) {
      if (i < retries - 1 && !/HTTP/.test(String(e))) {
        await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

function cleanOutput(raw) {
  let out = raw.replace(/^```(?:astro)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  out = out.replace(/from '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/g, "from '../../../../");
  return out;
}

async function translateFull(file, zh) {
  const data = await callApi([
    { role: 'system', content: systemPrompt(file) },
    { role: 'user', content: 'Source file (Chinese):\n\n' + zh },
  ]);
  const finish = data.choices?.[0]?.finish_reason;
  return { out: cleanOutput(data.choices?.[0]?.message?.content ?? ''), finish };
}

function splitSource(zh) {
  const idx = zh.lastIndexOf('\n<script');
  if (idx === -1) return null;
  return { head: zh.slice(0, idx + 1), tail: zh.slice(idx + 1) };
}

async function translateSplit(file, zh) {
  const parts = splitSource(zh);
  if (!parts) return null;
  const sys1 =
    systemPrompt(file) +
    '\n\nThe source is split into two parts. This message contains only the part BEFORE the <script> block. Output only that translated part (frontmatter + template + <style>). Do not include the <script> block.';
  const head = await callApi([
    { role: 'system', content: sys1 },
    { role: 'user', content: 'Part 1 of source (Chinese):\n\n' + parts.head },
  ]);
  const sys2 =
    `Translate the following <script> block of an Astro tool page to ${LANG_NAME}. Keep ALL JS logic, identifiers and class names identical; translate only Chinese user-visible strings (labels, status/error messages, weekday names). Deepen relative imports by one level (from '../../../ to '../../../../). Output ONLY the complete <script>...</script> block, nothing else.`;
  const tail = await callApi([
    { role: 'system', content: sys2 },
    { role: 'user', content: 'Script block (Chinese):\n\n' + parts.tail },
  ]);
  return {
    out: cleanOutput(head.choices?.[0]?.message?.content ?? '') + '\n' + cleanOutput(tail.choices?.[0]?.message?.content ?? ''),
    finish: 'stop',
  };
}

async function translate(file) {
  const zhPath = join(root, 'src', 'pages', 'tools', file.cat, file.slug + '.astro');
  const zh = readFileSync(zhPath, 'utf8');
  if (zh.split('\n').length > SPLIT_THRESHOLD) {
    const split = await translateSplit(file, zh);
    if (split) return split;
  }
  const full = await translateFull(file, zh);
  if (full.finish === 'length') {
    const split = await translateSplit(file, zh);
    if (split) return split;
  }
  return full;
}

function validate(out, file) {
  const issues = [];
  if (!out.startsWith('---')) issues.push('frontmatter-start-missing');
  if ((out.match(/^---$/gm) || []).length < 2) issues.push('frontmatter-not-closed');
  if (!out.includes(`getToolMeta(category, '${file.slug}', '${TARGET}')`)) issues.push('frontmatter-wrong');
  if (/from '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/.test(out)) issues.push('import-depth-wrong');
  const so = (out.match(/<style/g) || []).length;
  const sc = (out.match(/<\/style>/g) || []).length;
  if (so !== sc) issues.push(`style-unbalanced(${so}/${sc})`);
  const sOpen = (out.match(/<script/g) || []).length;
  const sClose = (out.match(/<\/script>/g) || []).length;
  if (sOpen !== sClose) issues.push(`script-unbalanced(${sOpen}/${sClose})`);
  if (out.trim().length < 400) issues.push('too-short');
  return issues;
}

async function main() {
  const results = [];
  const queue = [...files];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const file = queue.shift();
      if (!file) return;
      try {
        const { out, finish } = await translate(file);
        const issues = validate(out, file);
        if (finish === 'length') issues.push('truncated-length');
        if (issues.length) {
          results.push({ slug: file.slug, status: 'fail', issues });
          console.log(`FAIL ${file.cat}/${file.slug}: ${issues.join('; ')}`);
          continue;
        }
        const outPath = join(root, 'src', 'pages', TARGET, 'tools', file.cat, file.slug + '.astro');
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, out, 'utf8');
        markDone(file.slug);
        results.push({ slug: file.slug, status: 'ok' });
        console.log(`OK   ${file.cat}/${file.slug}`);
      } catch (e) {
        results.push({ slug: file.slug, status: 'err', error: String(e).slice(0, 200) });
        console.log(`ERR  ${file.cat}/${file.slug}: ${String(e).slice(0, 160)}`);
      }
    }
  });
  await Promise.all(workers);
  const ok = results.filter((r) => r.status === 'ok').length;
  console.log(`\n完成：${ok}/${files.length} 成功`);
  for (const r of results.filter((r) => r.status !== 'ok')) {
    console.log(' -', r.slug, r.issues || r.error);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
