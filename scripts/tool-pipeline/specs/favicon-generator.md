# 站点图标生成（favicon-generator）选题卡

## 用户与场景
建站者从一张图生成多尺寸 favicon/PNG 与 HTML 清单；不新增依赖。

## 核心功能
1. 上传图片（PNG/JPG/WebP/SVG）；选择背景/圆角；生成 16/32/48/180/192/512 PNG。
2. 预览网格；单个/全部下载（逐个下载，不做 zip 依赖）；生成 `<link>` 清单复制。
3. 透明背景/安全边距；尺寸不足提示；失败态。
4. 5 语言、键盘、360px、深浅色；本地处理。

## 数据/文件/测试
`src/lib/favicon.ts` 尺寸/清单/文件名；`src/scripts/favicon.ts`；组件；5 薄路由；集成；单测；浏览器用例（真实小图、下载 PNG 签名/尺寸、清单、非法文件、360px、深色、CSP）；docs/FAVICON-GENERATOR.md。隐私：图片不上传。SEO：favicon 生成、站点图标、ico/png。
