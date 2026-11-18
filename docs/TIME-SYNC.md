# 标准北京时间校时（time-sync）

HTTP 校时诊断台：用户主动测量两个固定网络来源，对照设备时间、两段 RTT、偏移及估计误差，保存最近十次记录。五语共用一个 dashboard，首次打开不请求 API。不能修改系统时间，不是 NTP、国家授时或原子钟服务，不承诺实测精度或来源可用率。

## 入口与区别

- 简体：`/tools/daily/time-sync/`
- 繁体：`/zh-hant/tools/daily/time-sync/`
- 英文：`/en/tools/daily/time-sync/`
- 日文：`/ja/tools/daily/time-sync/`
- 韩文：`/ko/tools/daily/time-sync/`

考场时钟组织考试阶段与提醒，世界时钟换算时区，时间戳工具转换日期表示。本工具组织多源测量、测量质量与历史，不提供倒计时、考试配置或提醒。五路由显式使用 `layout="wide" workspace="dashboard"`；路由传入当前语言的 exam-clock、world-clock、timestamp。共享组件也直接输出这三个本地化内链，因为当前 ToolLayout 的通用推荐区自行调用 getRelated。

## 算法和有效期

请求前取墙上时钟 w0、单调时钟 p0，完整读取响应体后取 w1、p1：

```text
R = p1 − p0
接收时参考 = nowMs + R/2
d = nowMs + R/2 − (w0 + R)
```

正偏移表示设备落后，负偏移表示设备超前。R 不能为负；`|(w1 − w0) − R| > 100 ms` 时整轮不可推荐。R 包括服务端处理和正文接收时间，不减去服务端处理时间。时钟只显示到秒，毫秒用于诊断数值。

服务端每个来源保存原始时间戳 T、单调上游 RTT U 和接收墙上时间 S。在本轮共同响应组装时刻 E 推进为：

```text
sampleAgeMs = E − S
nowMs = T + U/2 + (E − S)
u = max(timestampResolutionMs, 1000 ms) + U/2 + R/2 + sampleAgeMs × 0.0001
```

缓存保存采样锚点，不缓存最终 JSON；每次响应重新推进时间。每来源缓存 TTL 为 15000 ms，到边界即重新采样；并行等待中到期的样本返回 sample-expired。缓存写入推迟到整轮装配并通过服务端时钟跳变检查之后：被拒绝的一轮不会留下跳变前的采样。复用缓存的唯一前提是能证明样本年龄：锚点记录写入时的单调时钟读数与 isolate 标识，命中时要求墙上时钟增量与单调时钟增量一致（差异 >100 ms 视为期间发生墙钟跳变），跨 isolate 一律当未命中重新采样，避免把跳变量误当成经过时间。缓存读限时、限长，失败或损坏回退新采样；缓存写失败不影响成功结果。

两个有效来源满足 `|d1 − d2| ≤ u1 + u2` 才使用等权中位数，两个值即算术平均。推荐误差为 `max(|di − d推荐| + ui)`，不会因来源数量增加而缩小。冲突时保留两个来源事实，不推断谁错，不产生推荐时钟。只有一个有效来源时明确提示无法交叉核对。本站运行时 Date.now() 只作为诊断行，不参与共识。

浏览器 RTT 或单个上游 RTT 大于 2000 ms 时样本不参与推荐，等于 2000 ms 仍参与且标高延迟。原始来源时间戳范围为 `[2000-01-01, 2100-01-01)`，不与设备当前年份比较。零 RTT 合法，估计误差仍至少为 1000 ms。

接收后用单调锚点推进网络参考，60 秒后失效，并累加 100 ppm 漂移预算。每次刷新检查墙上与单调增量差；超过 100 ms、页面隐藏、离页或休眠后过期都要求主动重新测量。隐藏时取消在途请求，不自动恢复联网。显示统一为固定 UTC+8；Intl Asia/Shanghai 不可用或设备日期落在历史时区偏移、夏令时期间时，使用 epoch 加八小时的 UTC 字段回退。

模型假设双向延迟对称，不能覆盖来源本身错误、路径不对称及未知时钟漂移。100 ppm 是产品模型参数，不是硬件实测指标。估计误差不是置信区间或准确度保证。

## API 与网络边界

仅 `GET /api/time-sync`，不接受查询参数。非 GET 返回 405/Allow: GET；查询参数返回 400；这两类不访问上游。两源合法为 200 complete，单源合法为 200 partial；全超时为 504，其余全部失败为 502。所有最终响应均为 `Cache-Control: no-store`。

协议版本为 1。固定顺序 sources 为 cloudflare-trace、timeapi-io。成功来源只含规范化时间和诊断数字；失败来源只有 source、ok、结构化 error，无虚假时间。客户端严格校验版本、顺序、唯一性、类型、范围、时间推进等式及顶层状态。

固定地址：

- `https://www.cloudflare.com/cdn-cgi/trace`
- `https://timeapi.io/api/Time/current/zone?timeZone=UTC`

复用 functions/lib/http.ts 的目标检查、限长读取及 JSON 输出，另以完整 URL 精确匹配。拒绝其他路径、参数、域名、非 HTTPS、凭据、私网或 IP 目标；无任意 URL 输入。重定向手动处理且零次放行。每来源最多 3000 ms（包括缓存工作、连接和正文），整轮预算 4500 ms，浏览器截止 5000 ms。上游和客户端正文均最多 64 KiB，流超限或超时会取消读取并清理定时器。

Cloudflare 只提取唯一合法 ts 行，其他字段立即丢弃。[Cloudflare 官方文档](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/) 将 trace 用于诊断，页面没有把它称为官方授时接口。

TimeAPI 仅接受对象、timeZone 精确为 UTC、dateTime 为合法公历日期时间；无后缀按 UTC，显式偏移仅接受 UTC 等价值。小数秒截取至毫秒，严格回验年月日时分秒，不猜测替代字段。

本轮尝试访问 [TimeAPI Swagger](https://timeapi.io/swagger/index.html) 及 `/swagger/v1/swagger.json`，浏览工具均未取得内容；本地 curl 访问 Swagger JSON 返回 `Could not resolve host: timeapi.io`。因此**官方实际字段和实时成功响应尚未核实**。实现严格采用批准 spec 的字段契约，漂移时按来源错误降级；测试夹具不是官方响应证据。

## 状态、历史与复制

新请求先取消旧请求、递增序号并清空当前推荐；只有最新轮次能提交 UI、结束加载或写历史。取消或替代轮次不写历史；完成的双源、单源、冲突、失败各写一条。

`clover-time-sync:v1` 是唯一历史键。五语共用，最多十条，按提交顺序保留，不按设备时间重排；刷新只恢复历史，不恢复网络锚点。解析上限 64 KiB，验证版本、记录和枚举并剥离非协议字段；损坏或未知版本保留原文，直到用户确认清空才允许重新持久保存。存储读、写、删分别捕获；不可用时继续使用访问内存；删除失败不宣称已清空。其他标签页存储变化只更新历史，不自动采样；不保证并发写入无丢失。

趋势 SVG 按旧到新显示零线和偏移点；失败、冲突处断开。配套文字记录和可展开来源表，不只依赖颜色。示例独立展示慢 1.2 秒、快 0.8 秒，不联网、不覆盖真实结果、不写历史。

当前和历史均可复制纯文本摘要。权限拒绝或剪贴板接口不可用时聚焦并选中只读文本框，供手动复制。无完成结果时禁用当前复制；已过期的测量仍可作为带测量时间的历史事实复制。

## 隐私

只有用户操作后，浏览器才请求同源 API，且不携带设备时间、偏移、历史、设置或 Cookie；服务端仅以静态头访问固定上游。无需密钥、账号或新增依赖。工具代码不读取、记录、返回或转发访客 IP、Cookie、授权头、原始请求头或原始 trace，不保存浏览器指纹或剪贴板内容。托管平台仍处理连接信息，上游能看到本站出口连接信息。失败时设备时钟与历史继续显示，不使用本站运行时冒充网络共识。

## 文件清单

新增：

- `src/components/TimeSync.astro`
- `src/lib/time-sync.ts`、`src/lib/time-sync-i18n.ts`
- `src/scripts/time-sync.ts`、`src/styles/time-sync.css`
- `src/pages/{tools,en/tools,ja/tools,ko/tools,zh-hant/tools}/daily/time-sync.astro`
- `functions/api/time-sync.ts`、`functions/lib/time-sync.ts`
- `scripts/tests/time-sync.test.mjs`、`scripts/tests/time-sync-functions.test.mjs`
- `scripts/lib/tool-cases/time-sync.mjs`
- `docs/TIME-SYNC.md`

修改：

- `src/lib/tools.ts`、`src/lib/tool-seo/daily.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`
- `src/lib/i18n/{en,ja,ko}.json`
- `scripts/gen-search-index.mjs`、`tsconfig.tools.json`、`README.md`
- 生成产物 `data/i18n-tool-pages.json`、`public/search-index.json`、`public/{en,ja,ko,zh-hant}/search-index.json`

未改工具数量常量、公共组件职责、布局、CSP、包文件或部署配置。README 只添加入口和本文链接；数量由现有流水线派生更新。

## 实际验证记录

环境：当前独立 worktree，Linux，Node v22.23.4，无密钥。确定性测试全部注入上游响应；探针自身的单元测试也使用注入响应，不代表真实联网。

以下命令已实际运行，可原样复现：

```sh
node --test scripts/tests/time-sync.test.mjs scripts/tests/time-sync-functions.test.mjs
npx tsc -p tsconfig.tools.json
npx tsc -p tsconfig.functions.json
node scripts/editorial/build-tool-locales.mjs
node scripts/gen-search-index.mjs
node --check scripts/lib/tool-cases/time-sync.mjs
git diff --check
```

最终确定性测试 41 项通过（客户端 19、服务端及探针 22）；两个测试文件均成功，零 skip/todo。覆盖方向、中位数、不缩小误差、运行时隔离、冲突、RTT 边界、跳时、严格响应、损坏/超长历史、十条裁剪、五语格式、固定 UTC+8 与失效；服务端覆盖并行、超时、状态码、缓存推进/到期/故障、重定向、固定目标、限长流、请求头、泄漏防护及实际 Function 入口的 fetch 调用接收者。

两项 TypeScript 检查通过。路由清单包含本工具全部五语。搜索生成成功，额外检查确认五份索引含 time-sync 及 Beijing time check 别名。生成器报告全站 80 个工具，其中既有 vocab-flash 仍只有 zh/tw；没有修改它。额外内存检查通过：Astro compiler 能解析共享组件及五路由；五语字典完整；简体 SEO title 53 字符、description 159 字符。

按本次运行限制，**未执行 npm run build、npm run check:browser、npm test、npm run check；未部署或访问真实生产 API，未生成或审阅浏览器截图**。浏览器用例已由既有自动发现入口接入，覆盖五语、成功/失败/悬置超时、非法响应、单源/冲突、竞态、生命周期、历史/存储、实际复制与权限拒绝、键盘、生产 CSP、三个时区、360/768/1440 宽度和深浅主题；运行时截图文件名明确包含 `mock`。

Lead 后续需要执行构建和浏览器门禁并审阅截图。部署后使用用例文件的 `--verify` 模式，将正式站点 URL 作为参数执行独立只读探针；探针直接访问真实 API，不安装 mock，连续两次请求间隔 2100 ms，每次五秒截止并限长读取，检查 no-store、合法结构、共同来源、时间推进及缓存年龄。单源报告 partial，全部失败、缺少共同来源或时间未合理推进时非零退出。此处没有把尚未执行的生产探针记为成功。
