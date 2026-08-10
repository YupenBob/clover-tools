/**
 * 专门修复 ja ip-lookup：以英文版为源，script 按 150 行小片段翻译，
 * 拼接后用 esbuild 做语法校验，失败自动整段重试。
 * 用法：node scripts/fix-ja-iplookup.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env'), 'utf8');
const token = env.match(/^\s*DEEPSEEK_API_TOKEN\s*=\s*(.+)\s*$/m)?.[1]?.trim();
if (!token) {
  console.error('未找到 DEEPSEEK_API_TOKEN');
  process.exit(1);
}
const MODEL = 'deepseek-v4-flash';
const BASE = 'https://api.deepseek.com';
const TARGET = 'ja';
const SLUG = 'ip-lookup';
const CHUNK = 150;

async function call(messages, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 32000,
        temperature: 0.2,
        thinking: { type: 'disabled' },
      }),
    });
    if (!r.ok) {
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 3000));
        continue;
      }
      throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 160));
    }
    const d = await r.json();
    const content = (d.choices?.[0]?.message?.content ?? '').trim();
    if (content) return content;
    await new Promise((res) => setTimeout(res, 2500));
  }
  return '';
}

function clean(raw) {
  return raw.replace(/^```(?:ts|js|astro)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

async function syntaxOk(code) {
  try {
    await transform(code, { loader: 'ts' });
    return true;
  } catch {
    return false;
  }
}

function extractScript(text) {
  const m = text.match(/<script>([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

async function translateHead(head) {
  const sys =
    'You translate an English Astro page fragment to natural Japanese (日本語). Output ONLY the translated fragment. ' +
    'Rules: translate every user-visible English string (headings, labels, placeholders, buttons, option text, aria-labels, titles, status strings). ' +
    'Keep UNCHANGED: the entire frontmatter (imports, consts, JSON-LD), all ids, class names, JS logic, URLs, paths, format tokens, icon classes. ' +
    'Chinese characters that are DATA (sample text users would type) may stay. Never truncate, no fences.';
  return clean(await call([
    { role: 'system', content: sys },
    { role: 'user', content: 'Fragment (English):\n\n' + head },
  ]));
}

async function translateScript(script) {
  const sys =
    'You translate a complete <script> block of an Astro page from English to natural Japanese (日本語). ' +
    'Translate ONLY user-visible English strings (labels, status/error messages, weekday names, toasts). ' +
    'Preserve ALL code exactly: syntax, formatting, identifiers, class names, string escapes, template literal structure. ' +
    'Do NOT add, remove, reorder, rename or complete anything. Keep technical terms, URLs, regexes and locale codes like zh-CN unchanged. Chinese characters that are DATA may stay. ' +
    'Output ONLY the complete <script>...</script> block, no fences, never truncate.';
  const raw = await call([
    { role: 'system', content: sys },
    { role: 'user', content: 'Script block (English):\n\n' + script },
  ]);
  const m = raw.match(/<script>([\s\S]*?)<\/script>/);
  return m ? `<script>${m[1]}</script>` : clean(raw);
}

const srcPath = join(root, 'src', 'pages', 'en', 'tools', 'dev', SLUG + '.astro');
const outPath = join(root, 'src', 'pages', TARGET, 'tools', 'dev', SLUG + '.astro');
const src = readFileSync(srcPath, 'utf8');
const lines = src.split('\n');
const styleIdx = lines.findIndex((l) => l.startsWith('<style')) + 1; // 1-based
const scriptIdx = lines.findIndex((l) => l.startsWith('<script')) + 1; // 1-based
const head = lines.slice(0, styleIdx - 1).join('\n');
const style = lines.slice(styleIdx - 1, scriptIdx - 1).join('\n');
const script = lines.slice(scriptIdx - 1).join('\n');

let ok = false;
let finalScript = '';
for (let attempt = 0; attempt < 4 && !ok; attempt++) {
  console.log(`attempt ${attempt + 1}: whole script`);
  const translated = await translateScript(script);
  finalScript = translated.replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
  ok = await syntaxOk(finalScript);
  if (!ok) console.log('syntax check failed, retrying...');
}

if (!ok) {
  console.error('FAIL: script still invalid after retries');
  process.exit(1);
}

const tHead = await translateHead(head);
let finalText = tHead + '\n' + style + '\n' + '<script>' + finalScript + '</script>';
// 机械替换
finalText = finalText
  .replace(/getToolMeta\(category, '[^']+', 'en'\)/g, `getToolMeta(category, '${SLUG}', '${TARGET}')`)
  .replace(/'\/en\/'/g, `'/${TARGET}/'`)
  .replace(/"\/en\/"/g, `"/${TARGET}/"`)
  .replace(/\/en\//g, `/${TARGET}/`);

const check = extractScript(finalText);
if (!check || !(await syntaxOk(check))) {
  console.error('FAIL: final file script invalid');
  process.exit(1);
}
if (!finalText.includes(`getToolMeta(category, '${SLUG}', '${TARGET}')`)) {
  console.error('FAIL: frontmatter wrong');
  process.exit(1);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, finalText, 'utf8');
console.log(`OK ${TARGET}/${SLUG} (${finalText.split('\n').length} lines)`);
