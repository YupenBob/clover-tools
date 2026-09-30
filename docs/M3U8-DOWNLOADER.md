# M3U8 下载器

入口：`/tools/daily/m3u8-downloader/`，支持简体、繁体、英文、韩文和日文。首页、日常工具目录、搜索索引、站点地图与语言切换均使用现有工具清单。

## 上游与实现

参考仓库：https://github.com/Momo707577045/m3u8-downloader

本次克隆存放在忽略目录 `output/upstream/m3u8-downloader`，参考提交为 `0043470a3e0be2bab156a8fea82411339f918878`。上游通过定时重试和手动强制导出处理失败片段，流式写入遇到空位会等待，MP4 转换保留原时间戳。新版下载核心、解析器和界面独立实现，没有引入其 Vue、StreamSaver、远程脚本或页面注入代码，也没有改变上游仓库。

新增模块：

- `config/hls.mjs`：统一配置核心版本、分片大小、下载默认值、并发 / 超时 / 重试边界、导出内存上限、缓存名称、Worker 时限和 UI 更新频率。

- `src/lib/hls/playlist.ts`：HLS 解析、序号 IV、媒体身份摘要、ffconcat 清单与重新封装参数。
- `src/lib/hls/downloader.ts`：有限并发、请求与响应体超时、指数退避、取消、范围验证、AES-CBC 解密和媒体响应检查。
- `src/lib/hls/cache.ts`：IndexedDB 分片缓存；成功写入事务后才标记完成，存储错误会停止任务。
- `src/lib/hls/remux.ts` / `src/scripts/hls-remux.worker.ts`：按需加载的本地 FFmpeg Worker、逐片探测、流复制导出及可中断的封装。
- `src/components/M3u8Downloader.astro` / `src/scripts/m3u8-downloader.ts`：五语共用界面、分片分页、状态图、进度、缓存恢复、范围选择、缺失报告和本地预览。

## 缺口处理

1. `EXT-X-GAP` 不发请求；404 / 410 立即跳过，其他分片故障在配置次数内重试，完成后标记跳过。
2. 队列不会被缺失分片卡住。缓存按媒体列表内容的 SHA-256 摘要和原分片索引保存，因此完成顺序不会影响导出顺序。
3. AES 密钥错误、解密错误和存储失败视为任务故障，暂停任务，不把整条视频静默标记成缺失。
4. 导出从缓存按原顺序取回成功分片；fMP4 为每个分片补上其对应初始化数据。FFprobe 检查流，无法识别的媒体被跳过并记录。
5. FFmpeg concat demuxer 将每个保留分片的时间戳接到前一个分片后，使用 `EXTINF` 时长，不加入缺失分片的时长。`-c copy` 不重新编码，`-avoid_negative_ts make_zero` 统一输出起点；MP4 加 `faststart`，TS 重发流头。
6. 页面与 JSON 报告显示缺口数量、原时间范围、HTTP / 校验错误、序号及请求次数。报告包含资源 URL，应在分享前检查其中的令牌。

缺失画面无法恢复。若分片不是独立可解码的，缺口后的部分帧可能依赖丢失帧，要到下一个关键帧才能正常显示。编码类型 / 流结构变化、下载成功但内部已损坏的码流也不保证可接续。重新封装不等于重建这些内容。

## 支持与边界

支持主播放列表的清晰度选择、相对地址及重定向后的地址基准、普通 TS、AAC、fMP4 的 `EXT-X-MAP`、显式及隐式字节范围、标准 AES-128、显式 IV、媒体序号默认 IV、密钥轮换、`METHOD=NONE`、`EXT-X-DISCONTINUITY` 与直播快照。

暂不支持独立外置音轨、字幕合并、SAMPLE-AES / DRM、变量替换、持续直播录制。选择标记有独立音轨的清晰度时会明确拒绝，防止导出无声视频。资源源站需允许 CORS；浏览器无法伪造 `Referer` / `Origin` 或绕过网站访问控制。发送登录 Cookie 仍受跨站 Cookie 和服务器授权策略限制。

缓存包含解密后的媒体，在当前浏览器保存，不上传 CloverTools。密钥仅在任务内存中保存。刷新后重新解析相同媒体列表和范围即可恢复；清理浏览器站点数据或点击清除任务缓存会删除相应媒体。播放列表变化会产生不同缓存身份，避免把不同时期的列表混用。

单次选中媒体导出上限 384 MiB，手机和内存不足的浏览器可能更低。下载分片存放在 IndexedDB，但 FFmpeg 的 WASM 文件系统和输出仍需要内存；大视频应设置分片范围分批导出。取消封装会终止 Worker，下载缓存仍可继续使用。

## 引擎构建与部署

开发执行 `npm run dev`，`predev` 自动运行 `prepare:hls`；构建执行 `npm run build`，同样准备引擎。`@ffmpeg/core` 固定为 `0.12.10`，单线程，运行不要求跨源隔离。

`scripts/prepare-hls-core.mjs` 将约 30.7 MiB 的 WASM 分为 4 个不超过 8 MiB 的文件，并生成带 SHA-256 的清单，避免 Cloudflare Pages 单文件 25 MiB 限制。文件在 `public/vendor/ffmpeg/0.12.10/`，作为可重建产物忽略，构建时进入 `dist`。浏览器只在导出时同源加载、校验、拼合与实例化引擎，无第三方 CDN 依赖。

`public/_headers` 的 CSP 允许 `wasm-unsafe-eval`、同源 Worker 和 `blob:` 媒体预览。版本化引擎资源使用长期不可变缓存。首次导出需下载约 31 MiB，后续可使用浏览器 HTTP 缓存。

FFmpeg 核心依赖使用 GPL-2.0-or-later；许可证和对应源码 / 构建说明见 `public/vendor/ffmpeg/NOTICE.md`。本次工作只修改本地代码，没有发布站点。

## 验证

- `npm test`：解析、AES、密钥轮换、失败重试、缺口跳过、暂停继续、缓存恢复、响应体超时、字节范围、存储故障与清单顺序回归。
- `npm run build`：完整静态构建与项目内容、链接、SEO、图标检查。
- `npm run check:hls-browser`：需要本地 FFmpeg / FFprobe 与 Edge（或 `PLAYWRIGHT_CHANNEL` 指定浏览器）。生成真实 H.264 / AAC HLS，通过受控本地服务器制造 404、410、暂时失败、损坏媒体及声明缺口，验证缓存恢复、五语页面、移动端、深色界面、WASM 导出、解码、时间轴和保留画面哈希。截图及输出放在忽略目录 `output/playwright/hls/`。

技术参考：[HLS RFC 8216](https://www.rfc-editor.org/rfc/rfc8216)、[FFmpeg concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/)。

### 本次验收结果

2026-09-30，在 Windows / Edge 中使用站点生产 CSP 验证：

- 21 项单元测试、TypeScript 检查、独立分支完整构建（417 个页面）及内容 / 链接 / SEO / 图标检查通过；既有浏览器回归 29 个场景通过。

- TS 源 12 秒，制造 404、410、503 和损坏媒体；恢复暂时失败并跳过不可用内容后，MP4 / TS 输出 6 秒，保留 90 帧，逐帧哈希一致，AAC 音频数据逐字节一致。
- fMP4 源 12 秒，制造 404 与 `EXT-X-GAP`；输出 8 秒，保留 120 帧，逐帧哈希和 AAC 数据均一致。
- 三种输出均可完整解码，音视频 DTS 单调递增，没有遗留缺失分片对应的时间戳空洞。
- 已验证解析主列表、有限重试、刷新恢复缓存且不重复下载、暂停继续、取消导出、清除任务缓存、损坏媒体报告、明确拒绝独立音轨、五语页面、移动端无横向溢出、深色样式与本地视频预览。

以上结果来自受控、独立可解码的 H.264 / AAC 样本，不代表能恢复缺失画面或修复任意损坏源流。
