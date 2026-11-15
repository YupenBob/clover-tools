# MIME 类型参考（mime-types）选题卡

## 用户与场景
查扩展名 ↔ MIME、压缩/字符集、浏览器行为；离线参考，与 http-tester 不同。

## 核心功能
1. 双向搜索：扩展名/MIME/关键词；分类（文本/图片/音视频/字体/压缩/应用）。
2. 详情：MIME、扩展名、是否压缩、字符集、常见用途、Content-Type 示例、注意事项。
3. 复制、深链、键盘、5 语言、360px、深浅色。
4. 静态数据；不联网。

## 数据/文件/测试
`src/lib/mime-types.ts` 数据 + 查询；`src/scripts/mime-types.ts`；组件；5 薄路由；集成；单测（双向/未知/分类）；浏览器用例；docs/MIME-TYPES.md。SEO：MIME 类型、Content-Type、扩展名对照。
