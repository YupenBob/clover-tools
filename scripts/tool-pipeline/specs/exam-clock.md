# 考场大屏时钟（exam-clock）选题卡

> 这是给 Architect 的种子 spec；Architect 必须扩写成可执行的完整 spec，不得删掉本卡的硬性要求。

## 用户与场景

- 监考老师/考场管理员：把平板、笔记本或教室大屏变成一个全屏、远距离可读的时钟，按考试开始/结束时间倒计时，并在关键节点提醒。
- 自习室/家庭：大屏专注倒计时，弱网或断网也要能用。
- 与现有 `timer`（倒计时/秒表）的区别：本工具是**全屏考场时钟**，核心是“官方时间校准 + 考试阶段 + 大屏可读性 + 不中断”，不是通用秒表。

## 核心功能（至少这些）

1. **大屏时钟**：HH:MM:SS、日期、星期；12/24 小时；秒显示开关；字号/高对比/深浅色；全屏后控件自动隐藏，轻触/键盘唤回。
2. **时间校准**：调用 `GET /api/time` 获取网络时间；客户端按 RTT/2 估算偏移，显示“已校准 / 本地时钟 / 误差 ±N ms”；支持手动重新校时；断网/上游失败时降级到设备时钟并明确标注。
3. **考试模式**：考试名称、开始时间、结束时间、时长；倒计时与进度条；30/15/5/1 分钟阶段提醒（颜色 + 可选提示音）；结束态；配置校验（结束>开始、时长一致、跨午夜拒绝）；可保存多套配置。
4. **大屏可用性**：Fullscreen API + 不支持时的降级提示；Screen Wake Lock + 不支持/被拒绝时的提示；键盘快捷键（F 全屏、S 设置、R 重新校时、Esc 退出、空格暂停/恢复提醒音）；360px 手机到 4K 大屏都不横向溢出。
5. **持久化**：设置与考试配置存 `localStorage`；不上传考试名称/时间；提供清空入口。
6. **5 语言**：zh/tw/en/ko/ja；tw 用 s2t；en/ko/ja 自然文案，无中文残留。
7. **可访问性**：aria-live 阶段播报、label、焦点可见、减少动态偏好、对比度。

## 数据与状态（纯逻辑模块）

`src/lib/exam-clock.ts` 至少包含：

- `formatClock(ms, { hour12, showSeconds, timeZone })`
- `computeOffset({ sentAt, receivedAt, serverNowMs })`（RTT/2 估算）
- `phaseFor({ nowMs, startMs, endMs, thresholds })`（normal/warning/critical/finished）
- `validateExam({ name, start, end })`（错误码：end-before-start、invalid-duration、cross-midnight、missing-name）
- `progressFor(nowMs, startMs, endMs)`（0..1，钳制）
- `formatRemaining(ms)`（支持 00:00:00 与“1 小时 05 分”两种展示）

localStorage 键：`clover-exam-clock:v1`（设置 + 最近配置 + 最近校准结果）；不得保存任何访客标识。

## 边界与错误

- 结束时间早于/等于开始时间；时长为 0/负数；跨午夜；超长考试（>24h）；空名称。
- 时钟回拨/系统时间跳变；校准响应乱序/超时；RTT 异常大；上游返回非法 JSON。
- Fullscreen 被拒绝；Wake Lock 不可用或被系统回收；页面切后台。
- localStorage 被禁用/写满；无痕模式；用户清空后恢复默认。
- 倒计时结束后的停留状态；多次开始/重置；快速重复点击。

## 文件清单（Builder 必须覆盖）

- `src/lib/exam-clock.ts`（纯逻辑）
- `src/lib/exam-clock-i18n.ts`（5 语言 UI 字典）
- `src/scripts/exam-clock.ts`（DOM/时钟/全屏/唤醒锁/音效）
- `src/components/ExamClock.astro`（共享组件）
- `src/pages/tools/daily/exam-clock.astro` 与 `en/ja/ko/zh-hant` 四个薄路由
- `src/lib/tools.ts`、`src/lib/tool-seo/daily.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`、`src/lib/icons/registry.ts`（如需）
- `src/lib/i18n/en.json`、`ja.json`、`ko.json`（tools/content 条目）
- `scripts/tests/exam-clock.test.mjs`
- `scripts/lib/tool-cases/exam-clock.mjs`
- `scripts/gen-search-index.mjs`（别名）
- `tsconfig.tools.json`
- `docs/EXAM-CLOCK.md`
- `functions/api/time.ts`（网络工具）

## 测试计划

单测（≥8 条）：

- 时钟格式化（12/24h、秒开关、时区）
- 偏移计算（正常 RTT、乱序、超时、异常 RTT）
- 阶段阈值（30/15/5/1 分钟边界、结束）
- 进度钳制（开始前 0、结束后 1）
- 配置校验（结束早于开始、跨午夜、空名称、时长不一致）
- 剩余时间格式化（0、<1 分钟、>1 小时）
- 系统时间回拨/跳变（如果有处理策略）
- localStorage 序列化/反序列化/损坏数据拒绝

浏览器（`scripts/lib/tool-cases/exam-clock.mjs`）：

- 5 语言页面加载、标题/描述/canonical
- 输入考试时间 → 开始 → 倒计时/进度/阶段颜色变化
- 非法时间（结束早于开始）显示错误且不开始
- 全屏 API 不可用时的降级提示；Wake Lock 不支持时不报错
- 音效开关；清空设置；刷新后恢复配置
- 360px 手机、深色、无横向溢出、无 pageerror
- 生产 CSP 下运行（可参考 daily-tool-browser-cases 的 CSP 注入方式）

## 验收标准

- `npm test`、`npm run build`、`node scripts/smoke-tool.mjs --slug exam-clock --category daily` 全绿。
- 5 语言 URL 均 200 且 sitemap 包含。
- `GET /api/time` 返回 200 JSON，字段完整；无密钥。
- Reviewer ≥0.8 且 blocking=0。
- 不出现 TODO/占位/emoji；不新增依赖。

## i18n

术语：考场时钟 / Exam clock / 試験時計 / 시험 시계；北京时间 / Beijing time；校准 / Sync；全屏 / Fullscreen；唤醒锁 / Wake lock。tw 注意「校時」「計時」「螢幕」。

## SEO

- 简体 `<title>`：50–60 字符，含 “ - CloverTools”。
- meta description：150–160 字符，说明“全屏考场时钟、北京时间校准、考试倒计时、断网可用”。
- 关键词：考场时钟、考试倒计时、大屏时钟、北京时间校准、全屏时钟。
- 搜索别名：考场、考试倒计时、大屏时钟、exam clock、北京时间。
- 内链：`/tools/daily/timer/`、`/tools/daily/world-clock/`、`/tools/daily/calendar/`。

## 隐私与安全

- 页面明确：考试配置只存本机；`/api/time` 只返回时间，不记录访客 IP；没有账号/上传。
- `/api/time` 只允许固定上游（Cloudflare trace / timeapi.io），超时 3s，缓存 15s，响应体上限 64KB；不得接受任意 URL。
- 不做“NTP 级精度”声明；写“HTTP 校时，误差取决于 RTT”。

## 实现顺序建议

1. 纯逻辑 + 单测；
2. 组件骨架 + 5 页面 + i18n；
3. `/api/time` + 校准 UI；
4. 考试模式/阶段/音效/全屏/唤醒锁；
5. 浏览器用例 + 文档 + SEO。
