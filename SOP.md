# CloverTools 交接 SOP

> 本文档面向接手 CloverTools 项目的开发者，涵盖所有关键技术细节、日常运维流程和避坑指南。

---

## 一、项目概述

**CloverTools**（clovertools.cn）是一个面向开发者的在线工具箱，目前收录 **167 个工具**，月均数千访问。

- **仓库**: https://github.com/YupenBob/clover-tools
- **主域**: https://clovertools.cn
- **Vercel Project ID**: `prj_11LWzVut4GI4A2LPf0Ow6VCrZSRj`
- **GitHub Token**: 存在 `~/.openclaw/workspace/.env` → `GITHUB_TOKEN`
- **Vercel Token**: 存在 `~/.openclaw/workspace/.env` → `VERCEL_TOKEN`

---

## 二、技术架构

### 2.1 核心文件

| 文件 | 作用 |
|------|------|
| `tools.json` | **工具定义 source of truth**，所有工具的 metadata（名称、路径、类型、自定义 HTML/Script） |
| `generator.js` | 静态站点生成器，读取 tools.json 和 keywords.json，输出 dist/ 目录 |
| `keywords.json` | SEO 关键词，每条触发一篇博客文章生成 |
| `articles.json` | SEO 自定义文章（可选，用于生成高质量人工编辑内容） |
| `templates/` | HTML 模板（base.html、tool.html、home-new.html 等） |
| `src/shared.css` | 全站共享样式，含金色主题变量 `--primary: #c9a96e` |
| `src/shared.js` | 全站共享 JS（主题切换、搜索、复制等功能） |
| `extra_custom.json` | 存放 extra_custom 类型工具的 HTML 片段 |
| `dist/` | **构建输出目录**，不提交 git，由 Vercel 构建时自动生成 |
| `article_contents/` | 自定义博客文章 HTML 内容目录 |
| `.env` | 敏感配置（GitHub Token、Vercel Token、项目 ID、 BASE_URL） |

### 2.2 目录结构

```
clover-tools-v2/
├── tools.json              # 工具定义（JSON，每条含 name/path/type/customHtml/customScript）
├── generator.js            # 站点生成器（2469行）
├── keywords.json           # SEO关键词（~450条，每条生成一篇博客）
├── articles.json           # SEO自定义文章元数据
├── extra_custom.json       # extra_custom 类型工具 HTML 片段
├── templates/              # HTML 模板
│   ├── base.html           # 基础布局（含 head/header/footer）
│   ├── tool.html           # 工具页模板
│   ├── home-new.html       # 新版首页
│   ├── home.html          # 旧版首页
│   ├── blog-post.html      # 博客文章模板
│   └── components/        # 可复用组件片段
├── src/
│   ├── shared.css          # 全站样式（金色主题）
│   ├── shared.js           # 全站 JS
│   └── {category}/         # 各类工具的静态资源（icons 等）
├── dist/                   # 构建输出（Vercel 部署目录，不提交 git）
│   ├── index.html          # 首页
│   ├── home-new.html       # 新版首页
│   ├── tools/              # 工具页面（167个HTML）
│   ├── blog/               # 博客文章（~470篇HTML）
│   ├── src/                # 静态资源
│   ├── sitemap.xml         # SEO sitemap
│   └── .well-known/       # IndexNow key 等
├── plugins/                # 插件系统目录
├── api/                    # API 代理（github-proxy 等）
├── scripts/                # 辅助脚本
├── vercel.json             # Vercel 部署配置
└── CLAUDE.md               # Claude Code 使用指南（York 亲传丝滑小妙招）
```

### 2.3 工具类型系统（generator.js 实现）

generator.js 通过 `TOOL_TYPE_REGISTRY` 对象管理工具渲染逻辑：

```
type: "copy"          → 文本复制
type: "text"          → 文本处理（base64/urlencode/hash 等）
type: "time"          → 时间相关工具（复用 tools.json 的 customHtml）
type: "file-convert"  → 文件转换（上传→处理→下载）
type: "code"          → 代码处理（格式化/压缩等）
type: "tool-static"   → 静态工具（字段驱动，自动生成 UI）
type: "tool-custom"   → 完全自定义工具（tools.json 提供 customHtml + customScript）
type: "extra_custom"  → 特殊自定义（extra_custom.json 提供 HTML）
type: "tool-template" → 工具模板（可扩展）
```

**优先级**: customHtml > customScript > TOOL_TYPE_REGISTRY（自动生成）

### 2.4 SEO 系统

- **keywords.json**：每条关键词 → 一篇 `/blog/{keyword}.html`
- **articles.json**：人工定义的高质量文章（覆盖在 keywords 生成之上）
- **generator.js**：从 keywords.json + articles.json 生成 469 篇博客文章
- **sitemap.xml**：自动生成，包含所有工具页和博客页
- **IndexNow**：使用 key `05b97bd1ccb0108b037fad6252fd553acee2ce13191856e3a13c0aa1b5b4c37a`

---

## 三、日常运维

### 3.1 本地构建

```bash
cd /home/yock/clover-tools-v2
node generator.js
```

构建产物输出到 `dist/`，约 2-3 分钟完成。

### 3.2 部署到 Vercel

**方式一：GitHub 自动部署（推荐）**
每次 push 到 main 分支，Vercel GitHub App 自动触发构建部署。

**方式二：Vercel CLI 手动部署**
```bash
cd /home/yock/clover-tools-v2
npx vercel --prod --yes
```

**方式三：使用脚本**
```bash
# 需先 source .env
export $(grep -v '^#' ~/.openclaw/workspace/.env | xargs)
npx vercel --prod --yes
```

### 3.3 添加新工具

**步骤 1**：在 `tools.json` 中找到对应分类，添加工具条目：

```json
{
  "name": "工具名称",
  "path": "category/tool-name.html",
  "desc": "工具简短描述（用于工具卡）",
  "description": "完整描述（用于 SEO）",
  "keywords": ["关键词1", "关键词2"],
  "type": "tool-custom",
  "icon": "bi bi-icon-name",
  "customHtml": "<div class=\"tool-card\">...</div>",
  "customScript": "document.getElementById('btn').onclick = ..."
}
```

**工具类型选择**：
- 纯文本处理（copy/base64/hash）→ `type: "text"` 或 `type: "copy"`
- 有上传/处理/下载 → `type: "file-convert"`
- 有自定义 UI → `type: "tool-custom"` + `customHtml` + `customScript`
- 表单字段简单 → `type: "tool-static"`（generator.js 自动生成 UI）

**步骤 2**：本地构建并验证
```bash
node generator.js
# 浏览器打开 dist/tools/category/tool-name.html 检查
```

**步骤 3**：commit + push
```bash
git add tools.json
git commit -m "feat: add {tool-name}"
git push
# Vercel 自动部署（~30s）
```

### 3.4 添加 SEO 关键词

**方式一**：在 `keywords.json` 添加
```json
{
  "keyword": "要优化的关键词",
  "tool": "code/regex-tester.html",
  "slug": "对应的博客文章 slug",
  "intent": "error-fix | usage | comparison | tool",
  "category": "分类"
}
```

**方式二**：在 `articles.json` 添加自定义文章
```json
{
  "slug": "my-custom-article",
  "title": "自定义文章标题",
  "desc": "文章描述",
  "content_file": "article_contents/my-custom-article.html"
}
```
然后创建 `article_contents/my-custom-article.html` 文件。

---

## 四、避坑指南（经验沉淀）

### ⚠️ customHtml 开发规范

1. **禁止内嵌 `<style>` 块**：会和 toolTemplate 的 shared.css 冲突，导致样式崩（深紫色背景/输入框变黑）
2. **禁止包含 site header/导航/footer**：generator.js 会自动包入 toolTemplate
3. **禁止内嵌换行 `\n` 在字符串里**：用 `'+'\n'+` 拼接替代 `'...\\n...'`
4. **使用 CSS 变量**：背景用 `var(--bg-secondary)`、边框用 `var(--border)`、文字用 `var(--text)`
5. **output-bg 变量已废弃**：统一用 `bg-secondary`

### ⚠️ Vercel 部署高频 bug

**问题**：Vercel GitHub App 部署时忽略 `vercel.json` 的 `buildCommand`，项目设置被重置为 null。

**症状**：全站 404（不是路由问题）。

**修复**：
```bash
# 方式一：Vercel API 修复
curl -X PATCH "https://api.vercel.com/v6/projects/{id}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d '{"buildCommand": "node generator.js", "outputDirectory": "dist"}'

# 方式二：Vercel CLI 强制重新部署（每次 push 后执行）
npx vercel --prod --yes
```

### ⚠️ generator.js 禁止在构建时调用 git

Vercel 容器没有 `.git` 目录，调用 git 命令会报错。

### ⚠️ tools.json 字段命名

- 工具描述：英文 `description`（SEO用）、中文 `desc`（卡片用）
- `customHtml`：HTML 字符串（必须完整包裹在 `<div class="tool-card">` 内）
- `customScript`：JS 字符串（DOMContentLoaded 后执行）

### ⚠️ customHtml 渲染后的 DOM 结构

```
<main>
  <div class="tool-header">  ← 工具标题区（generator.js 自动生成）
  <div class="tool-layout">
    <div class="tool-content">
      <div class="tool-card">
        ← tools.json 的 customHtml 内容（嵌套 .tool-card 会被剥离）
      </div>
    </div>
    <div class="tool-sidebar">  ← 侧边栏（相关工具/分享等）
  </div>
</main>
```

### ⚠️ PNG/SVG 静态资源

禁用 UTF-8 读取，会损坏二进制内容。用 buffer 方式拷贝。

---

## 五、SEO 和流量

### 5.1 流量现状
- 月访问：数千（工具类网站，有增长空间）
- 主要来源：百度/Google 搜索

### 5.2 SEO 策略
- **工具页**：工具名称 + description + keywords
- **博客页**：keywords.json 触发 469 篇，覆盖长尾问题词（如"json 格式化失败怎么办"）
- **自定义文章**：articles.json 人工编写高质量内容
- **sitemap.xml**：629 个 URL，全部提交搜索引擎
- **IndexNow**：百度/Bing 实时推送

### 5.3 提交搜索引擎
```bash
# Bing IndexNow
node indexnow-submit.js

# 或手动 POST
curl -X POST "https://www.bing.com/indexnow" \
  -H "Content-Type: application/json" \
  -d '{"host": "clovertools.cn", "key": "05b97bd1ccb0108b037fad6252fd553acee2ce13191856e3a13c0aa1b5b4c37a", "urlList": ["https://clovertools.cn/tools/code/cron-parser.html"]}'
```

---

## 六、常用命令备忘

```bash
# 本地构建
cd /home/yock/clover-tools-v2 && node generator.js

# Git 提交
git add . && git commit -m "描述" && git push

# Vercel 部署
npx vercel --prod --yes

# 检查站点状态
curl -s -o /dev/null -w "%{http_code}" https://clovertools.cn/
curl -s -o /dev/null -w "%{http_code}" https://clovertools.cn/tools/code/cron-parser.html

# 工具数量
cd /home/yock/clover-tools-v2 && node -e "
const fs = require('fs');
const t = JSON.parse(fs.readFileSync('tools.json','utf8'));
let flat = []; t.forEach(c => c.tools.forEach(tool => flat.push(tool)));
console.log('Total tools:', flat.length);
"

# 检查 customHtml 工具
cd /home/yock/clover-tools-v2 && node -e "
const fs = require('fs');
const t = JSON.parse(fs.readFileSync('tools.json','utf8'));
let flat = []; t.forEach(c => c.tools.forEach(tool => flat.push(tool)));
const custom = flat.filter(tool => tool.customHtml || tool.customScript);
console.log('Custom tools:', custom.length);
"

# 搜索含 output-bg 的 customHtml
grep -r "output-bg" tools.json extra_custom.json

# Claude Code（使用 MiniMax DeepSeek）
claude -p "task prompt" --permission-mode bypassPermissions
```

---

## 七、最近更新日志

| 日期 | commit | 内容 |
|------|--------|------|
| 2026-05-13 | `9faf0a7` | fix: normalize output-bg → bg-secondary，剥离 home-new.html 重复 CSS |
| 2026-05-13 | `b0289ae` | fix: 剥离 customHtml 内嵌 CSS，防止与 toolTemplate 冲突 |
| 2026-05-13 | `23b73c3` | feat: 新金色主题 #c9a96e + customHtml 工具集成 toolTemplate |
| 2026-05-13 | `753d1b3` | fix: 使用 lookbehind regex 避免 double-escaping 外部 script 标签 |
| 2026-04-30 | `1c5ae9a` | refactor: generator.js 重构完成，工具生成逻辑模板化 |

---

## 八、关键联系人

- **项目 Owner**: York（YupenBob/Yock）
- **飞书**: ou_4d1a182c1c60e870e8957d3452049e22
- **AI 助手**: Clover（☘️）— OpenClaw 系统，运行于飞书群

---

## 九、快速上手检查清单

- [ ] Node.js 22+ 已安装
- [ ] `.env` 文件配置正确（VERCEL_TOKEN / GITHUB_TOKEN / BASE_URL=clovertools.cn）
- [ ] 理解 tools.json 结构（category → tools → tool definition）
- [ ] 理解 type → TOOL_TYPE_REGISTRY → HTML 生成映射关系
- [ ] 本地 `node generator.js` 能成功运行
- [ ] 了解 customHtml 禁止事项（内嵌 style/header/换行符）
- [ ] 知道 Vercel 部署后要手动 `npx vercel --prod --yes` 双保险