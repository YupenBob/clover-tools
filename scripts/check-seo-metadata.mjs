#!/usr/bin/env node
/**
 * SEO 元数据源检查：简体中文工具页的 SEO 标题/描述覆盖，以及全部简体中文指南的
 * `seoDescription`。长度口径与 docs/SEO-BING-REMEDIATION.md 一致（Unicode 码点）。
 *
 * 运行于 `npm run check`；构建后 `scripts/check-seo.mjs` 还会复核渲染后的 `<title>`
 * 与 `<meta name="description">`，这两层检查共同防止再次出现 Bing 的“标题/描述过短”。
 */
import { getAllTools } from '../src/lib/tools.ts';
import { TOOL_SEO_ZH } from '../src/lib/tool-seo/index.ts';
import { GUIDES } from '../src/lib/guides.ts';

const TOOL_TITLE_MIN = 50;
const TOOL_TITLE_MAX = 60;
const DESCRIPTION_MIN = 150;
const DESCRIPTION_MAX = 160;
const BRAND_SUFFIX = ' - CloverTools';
const length = (value) => [...String(value ?? '')].length;

const problems = [];
const tools = getAllTools();
const toolSlugs = new Set(tools.map((tool) => tool.slug));

for (const tool of tools) {
  const seo = TOOL_SEO_ZH[tool.slug];
  if (!seo) {
    problems.push(`${tool.slug}: 缺少简体中文 SEO 标题 / 描述（src/lib/tool-seo）`);
    continue;
  }
  const titleLength = length(seo.title);
  if (titleLength < TOOL_TITLE_MIN || titleLength > TOOL_TITLE_MAX) {
    problems.push(`${tool.slug}: SEO title 长度 ${titleLength} 不在 ${TOOL_TITLE_MIN}–${TOOL_TITLE_MAX}`);
  }
  if (!seo.title.endsWith(BRAND_SUFFIX)) {
    problems.push(`${tool.slug}: SEO title 必须以 "${BRAND_SUFFIX}" 结尾`);
  }
  const descriptionLength = length(seo.description);
  if (descriptionLength < DESCRIPTION_MIN || descriptionLength > DESCRIPTION_MAX) {
    problems.push(`${tool.slug}: SEO description 长度 ${descriptionLength} 不在 ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}`);
  }
}
for (const slug of Object.keys(TOOL_SEO_ZH)) {
  if (!toolSlugs.has(slug)) problems.push(`${slug}: SEO 元数据没有对应工具`);
}

for (const guide of GUIDES) {
  if (!guide.seoDescription) {
    problems.push(`${guide.slug}: 缺少 seoDescription（简体中文指南 meta description）`);
    continue;
  }
  const descriptionLength = length(guide.seoDescription);
  if (descriptionLength < DESCRIPTION_MIN || descriptionLength > DESCRIPTION_MAX) {
    problems.push(`${guide.slug}: seoDescription 长度 ${descriptionLength} 不在 ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}`);
  }
}

if (problems.length) {
  console.error(`SEO 元数据检查失败（${problems.length} 处）：`);
  for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`);
  if (problems.length > 40) console.error(`  ……另有 ${problems.length - 40} 处`);
  process.exit(1);
}
console.log(
  `SEO 元数据检查通过：${tools.length} 个工具标题/描述（${TOOL_TITLE_MIN}–${TOOL_TITLE_MAX} / ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} 字符），${GUIDES.length} 篇指南 seoDescription`,
);
