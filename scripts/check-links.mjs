/** Verify links and require sitemap coverage to match the rendered index policy. */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { root, buildSiteUrl } from './lib/build-config.mjs';
import {
  walk,
  relativePath,
  pagePath,
  outputPath,
  attributes,
  decodeEntities,
  isVerificationFile,
  htmlTags,
} from './lib/artifacts.mjs';
import { isIndexablePath } from '../config/routes.mjs';

const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}
const siteUrl = buildSiteUrl();
const files = walk(dist).filter(
  (file) =>
    file.endsWith('.html') && !isVerificationFile(relativePath(dist, file)),
);
const problems = [];
const expectedUrls = new Set();

for (const file of files) {
  const from = relativePath(dist, file);
  const path = pagePath(from);
  const content = readFileSync(file, 'utf8');
  if (isIndexablePath(path)) expectedUrls.add(siteUrl + path);
  // Do not interpret HTML examples or JavaScript strings as live links.
  const markup = content.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/g,
    (script) => script.slice(0, script.indexOf('>') + 1),
  );
  for (const match of htmlTags(markup).filter((tag) =>
    /^<(?:a|link|script|img|source|iframe|video|audio)\b/.test(tag),
  )) {
    const tag = attributes(match);
    for (const ref of [tag.href, tag.src].filter(Boolean)) {
      try {
        const url = new URL(ref, siteUrl + path);
        if (url.origin !== siteUrl) continue;
        const target = outputPath(dist, url.pathname);
        if (!statSync(target, { throwIfNoEntry: false })?.isFile())
          problems.push(`${from} -> ${ref}`);
      } catch {
        problems.push(`${from}: 无效 URL ${ref}`);
      }
    }
  }
}

const actualUrls = new Set();
const sitemapIndex = join(dist, 'sitemap-index.xml');
function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decodeEntities(match[1]),
  );
}
if (!existsSync(sitemapIndex)) {
  problems.push('缺少 dist/sitemap-index.xml');
} else {
  for (const loc of locations(readFileSync(sitemapIndex, 'utf8'))) {
    try {
      const url = new URL(loc);
      const file = outputPath(dist, url.pathname);
      if (url.origin !== siteUrl || !existsSync(file)) {
        problems.push(`sitemap 索引地址无效：${loc}`);
        continue;
      }
      for (const entry of locations(readFileSync(file, 'utf8'))) {
        if (actualUrls.has(entry)) problems.push(`sitemap 重复 URL：${entry}`);
        actualUrls.add(entry);
        if (!expectedUrls.has(entry))
          problems.push(`sitemap 包含非可收录页面：${entry}`);
      }
    } catch {
      problems.push(`sitemap 索引无法解析：${loc}`);
    }
  }
}
for (const url of expectedUrls) {
  if (!actualUrls.has(url)) problems.push(`可收录页面遗漏于 sitemap：${url}`);
}
const robots = join(dist, 'robots.txt');
if (
  !existsSync(robots) ||
  !readFileSync(robots, 'utf8').includes(
    `Sitemap: ${siteUrl}/sitemap-index.xml`,
  )
) {
  problems.push('robots.txt 中的 sitemap 地址与站点配置不一致');
}
if (problems.length) {
  console.error(`链接 / sitemap 检查失败（${problems.length} 处）：`);
  problems.forEach((problem) => console.error('  ' + problem));
  process.exit(1);
}
console.log(
  `链接检查通过：${files.length} 个页面无失效链接；sitemap ${actualUrls.size} 条 URL 与可收录页面一致`,
);
