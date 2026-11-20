# 工具生产线（每日 00:00 · Codex）

本文是 CloverTools「每日一个中大型工具」流水线的运行手册。它和 [内容流水线](EDITORIAL-AUTOMATION.md) 是两条独立的生产线：内容线写 `/guides/`，工具线写 `/tools/` 并直接发布到 `main`。

- 建立：2026-11-15
- 触发：systemd timer，每天 **00:00 Asia/Shanghai**（服务器 UTC 16:00）
- 运行体：`scripts/tool-pipeline/tick.mjs`
- 早报：DSH 每天 08:00 只读检查，不参与构建
- 模型：默认 `gpt-6.1-sol`；修复轮 `gpt-6.1-sol`（Astra 额度不足时回退）；复核 `gpt-6.1-terra`

## 零、目标与边界

**目标**：每晚由 Codex 在独立 worktree 中完成一个中大型工具（对标 FPS 练枪 / 专注航班 / 背单词 / M3U8 下载器的完成度），通过确定性门禁与独立复核后直接 push `main`；不合格不发布。

**非目标 / 硬边界**

- 不承诺“每晚必然发布”。05:30 硬截止；未过门禁就保留 worktree、不发布。
- 不做账号封禁预测；只做网络可达性测量。
- 不做真正的 NTP；用 HTTP 校时 + RTT 误差标注，文案不得宣称 NTP 级精度。
- 默认不新增运行时依赖；不修改 `package.json` / `package-lock.json`。
- 不动内容流水线、`config/routes.mjs` 收录策略、`public/_headers` CSP、`.github/workflows`、`legacy/`。

## 一、触发与调度

### systemd（主触发）

```bash
bash deploy/systemd/install.sh
systemctl list-timers clovertools-tool-pipeline.timer
```

- `OnCalendar=*-*-* 00:00:00 Asia/Shanghai`；`Persistent=true`（停机后会补跑）。
- 06:00 后再补跑会被 tick 守卫跳过，避免和内容流水线冲突。
- 日志：`journalctl -u clovertools-tool-pipeline.service` 与 `.editorial/tool-runs/nightly.log`。
- 暂停：`mkdir -p .editorial/tool-pipeline && echo '{"reason":"..."}' > .editorial/tool-pipeline/PAUSED`；恢复：删除该文件。
- 停用：`sudo systemctl disable --now clovertools-tool-pipeline.timer`。

### DSH 早报（只读）

```text
schedule_create:
  title: "CloverTools 工具流水线早报"
  cron: 0 8 * * * （Asia/Shanghai）
  prompt: cd /home/ubuntu/Clovertools && node scripts/tool-pipeline/tick.mjs --report --verify
```

早报只读 `--report`/`--verify`：检查 CI、生产 5 语言页面与 API，必要时自动 revert；不重跑构建、不改文件。

## 二、目录与状态

```
scripts/tool-pipeline/
  tick.mjs                 # CLI：run/dry-run/report/verify/resume
  nightly.sh               # systemd 入口（env、flock、nice、日志）
  verify-later.sh           # 推送后轮询 CI/生产，直到 verified/reverted
  config.mjs               # 配置读取
  backlog.json             # 选题源（committed）
  specs/<slug>.md          # 选题卡（committed）
  templates/{architect,builder,repair,verifier}.md
  lib/{state,select,prompt,codex,diff-guard,gates,publish,verify-deploy,incident,report,git}.mjs
  update-tool-counts.mjs   # README 计数确定性更新/检查
deploy/systemd/            # service + timer + install.sh
scripts/smoke-tool.mjs     # 单工具 5 语言浏览器回归
scripts/lib/tool-pipeline-cases.mjs
scripts/lib/tool-cases/<slug>.mjs  # 每工具浏览器用例（Builder 产出）
scripts/tests/tool-pipeline.test.mjs
scripts/tests/functions-http.test.mjs
functions/lib/http.ts      # 网络工具共享助手
tsconfig.functions.json
docs/TOOL-PIPELINE.md      # 本文

.editorial/tool-pipeline/  # gitignored：queue.json/state.json/PAUSED/locks
.editorial/tool-runs/<runKey>/
  run.json report.md spec.md gates.json review.json incident.md
  logs/ screenshots/ schemas/
.editorial/tool-worktrees/<runKey>/  # 独立 worktree（失败时保留 7 天）
```

## 三、单次运行契约

| 阶段 | 预算 | 做什么 | 失败处理 |
| --- | --- | --- | --- |
| 0 守卫 | 5 min | PAUSED、主 checkout 干净、main 与 origin 同步、无未推送内容提交、磁盘 ≥5G、负载等待 ≤10min、codex 登录、gh 登录、补跑窗口 | `skipped`/`paused`，退出 0 |
| 1 选题 | 1 min | runtime queue 取最高优先级 `ready`；已在 registry 自动 published；秘密策略检查 | 队列空→报告 |
| 2 worktree | 2 min | `.editorial/tool-worktrees/<runKey>` ← `origin/main`，软链 `node_modules`/`.playwright-browsers`/`.env` | 清理退出 |
| 3 Architect | 35 min | Codex read-only 产出 spec.md（含用户/功能/边界/文件/测试/验收/i18n/SEO/隐私） | lint 失败重试 1 次；仍失败→`stalled` |
| 4 Builder | 165 min | Codex workspace-write 写实现；不 commit/push/装依赖 | 超时/失败→`failed`，保留 worktree |
| 5 Diff guard | 15 min | 默认拒绝：白名单外、删除、重命名、包文件、大文件、密钥、TODO/占位、emoji、eval | 违规→不发布 |
| 6 Gates | ≤150 min | `npm test` → `npm run build` → `smoke-tool` → 结构/清单检查 | 修复轮 1 次（`gpt-6-astra`）后重跑 |
| 7 Verifier | 30 min | Codex read-only + 截图，输出 JSON rubric | fail→修复轮 1 次→复审 |
| 8 发布 | 10 min | commit 白名单 → 主 checkout `merge --ff-only` → `git push origin main` | push 失败→主 checkout reset 回 base、保留 worktree |
| 9 收尾 | 10 min | `run.json`/`report.md`、队列/状态、删除 worktree（成功）、记录待验证 SHA | — |

硬截止：`tool-pipeline.config.json` 的 `budget.maxTotalMinutes=330`；超过即 `stalled`，不发布。

### 模型与沙箱

| 角色 | 模型 | reasoning | 沙箱 | 超时 |
| --- | --- | --- | --- | --- |
| Architect | `gpt-6.1-sol` | high | read-only | 35m |
| Builder | `gpt-6.1-sol` | high | workspace-write | 165m |
| Repair | `gpt-6.1-sol`（`gpt-6-astra` 额度不足时回退） | high | workspace-write | 45m |
| Verifier | `gpt-6.1-terra` | medium | read-only | 30m |
| Propose | `gpt-6.1-terra` | medium | read-only | — |

模型、超时、预算都在 `tool-pipeline.config.json`；改模型不需要改代码。

### worktree 与主 checkout

- Builder 只在 worktree 写；主 checkout 全程干净，内容流水线 06:00 tick 不受影响。
- 发布时先确认主 checkout 干净且 `HEAD == base`、`origin/main == base`，再 `merge --ff-only` 并 push；否则中止、保留 worktree。
- 失败时 worktree 保留在 `.editorial/tool-worktrees/<runKey>/`，可手动检查或用 `--resume <runKey>` 续跑。

## 四、质量门禁

### 确定性门禁

```bash
npm test                       # tsc: fps/hls/tools/functions + node --test
npm run build                  # tests + 搜索索引 + 译文清单 + 工具语言清单 + astro build + npm run check
node scripts/smoke-tool.mjs --slug <slug> --category <cat>
node scripts/tool-pipeline/update-tool-counts.mjs --check
```

`npm run build` 内含：内容关联、SEO 元数据、指南质量、链接、页面 SEO、发布商、emoji、图标、README 计数。

### 结构检查（`lib/gates.mjs`）

- 5 语言构建产物存在且 `html lang` 正确、title/description/canonical 非空、无 noindex。
- `dist/sitemap-0.xml` 含 5 个 URL。
- `data/i18n-tool-pages.json` 含 5 语言。
- `src/lib/tools.ts`、`tool-seo/<cat>.ts`、`tool-content.ts`、`tool-details.ts` 已登记。
- `src/lib/i18n/{en,ja,ko}.json` 都有 `tools.<slug>` 与 `content.<slug>`。
- `scripts/gen-search-index.mjs` 有 alias；`tsconfig.tools.json` 纳入新文件；`public/search-index.json` 含新工具。
- 单测 ≥3 个 test、≥5 个 assert、无 skip/todo；浏览器用例存在且导出 `run`。
- `docs/<TOOL>.md` 存在且提到 slug；README 计数一致。
- 网络工具：`functions/api/<slug>.ts` 存在且有 `onRequest`。

### 独立复核

`gpt-6.1-terra` 只读，附 5 语言截图，输出：

```json
{
  "verdict": "pass|fail",
  "confidence": 0.0,
  "blockingIssues": [],
  "nonBlocking": [],
  "rubric": {
    "features": 0.9, "interaction": 0.85, "a11y": 0.8, "i18n": 0.85,
    "tests": 0.8, "honesty": 0.95, "security": 0.9, "docs": 0.8,
    "maintainability": 0.85
  },
  "notes": ""
}
```

通过条件：blocking 为空、confidence ≥0.8、没有 rubric 项 <0.6。存在的具体功能缺失、事实错误、伪造断言、5 语言缺失、测试造假、网络安全缺陷都必须 fail。

## 五、发布、验证与回滚

- 提交作者：`CloverTools Tool Bot <tool-bot@clovertools.cn>`；信息 `feat(tool): add <name> (<slug>)`。
- 推送后 `run.publish.status=pushed`，`run.verify.status=pending`。
- `nightly.sh` 在 tick 成功后自动执行 `verify-later.sh`：每 60s 调一次 `--verify`，最多 25 次（约 25 分钟），直到结果落定。
- `--verify` 的判定顺序：
  - 只认 `config.verify.qualityWorkflow`（`Quality checks`）的 run；同 SHA 的其它 workflow（crawler audit、search submission 等）不参与判定，避免被无关的 skipped/failed workflow 误触发 revert。
  - 该 workflow 未开始/未完成→pending，继续轮询。
  - quality 失败→自动 `git revert` + push + `PAUSED`。
  - deploy job 失败→保留 main（生产仍是旧版本），报告并允许重试。
  - 生产 5 语言页面/API 失败→自动 revert + `PAUSED`。
- 08:00 DSH 早报仍会 `--report --verify`，作为夜间轮询超时（pending/机器关机）后的兜底。
- 不 force-push；revert 是普通提交。

### 异常修复（`--repair-incident`）

推送后 `--verify` 判定为 `ci-failed`/`production-failed`/`reverted` 时，`verify-later.sh` 默认会自动尝试一次异常修复（`AUTO_INCIDENT_REPAIR=0` 关闭）：

```bash
node scripts/tool-pipeline/tick.mjs --repair-incident --dry-run --json  # 只打印计划，不调 codex
node scripts/tool-pipeline/tick.mjs --repair-incident --json            # 修复并重新走门禁/复核/发布
```

- 仅这三个状态可修；`deploy-failed` 属基础设施问题，跳过并交给人工。
- 前置：main 干净且与 origin 同步、磁盘 ≥5G、同一被修 run 的修复次数 < `caps.maxIncidentRepairs`（默认 1）、queue 中 item 存在。verify 失败留下的 `PAUSED` 对异常修复放行。
- 证据写入新 run 的 `incident.md`：失败检查/原因/CI 链接、被回滚提交的 `git show` stat+patch、spec 路径。
- 复用被修 run 的 `plan.md`（历史 run 回退 `spec.md`）跳过 Architect；Builder 使用 `timeoutsMinutes.repairIncident` 并附带「上一次发布失败（必须修复）」章节；门禁、独立 verifier、发布与 revert 流程不变。
- 发布成功后 `verify-later.sh` 继续轮询新结果；修复未发布则按原逻辑退出 1。
- 同一 run 内既往失败修复轮 ≥2 次时，后续 repair 轮升级到 `models.repairEscalation` / `reasoning.repairEscalation`（未配置则回退 `repair`），记录在 `run.repairRounds` 与报告。
- 常规 run 的 Builder prompt 也会自动附上 `item.lastFailure` 摘要；`verified`/`skipped` 后清除。

## 六、失败矩阵

| 场景 | 处理 |
| --- | --- |
| `PAUSED` 存在 | 直接退出 0，报告原因 |
| 主 checkout 脏 / 有未推送内容提交 | 跳过，不写任何文件 |
| 主 checkout / origin 移动 | 若并发提交与工具改动路径完全不重叠：在 worktree 里 `rebase --onto` 新 main 后发布（自动记录 `publish.rebased`）；路径重叠→`main-moved-conflict`，不合并、不推送，保留 worktree |
| codex 未登录 / 额度耗尽 | 写 `PAUSED` 并保留 worktree/spec；额度耗尽时带 `resumeCheck=quota-reset` + `budget.quotaResetHours`（默认 5h）自动解除，避免永久阻塞后续 nightly；额度恢复后 `--resume <runKey>` 继续，不重跑 Builder |
| 异常修复期间额度再次耗尽 | 修复 run 同样 `stalled` + `PAUSED`（quota-reset），worktree 保留，可 `--resume <incidentRunKey>` |
| Architect spec lint 失败 | 重试 1 次；仍失败→`stalled` |
| Builder 超时 | `stalled`，保留 worktree |
| Diff 违规 | 不发布；报告违规路径；`failed`。常见原因：队列把 `apiFile` 指向已上线的 API（只允许新增 `functions/api/*.ts`）——应为每个网络工具新建独立端点 |
| Gates 失败 | 修复轮 1 次；仍失败→`failed` |
| Verifier fail | 修复轮 1 次 + 复审；仍失败→`failed` |
| 主视图契约失败 | guard 阶段契约非法 → 不启动；build 后补验产物与页面各状态；缺配置（无 legacy 豁免）→ `failed`，见 `docs/PRESENTATION.md` |
| push 失败 | 主 checkout reset 回 base；worktree 保留；`failed` |
| CI quality 失败 | 自动 revert + `PAUSED`；`verify-later` 默认再尝试 1 次 `--repair-incident`（`AUTO_INCIDENT_REPAIR=0` 关闭） |
| deploy job 失败 | 不 revert；报告；允许重试；**不**触发异常修复 |
| 生产页面/API 失败 | 自动 revert + `PAUSED`；随后默认尝试 1 次 `--repair-incident` |
| 异常修复未发布 / 前置检查不通过 | 不污染 main（沿用原失败/revert 路径），`verify-later` 退出 1 |
| 同一被修 run 超过 `caps.maxIncidentRepairs` | 跳过自动修复，交人工处理 |
| Functions 返回 502/504 | 该 zone 的边缘会把 502/504 换成通用错误页（正文 `error code: 502`），客户端拿不到结构化 JSON。网络工具的“上游不可用/超时”统一用 **503**；新增 API 不要用 502/504 表示业务失败 |
| 推送后 CI/部署 25 分钟内未落定 | `verify-later` 退出 2 并保留 pending，08:00 早报复检 |
| 浏览器用例对异步 UI 直接断言 | 用 `poll` 等到状态/存储落定再断言；`<dialog>` 关闭后应用才落盘，`confirm()` 返回不代表动作完成 |
| 连续 2 次失败/停滞 | 写 `PAUSED`，早报提示人工处理 |
| 补跑窗口已过（≥06:00） | 跳过，避免与内容线冲突 |

## 七、选题与队列

- `scripts/tool-pipeline/backlog.json` 是 committed 选题源；运行时状态在 `.editorial/tool-pipeline/queue.json`。
- 状态机：`ready → in_progress → published | failed | stalled | skipped`。
- 选择规则：priority 降序；已在 `src/lib/tools.ts` 的 slug 自动 published；同 slug 冷却 30 天；`secretPolicy=required` 且缺密钥时跳过。
- 失败项 `attempts < maxAttempts` 可再次被选中；`stalled` 只允许 `--resume` 手动续跑。
- 队列低于 5 条时启用 `--propose`（后续阶段）：read-only Codex 从竞品缺口/关键词/建议数据生成候选，确定性去重后进入 `candidate`，不自动发布。
- 首批选题：exam-clock / focus-timer / time-sync / ip-reputation / service-reachability / json-to-sql / image-convert / image-compress / wcag-contrast / http-status / mime-types / image-palette / ulid-generator / text-stats / color-blindness / favicon-generator / image-to-ascii。

## 八、网络/API 工具契约

- 只放 `functions/api/<slug>.ts`；共享助手 `functions/lib/http.ts`。
- SSRF：固定 host allowlist；拒绝 localhost/私网/链路本地/元数据地址/非 http(s)/非 80/443。
- 超时 ≤5s、响应 ≤256KB、重定向 ≤2、缓存 15–60s、结构化错误。
- 密钥只从 `context.env` 读；不落客户端/响应/日志/仓库。
- 无密钥/上游失败必须有降级态；页面写清请求发起方、是否记录 IP、局限。
- 网络工具必须过 `tsconfig.functions.json` + `scripts/tests/functions-*.test.mjs`。
- 密钥配置（示例）：

```bash
npx wrangler pages secret put IPAPI_IS_KEY --project-name clovertools
```

## 九、常用命令

```bash
npm run tool:dry -- --slug exam-clock       # 只打印计划，不写文件/不调模型
npm run tool:run -- --slot manual --slug exam-clock
npm run tool:run -- --slot manual --slug exam-clock --no-push
npm run tool:verify                          # 检查最近一次发布的 CI/生产
npm run tool:report                          # 打印最近报告
node scripts/tool-pipeline/tick.mjs --repair-incident --dry-run --json  # 异常修复计划
node scripts/tool-pipeline/tick.mjs --repair-incident --json            # 异常修复
node scripts/tool-pipeline/tick.mjs --resume <runKey>
npm run tool:counts -- --check
node scripts/smoke-tool.mjs --slug <slug> --category <cat>
```

## 十、首次上线 / 试点

1. 先跑 `npm run tool:dry -- --slug exam-clock`，确认选题、spec、模型、门禁计划。
2. `node scripts/tool-pipeline/tick.mjs --slot manual --slug exam-clock --no-push` 走全流程（不提交），检查报告与截图。
3. 正式 `--slot manual --slug exam-clock` 发布一次，确认 CI + 生产 5 语言页面。
4. 安装 systemd timer（见第一节），确认 `systemctl list-timers` 的 next elapse。
5. 创建 08:00 DSH 早报 schedule。
6. 连续观察 7 天：发布率、门禁失败原因、codex 用量、人工介入次数；必要时调 `timeoutsMinutes`/`models`/backlog。

## 十一、排查

- `journalctl -u clovertools-tool-pipeline.service -n 200`；`.editorial/tool-runs/nightly.log`。
- 最近报告：`.editorial/tool-runs/latest.json` → `report.md`；`gates.json`、`review.json`、`logs/*.jsonl`。
- worktree 保留：`.editorial/tool-worktrees/<runKey>/`；确认主 checkout 干净后可 `git worktree remove --force <path>`。
- 锁残留：`.editorial/tool-pipeline/run-*.lock`（PID 不存活会自动清理）。
- 暂停恢复：删除 `.editorial/tool-pipeline/PAUSED`，处理报告中的阻塞项后再跑。
- 主 checkout 落后 origin（手动 push 后）：`git pull --ff-only`。

## 十二、资源与安全

- 机器 2 vCPU；流水线 `nice 10`、负载守卫、05:30 硬截止，避免和 06:00 内容线争抢。
- 不使用 `--dangerously-bypass-approvals-and-sandbox`；Builder 在 worktree 的 `workspace-write` 沙箱内运行。
- 不把 token 写进仓库；`.editorial/secrets/github-token` 与 `~/.codex/auth.json` 已在忽略路径/用户目录。
- 不自动 force-push；不自动改 CI/依赖/内容策略。
