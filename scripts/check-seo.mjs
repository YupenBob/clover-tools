/** Check every generated page, including root-language tools and absent variants. */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, buildSiteUrl } from './lib/build-config.mjs';
import { walk, relativePath, isVerificationFile, pagePath, htmlTags, attributes } from './lib/artifacts.mjs';
import { auditSeoPage } from './lib/seo-audit.mjs';
import { isIndexablePath, languageFromPath, isErrorPath } from '../config/routes.mjs';
import { structuredData, hasType } from './lib/structured-data.mjs';

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
const inventory = [];
const problems = files.flatMap((file) => {
  const content = readFileSync(file, 'utf8');
  const relative = relativePath(dist, file);
  const path = pagePath(relative);
  const tags = htmlTags(content).filter(tag => /^<(?:meta|link)\b/.test(tag)).map(attributes);
  const indexable = isIndexablePath(path);
  inventory.push({ path, url: siteUrl + path, language: languageFromPath(path), indexable,
    policyReason: indexable ? 'eligible-by-site-policy' : isErrorPath(path) ? 'error-page' : 'staged-language',
    canonical: tags.find(tag => tag.rel === 'canonical')?.href || '',
    metaRobots: tags.find(tag => tag.name === 'robots')?.content || '',
    breadcrumbTrails: structuredData(content).nodes.filter(node => hasType(node, 'BreadcrumbList')).length,
    googleIndexStatus: 'not-observed',
  });
  return auditSeoPage(content, relative, siteUrl);
});
if (problems.length) {
  console.error('SEO 结构检查失败（' + problems.length + ' 处）：');
  problems.forEach((problem) => console.error('  ' + problem));
  process.exit(1);
}
const output = join(root, 'output', 'seo');
mkdirSync(output, { recursive: true });
const eligible = inventory.filter(page => page.indexable).length;
const summary = { origin: siteUrl, generatedAt: new Date().toISOString(), source: 'rendered build, not Search Console', commit: process.env.GITHUB_SHA || null, pages: inventory.length, eligibleBySitePolicy: eligible, excludedBySitePolicy: inventory.length - eligible, breadcrumbPages: inventory.filter(page => page.breadcrumbTrails > 0).length };
writeFileSync(join(output, 'indexing-inventory.json'), JSON.stringify({ ...summary, inventory }, null, 2) + '\n');
const columns = Object.keys(inventory[0]);
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
writeFileSync(join(output, 'indexing-inventory.csv'), [columns, ...inventory.map(page => columns.map(key => page[key]))].map(row => row.map(quote).join(',')).join('\n') + '\n');
console.log(`站内索引策略清单：${eligible} 个候选页面，${inventory.length - eligible} 个按设计排除；不代表 Google 实际收录数`);
console.log(
  'SEO 结构检查通过：' +
    files.length +
    ' 个页面，元信息 / 收录策略 / hreflang / JSON-LD / 使用说明均合规',
);
