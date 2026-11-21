# 主视图契约（presentation contract）

工具必须声明一个 **primary mode**：用户打开页面后最快完成核心任务的画面。契约保证"投影/大屏场景下屏幕上只有声明过的东西"。


`interaction.shortcuts` 一律是「按键 → 动作」（如 `"S": "settings"`、`"F": "fullscreen"`、`"Escape": "exit"`），值必须是动作名；schema 用 `propertyNames` 校验按键名、`additionalProperties` 校验动作名，校验器两者都检查。共享 runner 的 `shortcutFor(config, action)` 按值反查键位。

## 文件与单一来源

| 文件 | 作用 |
| --- | --- |
| `config/presentation-policy.json` | 可信基线：profile（`projector` / `workspace`）、槽位与控件上限、字号/亮度下限、允许的状态与绘制面、legacy 试运行名单 |
| `config/schemas/tool-presentation.schema.json` | 严格结构：拒绝未知键、非法枚举、重复 id、无约束通配 |
| `data/tool-presentation/<slug>.json` | 每个工具的声明：槽位、控件、外观、交互、状态矩阵、绘制面、i18n key |
| `data/tool-presentation/acceptance.json` | 验收凭证：哈希绑定 policy/schema/checker/fixtures；tick 自动恢复暂停时校验 |
| `scripts/tool-pipeline/lib/presentation.mjs` | 加载 + 校验（未知键/越界/引用不存在即 fail；无 per-tool 分支） |
| `scripts/lib/presentation-check.mjs` | 浏览器扫描器：可见文本、可交互元素、可绘制载体、背景亮度、滚动 |
| `scripts/lib/presentation-cases.mjs` | 通用验收用例（first-load/primary/reveal/settings/degraded/fullscreen），被单工具 smoke 与 CI 共用 |

配置只能**收紧**基线，不能放宽或关闭检查；改 policy/schema/checker 属于共享依赖变更，会让 acceptance 凭证失效并触发重跑。

## 状态矩阵

- `firstLoad`：禁用 JS 的 SSR 快照也必须满足 primary 白名单（HTTP 200 + 根节点带 `data-presentation-state`）。
- `primary`：只有声明槽位与声明控件；其它文本/控件/绘制面一律失败。
- `reveal`：鼠标/键盘/聚焦主动唤出控制层；`autoHideMs` 后自动回到 primary（测试用 fake clock 推进）。
- `settingsOpen`：隐藏面板打开态，可显示说明文字，但仍不得出现未声明的绘制面或控件；关闭后必须回 primary。
- `degraded`：校时失准、Wake Lock 被拒等异常不得打断投影，可见内容不得增加（aria-live 保留可查知）。
- `fullscreen`：`data-presentation-mode="fullscreen"` 或 `"fallback"`（requestFullscreen 被拒时）。

## 门禁接入

1. 流水线 guard：`validatePresentationContract` 失败即不启动 Codex。
2. 管线 gates（build 后）：`requireManaged`（本轮工具必须有配置，无 legacy 豁免）+ 全量契约校验。
3. 单工具 smoke 与 CI（`smoke-growth` → `tool-pipeline-cases`）：同一套 `runPresentationChecks`；CI 从注册表校验，不依赖用例文件是否存在。
4. 验收：`node scripts/tool-pipeline/accept-presentation.mjs --write` 生成凭证；`--check` 在 CI/恢复前比对哈希。

## 反例（fixture 固定保留）

空白画面、未声明说明文字、SVG `<text>`、伪元素 `content`、背景图、canvas —— 这些都必须让门禁失败，`scripts/tests/fixtures/presentation/manifest.json` 列出清单。

## 红线

- 不写死阈值/译文/工具 slug 判断：阈值在 policy/config，译文走 i18n key，工具差异只在 `<slug>.json`。
- 不靠"删用例/删配置"通过：CI 从注册表反查。
- 不为过门禁隐藏事实：异常仍要可查知（aria-live + 隐藏面板），投影态不弹层、不常驻状态点。
