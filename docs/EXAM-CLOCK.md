# 考场大屏时钟

`daily/exam-clock` 为五语共用的大字时钟。**打开即进入投影态**：黑底白字、屏幕上只有 HH:MM 与右上角无文字退出图标，其余内容（标题、日期、时区、说明、页脚、设置面板）全部隐藏；契约声明在 `data/tool-presentation/exam-clock.json`，由 `docs/PRESENTATION.md` 的门禁校验。点击时间或按 F 进入原生全屏，ESC/双击退出；鼠标/键盘唤出无文字图标控制层，`autoHideMs` 后自动回到投影态。退出图标或 ESC 进入工作台（`settingsOpen`）：恢复正面的设置面板，包含考试起止时间、等待/进行/结束与剩余时间、提醒节点、校时、显示偏好与方案管理。

## 使用

1. 填写考试名称与同一个北京时间日期的起止时间，或输入小时、分钟和秒推导结束时间。时间范围为 2000–2099 年，时长为 1–86399 秒；不支持跨午夜。示例只填入次日 09:00–10:30，不启用考试。
2. 核对后启用。已经开始但尚未结束的考试可加入；结束已过时拒绝启用。活动考试锁定时间配置，重置保留表单。
3. 选择显示、声音或常亮设置。最多保存十套具名方案；保存、加载均不自动启用。相同名称允许保存，以本地序号和日期区分。

投影态的槽位、字号下限、时区与小时制（h23、不显示秒）由 presentation 配置声明，门禁断言可见文本只有 `HH:MM`。工作台内保留原有显示偏好（12/24 小时制、秒显示、字号、主题等）与全部考试能力。全屏使用原生 Fullscreen API，拒绝或缺失时以覆盖层回退并标记 `data-presentation-mode="fallback"`，隔离其他内容的键盘焦点。控制层（无文字图标按钮）在鼠标/键盘/聚焦时唤出，按配置 `autoHideMs` 自动隐藏；设置面板默认收起。

快捷键为 F 大屏、S 设置、R 校时、Esc 关闭设置/退出页面内大屏、空格切换提醒音、Ctrl/Cmd+Enter 校验并启用考试。单字快捷键避开输入、选择及编辑区域，也不处理组合输入和重复按键。原生按钮上的 Enter/空格保持原生激活。

## 时间与提醒模型

`src/lib/exam-clock.ts` 不访问 DOM、网络、存储或真实系统时钟。日期按民用字段严格校验，再转换固定 UTC+8 epoch，不依赖宿主时区。数字剩余时间向上取整至秒，文字向上取整至分，阶段判断保留原始毫秒。

成功校时保存接收参考 epoch 与对应单调时间到内存，刷新按单调差值推进。设备模式使用当前设备时刻。每次可见刷新比较设备与单调经过量，超过一秒视为时间变化；不能区分休眠和人为改时。检测到设备时间变化时提示方向与变化量并立即重新核对；只有这次核对失败才改用设备时间，最近一次成功记录从此仅作历史展示。返回前台及 BFCache 恢复同样立即重新核对。每轮依次采样三次，选有效且客户端 RTT 最小的一次，单次限四秒，同一时刻最多一轮。隐藏页面不发起轮询、不排队；失败不紧接着循环重试。

偏移为 `serverNowMs - (sentAt + sentAt + RTT) / 2`，接收参考时间为 `serverNowMs + RTT / 2`。RTT 使用单调时钟；超过 2000ms、设备在请求期间跳变超过一秒、非法 JSON/结构均拒绝。失败、离线、超过五分钟未更新时切换设备时间，仅保留历史校时信息；设备时间刚跳变时先重新核对，只有核对失败才切换到设备时间。误差为服务端估计分量加客户端 RTT/2，上取整展示，**估计值，非精度保证**。

30、15、5、1 分钟节点可分别关闭，严格小于本场总时长才适用。静音也消耗节点，一次跨过多个节点只提示当前最紧迫节点。启用、恢复、校时和来源切换只重算，不补播旧节点；已处理节点在回拨后不重播。结束为终态，只有重置能创建下一场；来源切换不撤销已进入的结束状态。声音默认关闭；AudioContext 只在开启/试听手势创建或恢复，阶段短音约 200ms，结束双音约 480ms。刷新后需重新点击启用声音。没有后台一定响铃的保证。

常亮依据真实 Screen Wake Lock 状态展示，可因系统或页面隐藏释放。恢复前台且用户意愿仍开启时重试一次，失败后提供手动重试；不通过视频绕过权限。退出全屏不改变常亮意愿。

## `/api/time`

只接受同源前端 GET，无查询参数；其他方法 405，任意查询 400。固定上游为 `https://www.cloudflare.com/cdn-cgi/trace`，精确匹配 HTTPS、主机、端口和路径，零重定向，无客户端可控目标。

上游请求及响应体读取共用三秒超时，流式累计真实字节，超过 64KiB 取消。仅接受一个有限且在 2000–2099 年内的 Unix 秒 `ts`，转换毫秒，丢弃其他字段。Cloudflare 的该端点是诊断接口中的 HTTP 时间参考，不是国家授时中心或 NTP 服务。参见 [Cloudflare 的接口说明](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/)。

Cache API 使用固定键保存清洗后的样本十五秒：原始时间、上游 RTT、接收设备时刻、RTT/2 调整后的参考时间、来源、到期时刻。命中不续期，每次用当前边缘时间减接收时间外推；负年龄、到期、结构损坏或缓存不可用均重新获取。写缓存不阻塞最终响应。

成功 JSON 字段为 `ok`、`serverNowMs`、`source=cloudflare-trace`、`sourceUrl`、`sourceSampleMs`、`sampleAgeMs`、`upstreamRttMs`、`uncertaintyMs`、`cached`。所有时间量单位均为毫秒。误差分量为 `1000 + upstreamRttMs/2 + sampleAgeMs*0.0001`。最终成功和错误响应均 `Cache-Control: no-store`，不能缓存冻结的时间 JSON。

错误包含 `ok=false`、稳定 `code`、`error`、`retryable`；上游错误 502，超时 504，不返回原文、堆栈或服务端设备时间冒充成功。共享 `http.ts` 的 JSON/文本限体积助手改为按流读取字节，保留原调用签名兼容性。

## 数据与隐私

浏览器只请求同源 `/api/time`，不发送考试名称、起止时间、方案或音量。服务端不转发访客 Cookie、Authorization、Referer、IP 或原始 User-Agent；使用固定应用 User-Agent。trace 原文、IP、请求头不进入本工具日志、缓存或响应。应用不读取/保存访客 IP，托管平台仍会处理网络连接信息。无账号、密钥、上传、新增运行时依赖、统计事件或 Service Worker。

存储键为 `clover-exam-clock:v1`，五语共用；存显示、声音偏好、最近表单、至多十套方案与递增序号、活动快照/已处理节点、历史校时。逐字段校验版本、枚举、日期、类型、数量和数值，JSON 上限 64KiB，只重建允许字段。不保存单调锚点或音频/全屏/常亮授权。

损坏/未知版本保留原数据并使用内存默认值，用户可明确清空。存储读写失败时保留内存功能并提示无法刷新恢复。表单内容暂时不合法时仍写入显示、声音等独立偏好，只跳过最近表单并提示，修正输入后自动恢复保存表单。其他页面修改只提示并保留本页活动考试，本页后续的设置、考试和提醒记录仍可保存；删除事件同步清空。各标签页独立计时，不互斥声音。清空增加生命周期及请求轮次序号，取消请求，释放锁，关闭声音，删除键；自动校时、清空后的旧响应以及无新操作的刷新不会重新创建默认存储。清空后首次明确编辑/保存等操作才重新开启持久化。

已经加载的页面断网后可继续使用设备时钟；不保证首次离线访问或离线刷新。浏览器限制、休眠和声音权限仍可能影响显示与提醒。Wake Lock 与 `performance.now()` 的平台限制参见 [Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) 和 [休眠差异](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now#ticking_during_sleep)。

## 实际验证记录（2026-11-15）

- `npm test`：265 项通过（含客户端 19 项、服务端 15 项），0 失败、0 跳过。
- `npm run build`：583 个页面构建成功；内容关联、SEO 元数据、链接、发布商、emoji 与图标检查通过；README 工具计数更新为 78。
- `node scripts/smoke-tool.mjs --slug exam-clock --category daily`：52 项浏览器场景通过（含共享 `presentation-*` 门禁：first-load、primary、reveal、settings、degraded、fullscreen），覆盖 5 语言、生产 CSP、阶段提醒、声音节点、全屏降级、常亮、存储异常、时间跳变与 5 档布局，覆盖 5 语言、生产 CSP、阶段提醒、声音节点、全屏降级、常亮、存储异常、时间跳变与 5 档布局；新增「设备时钟前跳不得直接结束考试」和「表单不合法时显示/声音设置仍保存并在刷新后生效」两项回归。
- `npx tsc -p tsconfig.tools.json`、`npx tsc -p tsconfig.functions.json`：通过。
- `npm run tool:verify` 的通用门禁已识别选题的 `/api/time`，深检按 `tool-pipeline.config.json` 的 `verify.apiChecks` 执行：成功字段集合、有限非负数值、声明来源与上游、`Cache-Control: no-store`、间隔约两秒的时间推进与其他方法 405、查询参数 400。该命令已在本版本发布后执行（提交 2f7c642）：五个生产语言页面均 HTTP 200、`lang` 与标题正确，真实 `/api/time` 返回 200 且字段集合、有限非负数值、声明来源与上游、`Cache-Control: no-store`、约两秒时间推进、查询参数 400、POST 405 全部通过；Quality checks 工作流成功。首次发布曾因 Workers 把脱离全局对象的原生 `fetch` 判为 Illegal invocation 而使 `/api/time` 返回 502，生产验证按设计自动回滚（`c7410e3`），修复入口后重新发布并通过。未生成或宣称伪造截图。

## 文件清单

新增：

- `src/lib/exam-clock.ts`、`src/lib/exam-clock-i18n.ts`
- `src/scripts/exam-clock.ts`、`src/styles/exam-clock.css`
- `src/components/ExamClock.astro`
- `src/pages/tools/daily/exam-clock.astro`
- `src/pages/en/tools/daily/exam-clock.astro`
- `src/pages/ja/tools/daily/exam-clock.astro`
- `src/pages/ko/tools/daily/exam-clock.astro`
- `src/pages/zh-hant/tools/daily/exam-clock.astro`
- `functions/api/time.ts`、`functions/lib/exam-clock-time.ts`
- `scripts/tests/exam-clock.test.mjs`、`scripts/tests/exam-clock-functions.test.mjs`
- `scripts/lib/tool-cases/exam-clock.mjs`
- `docs/EXAM-CLOCK.md`

修改：

- `functions/lib/http.ts`、`tsconfig.tools.json`
- `src/lib/tools.ts`、`src/lib/tool-seo/daily.ts`
- `src/lib/tool-content.ts`、`src/lib/tool-details.ts`
- `src/lib/i18n/en.json`、`src/lib/i18n/ja.json`、`src/lib/i18n/ko.json`
- `scripts/gen-search-index.mjs`
- 生成文件：`data/i18n-tool-pages.json`、`public/search-index.json`、`public/en/search-index.json`、`public/ja/search-index.json`、`public/ko/search-index.json`、`public/zh-hant/search-index.json`

README 按最新任务指示留待流水线更新。未修改依赖、浏览器缓存、CSP、布局、wrangler 或生产验证通用脚本。
