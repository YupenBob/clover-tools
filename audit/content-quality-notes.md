# 全站内容盘点方法与人工抽样

取证基线：HEAD `2de17e51ae2b7fc8983a6964e31ade6c61dfd816`；源数据和现有 dist 于 2026-11-15 05:59 UTC 读取。**未运行构建或 editorial/tool-pipeline**。dist HTML 文件 mtime 范围为 2026-11-15 00:52:51–00:53:01 UTC，不推断其生产部署提交。

## 数量与口径

| 对象 | 当前重算值 | 来源/限定 |
| --- | ---: | --- |
| 工具注册项 | 77 | `src/lib/tools.ts`：dev 37、daily 22、fun 18；按独立 slug，不乘语言数 |
| 简体已注册指南 | 56 | `GUIDES = EDITORIAL_GUIDES + AUTO_GUIDES`，来自 `src/lib/editorial-guides.ts` 与 JSON；不是单纯数目录文件 |
| 繁体译文 | 23 | `src/lib/guides-translated.ts` 实际导入 |
| 英/韩/日译文 | 各 22 | 同上；翻译版本不计为新原创文章 |
| 指南正文路由 | 145 | 56 + 23 + 22×3；不含五语指南索引 |
| 工具正文路由 | 382 | 简繁各77、英韩日各76；`vocab-flash` 只有简繁实际页面，不能将77×5当真实路由数 |
| 全站 HTML | 578 | 排除百度验证 HTML；首页5、工具382、指南145、分类20（含指南索引5）、系统26（含404五页） |
| 站内允许索引 | 573 | `config/routes.mjs` 策略及产物 meta；其余5个404。不是 Google 已收录数 |
| 线上 sitemap | 573 | `sitemap-index.xml` 指向单个 `sitemap-0.xml`，URL集合与此时dist一致 |

复现（在仓库根目录，Node 22.23.4）：

```bash
node --experimental-strip-types audit/tools/inventory.mjs
python3 audit/tools/fetch-live.py
python3 audit/tools/summarize.py
python3 audit/tools/source-evidence.py
python3 audit/tools/compare-deployment.py
node audit/tools/screenshots.mjs
```

仅写 `audit/`。重新运行会使用当时源文件、dist与线上状态，应先保留本次提交，避免覆盖时点证据。CSV 每行对应实际 dist HTML；工具和指南清单先从模块读取，再与产物核对。`missingExpected` 的3条是“全语言笛卡尔积”与实际可用范围之差，不是已确认线上坏链。未注册正文 JSON 检出0个。

CSV字段：`approx_word_count` 对指南统计源 `content` 正文；其他页统计静态 `<main>`，排除 script/style，汉字/假名逐字计、其他语言按词计，故**跨语言数值不可直接比较**。不计图片文字、FAQ（指南）和交互价值，工具页含相关工具及说明，属于近似量。`internal_links` 为 main 内部链接出现次数，非去重目标数。`updated` 只取指南真实元数据或明确 dateModified，缺失留空，不用构建时间伪装更新。`indexable` 是站内允许，不是后台索引状态。canonical 从产物读取，全部属于正式域名。

## 薄内容与重复簇

规则是人工审查排序，不是 Google 阈值：工具main低于500近似单位、指南正文低于600标记候选；所有外语正文另标人工翻译复核。P0仅用于流媒体政策边界复核，P1用于薄文/译文候选，其他P2并不代表内容已人工认证。

- 208个英韩日工具页命中短文本规则（en70、ko71、ja67）。例：英文 SQL formatter 86单位、英文 JSON formatter 138，后者线上main没有指南链接；简体 JSON formatter 有具体示例、边界和3个指南链接。优先补齐有真实需求的外语说明与对应译文互链，不能用重复段落凑字数。
- 12篇简体指南命中短正文规则：`random-number-fairness`270、`date-difference-rules`275、`hash-vs-encryption`277、`bmi-reference-not-diagnosis`279、`text-diff-review`282、`unix-timestamp-seconds-milliseconds`282、`strong-password-practices`290、`url-encoding-guide`298、`cron-expression-basics`308、`regex-debugging-method`318、`json-formatting-validation`364、`json-to-csv-excel`577。完整数字以 `evidence/page-metrics.json` 为准。
- 对同类型同语言正文做字符5-gram集合 Jaccard，阈值0.45，发现0对；这**不证明无重复或原创**。指南统计源正文、工具统计main，主题不同也可能共享框架；跨语言未用机器翻译相似度。
- 结构规则：英文3个工具有完全相同H2序列 `Input Text / Result / Related tools / How to use`；另有2页生成工具簇等，见 `evidence/structure-clusters.json`。相同结构不等于重复答案。
- **已确证的泛化模板簇**：16篇简体指南显示“结果用于生产系统前，请结合项目文档和测试环境复核”及“真实密码、令牌”通用提示，见 `evidence/guide-boilerplate-clusters.json`。BMI指南也出现这两句，与健康教育题意不符。应逐题替换为相关限制；不能因此否定全部正文。

优先队列：P0五语M3U8（使用边界与广告启用决策）；P1 BMI指南（短正文+不相关模板）；P1 random/date/hash/text-diff等短指南（逐篇核对真实示例与信息增量）；P1英韩日JSON/SQL等工具（说明与互链落差）。Base64长文、ASCII实测指南可作为差异化内容的正例，不建议统一扩字。

## 首页 + 五种工具 + 五种指南抽样

2026-11-15线上HTML及桌面/390px浏览器证据见 `evidence/http-results.json`、`browser-results.json`、`screenshots/`。浏览器记录含实际URL、UTC、状态、页面宽度、图片加载、广告请求及正文。此轮是内容与布局审查，不冒充每个工具的完整功能回归。

| 页面 | 可验证的内容价值 | 本轮风险/后续 |
| --- | --- | --- |
| 首页 `/` | 用途说明、搜索、真实分类工具入口 | main中0个指南链接，无侧栏推荐/统计/运势；原创内容不易发现 |
| JSON `/tools/dev/json-formatter/` | 示例、语法错误、原理边界、FAQ、3篇延伸阅读 | 有价值；需后续以任务成功率验证体验 |
| Base64 `/tools/dev/base64/` | UTF-8、URL安全模式、膨胀与非加密解释，链接指南 | 已有针对性说明；跨语言说明不齐 |
| 计算器 `/tools/daily/calculator/` | 运算优先级14/20示例、浮点与解析器边界、指南 | 非仅输入框；长计算/键盘等完整回归未做 |
| 反应测试 `/tools/fun/reaction-test/` | 无效提前点击、设备延迟、不可用于医疗/招聘说明 | 娱乐功能价值不能由字数衡量；未来广告与点击区需实测 |
| M3U8 `/tools/daily/m3u8-downloader/` | 分片示例、缺口、缓存、CORS/DRM边界 | 未见明确内容提供方允许下载的用途提示；P0条件风险见unresolved |
| JSON返回HTML `/guides/json-unexpected-token-html/` | 本地HTTP复现脚本、状态码/类型/跳转排错、截图与3来源 | 有复现增量；只有简体hreflang符合现有译文范围 |
| Base64 `/guides/base64-not-encryption/` | 位级示例、UTF-8/填充差异、实际错误与6来源 | 内容充实，仍有通用生产环境提示 |
| BMI `/guides/bmi-reference-not-diagnosis/` | 单位和适用人群边界、CDC来源 | 无具体数值案例；279近似单位；生产系统/密码模板不合题意，P1 |
| 专注 `/guides/focus-flight-first-session/` | 一分钟完整流程、原始导出图、本地存储及后台限制 | 具体案例；浏览器全流程计时不在本轮功能验证内 |
| ASCII `/guides/ascii-art/` | 22字体、参数与输出尺寸、已知Universal/emoji限制、6来源 | 有可追溯差异细节；应核对文中已知缺陷是否修复后同步更新 |

未取得原始创作与独立复核记录，不能仅凭页面“AI辅助起草，经独立复核”声明确认全过程。未运行可能写产品产物的质量流水线。移动视觉结论及截图失败记录以浏览器结果为准，不能把图片中未滚动加载的内容算永久缺失。

## 双视口观察结果

22次线上浏览器访问全部200；11个URL的桌面/手机广告容器及广告请求均0。首页与JSON工具、JSON指南的6张主截图为精确视口尺寸；其余16张为补充整页图。浏览器记录的`clientWidth`才是CSS布局视口，移动溢出时`innerWidth`可能自动扩到417，不能仅比较scrollWidth与innerWidth宣称无溢出。

**P1：Base64与ASCII指南的390px视口出现页面级横向扩展（scrollWidth417、clientWidth390，表格右边界417）**；其余9个抽样URL的390px页面宽度为390。建议针对真实表格设置局部滚动/列宽换行，并检查长代码与内联URL；本审计未改CSS。此项影响交接§8第2项，不能用首页无溢出代替全站验收。

截图中的代码块局部横向滚动是可观察行为，不直接等于页面溢出。图片在采样时可能仍为原生lazy、内容可见性渲染或网络加载状态；`images`仅为未完成/零naturalWidth列表，不应判定全部失效。首页整页渲染曾出现未显示下方分类的区域，因此主交付采用真实视口截图，配合HTML/DOM证据；空区域没有广告容器，不能认作旧广告位。

## 终检时点补充（06:12 UTC）

并行工作推进后，现有dist在06:10 UTC被外部进程重建，原清单578个文件的哈希均已改变，HEAD也已前进；本执行者未运行构建或写产品文件。差异见 `evidence/dist-drift.json`。**本CSV及初次路由/内容统计仍依赖00:52–00:53 UTC快照，不代表新dist已验收**；原始manifest、page-metrics与线上HTML保留，不重新生成CSV以免混时点。仅保留哈希而非原dist全部HTML，复算原始全部指标需要取得对应旧产物。`deployment-comparison.json`记录初次比较（正文相同）；`deployment-comparison-later-dist.json`记录较晚已变化产物的比较，不能混用。结构/通用提示簇在较晚读取中仍检出相同规则簇，原始发现此前已记录；最终新版由WP-C独立验收。

主截图已人工查看，六张PNG为1280×900/390×844；其余为补充整页。`python3 audit/tools/validate-deliverables.py`核对CSV唯一URL/字段/计数、22次成功浏览器取证、无广告DOM/请求、截图尺寸/文件和本地文档链接；dist是否变化作为观察字段保留，不把外部构建变化伪装成审计者改动或校验通过。
