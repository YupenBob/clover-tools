/**
 * 修复超长工具页：schulte-trainer / ip-lookup。
 * 模板部分调用 API 翻译，style 原样保留，script 按片段翻译后合并。
 * 用法：node scripts/fix-big-pages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env'), 'utf8');
const token = env.match(/^\s*DEEPSEEK_API_TOKEN\s*=\s*(.+)\s*$/m)?.[1]?.trim();
if (!token) {
  console.error('未找到 DEEPSEEK_API_TOKEN');
  process.exit(1);
}
const MODEL = 'deepseek-v4-flash';
const BASE = 'https://api.deepseek.com';
const TARGET = process.env.DS_LANG || 'en';
const PREFIX = TARGET === 'en' ? '/en' : '/' + TARGET;
const SOURCE = process.env.DS_SOURCE || 'zh';
const LANG_NAME =
  TARGET === 'ko' ? 'Korean (한국어)' : TARGET === 'ja' ? 'Japanese (日本語)' : 'English';
const ONLY = process.env.DS_ONLY
  ? process.env.DS_ONLY.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

async function call(messages) {
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
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return d.choices?.[0]?.message?.content ?? '';
}

function clean(raw) {
  let out = raw.replace(/^```(?:astro|js)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return out.replace(/from '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/g, "from '../../../../");
}

function templatePrompt(file) {
  const srcLang = SOURCE === 'en' ? 'English' : 'Chinese';
  return `You translate ${srcLang} Astro UI pages to ${LANG_NAME} for CloverTools. Output ONLY the translated fragment, no fences, no extra text.
Replace the frontmatter with EXACTLY:
---
import ToolLayout from '../../../../layouts/ToolLayout.astro';
import ToolPanel from '../../../../components/ToolPanel.astro';
import { getToolMeta, getRelated } from '../../../../lib/i18n';

const category = '${file.cat}' as const;
const tool = getToolMeta(category, '${file.slug}', '${TARGET}')!;
const related = getRelated(category, '${file.slug}', '${TARGET}', 6);
---
<ToolLayout category={category} tool={tool} related={related}>
Include the ToolPanel import only if the source imports it. Remove old imports/lookups and any categoryName prop. Deepen any other relative import by one level.
Translate every user-visible ${srcLang} string to natural ${LANG_NAME} (headings, labels, placeholders, buttons, option text, aria-labels, titles). Keep ALL ids, class names, element structure, format tokens and bi-* icon classes unchanged. Prefix internal site links with ${PREFIX}. ${
    SOURCE === 'en'
      ? 'Chinese characters that are DATA (sample text users would type) may stay.'
      : 'Chinese characters that are DATA (sample text users would type) may stay.'
  } Never truncate.`;
}

function scriptPrompt() {
  const srcLang = SOURCE === 'en' ? 'English' : 'Chinese';
  return `You are translating a <script> block of an Astro tool page from ${srcLang} to ${LANG_NAME}.
This is a FRAGMENT of a larger script — it is intentionally partial and may start or end mid-expression.
Translate ONLY ${srcLang} user-visible strings (labels, status/error messages, weekday names, toasts) to natural ${LANG_NAME}. ${
    SOURCE === 'en' ? 'Chinese characters that are DATA may stay.' : ''
  }
Preserve ALL code exactly: syntax, formatting, identifiers, class names, string escapes, template literal structure. Do NOT add, remove, reorder, rename or complete anything. Deepen relative imports by one level (from '../../../ to '../../../../').
Output ONLY the translated fragment, no fences, no explanations. Never truncate.`;
}

function splitLines(lines, styleLine, scriptLine) {
  // 行号从 1 开始
  const head = lines.slice(0, styleLine - 1).join('\n');
  const style = lines.slice(styleLine - 1, scriptLine - 1).join('\n');
  const script = lines.slice(scriptLine - 1).join('\n');
  return { head, style, script };
}

async function translateTemplate(file, head) {
  const out = await call([
    { role: 'system', content: templatePrompt(file) },
    { role: 'user', content: 'Template part (Chinese):\n\n' + head },
  ]);
  return clean(out);
}

async function translateScriptFragments(script) {
  const lines = script.split('\n');
  const MAX = 380;
  const chunks = [];
  for (let i = 0; i < lines.length; i += MAX) {
    chunks.push(lines.slice(i, i + MAX).join('\n'));
  }
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks.length > 1 ? ` (fragment ${i + 1} of ${chunks.length})` : '';
    const raw = await call([
      { role: 'system', content: scriptPrompt() + label },
      { role: 'user', content: 'Script fragment (Chinese):\n\n' + chunks[i] },
    ]);
    out.push(clean(raw));
  }
  return out.join('\n');
}

function validate(file, finalText) {
  const issues = [];
  if (!finalText.startsWith('---')) issues.push('frontmatter-start-missing');
  if ((finalText.match(/^---$/gm) || []).length < 2) issues.push('frontmatter-not-closed');
  if (!finalText.includes(`getToolMeta(category, '${file.slug}', '${TARGET}')`)) issues.push('frontmatter-wrong');
  if (/from '\.\.\/\.\.\/\.\.\/(?!\.\.\/)/.test(finalText)) issues.push('import-depth-wrong');
  for (const tag of ['style', 'script']) {
    const o = (finalText.match(new RegExp(`<${tag}`, 'g')) || []).length;
    const c = (finalText.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (o !== c) issues.push(`${tag}-unbalanced(${o}/${c})`);
  }
  return issues;
}

const JOBS = [
  { cat: 'fun', slug: 'schulte-trainer', zh: { styleLine: 256, scriptLine: 1806 }, en: { styleLine: 256, scriptLine: 1806 } },
  { cat: 'dev', slug: 'ip-lookup', zh: { styleLine: 86, scriptLine: 361 }, en: { styleLine: 85, scriptLine: 360 } },
];

for (const job of JOBS) {
  if (ONLY && !ONLY.includes(job.slug)) continue;
  const srcDir = SOURCE === 'en' ? 'en/tools' : 'tools';
  const zhPath = join(root, 'src', 'pages', srcDir, job.cat, job.slug + '.astro');
  const enPath = join(root, 'src', 'pages', TARGET, 'tools', job.cat, job.slug + '.astro');
  const lines = readFileSync(zhPath, 'utf8').split('\n');
  const { styleLine, scriptLine } = job[SOURCE] || job.zh;
  const { head, style, script } = splitLines(lines, styleLine, scriptLine);

  console.log(`[${job.slug}] head=${head.split('\n').length} style=${style.split('\n').length} script=${script.split('\n').length}`);
  const tHead = await translateTemplate(job, head);
  const tScript = await translateScriptFragments(script);
  const finalText = tHead + '\n' + style + '\n' + tScript;

  const issues = validate(job, finalText);
  if (issues.length) {
    console.log(`FAIL ${job.slug}: ${issues.join('; ')}`);
    writeFileSync(enPath + '.broken', finalText, 'utf8');
    continue;
  }
  writeFileSync(enPath, finalText, 'utf8');
  const cjk = (finalText.match(/[\u4e00-\u9fff]/g) || []).length;
  console.log(`OK ${job.slug} (cjk=${cjk})`);
}
