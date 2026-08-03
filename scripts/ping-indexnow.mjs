/**
 * Bing IndexNow 提交：部署完成后运行 `npm run indexnow`。
 * 从 public/ 下形如 <32位hex>.txt 的 key 文件识别密钥，读取 sitemap 并推送全部 URL。
 * 未配置 key 文件时静默跳过（exit 0）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'clovertools.cn';

function findKeyFile() {
  const publicDir = join(root, 'public');
  if (!statSync(publicDir, { throwIfNoEntry: false })) return null;
  for (const name of readdirSync(publicDir)) {
    if (/^[0-9a-f]{32}\.txt$/.test(name)) {
      const content = readFileSync(join(publicDir, name), 'utf8').trim();
      if (content === name.replace(/\.txt$/, '')) return content;
    }
  }
  return null;
}

function collectUrls() {
  const sitemapIndex = join(root, 'dist', 'sitemap-index.xml');
  if (!statSync(sitemapIndex, { throwIfNoEntry: false })) return [];
  const indexXml = readFileSync(sitemapIndex, 'utf8');
  const urls = [];
  for (const loc of indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const file = join(root, 'dist', new URL(loc[1]).pathname.replace(/^\//, ''));
    if (!statSync(file, { throwIfNoEntry: false })) continue;
    const xml = readFileSync(file, 'utf8');
    for (const u of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(u[1]);
  }
  return urls;
}

const key = findKeyFile();
if (!key) {
  console.log('IndexNow：未找到 key 文件（public/<32位hex>.txt），跳过提交。');
  process.exit(0);
}

const urls = collectUrls();
if (!urls.length) {
  console.error('IndexNow：dist 中没有找到 sitemap，请先 npm run build。');
  process.exit(1);
}

const payload = {
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${key}.txt`,
  urlList: urls,
};

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error(`IndexNow 提交失败：HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`IndexNow 已提交 ${urls.length} 个 URL（${HOST}）`);
