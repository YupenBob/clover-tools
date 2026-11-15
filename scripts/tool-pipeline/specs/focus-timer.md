# 专注时间（focus-timer）选题卡

> 种子 spec；Architect 扩写为可执行规格，保留硬性要求。

## 用户与场景
学生/写作者/远程工作者需要“开始一段专注 → 记录任务 → 看到本周投入”的闭环。与现有 `timer`（通用倒计时/秒表）和 `focus-flight`（沉浸飞行）区分：本工具是任务驱动的番茄/专注记录器，侧重统计与复盘，不做游戏化场景。

## 核心功能
1. 专注会话：25/45/60 分钟预设 + 自定义；开始/暂停/继续/提前结束；休息计时；自动进入下一轮（可关）。
2. 任务列表：本次专注关联一个任务；任务可新增/完成/删除；刷新后保留；不保存用户身份。
3. 统计：今日/本周专注分钟、完成轮数、按任务汇总；7 天柱状图（SVG，无图表依赖）；清空入口。
4. 环境声：Web Audio 生成白噪音/雨声/咖啡馆（不加载外部音频）；音量/静音；播放失败降级。
5. 提醒：页面内提示 + 可选浏览器 Notification（权限拒绝时降级）；Wake Lock；页面标题显示剩余时间。
6. 键盘：空格开始/暂停、S 跳过、R 重置；移动端 360px；深浅色；5 语言。

## 数据与状态
`src/lib/focus-timer.ts`：会话状态机（idle/running/paused/break/finished）、时长校验、统计聚合、7 天分桶、localStorage 序列化/迁移。键：`clover-focus-timer:v1`。

## 边界与错误
0/负数/超长时长；系统时间跳变（用单调时钟）；暂停后刷新；多标签同时写；localStorage 禁用/损坏；Notification/Wake Lock 不可用；音频上下文被挂起；任务名为空/超长。

## 文件清单
`src/lib/focus-timer.ts`、`src/lib/focus-timer-i18n.ts`、`src/scripts/focus-timer.ts`、`src/components/FocusTimer.astro`、5 薄路由、`tools.ts`、`tool-seo/daily.ts`、`tool-content.ts`、`tool-details.ts`、`i18n/{en,ja,ko}.json`、`scripts/tests/focus-timer.test.mjs`、`scripts/lib/tool-cases/focus-timer.mjs`、`docs/FOCUS-TIMER.md`、`gen-search-index.mjs`、`tsconfig.tools.json`。

## 测试
单测：状态机、时长校验、统计聚合、7 天分桶、暂停恢复、损坏数据拒绝、跨天统计、多标签冲突策略。浏览器：5 语言、开始/暂停/结束、任务增删、统计变化、刷新恢复、通知拒绝、360px、深色、CSP、无 pageerror。

## 验收
`npm test`/`npm run build`/`smoke-tool` 全绿；Reviewer ≥0.8；不新增依赖；不出现 TODO/占位/emoji。

## i18n/SEO
术语：专注 / Focus / 集中 / 집중；番茄钟 / Pomodoro。title 50–60 字符含 “ - CloverTools”；description 150–160 字符；关键词：专注计时、番茄钟、专注统计、学习计时。内链 timer、focus-flight、workday。

## 隐私
全部本地；不联网；不保存任务内容到服务器；说明 localStorage 与清空方式。
