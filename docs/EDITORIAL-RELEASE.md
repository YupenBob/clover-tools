# 图文指南发布记录

内容日期：2026-10-16。生产验证结果以本提交对应的 Quality checks / Deploy 日志为准。

## 本轮内容

| 路径（位于 /guides/） | 对应场景 | 核对方式 |
| --- | --- | --- |
| focus-flight-first-session | 选机场、撕票、计时与保存抵达卡 | 真实等待一分钟，下载 1080 × 900 PNG；未加速时钟 |
| fps-aim-training-settings | 输入校准、Bot、小球、急停与预瞄 | 实际 WebGL 运行、原生鼠标锁定、Esc 暂停；不声称测得技能提升 |
| m3u8-download-mp4-gaps | 分片、MP4、缓存、缺口与流式保存 | 自行生成 8 秒 H.264/AAC，4 个两秒 TS，实际导出与完整解码 |
| base-converter-large-integers | 大整数、负号与固定宽度补码的区别 | 9007199254740993 ↔ 20000000000001；负数、零和非法输入 |
| keyboard-test-key-code | key、code、修饰键与硬件检测边界 | 浏览器自动化按键，左右 Ctrl、20 条记录、清空；不当作实体键盘测试 |
| perler-beads-pattern-materials | 格数、色板、透明区域、用量与导出 | 32 × 32 原创四叶草，512 颗、4 色，PNG 与 CSV 数量核对 |
| avatar-seed-transparent-export | 可重现种子、外观设置、透明 PNG 与 SVG | 相同设置恢复相同 SVG；实际 512 × 512 透明 PNG |
| markdown-checklist-export | 清单、表格、草稿、源码与 HTML 出口 | 原创骑行清单、2 行表格，实际下载 .md 与 .html |
| fetch-failed-to-fetch | 网络、CORS、混合内容、取消与可读响应 | 两个本地端口的真实 CORS 失败 |
| json-unexpected-token-html | HTML、登录页、路由回退与 JSON 读取 | HTTP 200 text/html 实际交给 JSON.parse 产生 SyntaxError |
| http-429-retry-after | 频率、并发、额度、等待与幂等 | 实际 HTTP 429 / Retry-After: 3，保留响应体 |

写作按具体问题展开，不虚构用户经历、收益、训练提升或服务端故障。不为每篇硬加同样的 FAQ。相关标准与产品能力分别核对；来源列在正文末尾。工具本身的限制写进操作过程，避免读者拿到结果后误用。

## 图片与配套文件

- `public/article-images/2026-10/`：12 张实际浏览器截图、3 张工具原始 PNG 导出，共 15 张。
- `captures.json`：每张图的时间、来源、用途、宽高、字节数和 SHA-256。截图未经图像生成或二次重绘。
- `scripts/capture-editorial.mjs`：通过真实按钮、输入、请求和下载捕获。可用 `ARTICLE_BASE_URL` 指向本地预览，用 `ARTICLE_ONLY=http,beads,...` 选择重拍范围。FPS 使用真实 Pointer Lock；专注航班等待实际一分钟。需 Chromium 与本地 FFmpeg。
- `public/article-assets/http-repro.mjs`：可下载的本地复现脚本，Node.js 运行，只监听回环地址 8765 / 8766；直接返回 HTML、429 与未允许 CORS 的 JSON。
- `public/article-assets/hls-sample/`：自行生成的测试图与 440 Hz 音频，8 秒、4 个分片。生成命令在捕获脚本中。文件不含第三方影视内容，不需要密钥。
- `beads-materials.csv` 与 `cycling-checklist.md`：本次工具实际导出的材料表和示例文档。

截图中只有演示输入。用户提供的账号后台、搜索数据截图没有进入公开资源。

## 网址处置

三篇文章与旧版题意对应。正文统一接入现有指南布局、目录、关联工具、Article / BreadcrumbList、canonical 与 sitemap，避免再维护一套重复文章模板。既有 16 篇指南地址不变。

| 已审核旧路径主体 | 当前规范地址 |
| --- | --- |
| /blog/failedtofetch怎么解决 | /guides/fetch-failed-to-fetch/ |
| /blog/unexpectedtokenjson错误怎么解决 | /guides/json-unexpected-token-html/ |
| /blog/接口返回429怎么办 | /guides/http-429-retry-after/ |

各主体的无后缀、`.html` 和斜杠形式均配置精确 301，共 9 条，由 `config/editorial-redirects.mjs` 维护并生成到 `_redirects`。生产验收逐条检查状态与目标。

取消 `/blog/* → /` 的全量跳首页规则。未恢复的旧文章正常返回 404，不制造与主题无关的首页跳转；它们在历史审计清单中继续保留待核，不等于已完成全部旧文审查。fix / category / plugins 旧规则本轮未调整。历史 CSV 是审计基线，不能作为本轮自动重定向配置。

这与早期计划中的同名 blog 主网址有一处调整：保留旧入口的等价跳转，把重写正文放到已存在的 `/guides/`，统一内容维护和阅读入口。没有恢复“实作案例”栏目。

Pages 本地运行时发现既有的绝对来源 `https://www...` 规则无效，已从生成文件中移除。Cloudflare 官方说明 `_redirects` 不支持域名级跳转，www / HTTPS 应由站点级规则负责，实际账号配置仍待核对；本次不把它写成已修复。其余相对路径精确规则置于通配规则前。[Cloudflare 重定向规则说明](https://developers.cloudflare.com/pages/configuration/redirects/)。

## 随操作核对修正

- 五语进制转换：拒绝单独负号，非法或空输入清空上次结果，避免旧成功值被误认成新结果。
- 五语键盘测试：修复动态记录行的样式作用域；按键内容使用文本节点；按钮、链接和输入控件保留默认操作，Tab 可以离开当前控件。
- 首页分类标签：约束容器宽度，窄屏可横向浏览，避免既有 320px 溢出。桌面仍保持单行分类。
- 指南：真实图片宽高与延迟加载、原图入口、图注、横向滚动代码/表格、文章目录及针对场景的提示。仅发布实际存在的简体正文，不批量制造外语副本。

## 验证范围

`runEditorialChecks` 由既有浏览器 CI 和生产验收共同调用：逐篇在 320 / 390 / 1440px 检查正文、canonical、工具入口、图片解码和固有尺寸，检查指南目录与首页；五语验证整数转换和键盘记录；用公开配套样本实际导出 8 秒 MP4。390px 使用深色偏好。

生产验收还核对所有 27 篇指南、图片和配套资源与上传构建的哈希，9 条旧文重定向、未恢复博客的 404、撤回案例页的 404，以及 Cloudflare Bot Fight Mode 关闭状态。

通过这些检查说明本次功能和发布成立，不代表 Google 已重新抓取、增加收录或通过 AdSense。下一轮仍要拿到具体未收录原因、落地页数据和结构化数据错误，按页面处理。
