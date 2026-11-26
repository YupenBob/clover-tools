# 图片格式转换

打开 [图片格式转换](/tools/daily/image-convert/)，点击右上角图标展开操作区，或直接拖入一张图片。选图后先核对原图，再选择输出格式。需要缩小时填写最大宽度或高度，留空的一边不限。点击转换或按 Ctrl/Cmd + Enter，核对结果的像素尺寸、实际体积和变化比例，再预览、下载或复制对照摘要。预览在新的浏览器标签页打开，下载使用实际生成的文件。

图片转 Base64 生成可嵌入的文本，九宫格切图导出多张切片。本工具输出单个完整的图片文件，支持双边等比缩小、自定义 JPG 底色和实际文件对照。

## 格式与上限

| 项目 | 处理方式 |
| --- | --- |
| 输入 | 单张静态 JPG/JPEG、PNG、WebP 或 AVIF，按内容识别。上限 16 MiB |
| 输出 | 按浏览器能力提供 JPG、PNG、WebP、AVIF。上限 64 MiB |
| 像素 | 输入和输出单边最多 8192 px，总像素最多 16,000,000。各上限包含边界值 |
| 尺寸 | 按最大宽高中的较紧限制等比缩小，每边向下取整且至少 1 px |
| 质量 | 0–100 的整数，默认 85。PNG 由浏览器直接编码 |
| 背景 | JPG 默认白色，也可填写六位 HEX。PNG、WebP、AVIF 通过透明度探测后可用于透明输出 |

示例 `transparent-sample.png` 为内置的 320 × 200 px 透明 PNG。选择 JPG，最大宽度填 160，高度留空，背景选 `#E8EEF5`，输出为 160 × 100 px。将静态 WebP 转为 PNG 时可把最大宽高都留空，以维持原尺寸。两例的文件体积均由实际编码决定。

容器检查按块或段的声明长度做有界读取，最多遍历 4096 项。APNG、动画 WebP 与 AVIF 序列会被拒绝。来源通过检查后还要成功解码，输出则经过 MIME、文件结构、体积和回读尺寸核验。浏览器的编码与解码能力独立，能够导入 AVIF 的浏览器仍可能只提供其他输出格式。浏览器编码能力通过本地小画布和透明像素回读确定。[Canvas 编码](https://html.spec.whatwg.org/multipage/canvas.html#serialising-bitmaps-to-a-file)、[PNG](https://www.w3.org/TR/png-3/)、[WebP 容器](https://developers.google.com/speed/webp/docs/riff_container)、[AVIF](https://aomediacodec.github.io/av1-avif/latest-approved.html)

## 视图、状态与隐私

首屏保留原图和结果摘要以及右上角图标。鼠标移动到左上角可展开，键盘用户可用 Tab 聚焦图标后按 Enter。F2 打开或关闭设置，F10 切换全屏，被拒时改用页内全视口。Esc 从设置、全屏或操作区回到摘要。关闭 JavaScript 时仍可通过图标查看静态说明。

解码和转换各自展示等待状态。新选图替换旧图并撤下旧结果，修改设置也会立即撤下旧结果。处理期间的换图以最后一次选择为准。下载请求交给浏览器处理，保存遇阻时可从结果预览页保存。清空会重置文件和配置，刷新会开始新会话。跨午夜和设备时区不参与缩放、编码或体积计算。

工具操作不访问网络。文件、像素、文件名与配置仅在当前页面会话使用。解码应用浏览器识别的方向，输出由像素重新编码，原 EXIF 不会复制。颜色、分辨率元数据和有损编码效果可能变化，画面中的个人信息仍可见。[ImageBitmap 方向](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html)、[图片自然尺寸](https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element)

## 验证记录

| 检查 | 本工作区结果 |
| --- | --- |
| `node --test scripts/tests/image-convert.test.mjs` | 通过，9 项。另检查了四种真实容器夹具及其截断和单字节变化 |
| `npm run check:tool-types` | 通过 |
| `node scripts/editorial/build-tool-locales.mjs`、`node scripts/gen-search-index.mjs` | 通过，五语清单与索引均包含本工具 |
| Astro 组件编译与五语 SSR 渲染 | 通过。直接使用 Astro 容器核对五语首次输出的两条摘要、布局标记、唯一标题、canonical 和 hreflang |
| 模拟 DOM 与编解码回调 | 通过。检查导入、160 × 100 转换提交、非法尺寸撤回结果、连续换图保留最新文件及清空。原生 Canvas 与下载由浏览器用例验证 |
| `node scripts/tool-pipeline/lib/presentation.mjs` | CLI 的子进程被当前环境拦截。直接调用同一校验器，83 个登记工具的契约校验通过 |
| `node scripts/tool-pipeline/update-tool-counts.mjs` | 核对为 83 项，开发 39、日常 26、趣味 18。README 由流水线写入 |
| `node scripts/smoke-tool.mjs --category daily --slug image-convert` | 本地监听被当前环境拒绝，真实浏览器结果待验证 |
| `npm run build`、`npm run check:browser` | 由 Lead 执行 |

浏览器用例覆盖五语核心流程、原生 Blob 预览及下载文件回读、PNG/WebP 透明像素、JPG 底色与 EXIF 方向、AVIF 能力分支、模式切换、竞态、360 px 深色模式和跨午夜离线转换。用例使用本地合成图与生产 CSP。当前环境未验证浏览器的实际编解码能力、截图或六态门禁。

## 文件索引

- 新增简体路由 `src/pages/tools/daily/image-convert.astro` 及 `src/pages/{zh-hant,en,ko,ja}/tools/daily/image-convert.astro`，共用 `src/components/ImageConvert.astro` 与 `src/styles/image-convert.css`。
- 新增 `src/lib/image-convert.ts`、`src/lib/image-convert-i18n.ts`、`src/lib/image-convert-samples.ts`、`src/scripts/image-convert.ts`、`src/scripts/image-convert-codecs.ts`、`data/tool-presentation/image-convert.json`、`scripts/tests/image-convert.test.mjs`、`scripts/lib/tool-cases/image-convert.mjs` 和本文档。
- 更新 `src/lib/tools.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`、`src/lib/tool-seo/daily.ts`、`src/lib/i18n/{en,ko,ja}.json`、`tsconfig.tools.json`、`scripts/gen-search-index.mjs`、`data/i18n-tool-pages.json` 和五份 `public/**/search-index.json`。
