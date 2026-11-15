# ULID 批量生成（ulid-generator）选题卡

## 用户与场景
需要按时间有序、可排序的 ID；现有 uuid-generator 不含 ULID。

## 核心功能
1. 批量生成 1–100 个 ULID；显示时间戳/随机部分；排序校验。
2. 解析输入 ULID → 时间戳（本地/UTC）；大小写/长度校验。
3. 复制/下载 txt/csv；清空；示例。
4. 5 语言、键盘、360px、深浅色；纯前端无网络。

## 数据/文件/测试
`src/lib/ulid.ts`（Crockford Base32、时间戳、随机；用 WebCrypto，必要时降级）；`src/lib/ulid-i18n.ts`；`src/scripts/ulid.ts`；组件；5 薄路由；集成；单测（格式/长度/时间/排序/解析/非法）；浏览器用例（生成/复制/解析/下载/360px/深色/CSP）；docs/ULID-GENERATOR.md。SEO：ULID、批量生成、有序 ID。
