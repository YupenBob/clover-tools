# Bing 标题与元描述整改（2026-11-13）

Bing Webmaster Tools 在 2026-11-13 的 SEO/GEO 报告中给出两项 Moderate 错误（站点 `https://clovertools.cn`）：

| 报告 | 页面数 | 导出文件 | 本轮处理 |
| --- | ---: | --- | --- |
| Meta descriptions on many of your pages are too short | 68（表格仅展示 50 条） | `clovertools.cn_FailingUrls_11_13_2026.csv` | 简体中文全部可收录页面扩写到 150–160 字符；`/en/about/` 同步 |
| Many of your page titles are too short | 18 | `clovertools.cn_FailingUrls_11_13_2026 (1).csv` | 工具页、固定页补到 50–60 字符；`/en/about/` 同步 |

Bing 的建议原文：标题约 50–60 个字符；meta description 150–160 个字符。本轮按这两个区间执行。

## 长度口径

- 以 Unicode 码点计数，等价于 JS 的 `[...value].length`；汉字与全角标点各算 1 个字符。
- 标题 **50–60 个字符**，必须包含结尾后缀 ` - CloverTools`（空格、连字符、空格都计入）。
- Meta description **150–160 个字符**。
- 写作时先写好再量长度，不足补具体信息，超了删冗余；不要为凑长度重复关键词。

## 范围（本轮）

1. 简体中文（`/` 根路径）全部 143 个可收录页面：
   - 77 个工具页：`src/lib/tool-seo/{dev,daily,fun}.ts` 提供覆盖标题与元描述；
   - 56 篇指南：`data/editorial-guides/<slug>.json` 与 `src/lib/editorial-guides.ts` 增加 `seoDescription`；
   - 首页、关于、联系、隐私、条款、指南索引、编辑流程、3 个分类页：直接改页面内字符串；`/en/about/` 单独同步英文标题与描述。
2. 其它语言（tw / ko / ja / en 的工具与指南页）本轮不改；`config/quality.mjs` 中它们的门槛维持旧值，属下一阶段工作。

指南的 `<title>` 目前都 ≥30 字符，已超过 Bing 的过短阈值，本轮不改标题、不动 H1；只补 `seoDescription`。

## 文案规范

- 工具页标题：主关键词在前，随后补充 2–3 个真实能力或输入形式（如进制、格式、算法、导出方式），最后接 ` - CloverTools`。
- 指南 / 固定页标题：先用页面主题，再补具体场景或边界，最后接 ` - CloverTools`。
- Meta description：首句直接说明页面能解决什么问题；随后 1–2 句写具体功能、适用场景或限制。只写仓库里已有的事实（工具说明、深度说明、指南正文与 FAQ），不编造数字、实测经历、作者或承诺。
- 每页文案必须独立撰写，禁止跨页面复制同一句式；避免「最强 / 全网第一 / 永久免费 / 100% 准确 / 包治 / 绝对安全」等夸大用语。
- 只用中文全角标点；字符串内不要出现 ASCII 单引号 `'`、反斜杠、反引号、`<`、`>`；不要用 emoji。

## 字段与渲染位置

- 工具页：`src/lib/tool-seo/types.ts` 定义 `ToolSeoZh { title, description }`；`src/lib/tool-seo/index.ts` 汇总三个分类文件。`src/layouts/ToolLayout.astro` 只在 `lang === 'zh'` 时使用，其它语言回退到现有 `tool.name / tool.description`。
- 指南页：`Guide.seoDescription?: string`；`src/components/GuideArticle.astro` 用 `guide.seoDescription ?? guide.description` 作为 meta description 与 Article JSON-LD 的 description。H1 与列表卡片继续使用 `guide.description`。
- 固定页：页面内的 `title` / `description` 常量（`LegalPage.astro` 用简体中文覆盖表；`/en/about/` 直接用英文）。

## 校验方式

- 工具：导入 `src/lib/tool-seo/<分类>.ts` 与 `src/lib/tools.ts`，核对 slug 集合、标题长度 / 后缀、描述长度。
- 指南：导入 `src/lib/guides.ts` 或遍历 `data/editorial-guides/*.json`，核对 `seoDescription` 长度 150–160。
- 固定页：构建后由 `scripts/check-seo.mjs` 与 `scripts/lib/seo-audit.mjs` 统一复核（简体中文标题 ≥50 且描述 150–160；`/en/about/` 描述 ≥150）。

## 门禁变化（本轮固化）

- `config/quality.mjs`：新增按语言的标题下限与描述下限——简体中文标题 ≥20（Bing 的“过短”阈值）、meta description 150–160；英文标题 ≥20；其它语言本轮维持旧门槛。工具页与固定页由内容层保证 50–60 字符标题。
- `scripts/lib/seo-audit.mjs`：按语言读取标题 / 描述上下限。
- 新增 `scripts/check-seo-metadata.mjs`：校验 `src/lib/tool-seo/*` 的 slug 覆盖与长度（标题 50–60 且以 " - CloverTools" 结尾、描述 150–160），并校验全部简体中文指南的 `seoDescription` 长度。
- `.editorial/config.json` 与 `scripts/editorial/lib/quality.mjs`：自动指南新增 `seoDescription`（150–160 字符）硬性校验，`docs/EDITORIAL-AUTOMATION.md` 的 Writer 任务书同步更新，避免下一轮内容流水线重新产出过短描述。
