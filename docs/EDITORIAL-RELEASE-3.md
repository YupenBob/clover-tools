# 内容流水线上线记录（第三批：自动化发布）

日期：2026-11-06（Asia/Shanghai 当日 14:44 完成 GitHub 授权并开始上线）。
本文件记录自动化内容流水线的首次上线、首篇文章与验证方式；后续每批自动文章在此追加。

## 一、本次上线内容

| 项 | 内容 |
| --- | --- |
| 流水线 | `docs/EDITORIAL-AUTOMATION.md`；脚本位于 `scripts/editorial/`（24 个文件） |
| 文章数据 | `data/editorial-guides/`（16 篇旧指南迁移 + 本批 1 篇新文章），索引由 `src/lib/guides-auto.ts` 生成 |
| CI 门禁 | `scripts/check-guides-quality.mjs` 接入 `npm run check` |
| 站点信任层 | 新增 `/editorial/` 透明页；指南页新增"发布于/更新于"与"内容与验证"卡片 |
| 首篇文章 | `/guides/uuid-generator/`《UUID 怎么生成：v4/v7 差异、批量与格式校验》 |

## 二、首篇文章的量化结果

- 正文 **2489 汉字**、9 个 H2、1 个表格、5 条来源（4 条官方一手）、3 个工具内链、39 条可回查证据
- 与站内 36 篇指南最大 8-gram 相似度 **0.0006**，与 CSDN 137 篇语料 **0.0042**
- 两轮独立复核：第一轮判 **fail**（Node 示例版本矛盾、回环地址安全上下文过宽、v4 大写变体、证据行号错），
  Writer 修复后第二轮判 **pass**（confidence 0.84，39 条证据全查）
- `npm run check:all` 本地全绿：466 页构建、144 条可收录 URL、37 篇指南、189+ 项测试

## 三、发布与验证方式

1. 本地通过全部门禁后提交（`content: add guide "…"`），推送 `main`；
2. GitHub Actions 运行 Quality checks（内容/链接/SEO/发布商/emoji/图标 + 浏览器回归）与 Cloudflare Pages 部署；
3. 部署完成后校验生产 URL 的 HTTP 状态、canonical、Article 结构化数据与 robots 指令；
4. 失败时自动回滚（见 `docs/EDITORIAL-AUTOMATION.md` 第六节与 `scripts/editorial/rollback.mjs`）。

## 四、运行节奏与已知边界

- 定时任务：每天 3 次（Asia/Shanghai 06/12/18），每次最多 1 篇；连续 2 次失败自动暂停。
- 选题需求层：当前无法自动获取 Search Console 数据（凭证无法进入本机），先用
  `scripts/editorial/import-suggest.mjs` 采集 Bing/Google/Baidu 公开搜索建议作为需求代理；
  拿到 GSC 服务账号后可切回真实曝光/点击数据。
- 质量边界：独立复核由 AI 完成，等同于"自动化的第二人复核"而非人类终审；按 AdSense
  "未经人工审核的自动生成内容"政策，仍建议在 AdSense 复审前保持广告关闭，并保留一键回滚。
- 首篇之后，本文件在此追加每批（含 commit sha、生产 URL、检查结果）。
