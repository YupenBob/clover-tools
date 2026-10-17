# Google 收录与迁移接续检查

更新：2026-10-16。来源是本仓库的历史树、当前静态构建与部署后的公开 HTTP 审计。本文不包含 Search Console 后台数据，也不把站内检查写成 Google 已抓取或已收录。

## 这轮解决的事

新增 20 个经过功能核对的旧工具地址，指向 18 个现有工具。包括旧站文章引用的 JSON 格式化、HTTP 测试、Base64、JWT、UUID、JSON/YAML、哈希、URL 编码、XML/SQL 排版、Unicode、M3U8、二维码、时间戳、URL 解析、JavaScript 排版、文本对比和 Markdown 预览入口。

清单在 [reviewed-legacy-tool-redirects.csv](audits/reviewed-legacy-tool-redirects.csv)。每条保留旧工具名称、历史 Git 引用、可找到的历史文件与旧文引用次数。部分地址只有清单和文章引用，不能据此声称它当年线上返回过 200；引用次数也不是访问量。

JSON 数据对比、JSON 表格等主用途有差异的入口继续待核。没有把全部旧工具或旧文章指向首页。

跳转从 `ToolMeta.legacyPath / legacyAliases` 统一生成。生成器直接读取工具注册表，并检查重复和循环地址；只有别名、没有主旧地址的工具也能生成规则。当前共有 89 条工具跳转；三篇重写文章的 9 条历史别名规则保留。Pages 本地解析共 112 条有效规则。

## 面包屑检查补全

原检查确认 JSON-LD 中存在 BreadcrumbList，但没有逐项检查内容。现在构建和正式域名验收都检查：

- 至少两个 ListItem，名称有效，position 为从 1 连续递增的整数。
- 中间项有有效本站绝对网址；最后一项可按 Google 规范省略 item。
- 同时支持字符串网址、带 @id 的对象、JSON-LD 数组和 @graph。
- 项目额外约定：末项提供网址时应与 canonical 一致，不夹带查询参数或片段。

当前构建 407 个带面包屑的页面通过上述检查，包含暂未开放收录的语言版本。没有为了让报告好看而编造评分、移除面包屑或更换页面主题。

后台过去的错误是否消失，仍要看相应网址的错误字段、最近抓取日期与重新验证结果。[Google 的面包屑字段说明](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)。

## 站内策略和 Google 实际状态分开记录

当前构建有 453 个站点页面，其中：

| 构建状态 | 页数 | 含义 |
| --- | ---: | --- |
| 站内策略允许收录 | 132 | 进入 sitemap 的规范页面；不保证 Google 收录 |
| 分阶段语言版本 | 316 | 工具及分类页暂时 noindex，保留访问能力 |
| 错误页面 | 5 | 404 页面，按设计排除 |

`scripts/check-seo.mjs` 生成 `output/seo/indexing-inventory.json / .csv`，逐页记录路径、语言、canonical、meta robots、策略原因和面包屑条数。Google 实际状态统一标为 `not-observed`。

质量 CI 的清单 origin 为测试域名，适合检查规则；生产验收归档另含正式域名清单，核对 Search Console 时使用生产版本。清单保留 30 天或随生产验收归档保留。

## 公开访问审计

`scripts/audit-crawlability.mjs` 在成功发布后由 Cloudflare crawler audit 工作流执行，也可以手动触发。它只读取公开响应，不修改 DNS、WAF 或 Google 账户：

1. 读取正式 sitemap，逐一检查其网址的 HTTP 状态、canonical、索引指令、页面结构和面包屑。
2. 用 Googlebot / Mediapartners-Google 两种 UA 字符串请求三个代表页面，记录与普通请求的差异。
3. 查看 HTTP / www 入口的跳转链，检查规范域名、深层路径和查询参数是否保留。
4. 检查所有 89 条工具跳转是否直接 301 到等价规范页。

UA 检查只换请求头，不能模拟 Google 的来源 IP、已验证爬虫身份或 Search Console 实时测试；真实 Google 请求需依照[官方验证方法](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests)确认。

普通页面或旧工具入口失败会使审计失败。域名变体的问题单列为 `needs_attention`，不因为主要网址正常而隐去。输出保存在 `output/crawler-audit/public-crawlability.json`，报告不保存 Cookie 或整页响应内容。

同一工作流重新通过 API 检查 Bot Fight Mode 关闭，并只读查看 www 的公开地址记录和 Always Use HTTPS 单项状态。权限不足记为未验证；没有读到某个设置不能推断它关闭，某一项关闭也不能替代对实际跳转链的判断。

## 接下来怎样用 Search Console 明细

先核对发生问题的网址，再按原因处理：

| 后台原因 | 核对重点 | 处理边界 |
| --- | --- | --- |
| 被 noindex 排除 | 与生产策略清单对照 | 分阶段语言版本是预期；简体工具或指南意外出现 noindex 才需要修复 |
| 网页会自动重定向 | 检查旧地址与最终目标 | 旧地址退出索引正常，应观察规范目标的状态 |
| 未找到 / 软 404 | 对照历史处置和当前正文 | 有等价内容才精确跳转；没有恢复的旧文正常 404 |
| 已发现，尚未编入索引 | 发现日期、抓取记录、站内入口 | sitemap 和内链完整不代表已经抓取，不能靠反复提交保证收录 |
| 已抓取，尚未编入索引 | 抓取日期、Google 看到的正文、重复内容与实际用途 | 需要按页面审查，不能从状态名直接推导整个网站质量差 |
| Google 选择了其他规范网页 | 用户声明和 Google 选择的 canonical | 先确认具体被选择的网址，避免盲目改全站 canonical |
| 面包屑错误 | 错误字段、样本网址、最后抓取时间 | 当前构建通过字段检查，仍需 Google 重新抓取后在后台验证 |

账户服务账号尚未配置时，自动 sitemap 提交会明确跳过；已有 sitemap 仍按当前内容更新。保留已有后台配置，不伪造凭据或把流水线成功当成 Google 已接收。

## 本地验证和发布验收

本轮本地完整构建与专项测试通过；Pages 运行时已验证 132 个规范页面、89 条工具跳转和 6 次 UA 请求头探测。HTTP / www 的真实边缘行为留给正式域名审计，不以本地模拟代替。

正式部署继续运行既有完整质量流程，并在每个被验收页面上检查实际返回的 SEO 和面包屑字段。公开访问审计在部署完成后归档独立报告，最终结论以对应提交的 Actions 记录为准。
