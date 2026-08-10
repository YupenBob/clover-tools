/**
 * 根据中文描述批量重新生成 en.json 的英文 meta description（≤150 字符）。
 * 分批调用 API，每批返回 JSON，成功后立即写回文件。
 * 用法：node scripts/rebuild-desc.mjs
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
const MAX = 150;
const BATCH = 6;

const manifest = readFileSync(join(root, 'src', 'lib', 'tools.ts'), 'utf8');
const categories = { dev: '开发实用', daily: '日常实用', fun: '趣味工具' };
const zhDesc = {};
for (const [catKey] of Object.entries(categories)) {
  const section = manifest.split(`${catKey}: [`)[1].split(/\n  (?:dev|daily|fun): \[/)[0];
  for (const block of section.split('\n    {')) {
    const slug = block.match(/slug: '([^']+)'/)?.[1];
    const desc = block.match(/description: '([^']+)'/)?.[1];
    if (slug && desc) zhDesc[slug] = desc;
  }
}

const file = join(root, 'src', 'lib', 'i18n', 'en.json');
const data = JSON.parse(readFileSync(file, 'utf8'));

const jobs = Object.keys(data.tools)
  .filter((slug) => !data.tools[slug].description || data.tools[slug].description.length < 20)
  .map((slug) => ({
    slug,
    zh: zhDesc[slug] || '',
    keywords: data.tools[slug].keywords || [],
  }));

async function callBatch(batch, retries = 5) {
  const payload = batch
    .map(
      (j) =>
        `slug: ${j.slug}\nkeywords: ${j.keywords.slice(0, 3).join(', ')}\nChinese: ${j.zh}`,
    )
    .join('\n\n');
  const sys =
    `You translate Chinese tool descriptions into concise English SEO meta descriptions. ` +
    `For each item, produce a JSON object mapping the slug to a description. Rules: each description ` +
    `is at most ${MAX} characters (count characters, not words), natural English, mentions what the tool does, ` +
    `and includes the most important keywords. Output ONLY a valid JSON object, no markdown fences, no extra text.`;
  for (let i = 0; i < retries; i++) {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: payload },
        ],
        max_tokens: 4000,
        temperature: 0.2,
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
          // 继续重试
        }
      }
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  throw new Error('batch failed after retries');
}

function save() {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

let ok = 0;
const failed = [];
for (let i = 0; i < jobs.length; i += BATCH) {
  const batch = jobs.slice(i, i + BATCH);
  try {
    const result = await callBatch(batch);
    for (const job of batch) {
      const desc = String(result[job.slug] || '').trim();
      const len = [...desc].length;
      if (desc && len <= MAX) {
        data.tools[job.slug].description = desc;
        ok++;
        console.log(`OK ${job.slug} len=${len}`);
      } else {
        failed.push(job.slug);
        console.log(`FAIL ${job.slug} len=${len || 'empty'}`);
      }
    }
    save();
  } catch (e) {
    failed.push(...batch.map((b) => b.slug));
    console.log(`ERR batch: ${batch.map((b) => b.slug).join(',')} :: ${String(e).slice(0, 120)}`);
  }
}

console.log(`\n完成：${ok}/${jobs.length}；失败：${failed.length}`);
if (failed.length) console.log('失败项：' + failed.join(', '));
