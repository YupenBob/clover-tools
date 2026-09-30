/** Check every generated page, including root-language tools and absent variants. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, buildSiteUrl } from './lib/build-config.mjs';
import { walk, relativePath, isVerificationFile } from './lib/artifacts.mjs';
import { auditSeoPage } from './lib/seo-audit.mjs';

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
const problems = files.flatMap((file) =>
  auditSeoPage(readFileSync(file, 'utf8'), relativePath(dist, file), siteUrl),
);
if (problems.length) {
  console.error('SEO 结构检查失败（' + problems.length + ' 处）：');
  problems.forEach((problem) => console.error('  ' + problem));
  process.exit(1);
}
console.log(
  'SEO 结构检查通过：' +
    files.length +
    ' 个页面，元信息 / 收录策略 / hreflang / JSON-LD / 使用说明均合规',
);
