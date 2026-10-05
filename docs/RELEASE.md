# 发布与线上验收

更新：2026-10-05。

## 发布目标

- GitHub：`YupenBob/clover-tools`，生产分支 `main`。
- Cloudflare Pages：`clovertools`，直接上传模式，生产分支 `main`；自定义域名 `clovertools.cn`。
- 静态产物：`dist/`；Pages Functions 同时由 Wrangler 打包。项目名、输出目录和 R2 绑定见 `wrangler.toml`。

生产发布由 `.github/workflows/quality.yml` 自动执行：推送 `main` 后先完成质量检查，再使用仓库 Actions 中的 `CLOUDFLARE_API_TOKEN`（Secret）和 `CLOUDFLARE_ACCOUNT_ID`（Secret 或 Variable）上传 Cloudflare Pages。Token 从 Secret 读取，使运行日志自动遮蔽其值。只有部署和正式域名验收也通过，才视为上线完成；PR 和其他分支只执行质量检查。凭据不需要放入本地工作环境，`.env`、依赖目录、构建输出和测试视频不提交。

## 发布步骤

1. 核对发布范围与远程生产分支；若原工作目录还有其他未完成改动，使用独立发布目录，保留原工作。本次加入「专注航班」，五语言搜索索引、使用说明、工具总数与生产验收同时更新。
2. `npm ci` 安装锁定依赖；`npm run check:all` 执行类型/规则测试、FFmpeg 本地分片准备、静态构建和内容/链接/SEO/图标检查。
3. `npm run check:browser` 验证站点和 FPS；`npm run check:hls-browser` 验证实际媒体、缺口处理、流式写入和生产 CSP。媒体验证需 native FFmpeg/FFprobe，支持通过 `FFMPEG_PATH` / `FFPROBE_PATH` 指定；两个浏览器检查均支持 `PLAYWRIGHT_CHANNEL` 或 `PLAYWRIGHT_EXECUTABLE_PATH`，显式可执行文件优先。
4. 维护文档、提交、推送 GitHub，并确认同一提交的 CI 通过。CI 包含 HLS 媒体回归；运行器安装 native FFmpeg 只用于生成/解码验证样本，站点运行时使用锁定的 WASM 包。
5. `main` 的检查通过后，部署任务在同一提交下以生产 origin 重新构建，使用 `wrangler pages deploy dist --project-name clovertools --branch main --commit-hash <已推送提交>` 上传。生产部署串行执行；构建与上传前都检查远程 `main`，跳过已被新提交替代的版本。质量任务的 `https://quality.example` 产物不会上传生产。
6. 部署任务运行 `node scripts/verify-production.mjs`，核实 Cloudflare 部署状态、生产分支与提交哈希；检查正式域名的五语言首页、新工具、同构建脚本/音频/FFmpeg 分片、sitemap、搜索索引和 API，并执行三个趣味工具与专注航班的 35 项真实浏览器场景。验收报告、截图和下载样本作为 Actions artifact 保存 7 天。必要时仍可在有凭据的本地环境按上述 Wrangler 命令手动部署。
7. 部署工作流成功后，独立的 Search engine submission 工作流提交已发布 sitemap；它也每天 UTC 01:00 执行。Bing 使用公开 IndexNow key；Google 服务账号设置与实际提交状态见 [SEARCH-SUBMISSION.md](SEARCH-SUBMISSION.md)，不能将“未配置，未提交”计为 Google 提交成功。

## 发布产物边界

FFmpeg WASM 从固定 npm 包生成四个可校验的同源分片，每个低于 Pages 单文件限制。不能上传未经分片的约 31 MiB WASM 文件。FPS Three.js 和媒体引擎仍按工具使用时加载。

若部署或线上检查失败，保留验证记录，定位失败阶段后修复或使用 Pages 的上一成功部署回滚。只有自定义域名实际验收成功后才报告上线完成。

## 此前验收（2026-10-04）

本次更新覆盖五语界面、移动端和深色主题，保留原 FPS 与 HLS 的独立模块和运行边界。三个新工具的实现、需求依据和使用限制见 [FUN-TOOLS.md](FUN-TOOLS.md)，工具布局与验证记录见 [TOOL-DESIGN.md](TOOL-DESIGN.md) 和 [QUALITY.md](QUALITY.md)。本地验证与生产部署分别记录，不能以本地通过代替上线确认。

本地构建验证：FPS / HLS / 工具类型检查、127 项单元与反例测试、75 个工具与 25 份深度说明、437 页面、120 条 sitemap 地址均通过。内容、链接、SEO 和图标检查通过；最终产物通过 450 次全工具布局与脚本检查。浏览器和媒体发布回归结果记录在质量文档。

## 此前验收（2026-10-03）

FPS / HLS 类型检查、74 项单元测试、72 个工具与 22 份深度说明、422 页面、117 条 sitemap 地址均通过。内容、链接、SEO 和图标检查通过；最大静态文件为 8 MiB 的 FFmpeg 分片。

58 个站点/FPS 浏览器场景和 HLS 真实媒体回归通过。HLS 回归覆盖缺口跳过、帧/音频数据一致、连续时钟、完整解码、文件写入/权限故障恢复、刷新续传和 448 MiB 流式保存；五语言与生产 CSP 检查通过。测试不证明任意损坏视频可恢复，也不保证任意设备的内存或磁盘用量。
