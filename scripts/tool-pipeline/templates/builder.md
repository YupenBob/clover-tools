你是 CloverTools 的 Builder。目标：在当前 git worktree 中按下面这份**已批准的 spec** 实现一个中大型、可发布的工具。

## 选题

```json
{{TOOL_JSON}}
```

## 已批准 spec

{{SPEC}}

## 仓库与工作区

- 你已经在 `/home/ubuntu/Clovertools` 的独立 worktree 中；只改这个 worktree。
- 先读 `README.md`「添加工具（精品制作规范）」、`docs/TOOL-DESIGN.md`、一个近期同类工具、`src/lib/tool-presentation.ts`、`tsconfig.tools.json`。
- 这是生产站点：宁可少一个功能，也不要伪造、占位或半成品。

## 只允许改这些路径

```
{{ALLOWED_PATHS}}
```

以下路径禁止改（违反会被 diff guard 拒绝并整轮作废）：

```
{{FORBIDDEN_PATHS}}
```

## 必须交付

1. **共享组件**：`src/components/<Tool>.astro`（或等价命名），5 个薄路由共用；不要在 5 个页面复制实现。
2. **纯逻辑**：`src/lib/{{SLUG}}.ts`（可加 `{{SLUG}}-*.ts`），输入输出明确、可单测；UI 脚本放 `src/scripts/{{SLUG}}.ts`。
3. **5 个页面**：
   - `src/pages/tools/{{CATEGORY}}/{{SLUG}}.astro`
   - `src/pages/en/tools/{{CATEGORY}}/{{SLUG}}.astro`
   - `src/pages/ja/tools/{{CATEGORY}}/{{SLUG}}.astro`
   - `src/pages/ko/tools/{{CATEGORY}}/{{SLUG}}.astro`
   - `src/pages/zh-hant/tools/{{CATEGORY}}/{{SLUG}}.astro`
   使用 `ToolLayout`，按 spec 选择 `layout`/`workspace`；每页只保留本地化 UI 文案和组件调用。
4. **i18n**：
   - `src/lib/{{SLUG}}-i18n.ts`：5 语言 UI 字典（zh/tw/en/ko/ja），或用现有共享字典并补 key。
   - `src/lib/i18n/en.json` / `ja.json` / `ko.json`：`tools.<slug>` 的 name/oneLiner/description/keywords + `content.<slug>` 的 usage/features；必须与 zh 语义一致，en/ko/ja 不得残留整段中文。
   - tw 走 `chinese-s2t`，页面文案用繁体。
5. **注册与内容**：`src/lib/tools.ts`、`src/lib/tool-seo/{{CATEGORY}}.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`（zh/tw 深度说明：步骤/示例/原理/误区/FAQ/隐私，满足 `config/quality.mjs` 的 steps/examples/faqs 下限）、必要时 `src/lib/icons/registry.ts`。
6. **测试**：
   - `scripts/tests/{{SLUG}}.test.mjs`：≥6 条真实断言，覆盖纯逻辑、边界、非法输入、极端值；禁止 skip/todo。
   - `scripts/lib/tool-cases/{{SLUG}}.mjs`：导出 `run({ run, remember, base, artifacts })`；覆盖 5 语言核心流、非法输入、移动端 360px、深色、CSP、无 pageerror；用 `localizedPath` 构造 URL；用 `shot`/screenshot 保存关键界面到 artifacts。
7. **网络工具**（仅当 spec 声明网络）：`{{API_FILE}}` + `functions/lib/*.ts`；前端只调 `{{API_PATH}}`；遵守下方网络契约；无密钥/上游失败必须有降级态和测试；本地预览不跑 Functions，浏览器用例必须 mock。
8. **集成**：`scripts/gen-search-index.mjs` 增加 alias；`tsconfig.tools.json` 增加新 lib/scripts；`docs/<TOOL>.md` 写功能、边界、隐私、验证记录；不要改 README 计数（流水线会确定性更新）。
9. **搜索/SEO**：标题含 “ - CloverTools” 且总长 50–60 字符；meta description 150–160 字符；关键词自然，不堆砌。
10. **文档**：`docs/<TOOL>.md` 必须说明与现有工具的差异、数据边界、测试命令。

## UI 质量底线

- 空态/错误态/加载态/成功态齐全；非法输入给具体原因并禁用结果/复制。
- 复制/清空/示例（适用时）；Ctrl/Cmd+Enter 快捷执行（适用时）。
- 键盘可达、焦点可见、aria-live；移动端 360px 无横向溢出；深色主题对照度足够。
- 不使用 emoji；不新增外部图片/字体/脚本；CSP 兼容（无 eval/内联事件）。
- 不伪造“实测”“官方”“保证”；网络工具写清请求发起方与降级。

## 网络契约

{{NETWORK_RULES}}

## 运行限制

- 不要 `git commit`、`git push`、`git add`；不要改 `.github/`、`package.json`、`package-lock.json`、`public/_headers`、`wrangler.toml`。
- 不要 `npm install`、不要新增运行时依赖（除非 spec 已批准并明确写出）。
- 不要运行 `npm run build` 或 `npm run check:browser`（Lead 会跑）；可运行：
  - `npx tsc -p tsconfig.tools.json`
  - `npx tsc -p tsconfig.functions.json`（网络工具）
  - `node --test scripts/tests/{{SLUG}}.test.mjs`
- 遇到不确定的事实，删掉断言或写“未验证”，不要编造。

## 完成后返回（≤300 字）

1. 新增/修改的文件清单；
2. 已运行的自检命令与结果；
3. spec 中未完成或不确定的点；
4. 你认为最容易被 Reviewer 挑出的 3 个风险。
