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

## 五、上线结果（2026-11-06 06:44–06:52 UTC）

| 项 | 结果 |
| --- | --- |
| 推送 | 13 个提交推送 `main`，HEAD `eac61449`（首篇内容提交 `17c5d96`） |
| CI | [Quality checks #42176386963](https://github.com/YupenBob/clover-tools/actions/runs/42176386963)：quality job success，Deploy to Cloudflare Pages success |
| 生产文章 | `https://clovertools.cn/guides/uuid-generator/` HTTP 200，canonical/Article JSON-LD/indexable 校验通过 |
| 生产透明页 | `https://clovertools.cn/editorial/` HTTP 200 |
| 站点状态 | 指南索引 37 篇；sitemap 144 条 URL（含新页）；首页工具数 77 |
| GitHub 授权 | 设备授权（scope `public_repo`）；token 存 `.editorial/secrets/github-token`（600，gitignored） |
| 定时任务 | `schedule-a1d3191e-4b1d-4f80-88f1-599561a9f402`，cron `0 6,12,18 * * *` Asia/Shanghai，首次 2026-11-06 18:00（Asia/Shanghai） |

## 六、多语言与全语言索引（2026-11-06）

用户决策（2026-11-06）：

1. **指南 5 语言**：新文章自动产出 tw/en/ko/ja 译文并直接允许收录；旧文章不回填（UUID 篇的繁中版作为流水线验证样本保留）。
2. **工具页全语言索引**：`config/routes.mjs` 的 `toolIndexLanguages` 与 `/guides` 的 `localizedSections` 同时开放 zh/tw/en/ko/ja。
   构建结果：可收录页面从 144 增至 461+（sitemap 461 条；加入繁中译文后 463 条、468 页）。
   唯一缺口语种是 `vocab-flash` 的 en/ko/ja 页面（不存在），其 hreflang 与语言切换按实际存在的 zh/tw 输出。
3. **数据结构**：`data/editorial-guides/<slug>.<lang>.json` + 生成的 `translations.json` / `guides-translated.ts`；
   工具页语言清单 `data/i18n-tool-pages.json`。
4. **质量门禁**：译文需通过 `validateTranslationStatic`（结构对齐、来源集合一致、内链本地化、语言脚本比例、长度、`_meta.translation` 含复核结论）
   与多语 Reviewer（confidence ≥0.7）；CI 的 `check-guides-quality.mjs` 做持久校验。
5. **风险与回滚**：自动翻译在 Google 的 scaled content 规则下仍有风险，尤其 AdSense 低质历史叠加；
   建议保持广告关闭，并可用一行配置回退：收窄 `config/routes.mjs` 的 `toolIndexLanguages` 与 `localizedSections` 中 `/guides` 的语言列表。

繁中样章：`https://clovertools.cn/zh-hant/guides/uuid-generator/`（机械转换，`_meta.translation.reviewerConfidence=1`）。

### 上线与验收（2026-11-06）

| 项 | 结果 |
| --- | --- |
| 提交 | `c64121b`（五语言指南 + 全语言索引 + 翻译流水线），已推送 `main` |
| CI / 部署 | [Quality checks #42181987673](https://github.com/YupenBob/clover-tools/actions/runs/42181987673)：quality ✅、Cloudflare 部署 ✅ |
| 构建 | 468 页；sitemap 463 条（唯一排除项为 5 个 404） |
| 生产抽查 | `/zh-hant/guides/uuid-generator/` 200 且 canonical/hreflang 正确；`/en/tools/dev/json-formatter/` 无 noindex、5 语言 hreflang；`/zh-hant/tools/daily/vocab-flash/` 仅 zh/zh-Hant；`/en|ja|ko/tools/daily/vocab-flash/` 为真实 404（不虚构页面）；首页工具数 77 |
| 风险 | 317 个外语工具页与自动翻译同时开放收录，叠加 AdSense 低质历史，风险显著上升；已保留配置级回滚（收回 `toolIndexLanguages` / `localizedSections`）与一键文章回滚 |
