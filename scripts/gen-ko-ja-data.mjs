/**
 * 生成韩语（ko）与日语（ja）数据字典：以 en.json 为源，调用 DeepSeek 翻译。
 * 输出 src/lib/i18n/ko.json、src/lib/i18n/ja.json（结构同 en.json）。
 * 用法：node scripts/gen-ko-ja-data.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
const MAX_DESC = 160;
const CONCURRENCY = 3;

const LANGS = {
  ko: 'Korean (한국어)',
  ja: 'Japanese (日本語)',
};

const src = JSON.parse(readFileSync(join(root, 'src', 'lib', 'i18n', 'en.json'), 'utf8'));
const slugs = Object.keys(src.tools);

async function call(messages, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 8000,
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
    if (!content) {
      await new Promise((res) => setTimeout(res, 2000));
      continue;
    }
    const cleaned = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          // 重试
        }
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  throw new Error('batch failed after retries');
}

function sysPrompt(langName) {
  return (
    `You translate English SEO content into natural ${langName} for an online tools website. ` +
    'For each item, output a JSON object with the same keys/slugs. Rules: ' +
    `each "description" is at most ${MAX_DESC} characters (count characters, not words), natural and keyword-rich; ` +
    '"keywords" are 3-6 lowercase ${langName} search keywords; keep "icon" values EXACTLY unchanged; ' +
    '"name" is a concise tool name; "oneLiner" is one sentence; "usage" is 1-3 sentences. ' +
    'Output ONLY a valid JSON object, no markdown fences, no extra text.'
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function generateLang(lang) {
  const outFile = join(root, 'src', 'lib', 'i18n', lang + '.json');
  const existing = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
  const data = existing || { site: null, categories: null, tools: {}, content: {} };
  const sys = sysPrompt(LANGS[lang]);

  if (!data.site || !data.categories) {
    const siteBatch = await call([
      { role: 'system', content: sys },
      {
        role: 'user',
        content:
          'Translate these site strings and category names/blurbs:\n' +
          JSON.stringify({ site: src.site, categories: src.categories }, null, 1),
      },
    ]);
    data.site = siteBatch.site;
    data.categories = siteBatch.categories;
    writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`[${lang}] site + categories OK`);
  }

  const todoTools = slugs.filter((s) => !data.tools[s]);
  const toolChunks = chunk(todoTools, 5);
  const queueT = [...toolChunks];
  const workersT = Array.from({ length: CONCURRENCY }, async () => {
    while (queueT.length) {
      const batch = queueT.shift();
      if (!batch) return;
      try {
        const payload = {};
        for (const s of batch) payload[s] = src.tools[s];
        const res = await call([
          { role: 'system', content: sys },
          { role: 'user', content: 'Translate these tool entries (slug -> translated object):\n' + JSON.stringify(payload, null, 1) },
        ]);
        for (const s of batch) {
          const item = res[s];
          if (item && item.name && item.oneLiner && item.description && Array.isArray(item.keywords)) {
            data.tools[s] = item;
          } else {
            console.log(`[${lang}] TOOL MISS ${s}`);
          }
        }
        writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`[${lang}] tools +${batch.length} (${Object.keys(data.tools).length}/${slugs.length})`);
      } catch (e) {
        console.log(`[${lang}] TOOL BATCH ERR ${batch.join(',')}: ${String(e).slice(0, 100)}`);
      }
    }
  });
  await Promise.all(workersT);

  const todoContent = slugs.filter((s) => !data.content[s]);
  const contentChunks = chunk(todoContent, 3);
  const queueC = [...contentChunks];
  const workersC = Array.from({ length: CONCURRENCY }, async () => {
    while (queueC.length) {
      const batch = queueC.shift();
      if (!batch) return;
      try {
        const payload = {};
        for (const s of batch) payload[s] = src.content[s];
        const res = await call([
          { role: 'system', content: sys },
          { role: 'user', content: 'Translate these usage/content entries (slug -> {usage, features:[{icon,text}]}):\n' + JSON.stringify(payload, null, 1) },
        ]);
        for (const s of batch) {
          const item = res[s];
          if (item && item.usage && Array.isArray(item.features) && item.features.length >= 3) {
            data.content[s] = item;
          } else {
            console.log(`[${lang}] CONTENT MISS ${s}`);
          }
        }
        writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`[${lang}] content +${batch.length} (${Object.keys(data.content).length}/${slugs.length})`);
      } catch (e) {
        console.log(`[${lang}] CONTENT BATCH ERR ${batch.join(',')}: ${String(e).slice(0, 100)}`);
      }
    }
  });
  await Promise.all(workersC);

  // 校验与收尾
  const over = Object.entries(data.tools)
    .filter(([, t]) => [...(t.description || '')].length > MAX_DESC)
    .map(([s, t]) => [s, [...t.description].length]);
  for (const [s, len] of over) {
    console.log(`[${lang}] DESC OVER ${s} (${len})`);
    data.tools[s].description = [...data.tools[s].description].slice(0, MAX_DESC).join('');
  }
  writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[${lang}] done: tools=${Object.keys(data.tools).length} content=${Object.keys(data.content).length} descOver=${over.length}`);
}

const targets = process.env.DS_LANG ? [process.env.DS_LANG] : Object.keys(LANGS);
for (const lang of targets) {
  await generateLang(lang);
}
console.log('完成');
