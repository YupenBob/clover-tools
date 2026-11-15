# 图片格式转换（image-convert）选题卡

## 用户与场景
把 JPG/PNG/WebP/AVIF 互转，控制质量/尺寸，处理透明背景；全部本地 Canvas，不上传。

## 核心功能
1. 拖拽/选择单图；预览原图（尺寸/体积/类型）。
2. 目标格式 JPG/PNG/WebP/AVIF（浏览器支持时）；质量滑块；可选最大宽/高；透明背景处理（JPG 填白/自定义色）。
3. 转换后预览 + 体积对比 + 下载；失败态（不支持格式/解码失败/过大）。
4. EXIF/方向提示（不读取敏感元数据；说明 Canvas 会剥离 EXIF）。
5. 5 语言、键盘、移动端、深浅色；不加载外部资源。

## 数据与状态
`src/lib/image-convert.ts`：格式支持检测、尺寸计算、文件名校验、体积格式化；Canvas 逻辑放 `src/scripts/image-convert.ts`。无网络；不持久化图片。

## 边界与错误
非图片/损坏文件；超大图（限制像素/体积）；SVG/GIF 动图（明确不支持/首帧）；透明转 JPG；质量 0/1；AVIF 不支持；下载失败；内存不足。

## 文件清单
`src/lib/image-convert.ts`、`src/lib/image-convert-i18n.ts`、`src/scripts/image-convert.ts`、`src/components/ImageConvert.astro`、5 薄路由、集成文件、单测、浏览器用例、`docs/IMAGE-CONVERT.md`。

## 测试
单测：格式/质量/尺寸计算、文件名、体积格式化、非法输入。浏览器：5 语言、真实小图转换（PNG→JPG/WebP）、下载文件签名/尺寸、透明处理、非法文件错误、360px、深色、CSP。

## 隐私/SEO
图片不上传、不落盘；说明 Canvas 会剥离 EXIF。SEO：图片格式转换、PNG 转 JPG、WebP 转换、在线图片转换。
