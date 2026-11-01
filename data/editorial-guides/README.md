# 自动内容流水线的文章数据（data/editorial-guides/）

本目录每篇文章一个 `<slug>.json`，由自动化内容流水线写入；`src/lib/guides-auto.ts`
由 `node scripts/editorial/build-auto-index.mjs` 生成并提交，站点构建通过它把这些文章
纳入 `GUIDES`。

- 带 `_meta.auto: true` 的文件会接受 `scripts/check-guides-quality.mjs` 的严格质量门禁
  （篇幅、结构、来源、内链、证据、相似度、日期、图片登记等）。
- 带 `_meta.source: "legacy-migration"` 的文件是 2026-11 从 `src/lib/guides.ts`
  迁移出来的旧文章，只做基础字段校验；它们会作为 `upgrade-guide` 任务的升级对象。
- 手工修改本目录后必须运行 `node scripts/editorial/build-auto-index.mjs`，
  然后 `npm run check:all`。

字段与 `src/lib/guides.ts` 的 `Guide` 接口一致；发布记录与流水线规范见
`docs/EDITORIAL-AUTOMATION.md`。
