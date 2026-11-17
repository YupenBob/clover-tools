# 专注时间 / Focus Timer

`/tools/daily/focus-timer/`，以及 `/zh-hant/`、`/en/`、`/ja/`、`/ko/` 对应路由。五个薄路由直接传入 `workspace="dashboard"`、`layout="wide"`，共用 `FocusTimer.astro` 和同一客户端控制器。没有新增运行时依赖或服务端接口。

## 与已有工具的分工

- `timer` 提供通用倒计时、秒表与计次；本工具围绕任务、番茄循环、提前结束记录和周复盘，不提供秒表。
- `focus-flight` 提供航程仪式与沉浸客舱；本工具提供短长休息及按任务累计统计，不复制航程场景。
- `exam-clock` 提供考场大屏与网络校时；本工具使用页面生命周期内的本地单调时间，不请求网络时间。
- `workday` 计算工作日区间；这里记录计时投入，不处理考勤或薪酬。

操作区按本周概览、计时与任务、统计、设置的 DOM 顺序组织。七天 SVG 始终伴随文字表格，今天和本周范围均可查看任务明细与最近会话。空白数据展示零值，不填充示例统计。记录区按当前选定范围判断空态：该范围无记录时显示真实零值、空柱状图、范围限定的空态说明和“开始专注”入口；入口始终真的开始专注，若上一轮结束后仍在等待休息，会先跳过这次休息（等价显式“跳过”）再开始新一轮专注。

## 纯逻辑与状态机

`src/lib/focus-timer.ts` 不访问 DOM、浏览器存储、通知、音频或常亮，不读取当前时间、不生成 ID。调用方提供单调时间、UTC 墙上时钟、IANA 时区、阶段 ID 与会话 ID。

状态为 `idle / running / paused / break / finished`，阶段独立为 `focus / short / long`。每个动作先采样推进当前阶段，再判断动作；同时到期与暂停、提前结束或重置，以自然完成优先。延迟回调最多结束一个阶段。自然完成按阶段 ID 输出一次结束副作用，历史按会话 ID 去重。

自然完成增加完整时长和一个完成轮次；默认第四次后安排长休息。提前结束保存实际运行毫秒但不增加轮数，下一阶段为专注。跳过专注丢弃未提交时间并安排短休息；长休息完成或跳过后归零循环。重置保留任务、设置和已提交记录。自动衔接默认关闭，仅在前台处理自然完成时从当前采样时刻开始下一阶段，不补跑过去的周期。后台完成与返回时处理的到期均等待手动开始。

当前专注的任务名称在开始时取快照。运行和暂停期间禁止完成或删除该任务，休息期间可以处理任务与选择下一轮任务。名字去首尾空白、NFC 规范化，按 Unicode 码点限制 1–80，拒绝换行和控制字符。用户文本只用文本节点或安全属性显示。

## 计时与日期口径

每次开始或继续时取得 `performance.now()`、UTC 和时区锚点。回调计算单调增量并钳制到阶段剩余时长，不逐秒减一；暂停不增加时长。剩余秒向上取整，结束显示 `00:00`。检测明显的墙上时钟跳变后提示，但当前运行段继续使用原锚点。

运行时间按真实的当地日界线拆分；用 Intl 日期与 UTC 二分查找边界，避免固定 24 小时假设。保存的分桶带原日期和时区，之后不按新设备时区重排。今日及本周范围由当前设备日期确定，周一开始。完成次数只归自然完成的结束日，休息、暂停、离页时间不计入专注。

例如 23:50 到 00:15 的完整专注，前一天 10 分钟，次日 15 分钟及一个完成轮次。图表按原始整数毫秒缩放，分钟最多一位小数，正值不足 0.1 分钟显示对应语言的“小于 0.1”，明细显示分钟和秒。统计衡量计时运行，不验证实际注意力或学习、工作成效。

## 持久化、恢复和容量

唯一数据键为 `clover-focus-timer:v1`，schemaVersion 为 1。快照包括 revision、有效设置、任务及选中 ID、循环数、当前阶段、未提交的日期分配和已提交记录。阶段包含时长、剩余毫秒、累计专注毫秒、任务快照与最近运行结束锚点。历史包含会话 ID、起止时间、结束日、实际及配置时长、结束方式、各日期毫秒及原时区。

检查点去除单调时钟锚点；恢复运行或休息中的快照统一为暂停，暂停快照保留剩余量，不使用持久化 performance 数值，也不补算关闭期间的时间。正常运行每五秒及关键操作、隐藏、pagehide 保存；冻结、崩溃、存储拒绝或配额不足可能丢失最近进度，不能承诺固定恢复精度。休眠期间单调时钟是否推进因浏览器而异。

最多 100 个任务、2,000 条历史，不静默淘汰。开始专注前保留最后一个记录槽位，已有合法活动会话可以提交到第 2,000 条。到达上限后需要复制复盘或清空记录再开始。删除任务保留历史名称并显示已删除状态。

恢复校验拒绝非法必填字段、ID、关联、状态、重复 ID、数值、分桶总和及未知版本。可选设置可补默认值；未知字段不继续写入。损坏或未知版本不返回可覆盖原值的默认快照，控制器另行进入临时使用，原值保持保护，直至用户明确清空。读写失败保留内存操作结果并持续告知刷新无法恢复。

“清空记录”仅在无活动阶段时开放，确认记录数后保留任务和设置。“全部清空”确认停止当前阶段、删除任务、设置及记录，仅删除本工具键，不调用 localStorage.clear()。持久化删除只由持锁页面执行：读取权限失败但已取得写锁时仍会尝试删除旧值，删除后再探测一次读取是否恢复；无 Web Locks 或锁申请失败时只清内存并提示“原本机数据可能仍在”。删除本身抛错时明确提示原本机数据可能仍在，内存仍可清空。成功清除后不在定时器、隐藏或退出事件中重新写入默认快照，下一次有效操作才保存。

## 多标签与资源生命周期

`focus-timer-storage.ts` 使用 Web Locks 的 `clover-focus-timer:writer` 独占写入锁，`ifAvailable` 不排队抢占。其他标签只读，可以看统计和复制；只有锁释放后主动尝试接管。接管重新读取并暂停旧检查点。无 Web Locks 或申请失败时允许临时操作、禁止持久化写入；没有锁也不执行持久化删除。

storage 事件仅接受更新的 revision，并确认事件值仍是当前存储值，忽略已经被新写入或清空取代的排队事件。外部清除会停止资源与当前阶段。完成记录和下一阶段在同一次快照写入中提交。页面退出移除工具监听器并释放锁；bfcache 返回时重新初始化和恢复。

`focus-timer-audio.ts` 点击才创建或恢复 AudioContext。白噪音使用噪声缓冲；雨声使用滤波噪声与稀疏滴落；咖啡馆为低频底噪和轻微器皿声的合成氛围，不是真实录音。空闲可试听五秒。切换先渐变停止并断开旧图，不叠加持续轨道。暂停、休息、结束、隐藏和离开停止播放。恢复或自动衔接仅使用已经启用且正在运行的音频上下文，失败显示重试入口，不循环申请权限。“重试声音”只解锁播放权限：未勾选“启用专注环境声”时不会自行开始持续播放，空闲页面的试听仍是显式的一次五秒预览。

`focus-timer-platform.ts` 仅点击通知开关请求权限，拒绝后不重复请求。通知与标题均省略任务名，不补发恢复前的旧提醒。常亮只在用户开启、阶段运行且页面可见时请求；暂停、隐藏、结束和退出释放。代次标识隔离过期的音频、通知与常亮异步结果；延迟返回的旧锁立即释放。当前请求未结束时禁止重复重试。权限或能力失败不影响计时和记录。

## 隐私与边界

本工具无需账号、密钥、付费服务或业务联网；无外部音频、API 或同步请求，不输出任务、快照或损坏数据到控制台或服务器日志。站点静态资源与原有基础设施仍沿用正常通信。SSR 本地化 JSON 转义 `<`，无 eval、内联事件处理器或 CSP 放宽。

五语言共用一份本机数据，任务与快照不进行语言转换。清除站点数据、更换浏览器、设备或结束无痕会话可能丢失记录，没有跨设备恢复。已加载页面的核心功能不依赖联网；首次离线访问和离线刷新不保证可用。浏览器提醒、声音、常亮和后台执行依赖系统，不能承诺休眠时准时提醒。

## 验证记录（2026-11-17）

已执行：

- `node --test scripts/tests/focus-timer.test.mjs`：通过（17 组具名用例）。包含时长、任务名、暂停排除、墙上时钟跳变、长休息、提前结束、幂等、延迟回调、恢复、聚合、跨午夜、周界/年界/DST、schema、revision/容量、非法时间样本、五语文案、SEO 长度、五路由及搜索索引接入检查。
- `npx tsc -p tsconfig.tools.json`：通过；纯逻辑、词典和四个客户端模块均已纳入。
- `node scripts/editorial/build-tool-locales.mjs`：生成 79 个已注册工具清单；focus-timer 含五语。输出中既有 vocab-flash 仍为 zh/tw，不属于本次修改。
- `node scripts/gen-search-index.mjs`：生成简体/繁体各 79 项，en/ja/ko 各 78 项；五份均包含 focus-timer。
- `node --check scripts/lib/tool-cases/focus-timer.mjs`：语法通过。
- `git diff --check`：通过，无空白错误；改动路径已按本轮允许清单核对。

浏览器用例已提供五语核心流程与生产 CSP、非法输入、恢复和时间跳变、前后台自动衔接、双标签、存储失败/损坏/未知版本/缺失 Web Locks、音频失败与切换、常亮拒绝/缺失/延迟返回、360px 深浅主题及键盘、离线复制和清空。截图仅在真实用例运行中写入 artifacts，不预制截图或验证结论。

按本轮运行限制，未执行全站构建、浏览器回归或 npm test；未生成实际浏览器截图，未获得 Reviewer 评分。以下由 Lead 执行并补记实际结果：

```sh
node scripts/tool-pipeline/update-tool-counts.mjs --write
npm test
npm run build
node scripts/smoke-tool.mjs --slug focus-timer --category daily
```

实际结果：`update-tool-counts.mjs --write` 将 README 工具计数更新为 79（日常 24），不手写数字；`npm test` 与 `npm run build` 通过，构建输出记录 593 个页面且图标规范无 emoji、README 计数一致；`node scripts/smoke-tool.mjs --slug focus-timer --category daily` 的 36 个浏览器场景全部通过，覆盖五语核心流程与生产 CSP、非法输入、恢复与时间跳变、前后台衔接、双标签、存储读/写失败、损坏与未知版本、缺失 Web Locks、音频失败与切换、常亮拒绝/缺失/延迟、360px 深浅主题与键盘、对比度检查及清空数据；截图由真实用例写入运行目录。复核阶段独立检查发现的标题对比度、读失败时清空数据、未启用声音时重试自行播放、空态入口与阶段不符等问题已逐项修复并纳入上述用例；生产环境验收在发布后由流水线自动执行。

## 文件清单

新增：

```text
src/components/FocusTimer.astro
src/lib/focus-timer.ts
src/lib/focus-timer-i18n.ts
src/scripts/focus-timer.ts
src/scripts/focus-timer-storage.ts
src/scripts/focus-timer-audio.ts
src/scripts/focus-timer-platform.ts
src/styles/focus-timer.css
src/pages/tools/daily/focus-timer.astro
src/pages/zh-hant/tools/daily/focus-timer.astro
src/pages/en/tools/daily/focus-timer.astro
src/pages/ja/tools/daily/focus-timer.astro
src/pages/ko/tools/daily/focus-timer.astro
scripts/tests/focus-timer.test.mjs
scripts/lib/tool-cases/focus-timer.mjs
docs/FOCUS-TIMER.md
```

修改或更新生成结果：

```text
src/lib/tools.ts
src/lib/tool-seo/daily.ts
src/lib/tool-content.ts
src/lib/tool-details.ts
src/lib/i18n/en.json
src/lib/i18n/ja.json
src/lib/i18n/ko.json
scripts/gen-search-index.mjs
tsconfig.tools.json
data/i18n-tool-pages.json
public/search-index.json
public/zh-hant/search-index.json
public/en/search-index.json
public/ja/search-index.json
public/ko/search-index.json
README.md
```
