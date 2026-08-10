/**
 * 生成韩语/日语共享页（首页、关于、404、分类页）：以英文版为基础，
 * API 翻译可见文案，随后机械替换语言常量与 /en/ 路径。
 * 用法：node scripts/gen-ko-ja-shared.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
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

const LANGS = {
  ko: 'Korean (한국어)',
  ja: 'Japanese (日本語)',
};

const PAGES = [
  { src: 'index.astro', out: 'index.astro' },
  { src: 'about.astro', out: 'about.astro' },
  { src: '404.astro', out: '404.astro' },
  { src: 'tools/[category]/index.astro', out: 'tools/[category]/index.astro' },
];

const TOOL_SLUGS = process.env.DS_TOOL
  ? process.env.DS_TOOL.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const LANG_FILTER = process.env.DS_LANG ? [process.env.DS_LANG] : Object.keys(LANGS);

function findToolPage(slug) {
  for (const cat of ['dev', 'daily', 'fun']) {
    const p = join(root, 'src', 'pages', 'en', 'tools', cat, slug + '.astro');
    if (existsSync(p)) return { src: `tools/${cat}/${slug}.astro`, cat, slug };
  }
  return null;
}

function toolPages() {
  return TOOL_SLUGS.map(findToolPage).filter(Boolean);
}

function pageList() {
  return TOOL_SLUGS.length
    ? toolPages()
    : PAGES.map((p) => ({ src: p.src, out: p.out, slug: null, cat: null }));
}

async function call(messages, retries = 4) {
  for (let i = 0; i < retries; i++) {
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
  return raw.replace(/^```(?:astro)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

function validate(out, target, page) {
  const issues = [];
  if (!out.startsWith('---')) issues.push('frontmatter-start-missing');
  if ((out.match(/^---$/gm) || []).length < 2) issues.push('frontmatter-not-closed');
  if (out.includes("'/en/'") || out.includes('href="/en') || out.includes('fetch(\'/en')) {
    issues.push('en-path-remnant');
  }
  if (!page.slug && page.out !== '404.astro' && !out.includes(`const lang = '${target}' as const`)) {
    issues.push('lang-const-missing');
  }
  if (page.slug && !out.includes(`getToolMeta(category, '${page.slug}', '${target}')`)) {
    issues.push('tool-frontmatter-wrong');
  }
  if (!out.includes(`/${target}/`)) issues.push('target-path-missing');
  if (out.includes(`inLanguage: 'en'`)) issues.push('inLanguage-not-replaced');
  for (const tag of ['style', 'script']) {
    const o = (out.match(new RegExp(`<${tag}`, 'g')) || []).length;
    const c = (out.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (o !== c) issues.push(`${tag}-unbalanced(${o}/${c})`);
  }
  if (out.length < 400) issues.push('too-short');
  if (page.slug && out.length < 8000) issues.push('tool-page-suspiciously-short');
  return issues;
}

for (const [target, langName] of Object.entries(LANGS)) {
  if (!LANG_FILTER.includes(target)) continue;
  for (const page of pageList()) {
    const srcPath = join(root, 'src', 'pages', 'en', page.src);
    const outRel = page.slug ? `tools/${page.cat}/${page.slug}.astro` : page.out;
    const outPath = join(root, 'src', 'pages', target, outRel);
    if (existsSync(outPath)) {
      console.log(`SKIP ${target}/${page.out}`);
      continue;
    }
    mkdirSync(dirname(outPath), { recursive: true });
    const src = readFileSync(srcPath, 'utf8');
    const sys =
      `You are translating an Astro page of the CloverTools website from English to ${langName}. ` +
      'This is a programming task: output the COMPLETE .astro file. Rules: ' +
      `1. Translate every user-visible English string to natural ${langName} (headings, labels, placeholders, buttons, option text, aria-labels, titles, status/toast strings, JSON-LD name/description strings). ` +
      '2. Keep UNCHANGED: the entire frontmatter (imports, consts, JSON-LD structure), all ids, class names, the whole <style> block, all JS logic and identifiers, URLs, paths, format tokens, icon classes (bi-*). ' +
      '3. Do NOT change any language constants, paths like /en/, canonical URLs, or fetch URLs — leave them exactly as-is. ' +
      '4. Output ONLY the complete .astro file, no fences, no explanations, never truncate.';
    const raw = await call([
      { role: 'system', content: sys },
      { role: 'user', content: 'Source file (English):\n\n' + src },
    ]);
    let out = clean(raw);
    // 机械替换：语言常量、路径前缀、inLanguage、分类 getStaticPaths
    out = out
      .replace(/const lang = 'en' as const;/g, `const lang = '${target}' as const;`)
      .replace(/getCategoryMetas\('en'\)/g, `getCategoryMetas('${target}')`)
      .replace(/getToolMeta\(category, '[^']+', 'en'\)/g, `getToolMeta(category, '${page.slug}', '${target}')`)
      .replace(/'\/en\/'/g, `'/${target}/'`)
      .replace(/"\/en\/"/g, `"/${target}/"`)
      .replace(/\/en\//g, `/${target}/`)
      .replace(/inLanguage: 'en'/g, `inLanguage: '${target}'`);
    const issues = validate(out, target, page);
    if (issues.length) {
      console.log(`FAIL ${target}/${page.slug || page.out}: ${issues.join('; ')}`);
      writeFileSync(outPath + '.broken', out, 'utf8');
      continue;
    }
    writeFileSync(outPath, out, 'utf8');
    console.log(`OK ${target}/${page.out}`);
  }
}
console.log('完成');
