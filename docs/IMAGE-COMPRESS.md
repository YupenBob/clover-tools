# 图片压缩

用于核对作业附件、表单照片和截图能否满足接收方的文件上限。图片压缩保留原格式，按字节预算搜索，并同屏对照原图和结果。图片格式转换用于换格式或给透明区域铺底色，图片转 Base64 用于生成嵌入文本。

## 操作

1. 点击右上角图标展开。也可以按 Tab 聚焦图标，或将本地文件直接拖入页面。选择一张静态 JPG、PNG 或 WebP，也可试用随站点提供的透明 PNG。
2. 打开设置填写最大宽高，留空代表不限。质量与尺寸模式编码一次。目标体积模式接受整数 B 或 KiB，关闭额外缩小可锁定首档尺寸。
3. 点击压缩或按 Ctrl/Cmd + Enter。比较两张图的完整预览、像素尺寸和实际字节数，再下载或复制摘要。目标未达时，仍可下载本次最小有效结果。
4. 按 Esc 收回展开区。再次打开保留结果。点清空或刷新可结束本次会话。

用内置透明 PNG 复现等比缩小。最大宽度填 160，得到 160 × 100 px 的 PNG。在目标模式输入 1 B，可查看本次最小结果及超出字节数。

## 算法与边界

- 文件体积先检查，容器和声明尺寸在解码前核验。单张静态图片输入最多 16 MiB，输出最多 64 MiB，每边最多 8192 px，总像素最多 1600 万。浏览器应用识别到的方向，工具按解码后的尺寸计算比例。
- 首档按最紧宽高约束等比缩小，两边向下取整，最少 1 px。目标搜索按首档尺寸的 100%、75%、50%、25% 顺序去重。每档 JPG/WebP 按质量上限的 100%、80%、60%、40%、20%、0% 取整去重。PNG 每档一次。最多编码 24 次。
- 编码使用浏览器 Canvas。小画布探测格式支持及透明像素读回。候选按实际 MIME、容器签名和回读尺寸验证。搜索采用首个达标候选，遍历后返回本轮最小有效结果。同体积按更大的尺寸和更高的质量优先。
- 处理全程在浏览器中进行。页面与脚本加载后可离线使用。无需本地持久化，图片、文件名、参数及结果无业务网络请求。导出省略原图 EXIF，浏览器可能写入新元数据或改变色彩，像素本身仍可能包含个人信息。
- 文件与设置的版本用于撤下过期结果。资源在换图、修改设置、清空及离开页面时释放。下载提示表示已将文件交给浏览器。若下载未发起，可打开结果使用浏览器另存。

## 验证记录

在 Node.js v22.23.4 的 Builder worktree 执行。

| 自检 | 实际结果 |
| --- | --- |
| `node --test scripts/tests/image-compress.test.mjs` | 通过。以 `--experimental-test-isolation=none` 复核 8 个子用例，零失败、零跳过。 |
| `npm run check:tool-types` | 通过。 |
| `node scripts/gen-search-index.mjs` 和 `node scripts/editorial/build-tool-locales.mjs` | 已生成五份搜索索引和语言路由清单。 |
| `validatePresentationContract` | 用实际工具注册表直接调用，严格 schema、必需语言键和共享策略均通过。 |
| `node scripts/check-content.mjs`、`node scripts/check-seo-metadata.mjs` 和 `node scripts/check-icons.mjs` | 通过。简中标题 51 个码点，描述 159 个码点。 |
| Astro 开发中间件 SSR | 内存请求验证五个 URL 均返回 200，并核对了 HTML 语言、单个 h1、canonical、五语 hreflang、首帧槽位和无脚本说明入口。 |
| Chromium 启动探测 | 当前环境拒绝本地监听及 Chromium 所需的套接字操作，浏览器用例和截图待流水线验证。 |

发布流水线复现命令如下。目录计数由流水线同步。

```sh
npm run build
node scripts/smoke-tool.mjs --slug image-compress --category daily
npm run check:browser
```
