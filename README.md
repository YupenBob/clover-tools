# CloverTools V3

精选在线工具箱，部署于 Cloudflare Pages + R2 + Worker（Pages Functions）。工具分为「开发实用 / 日常实用 / 趣味工具」三类，全部纯浏览器处理、即开即用、无需注册。

## 技术栈

- [Astro](https://astro.build) 5：静态站构建，工具页逐一手写（精品制作，不使用生成模板）
- Cloudflare Pages：站点托管（连接 GitHub 仓库，push 自动构建部署）
- Cloudflare R2：大文件 / 媒体资源存储
- Pages Functions：少量工具 API（如 `functions/api/ip.ts`）
- Bootstrap Icons（自托管 woff2）：全站图标统一 iconfont，**禁止 emoji**

## 项目结构

```
src/
  pages/index.astro          # 首页（三分类目录 + 搜索）
  pages/tools/{cat}/{slug}/  # 工具页（cat: dev | daily | fun）
  layouts/                   # BaseLayout / ToolLayout
  components/                # 页头、页脚、工具卡片
  lib/tools.ts               # 工具清单（驱动首页、sitemap、重定向）
  styles/global.css          # 设计系统（金色主题 + 深色模式）
functions/api/               # Pages Functions（工具 API）
public/
  _headers  _redirects  robots.txt   # Pages 配置
  clover-logo.svg                    # 品牌资产
legacy/                      # 旧版 CloverTools 代码归档（仅参考）
scripts/                     # 质检脚本（链接完整性、emoji 扫描）
```

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 构建到 dist/
npm run check      # 构建后检查：链接完整性 + SEO 结构 + emoji 扫描
```

## 添加工具（精品制作规范）

1. 在 `src/lib/tools.ts` 的对应分类数组里登记工具元信息（slug、名称、一句话描述、iconfont 图标类、关键词、tier）
2. 手写页面 `src/pages/tools/{cat}/{slug}/index.astro`，使用 `ToolLayout`
3. 页面必须包含：输入校验与错误提示、复制/清空/示例、Ctrl+Enter 快捷执行、移动端适配、SEO meta（布局已内置 JSON-LD）
4. 图标一律 `bi bi-*` iconfont 类名，禁止 emoji 字符
5. 需要服务端能力的工具，在 `functions/api/` 增加 Pages Function，前端 `fetch('/api/...')`
6. 若保留旧版同名工具，在 `public/_redirects` 中补充旧路径 301 到新路径
7. `npm run check` 全部通过后再提交

## 部署

### 站点（Cloudflare Pages）

1. 在 Cloudflare Pages 创建项目并连接 GitHub 仓库（构建命令 `npm run build`，输出目录 `dist`）
2. 绑定自定义域名 `clovertools.cn`

### 媒体（Cloudflare R2）

```bash
wrangler r2 bucket create clovertools-media
wrangler r2 object put clovertools-media/<key> --file <path>
```

在 Pages 项目设置中绑定同名 R2 桶（变量名 `CLOVER_MEDIA`）后，Functions 里通过 `context.env.CLOVER_MEDIA` 访问。

### 分析（Cloudflare Web Analytics，可选）

在 Pages 项目里创建 Web Analytics 后，将站点级发布 token 写入环境变量 `PUBLIC_CF_BEACON_TOKEN`，构建后自动注入 beacon 脚本。

### 搜索引擎验证与监控

1. **Google Search Console**：在 GSC 添加 `clovertools.cn`，推荐用 Cloudflare DNS 的 TXT 记录验证；验证后提交 `https://clovertools.cn/sitemap-index.xml`。
2. **Bing Webmaster**：添加站点后用 DNS TXT 验证；提交同一 sitemap。部署完成后可运行 `npm run indexnow` 主动推送全站 URL（key 文件为 `public/<32位hex>.txt`，已随仓库生成，勿删除）。
3. **百度站长平台**：添加站点后选择「文件验证」，把平台给出的 `baidu_verify_<验证码>.html` 放入 `public/` 并重新部署（参考 `public/baidu-verify.example.html`），再提交 sitemap。Cloudflare 海外节点下百度收录较慢属预期，主力流量渠道为 Google/Bing 与 CSDN 文章。
4. **数据闭环**：以 GSC「曝光→点击」排序工具页，Top 20 无收录页逐批排查；每周查看覆盖率与抓取统计。

## 约定

- 全中文站点，无营销文案、无注册引导
- 旧版 Vercel 相关代码已整体归档在 `legacy/`，仅作参考
- SEO 文章已从站内剥离，后续在 CSDN 独立发布（见 `data/keywords.json` 素材源）
