# 图片取色板（image-palette）选题卡

## 用户与场景
从图片提取主色/配色板，复制色值，用于设计/穿搭/装修参考；与 palette-generator（理论配色）不同。

## 核心功能
1. 上传图片；Canvas 采样 + 颜色量化（中位切分或 k-means，纯 JS）提取 5–8 色。
2. 每个色块显示 HEX/RGB，点击复制；锁定/排除某色后重算。
3. 导出色板 PNG/SVG 或 JSON；预览图。
4. 5 语言、键盘、360px、深色；无外部资源。

## 数据/文件/测试
`src/lib/palette-extract.ts` 纯算法（输入像素数组，输出色板）；`src/scripts/image-palette.ts`；组件；5 薄路由；集成；单测（量化/排序/空图/单色）；浏览器用例（真实小图、复制、导出下载、非法文件、360px、深色、CSP）；docs/IMAGE-PALETTE.md。隐私：图片不上传。SEO：图片取色、主色提取、配色板。
