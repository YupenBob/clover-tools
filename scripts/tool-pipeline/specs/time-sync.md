# 标准北京时间校时（time-sync）选题卡

## 用户与场景
用户想知道“我的设备时间准不准”，以及当前与标准时间的偏差。与 `exam-clock` 的分工：exam-clock 是考场大屏；本工具是**校时诊断**，展示多源结果、RTT、偏移、精度估计与历史。

## 核心功能
1. 一键校时：调用 `/api/time` 多个上游（Cloudflare trace、timeapi.io、本机 Date），返回每个源的 nowMs/source/latency。
2. 偏移计算：按 RTT/2 估算设备偏移；显示估计误差区间；异常 RTT 标注。
3. 多源对照：表格/卡片展示每个源的偏差与延迟；取中位数作推荐值。
4. 历史：最近 10 次校时记录（localStorage），显示趋势；清空。
5. 说明：HTTP 校时不是 NTP；误差取决于网络；不得宣称“原子钟级”。
6. 5 语言、复制结果、移动端、深浅色、键盘。

## 数据与状态
`src/lib/time-sync.ts`：`estimateOffset(samples)`、`median`、`formatDelta`、`classifyQuality`、localStorage 历史。页面纯展示 + 一键触发。

## 边界与错误
上游超时/非法 JSON/乱序；RTT 为 0 或极大；设备时间跳变；离线；localStorage 禁用；重复点击并发（只提交最新请求）。

## 文件清单
`src/lib/time-sync.ts`、`src/lib/time-sync-i18n.ts`、`src/scripts/time-sync.ts`、`src/components/TimeSync.astro`、5 薄路由、集成文件、`scripts/tests/time-sync.test.mjs`、`scripts/lib/tool-cases/time-sync.mjs`、`docs/TIME-SYNC.md`、`functions/api/time.ts`（与 exam-clock 共用，若已存在则复用）。

## 测试
单测：偏移/RTT/中位数/异常样本/历史裁剪/格式化。浏览器：5 语言、一键校时（mock 或真实）、并发只取最新、离线降级、复制、360px、深色、CSP。

## 验收/隐私
同流水线通用门禁；`/api/time` 不记录 IP；只允许固定上游；超时 3s；缓存 15s；文案不得写 NTP 精度。SEO：北京时间校准、网络时间、设备时间偏差。
