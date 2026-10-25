# CloverTools 视觉改造 v2：Morphicons 图标系统 + 卡片升级

> 状态：已实施（Phase 0/1/2 完成，Phase 3 部分完成）。
> 基线：`main @ b12a95a` 构建通过（453 页 / 132 sitemap / 184 tests）。
> 官方结果以 `npm run build`、`npm run check:browser` 与本文件末尾的验收为准。
> 配套证据：`output/ui-beautify/`（审计、截图、卡片实验室、品牌标志稿）。

## 0. 回滚与方向纠正

上一版「暖纸·墨金」编辑部方案（v1）已撤回：

- 删除 `docs/UI-BEAUTIFY-PLAN.md`（v1）；v1 概念稿移入 `output/ui-beautify/_superseded-v1/`；
- 保留三份审计与 27 张基线截图（事实证据仍有效）；
- **未修改过任何线上页面/部署**，v1 只停留在文档与静态概念稿。

v2 原则：**保留现版的浅金色调、无衬线字体、页面骨架与 hero**，只做四类改动：

1. 全站图标从 Bootstrap Icons 字体迁移到 **Lucide 24×24 描边 SVG**，用 **Morphicons** 做状态形变动画；
2. 工具卡升级为「Icon Spotlight」并加入 3 张精选卡（A + C）；
3. ~~品牌四叶草标记重绘（几何、可小尺寸）~~（2026-10-25 已回滚，见第 3 节）；
4. 修复客观缺陷：对比度、移动端分类头破版、指南索引 H1 不可见、reveal 白屏、页头/页脚跨页横移。

## 1. 图标系统

| 项 | 值 |
|---|---|
| 图标源 | `lucide@1.61.0`（ISC，1903 个 24×24 描边图标，tree-shakable） |
| 动效引擎 | `morphicons@2.0.2`（MIT，Astro 组件 + `<morph-icon>` 自定义元素，SSR 首帧 + spring morph） |
| 语义注册表 | `src/lib/icons/registry.ts`：217 个语义键（沿用历史 `bi-*` 名称去掉前缀），值 = Lucide IconNode |
| 客户端局部数据 | `src/lib/icons/client-data.ts`：仅 26 个动态图标，避免把整包 Lucide 打进浏览器 |
| 静态图标 | `src/components/Icon.astro`：SSR 内联 SVG，零 JS，`size` 默认 `1em` 继承父级字号 |
| 交互图标 | `src/components/MorphIcon.astro`：包装 `morphicons/astro`，SSR + 元素升级 |
| 已用 morph | 主题切换 sun↔moon（全站 header，`set()` 初始化 / `morphTo()` 点击）；保留 `reducedMotion="user"` |
| 移除 | `bootstrap-icons` 依赖、134KB woff2 预加载、9.6KB vendor CSS、`scripts/slim-icons.mjs`、`icons:slim` 脚本 |
| 质量门禁 | `scripts/check-icons.mjs`（源文件无 `bi-*`、图标名可解析、客户端无 `<Icon>` 字符串、dist 无字体请求），已接入 `npm run check` |
| 许可 | 新增 `THIRD-PARTY-LICENSES.md`（Lucide ISC + Morphicons MIT + Simple Icons GitHub 路径 CC0） |

实现要点：

- `Icon` 对未知/缺失名称回退到 `sparkles`，保证翻译内容缺 icon 键时静态构建不崩；
- 动态 HTML（复制按钮、音效、模式列表等）统一用 `renderIconSvg(iconData)` 生成字符串，避免 `<Icon>` 标签留在客户端字符串里；
- 图标检查失败会阻断 `npm run build`。

## 2. 工具卡（A + C）

保留现有容器 / 3 列网格 / 金色语言，只重做卡片内部（`src/components/ToolCard.astro` + `src/styles/cards.css`）：

- **A · Icon Spotlight（默认）**：46×46 暖金图标砖（24px/1.75 描边）、标题 16.5/600、描述 2 行截断、最多 2 个标签、30px 圆形箭头取代重复 76 次的「立即使用」；hover 上浮 4px + 金色发丝边 + 图标砖金渐变（墨色图标）+ 箭头右移 + 指针跟随柔光（`shared.ts` 委托，`prefers-reduced-motion` 关闭）。
- **C · 精选卡**：`tools.ts` 新增 `featured` / `badge` / `preview` 字段；首页三类各 1 张（JSON 格式化、M3U8、专注航班），跨 2 列、52px 图标、长描述 3 行、16:9 真实截图、金色 CTA（墨字，对比 ≥5.4:1）。
- **移动端紧凑行（≤640px）**：网格合并为一张列表卡，每行 78px（38px 图标 + 单行标题/描述 + chevron），76 卡滚动高度约 15,000px → 约 6,000px。
- 新增 `badge: 'new'` 给最近新增工具（M3U8 / FPS / 专注航班 / 拼豆 / 人格 / 头像），仅"新"标记，不伪造热度。
- 保留 `.tool-card` 类名与整卡链接，搜索过滤、reveal 动画、浏览器测试选择器不变。
- 原型与实测见 `output/ui-beautify/cards/`（A/B/C 对比、实测尺寸、对比度表）。

## 3. 品牌标记

- 沿用原 `public/clover-logo.svg`（512×512 金色四叶草，径向渐变 + 叶茎），全站 header / hero / 404 / about / favicon / JSON-LD 共用；
- `src/components/CloverMark.astro` 内联同一套图形，供专注航班登机牌使用；
- 2026-10-25 已回滚 v2 初版的几何 32×32 重绘（原稿曾新增 `public/clover-logo-mono.svg`，现一并删除）；
- 几何稿与旧版对比保留在 `output/ui-beautify/brand/`，仅作历史记录。

## 4. 客观缺陷修复

1. 指南索引 hero H1 显式 `#fffaf0`（原深色字压深色底 1.07–2.73:1）；
2. 移动端分类头改为两行网格（标题+计数 / 说明+查看全部），不再竖排折行；
3. reveal 加 1.2s watchdog + load 兜底，打印/截图/JS 异常不再整片空白；
4. 对比度：`--text-tertiary` 浅色 `#7a7362`、深色 `#8f8871`，新增 `--link: #8a6d35`，主按钮改金底墨字（原白字 2.24:1），首页 tab 选中态改墨字；
5. 页头/页脚不再透传工具页的 1280 容器，导航时品牌不再横移。

## 5. 验收

- `npm run build`：**通过**（184 tests / 453 页 / 132 sitemap / 内容·链接·SEO·发布商·emoji·icons 检查全绿，2026-10-25 本地）；
- `npm run check:browser`：**265 个浏览器场景全部通过**（五语、深色、320/390 溢出、FPS/HLS 回归）；
- 图标门禁：`node scripts/check-icons.mjs` 通过（535 个源文件、217 个注册图标、207 个引用名；dist 无图标字体请求、无残留 `<i class="bi">`）；
- 移动端首页总高：**6252 CSS px**（改造前 15110，约 −59%）；首张卡在 685px 处完整可见；320–1440 无横向溢出；
- 首页体积：HTML gzip **20.8KB**（改造前线上 15.2KB，+5.6KB），同时移除 **134KB** woff2 预加载与 9.6KB vendor CSS；每页 morph element 约 11.2KB gzip（仅在有交互图标的页面加载）；
- 视觉验收截图：`output/ui-beautify/final-shots/`（首页桌面/移动/深色、分类页、工具页、指南索引与正文、关于、404）；
- 已知边界：C 精选卡的截图来自浅色文章素材，深色模式下预览图偏亮；后续可补深色素材；复制/播放等其余动态图标目前用内联 SVG 状态替换，尚未全部改为 Morphicons 形变。
