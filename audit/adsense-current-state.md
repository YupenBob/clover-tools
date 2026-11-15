# AdSense P0现状审计

审计基线HEAD `2de17e51ae2b7fc8983a6964e31ade6c61dfd816`。源/产物盘点2026-11-15 05:59 UTC；线上curl06:00:08–06:00:13 UTC，浏览器时间见各条记录。只写audit，未运行构建/内容流水线，未改产品。并行首页重构不在本报告“已上线”结论内。`dist/` 是00:52:51–00:53:01 UTC的既有HTML快照；每页mtime、SHA256见 `evidence/dist-manifest.json`。

三次“低价值内容”拒审来自用户确认，未取得三次通知原文/时间/版本。**技术整改≠内容价值，广告布局不能确认为拒审唯一原因；本报告不保证过审。**

## 三栏结论

| 已确证（证据） | 待核实假设 | 风险分层与依据 |
| --- | --- | --- |
| 当前广告默认false，placeholder/空slot不渲染，唯一实ID是tool_sidebar（`evidence/source-baseline/src/lib/ads.ts`、AdUnit） | AdSense后台自动广告、地区同意、历史实际曝光位置 | P0启用前复核；当前无广告不代表历史无广告。旧位未知 |
| 线上首页/JSON工具/JSON指南200，adsbygoogle和广告容器0；浏览器无相应请求（`http-results.json`,`live-summary.json`,`browser-results.json`） | 所有地区/所有页面长期状态、未来广告填充效果 | P0边界审计已做；复审保持关闭，不能拿此图验收启用后布局 |
| 源注册77工具、56简体指南；译文tw23/en22/ko22/ja22；dist578页，站内573允许索引（`content-summary.json`,`content-quality.csv`） | 实际Google索引、原创比例及创作过程 | P0需后台覆盖与人工内容复核；数字是重算，不沿用历史77/56/36 |
| 线上首页main指南链接0，无侧栏、推荐、运势；有搜索和分类（`home.html`,`live-summary.json`） | 新改版部署何时完成、是否改善使用结果 | P1信息架构缺口；不能把新增UI当通过审核依据 |
| 12篇简体指南命中短正文规则；16篇显示泛化提示，BMI也写生产系统/密码（`guide-boilerplate-clusters.json`,`page-metrics.json`,`guide-bmi.txt`） | 是否满足真实用户问题、独立复核声明是否有原始记录 | P1逐篇审查；字数阈值只是排序，非Google门槛 |
| 208个英韩日工具页命中短main规则；英文JSON无指南互链但简体有3个（`page-metrics.json`,`en-tool.html`,`tool.html`） | 语言准确性/外语搜索需求/用户任务成功率 | P1译文说明与互链落差；已开放索引更需人工复核 |
| M3U8支持AES-128、登录Cookie、分片保存，拒绝非identity/DRM，受CORS限制；页面未见明确内容方允许下载提示（源码快照、`m3u8.txt`） | 用户实际下载场景和授权、提供方是否禁止下载 | P0条件性政策风险，**未确认违规**；见unresolved，不随意删功能 |
| robots允许搜索，sitemap573，缺失URL真实404；主HTTP301保留路径参数（`robots.html`,`sitemap-0.html`,`*.headers`） | Google选canonical、verified bot受WAF挑战情况 | P0公开技术证据通过抽样；实际爬虫/索引仍待私有证据 |
| 390px下Base64与ASCII指南clientWidth390、scrollWidth417，越界元素为表格（`browser-results.json`及对应移动截图） | 其他视口/语言是否同样溢出 | P1移动阅读缺陷，交接§8.2不能全站判通过 |
| `www`请求curl退出6，Could not resolve host（`http-results.json`） | 权威DNS与Cloudflare配置/地区传播 | P1域名入口不完整；主域名可用，不直接归因拒审 |
| 仓库和账号curl200；GitHub API homepage仍旧域名（`github-api.html`,`github-repo.html`,`http-results.json`） | 旧域名实际重定向、仓库About更新计划 | P1可信度/入口一致性；已证实About仍旧地址 |
| About/隐私/联系线上200；页面有仓库链接（`about.html`,`privacy.html`,`contact.html`,`home.html`） | 维护者身份与联系响应、账户资质、真实访问数据 | P2可信度与统计数据需用户核实；不伪造PV/UV |

证据路径在本表省略前缀均为 `audit/evidence/`。更完整内容与截图审查见 [内容方法](content-quality-notes.md)、[广告清单](ad-placement-inventory.md)、[未解决项](unresolved.md)。

## 源码、产物与线上部署一致性

源码比较固定在上述HEAD，原始相关源码已归档 `evidence/source-baseline/`。线上首页仍为旧目录结构：用途/搜索/分类/工具网格，main中0个`/guides/`入口，无`home-sidebar`、站点数据、推荐文章/工具和今日运势标记；与基线 `src/pages/index.astro` 的结构一致。后续工作区文件会由实现者改变，不能因此宣称线上已更新。

- 首页、工具、指南的线上HTML与既有dist**非字节相同**（各多约1114字符）；去script/标签并归一空白后可见文本逐字一致，不能据此认定完整部署同提交。哈希见 `deployment-comparison.json`，可能的边缘注入需单独识别，不能把hash不同直接称代码漂移。
- `ads.txt` 与public文件字节相同；sitemap-0与dist字节相同且URL集合573一致。源码广告关闭与三类线上无脚本/空框相符。
- robots线上比源生成文本多Cloudflare Managed Content，搜索允许、部分AI/其他爬虫禁止；这是公开边缘文本差异，不代表Googlebot被阻止。
- 源注册数量与dist实际路由能解释：`vocab-flash`仅简繁有工具页，英韩日未生成；不能把工具数乘5误报385工具页面。指南共145正文路由。

## 技术检查（命令与摘要）

复现：`python3 audit/tools/fetch-live.py` 保存curl完整headers/body，`python3 audit/tools/summarize.py`提取SEO标记；curl失败不被隐藏。`node --experimental-strip-types audit/tools/inventory.mjs`只读取现有dist和源数据，不触发构建。

| 检查 | 公开/静态结果与限定 |
| --- | --- |
| robots | `curl -sS https://clovertools.cn/robots.txt` 200。`User-agent:* Allow:/`、Sitemap指向sitemap-index；Cloudflare管理段另禁止Google-Extended/GoogleOther等，不把这些名字混为Googlebot。无针对Googlebot/Mediapartners的Disallow |
| sitemap | `curl -sS https://clovertools.cn/sitemap-index.xml` 200，1个子图；sitemap-0 200、573个`<loc>`；`/sitemap.xml`404是非配置入口，不应当作站点图坏掉。未重新请求573个页面的全网状态 |
| canonical | 首页、JSON简/英工具、JSON简指南、ASCII英指南均自引用HTTPS正式域名；dist578页canonical均正式域名。Google最终选择待GSC |
| hreflang | 首页和JSON工具五语+x-default；JSON返回HTML指南仅zh-CN+x-default（无译文）；ASCII英指南五语+x-default。实存语言有差异，不能要求每篇强制五语 |
| 404 | `curl -L https://clovertools.cn/audit-missing-20261115/`404；`/blog/audit-missing-20261115`404，未发现旧文一律跳首页的本次证据；历史文档中的通配首页跳转不可照搬为现状 |
| 重定向 | HTTP深层工具入口301→HTTPS200，保留`?audit=1`；`/tools/json/formatter.html`301→等价JSON页200，仅一跳；www DNS失败（退出6），详见headers与http-results |
| 首页title | 在线工具箱：开发、日常与趣味工具三合一，支持搜索、分类筛选与浏览器本地处理 - CloverTools |
| 首页description | 线上有具体用途、三类场景、搜索/拼音、浏览器与联网处理边界、移动和深色模式说明，原文见`live-summary.json`，不是缺失meta |
| 内链 | dist全部main内链解析，缺失目标0（包括可存在的资源文件），见`internal-links.json`；这是静态目标存在性，不是全网200或所有锚点/JS动作校验。线上五种工具、五种指南及About/隐私/联系抽样均200。首页原创指南入口缺失独立记录 |
| GitHub | `curl -L https://github.com/YupenBob/clover-tools`与`.../YupenBob`均200、无重定向；公开API full_name正确，homepage=`https://tools.xsanye.cn`；仓库HTML About也可检索旧域名。未修改GitHub资料 |
| Googlebot公开可抓取性 | `curl -A Googlebot URL`及`-A Mediapartners-Google`各对首页/工具/指南请求，6/6为200，有正文/canonical、无noindex/挑战页特征。仅更换UA，来源仍本机IP，不是verified Googlebot。不能证明GSC实际抓取、收录或AdSense审查成功 |

可读性、移动宽度、图片加载和真实URL记录见 `browser-results.json`。22次页面访问均200且广告DOM/请求0；Base64、ASCII两页移动表格扩到417px，其余9个URL在390px抽样未出现页面级横向溢出。图片字段记录采样时尚未加载/失败的候选，不等于永久404。本轮不运行build、check:all或会写output的既有检查脚本，不把历史CI记录当成本次测试。

## 对照交接包§7逐项状态

状态评估截至本审计线上时点；“已完成”仅指该项明确的公开审计交付，不表示审核风险全解决。

| 阶段/事项 | 状态 | 已有覆盖与缺口 |
| --- | --- | --- |
| P0真实广告清单/截图 | 已完成 | 本次slot、条件、CSS、桌面移动证据；历史位置未知如实保留 |
| P0全站路由/数量/构建来源 | 已完成 | CSV578页、模块与dist时间/哈希；Google真实索引另待 |
| P0首页+5工具+5指南内容/移动审查 | 已完成 | 11个URL双视口证据及人工内容表；完整交互回归未覆盖 |
| P0 M3U8政策评估与建议 | 已完成 | 源码/文案/官方政策条件风险；具体授权待核实，不宣判违规 |
| P0 robots/sitemap/canonical/404/内链 | 部分 | 静态全量+线上抽样已做，www失败；GSC、真实爬虫日志未有 |
| P0空广告/脚本及关闭策略 | 已完成 | 历史整改已默认关闭，本次实证无框/脚本；继续关闭建议 |
| P1首页定位+搜索 | 已完成 | 基线首页和线上已有；重构最终验收另交WP-C |
| P1精选原创指南显著入口 | 未做 | 本次线上main0指南链接；并行实现中不等于上线 |
| P1推荐工具/文章真实源与回访 | 未做 | 当前无首页专门推荐区；已有工具指南局部互链 |
| P1主要工具针对性用例/错误/互链 | 部分 | 历史深度说明在简繁可见；外语工具短说明/无互链优先补齐 |
| P1指南实测案例/清理泛化内容 | 部分 | 有JSON/专注/ASCII正例；短指南和16篇通用提示未清理 |
| P1全站导航/优先顺序/移动重构 | 部分 | 现有搜索分类与响应式可用；新版首页尚待部署验收 |
| P2自动真实计数 | 部分 | 源注册可重算、首页已有工具总数；文章统计卡未上线；vocab语言范围应保留 |
| P2可信访问统计 | 未做 | 本轮未取得真实PV/UV源；不编造值 |
| P2页尾维护者/仓库/政策入口 | 部分 | 仓库/政策入口可用；开发者独立身份露出与新页尾待最终验收，GitHub About旧域名仍在 |
| P2 README/域名/日期自动同步 | 部分 | 源日期与元数据已有规则；本轮未核实端到端自动同步，About不一致已确认；README历史计数不能当今日数 |
| P2今日运势轻量可关闭 | 未做 | 线上无此组件；并行实现完成后由WP-C核验娱乐标识/首屏负担 |
| P3审核期无空框/误导模拟 | 已完成 | 历史开关机制+本次线上样本确认 |
| P3统一广告配置、获批后启用 | 部分 | ads.ts已集中slot和开关，placeholder3个、实ID1个、空值1个；真实广告布局/后台未验收 |
| P3桌面移动视觉/可用/可访问 | 部分 | 本次双视口截图/宽度/内容审查；键盘、辅助技术和全站功能非完整回归 |
| P3已修复/需证据/未完成报告 | 已完成 | 此报告+广告清单+CSV+unresolved；不替代WP-C最终acceptance |
| P3账号主体年龄等资格 | 未做 | 私有资料不收集入仓库，仅需用户在安全渠道确认合资格 |
| P3不承诺过审 | 已完成 | 本报告明确审核由Google决定，无通过保证 |

历史整改覆盖：`docs/ADSENSE-SEO-REMEDIATION.md`记录工具说明、广告默认关闭、政策页、多语与技术SEO；`SEO-CRAWL-FOLLOWUP.md`记录旧入口等价迁移与UA检查；`LEGACY-CONTENT-AUDIT.md`记录旧模板与迁移历史。它们证明历史工作/调查，不自动证明今日线上实现全部一致。旧文档中“76工具、27/36篇、132/141索引”等均不用作当前数字；11月6日五语开放索引与当前routes一致。内容增量、使用需求、搜索实际表现和账户政策仍需分别验收。

## 终检时点补充（06:12 UTC）

并行工作推进后，现有dist在06:10 UTC被外部进程重建，原清单578个文件的哈希均已改变，HEAD也已前进；本执行者未运行构建或写产品文件。差异见 `evidence/dist-drift.json`。**本CSV及初次路由/内容统计仍依赖00:52–00:53 UTC快照，不代表新dist已验收**；原始manifest、page-metrics与线上HTML保留，不重新生成CSV以免混时点。仅保留哈希而非原dist全部HTML，复算原始全部指标需要取得对应旧产物。`deployment-comparison.json`记录初次比较（正文相同）；`deployment-comparison-later-dist.json`记录较晚已变化产物的比较，不能混用。结构/通用提示簇在较晚读取中仍检出相同规则簇，原始发现此前已记录；最终新版由WP-C独立验收。

主截图已人工查看，六张PNG为1280×900/390×844；其余为补充整页。`python3 audit/tools/validate-deliverables.py`核对CSV唯一URL/字段/计数、22次成功浏览器取证、无广告DOM/请求、截图尺寸/文件和本地文档链接；dist是否变化作为观察字段保留，不把外部构建变化伪装成审计者改动或校验通过。
