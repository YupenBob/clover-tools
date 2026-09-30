/** Node 22.18+ / 24 can read these data-only TypeScript modules without a second manifest. */
import { getAllTools } from '../src/lib/tools.ts';
import { TOOL_CONTENT } from '../src/lib/tool-content.ts';
import { TOOL_DETAILS } from '../src/lib/tool-details.ts';
import { GUIDES } from '../src/lib/guides.ts';
import { CONTENT_LIMITS } from '../config/quality.mjs';

const tools = getAllTools();
const slugs = new Set(tools.map((tool) => tool.slug));
const problems = [];
if (slugs.size !== tools.length) problems.push('工具 slug 重复');
const guideSlugs = new Set();
for (const guide of GUIDES) {
  if (guideSlugs.has(guide.slug))
    problems.push(`指南 slug 重复：${guide.slug}`);
  guideSlugs.add(guide.slug);
  if (!slugs.has(guide.toolSlug))
    problems.push(`${guide.slug}: 关联工具不存在`);
  if (!TOOL_DETAILS[guide.toolSlug])
    problems.push(`${guide.slug}: 工具缺少对应的深度说明与返回入口`);
  if (
    !guide.sources?.length ||
    guide.sources.some(
      (source) =>
        !source.title ||
        !URL.canParse(source.url) ||
        new URL(source.url).protocol !== 'https:',
    )
  )
    problems.push(`${guide.slug}: 参考来源缺失或无效`);
  if (!guide.content.trim() || guide.faqs.length < CONTENT_LIMITS.faqsMin)
    problems.push(`${guide.slug}: 正文或 FAQ 不完整`);
  const date = new Date(guide.updated);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== guide.updated
  )
    problems.push(`${guide.slug}: 更新日期无效`);
  const published = new Date(guide.published);
  if (
    !Number.isFinite(published.valueOf()) ||
    published > date ||
    published.toISOString().slice(0, 10) !== guide.published
  )
    problems.push(`${guide.slug}: 发布日期无效或晚于更新日期`);
}
for (const [slug, detail] of Object.entries(TOOL_DETAILS)) {
  if (!slugs.has(slug) || !TOOL_CONTENT[slug])
    problems.push(`${slug}: 深度说明没有对应工具`);
  if (
    detail.steps.length < CONTENT_LIMITS.stepsMin ||
    detail.examples.length < CONTENT_LIMITS.examplesMin ||
    detail.faqs.length < CONTENT_LIMITS.faqsMin ||
    !detail.privacy
  )
    problems.push(`${slug}: 深度说明不完整`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `内容关联检查通过：${tools.length} 个工具、${Object.keys(TOOL_DETAILS).length} 份深度说明、${GUIDES.length} 篇指南`,
);
