# 图片压缩（image-compress）选题卡

## 用户与场景
在本地把图片压到更小体积，控制质量/尺寸，避免上传隐私风险。

## 核心功能
1. 单图拖拽/选择；显示原体积/尺寸。
2. 质量滑块 + 最大宽/高 + 目标体积（尽力逼近，不保证）；实时/按钮压缩。
3. 前后对比（并排/滑块）+ 体积/压缩率 + 下载；失败态。
4. 不改变格式（或允许 JPG/WebP 输出）；透明背景提示。
5. 5 语言、键盘、360px、深色；无外部资源。

## 数据与状态
`src/lib/image-compress.ts`：尺寸缩放、目标体积迭代策略、压缩率、格式化；Canvas 在 `src/scripts/image-compress.ts`。无网络/无持久化。

## 边界与错误
非图片/损坏；超大图/内存；质量 0/1；目标体积小于可行下限（明确提示）；透明；下载失败；重复点击竞态（只提交最新）。

## 文件清单
`src/lib/image-compress.ts`、`src/lib/image-compress-i18n.ts`、`src/scripts/image-compress.ts`、`src/components/ImageCompress.astro`、5 薄路由、集成文件、单测、浏览器用例、`docs/IMAGE-COMPRESS.md`。

## 测试
单测：缩放尺寸、质量边界、压缩率、目标体积策略、格式化。浏览器：5 语言、真实小图压缩、体积变小、下载、非法文件、360px、深色、CSP。

## 隐私/SEO
本地处理；SEO：图片压缩、在线压缩图片、JPG 压缩、PNG 压缩。
