# WCAG 对比度检查（wcag-contrast）选题卡

## 用户与场景
设计与前端检查文字/背景对比度是否满足 WCAG AA/AAA，并给出可用的替代色；现有 color-convert 只做格式转换。

## 核心功能
1. 前景/背景取色（HEX/RGB/HSL + 颜色选择器）；alpha 合成到背景。
2. 计算 contrast ratio + AA/AAA（普通/大字号）判定；显示公式与相对亮度。
3. 建议：自动给出满足 AA 的加深/变浅候选（保持色相）；一键应用。
4. 实时预览卡片（文字/背景/字号）；复制 CSS 变量/色值。
5. 色盲模拟（红色盲/绿色盲/蓝色盲）作为附加视图。
6. 5 语言、键盘、360px、深色；无外部资源。

## 数据与状态
`src/lib/contrast.ts` 纯函数：parse color、relative luminance、contrast、alpha composite、suggest、simulate。无网络/无持久化（可选最近颜色）。

## 边界/文件/测试
非法颜色、短 HEX、超范围 RGB、透明背景、同色（1:1）、极值黑白（21:1）、非 sRGB 提示。文件：`src/lib/contrast.ts`、`contrast-i18n.ts`、`src/scripts/contrast.ts`、`src/components/ContrastChecker.astro`、5 薄路由、集成、单测、浏览器用例、docs。测试：公式、alpha、建议、色盲矩阵、非法输入；浏览器 5 语言/实时/复制/360px/深色/CSP。SEO：WCAG 对比度、颜色对比度检测、无障碍配色。
