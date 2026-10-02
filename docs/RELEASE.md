# 发布与线上验收

更新：2026-10-03。

## 发布目标

- GitHub：`YupenBob/clover-tools`，生产分支 `main`。
- Cloudflare Pages：`clovertools`，直接上传模式，生产分支 `main`；自定义域名 `clovertools.cn`。
- 静态产物：`dist/`；Pages Functions 同时由 Wrangler 打包。项目名、输出目录和 R2 绑定见 `wrangler.toml`。

推送 GitHub 与发布站点是两个操作。当前项目未配置 GitHub 自动部署，不能把推送成功或 CI 通过当作上线成功。凭据只从本地环境或部署平台读取，`.env`、依赖目录、构建输出和测试视频不提交。

## 发布步骤

1. 在独立发布目录合并已验证功能，保留原工作目录的改动。本次包含 FPS 练枪和 M3U8 下载器的流式格式/恢复版本；同时重新生成五语言搜索索引与工具总数。
2. `npm ci` 安装锁定依赖；`npm run check:all` 执行类型/规则测试、FFmpeg 本地分片准备、静态构建和内容/链接/SEO/图标检查。
3. `npm run check:browser` 验证站点和 FPS；`npm run check:hls-browser` 验证实际媒体、缺口处理、流式写入和生产 CSP。媒体验证需 native FFmpeg/FFprobe，支持通过 `FFMPEG_PATH` / `FFPROBE_PATH` 指定；浏览器由 `PLAYWRIGHT_CHANNEL` 指定。
4. 维护文档、提交、推送 GitHub，并确认同一提交的 CI 通过。CI 包含 HLS 媒体回归；运行器安装 native FFmpeg 只用于生成/解码验证样本，站点运行时使用锁定的 WASM 包。
5. 使用 `wrangler pages deploy dist --project-name clovertools --branch main --commit-hash <已推送提交>` 上传同一构建产物；发布前确认工作目录无未提交的产品变更。额外的凭据文件可由 Wrangler 的 `--env-file` 指定。
6. 核实 Cloudflare 部署状态、生产分支与提交哈希。对自定义域名检查首页、五语言入口、新工具、关键脚本/音频/FFmpeg 分片、sitemap 和 API，并用真实浏览器检查生产 CSP 下的加载和操作。

## 发布产物边界

FFmpeg WASM 从固定 npm 包生成四个可校验的同源分片，每个低于 Pages 单文件限制。不能上传未经分片的约 31 MiB WASM 文件。FPS Three.js 和媒体引擎仍按工具使用时加载。

若部署或线上检查失败，保留验证记录，定位失败阶段后修复或使用 Pages 的上一成功部署回滚。只有自定义域名实际验收成功后才报告上线完成。

## 本次验收

本次合并保留两项工具的独立模块、配置、来源与使用说明。合并验证和生产部署结果在交付时按实际证据汇报；发布不能改变原工具文档中列出的游戏近似模型或媒体恢复边界。

2026-10-03 本地构建验证：FPS / HLS 类型检查、74 项单元测试、72 个工具与 22 份深度说明、422 页面、117 条 sitemap 地址均通过。内容、链接、SEO 和图标检查通过；最大静态文件为 8 MiB 的 FFmpeg 分片。

58 个站点/FPS 浏览器场景和 HLS 真实媒体回归通过。HLS 回归覆盖缺口跳过、帧/音频数据一致、连续时钟、完整解码、文件写入/权限故障恢复、刷新续传和 448 MiB 流式保存；五语言与生产 CSP 检查通过。测试不证明任意损坏视频可恢复，也不保证任意设备的内存或磁盘用量。
