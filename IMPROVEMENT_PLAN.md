# CloverTools 优化方案

> 基于 2026-06-09 代码审查，针对当前项目存在的架构/UI/工程问题进行系统性优化

---

## 当前问题诊断

### 🔴 架构层面

| 问题 | 严重度 | 说明 |
|------|--------|------|
| **双轨系统** | 致命 | `generator.js` 生成的页面和 `src/code/` 等独立 HTML 是两套完全独立的体系，header/footer/OG 标签/SVG sprite 各自复制一份，修改一处需同步 N 处 |
| **4 版首页并存** | 高 | `home.html` / `home-new.html` / `home-demo.html` / `home-demo2.html` — 无人知道哪个是 canonical，变更需要四重维护 |
| **Python 脚本混乱** | 高 | 15+ 个 Python 脚本功能重叠 (`add_tools.py` / `add_tools2.py` / `add_tools_today.py`...)，无明确工作流，新人无法知道用哪个 |
| **无组件化** | 高 | 工具页面的 HTML/CSS/JS 全部手写或字符串拼接，复用度为 0，每个工具页面都在重复造轮子 |

### 🟡 UI/UX 层面

| 问题 | 说明 |
|------|------|
| **样式简陋** | `shared.css` 仅 ~600 行，只有基础 resets + 按钮 + textarea，无设计系统 |
| **工具页质量参差** | generator 生成的页面只有 textarea + 按钮；独立 HTML 各自实现风格不统一 |
| **无交互动效** | 仅 toast slide-up 和 button hover scale，工具操作无反馈 |
| **无状态设计** | 无 loading/empty/error/success 状态区分，用户不知道操作是否成功 |
| **移动端体验差** | 有响应式但未做移动端优化（触控区域、手势、safe-area） |

### 🟢 工程层面

| 问题 | 说明 |
|------|------|
| **无构建优化** | 无压缩、无打包、无 tree-shaking，直接输出原始文件 |
| **无测试** | 仅一个 `smoke-test.js`，无自动化测试保障 |
| **安全风险** | 工具脚本通过 `new Function()` 动态执行，来自 JSON 的代码无沙箱 |
| **无监控** | 仅有 Counter.dev 统计，无错误追踪、性能监控 |

---

## 优化计划（4 个 Phase）

### Phase 1：统一架构 — 消灭双轨系统

**目标**：让所有页面通过同一套模板 + 构建流程生成

#### 1a. 废弃独立 HTML 页面
将 `src/code/`、`src/encrypt/` 等目录中的 10 个独立页面迁移为 `tools.json` 中的条目：
- 提取每个页面的业务逻辑 JS → 写入 `tools.json` 的 `customScript` 字段
- 提取自定义 HTML 结构 → 写入 `customHtml` 字段
- 删除独立 HTML 文件，统一由 `generator.js` 构建

#### 1b. 统一首页
- 选择 `home-new.html` 作为唯一首页模板
- 删除 `home.html`、`home-demo.html`、`home-demo2.html`

#### 1c. 清理 Python 脚本
- 保留核心 2-3 个（`generate_tools.py`、`fix_tools.py`、`check_tools.py`）
- 其余归档到 `scripts/archive/`

#### 1d. 验证
- `node generator.js` 构建通过
- 所有工具页正常加载
- 冒烟测试通过

---

### Phase 2：设计系统 + UI 现代化

**目标**：建立统一的设计语言，大幅提升视觉品质

#### 2a. 设计 Token 系统
```
颜色 / 间距 / 圆角 / 阴影 / 字体大小 / 动画时长 → CSS 变量统一管理
```

#### 2b. 组件库（`shared.css` + `shared.js` 中实现）
- **ToolCard** — 统一工具卡片容器（含 header/body/footer 插槽）
- **InputGroup** — 输入框 + label + 校验状态 + 字符计数
- **OutputPanel** — 输出面板 + 复制按钮 + 状态指示
- **ModeTabs** — 模式切换组件（当前仅 json-compress 有，推广到全局）
- **Toast** — 增强（支持 success/error/warning/info 类型 + 图标）
- **Modal** — 通用弹窗
- **Dropdown** — 下拉选择
- **Tooltip** — 提示气泡

#### 2c. 动效系统
- 页面切换过渡（fade-in）
- 卡片 hover 微动效（translateY + shadow 增强）
- 按钮点击涟漪效果
- 复制成功脉冲动画（已有，增强）
- 输入框 focus 边框渐变动画
- 结果区域出现 slide-up 动画

#### 2d. 移动端体验优化
- 增大触控目标（最小 44×44px）
- 底部固定工具栏（常用操作）
- 移动端专用导航（hamburger menu 已有，优化动画）
- Safe area 适配（`env(safe-area-inset-bottom)`）

---

### Phase 3：工具质量升级

**目标**：每个工具都达到"好用"的标准

#### 3a. 统一工具功能标准
每个工具必须包含：
- ✅ 输入校验 + 实时错误提示
- ✅ 一键复制结果
- ✅ 一键清空输入
- ✅ 示例数据填入按钮
- ✅ 字符数/字节数统计
- ✅ 键盘快捷键（Ctrl+Enter 执行）

#### 3b. 高频工具优先重设计
- **JSON 格式化/压缩** → 添加语法高亮、树形视图、差异对比
- **Base64 编解码** → 添加文件上传编码、图片预览
- **时间戳转换** → 添加实时时钟、批量转换
- **URL 编解码** → 添加参数解析表格视图
- **MD5/SHA** → 添加文件哈希、进度条

#### 3c. 工具发现性优化
- 首页添加"常用工具"快速访问行（带图标大卡片）
- 搜索增强：拼音搜索、模糊匹配、搜索历史
- 工具页底部添加"相关工具"推荐

---

### Phase 4：工程化升级

**目标**：提升可维护性和性能

#### 4a. 构建系统现代化
- 引入简单构建脚本（仍用 Node.js，不引入重型工具）
- CSS 压缩（cssnano）
- JS 压缩（terser）
- HTML 压缩
- 自动生成 sitemap.xml

#### 4b. 性能优化
- Bootstrap Icons → 内联仅使用的图标 SVG（减少 CDN 请求）
- `shared.css` 按需拆分（首屏关键 CSS 内联，其余异步）
- 图片懒加载
- Service Worker 离线缓存（可选）

#### 4c. 质量保障
- 添加 Playwright 冒烟测试（每个工具页检查加载 + 核心功能）
- 添加 HTML/CSS 规范检查（prettier）
- 添加 Lighthouse CI 性能基线

#### 4d. 安全加固
- `new Function()` 执行 → 替换为沙箱化执行或预编译函数映射
- 添加 CSP header

---

## 优先级与工时

| Phase | 预估工时 | 影响范围 | 优先级 |
|-------|---------|---------|--------|
| Phase 1 统一架构 | 3-5 天 | 全部页面 | 🔴 立即做 |
| Phase 2 设计系统 | 5-7 天 | 全部 UI | 🟡 Phase 1 后 |
| Phase 3 工具质量 | 7-10 天 | 所有工具页 | 🟡 滚动进行 |
| Phase 4 工程化 | 3-5 天 | 开发体验 | 🟢 按需做 |

---

## 推荐执行路径

**最小可行改进（1 周）**：
1. 消灭双轨 → 迁移 10 个独立 HTML 到 `tools.json`
2. 统一首页模板
3. 建立基础设计 token（颜色/间距/圆角变量）
4. 给所有工具页统一加上"复制结果"+"清空"+"示例"三个按钮

**完整升级（3-4 周）**：
按 Phase 1 → 2 → 3 → 4 顺序全部执行

---

## 执行记录

| Date | Phase | Status |
|------|-------|--------|
| 2026-06-09 | Phase 1 | 🚧 In Progress |
