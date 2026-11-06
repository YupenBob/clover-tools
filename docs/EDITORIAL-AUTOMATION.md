# 自动化内容流水线（运行契约与质量标准）

本文是 CloverTools 定时内容流水线的唯一运行手册：定时任务、人工手动运行、以及未来的维护者都按本文执行。
流水线状态保存在 `.editorial/`（gitignored）；文章数据落在 `data/editorial-guides/`，索引由
`src/lib/guides-auto.ts` 生成。

- 建立日期：2026-11-01
- 当前策略：**站内 `/guides/`；每天 3 篇（Asia/Shanghai 06/12/18）；自动推送 `main` 上线**（可改 `publishMode`）
- 决策依据：[CloverTools 推进策略](STRATEGY.md)、[AdSense 与 SEO 整改记录](ADSENSE-SEO-REMEDIATION.md)、
  [内容审计结论](#零为什么需要这套流水线)

## 零、为什么需要这套流水线

2026-11-01 的只读审计结论：技术 SEO 合规（464 页构建、142 条可收录 URL、189 项测试全绿），但内容质量未达增长要求。

| 证据 | 数值 |
| --- | --- |
| 站内指南正文 | 36 篇中位数 573 汉字，72% < 800，0 篇 ≥ 1500；16 篇旧指南平均 295 字 |
| 结构/信任 | 全站 0 个 `<h3>`；16/36 无配图；16/36 无正文内链；36/36 作者只有 Organization；35/36 从未更新 |
| 覆盖 | 33/77 工具有指南，44 个工具零指南 |
| CSDN | 137 篇正文中位数 181 汉字，21 篇占位，0 篇外链引用；`csdn-check` 的 ≥800 字校验依赖 manifest 虚高字数，只覆盖 20/137 |
| 需求数据 | `data/keywords.json` 824 条里仅 2.4% 有 volume 字段（且值为 "low"）；仓库内无 GSC 数据 |
| 平台判定 | AdSense 已判定站点 "Low value content"（见整改记录） |

官方口径（2026 年最新，链接见文末）：Google 把"规模化生成、不以帮助用户为目的的内容"列为
scaled content abuse；AI 内容本身不违规，但要求人工事实核对、不得伪造作者；AdSense 复制内容政策明确
不接受"未经人工审核或策划的自动生成内容"。因此本流水线的设计目标是**用可验证、可回滚的门禁生产单篇高质量文章**，
而不是提高产出速度。

## 一、角色与触发

| 角色 | 职责 |
| --- | --- |
| Lead（本会话） | 定时触发持有者：取题、派活、执行确定性门禁、构建、提交/推送、部署验证、回滚、整队 |
| Writer 子代理（fresh） | 研究 + 起草 `guide.json`、`evidence.json`、可选截图用例；只写 `.editorial/drafts/<slug>/` 与 `scripts/editorial/cases/<slug>.mjs` |
| Reviewer 子代理（fresh） | 对抗式独立复核：逐条核对断言与证据、检查同质化与夸大，输出 `review.json` |
| 确定性脚本 | 队列/槽位、静态质量规则、来源抓取、图片登记、barrier 生成、构建、部署验证、回滚 |

触发方式：
- `schedule_create` 一次性创建的任务：cron `0 6,12,18 * * *`（Asia/Shanghai）。投递会恢复冷会话并启动**一轮**模型 turn；不能创建 goal，所以单轮内必须完成全部步骤（重活交给子代理）。
- 人工手动：用户说"跑一次内容流水线"，按本文以 `manual` 槽位执行同一契约。
- 暂停：`mkdir -p .editorial && echo '{"reason":"..."}' > .editorial/PAUSED`；恢复：删除该文件。
- 终止定时任务：`schedule_delete(<id>)`（先 `schedule_list` 查 id）。

## 二、目录与状态布局

```
.editorial/                     # 本地状态，gitignored
  config.json                   # 阈值/开关（见 config.mjs DEFAULT_CONFIG）
  queue.json                    # 选题队列（状态机）
  state.json                    # 连续失败、每日计数、最近运行
  PAUSED                        # 暂停开关
  locks/<date>-<slot>/          # 槽位幂等锁（重复投递直接退出）
  drafts/<slug>/                # writer 草稿：guide.json / evidence.json / captures.json / images/
  runs/<runKey>.json            # 当前运行记录（report.mjs 结构）
  runs/<runKey>/                # 运行产物：sources.json / review.json / verify.json / apply.json / 日志
  gsc/*.csv                     # 人工放入的 Search Console 导出
  secrets/github-token          # PAT（600，gitignored）

data/editorial-guides/<slug>.json   # 文章数据（可提交）
src/lib/guides-auto.ts              # 生成文件（可提交，禁止手改）
scripts/editorial/cases/<slug>.mjs  # 每篇可重跑的截图/验证用例（可提交）
public/article-images/<YYYY-MM>/    # 截图与 captures.json（可提交）
docs/EDITORIAL-AUTOMATION.md        # 本文
```

## 三、质量定义与硬门禁

**文章类型**：`new-guide`（新增 URL）、`upgrade-guide`（升级旧 URL：保留 slug 与 `published`，正文必须变长并重写，`updated` 用真实日期）。

| 维度 | 硬性要求（`verify-article.mjs` + CI `check-guides-quality.mjs`） |
| --- | --- |
| 篇幅 | 正文 ≥1500 汉字（目标 1800–2800，上限 6000）；`readingMinutes = ceil(汉字/400)`（±1 容差） |
| 结构 | H2 ≥5；无 H1；首段 ≤120 字直答；段落 ≥5；至少 1 个列表；至少 1 个表格/图片；有"边界与限制"专节 |
| 来源 | ≥2 条 HTTPS 外部来源，≥1 条官方一手（MDN/RFC/W3C/Node/Chrome 等白名单）；不得引用本站；**每条来源在本次 tick 由 Lead 独立抓取 200** 并记录状态与文本哈希 |
| 内链 | 正文 ≥2 个已登记工具页链接，不得指向未登记路径 |
| 证据 | `.editorial/drafts/<slug>/evidence.json` 至少 5 条断言，类型 `source`/`code`/`run`，各自可回查；来源需已抓取、代码引用需文件与行号有效、运行需 exit 0 且有落盘输出 |
| 去重 | 与站内语料 8-gram Jaccard <0.20、与 CSDN 语料 <0.25；标题相似度 <0.6；slug 唯一；`_meta.primaryQuery` 不得与已发布自动文章重复；同一工具 30 天内最多 1 篇（队列层面控制） |
| 元信息 | title ≤40 汉字且总长 ≤80；description 40–120 汉字；category 属于既有分类；slug 为 ASCII kebab-case；日期真实（published ≤ updated ≤ 今天）；不伪造作者/实测经历；禁止 emoji、占位文本、夸大用语 |
| 图片 | 真实浏览器截图：`<figure>` + `img[width][height][alt]`；登记 `public/article-images/<YYYY-MM>/captures.json`（宽高/字节/SHA-256），CI 逐字节复核；浏览器不可用时降级为"验证表格 + 仓库内 SVG 流程图"，并记录降级原因 |
| 复核 | 独立 Reviewer 子代理 `verdict=pass` 且 `confidence ≥0.7`；阻塞问题清零；Lead 不采信 Writer 自评 |

**证据规范**：正文中每个具体断言（行为、数字、报错、限制）都要能映射到证据包；写不出来就删掉断言。
`_meta` 持久化审计字段：`auto/mode/runId/verifiedAt/reviewerVerdict/reviewerConfidence/primaryQuery`。

**红线**：不伪造作者或 AI 头像（Google 2026-10 明确这是低质信号）；不写 YMYL 建议（医疗/投资/法律结论）；
不承诺安全或收益；不为同一关键词批量造页；不把未审核翻译当新内容发布。

## 四、单次运行契约（Tick Contract）

> 以下命令全部在仓库根执行；Astro 命令需要 `ASTRO_TELEMETRY_DISABLED=1`（沙箱内 `~/.config` 不可写）。
> 任何一步失败都按"失败处理矩阵"回滚并结束，不做降级发布。

0. **守卫**：`cat .editorial/PAUSED` 存在 → 直接结束并说明原因。
1. **准备**：`node scripts/editorial/tick-prepare.mjs --slot auto`。返回 `proceed:false` 时按 `reason` 结束
   （`paused / daily-limit-reached / safety-blocked / worktree-dirty / unsafe-pending-commits / slot-already-run / queue-empty`）。
   成功则拿到 `runKey/date/slot/item/draftDir`，并已原子占用槽位锁、把队列项置为 `in_progress`。
2. **续传**：若 `git log origin/main..main` 还有本流水线的未推送提交 → `node scripts/editorial/push-main.mjs`
   校验作者/允许路径（初始化提交还需 `approve-commit.mjs --sha` 人工批准）后推送；若有待验证部署
   （`runs/<runKey>.json` 的 `deploy.status === 'pending'`）→ 先跑 `deploy-verify.mjs --run <runKey>`，失败则回滚并结束。
3. **写作**：使用 `subagent`（fresh）执行"Writer 任务书"（本会话由 Lead 编排，子代理不持有日程工具）。它只允许写
   `.editorial/drafts/<slug>/` 与 `scripts/editorial/cases/<slug>.mjs`，不得改仓库其他文件、不得运行构建。
4. **来源核验**：`node scripts/editorial/verify-sources.mjs --slug <slug> --run <runKey>`（Lead 自己抓取，不信任 Writer 的抓取结果）。
5. **图片（可选）**：`node scripts/editorial/capture-tool.mjs --slug <slug>` 产生截图与 captures.json；
   然后 `node scripts/editorial/inject-images.mjs --slug <slug>` 把 `[[figure:name|caption]]` 占位符变成真实 `<figure>`。
   浏览器不可用时 Writer 必须改写为表格/SVG 方案并删掉占位符。
6. **独立复核**：`subagent`（fresh）执行"Reviewer 任务书"，把结果写到 `.editorial/runs/<runKey>/review.json`。
   不通过 → **允许 1 轮修复**：Writer 仅修补 blocking 问题与必要的 non-blocking 表述，然后换一个 fresh Reviewer 复审一次；
   复审仍不通过才置 `failed`、清理草稿、写运行记录并结束（防止无限循环）。
7. **落盘与静态门禁**：`node scripts/editorial/apply-draft.mjs --slug <slug> --run <runKey>`。
   它复制图片、登记 captures.json、写 JSON、重建 barrel，并在失败时按快照精确回滚。
8. **综合门禁**：`node scripts/editorial/verify-article.mjs --slug <slug> --run <runKey>`（静态规则 + 证据 + 来源覆盖 + 复核 + 图片哈希 + barrel + 允许路径）。
9. **构建**：`ASTRO_TELEMETRY_DISABLED=1 npm run check:all`（含 189+ 项测试与全部检查）。失败 → 回滚生成物，队列置 `failed`。
10. **提交**：只 `git add` 允许路径（`data/editorial-guides/`、`src/lib/guides-auto.ts`、`public/article-images/`、
    `public/article-assets/`、`scripts/editorial/cases/`），提交信息：
    `content: add guide "<标题>"` / `content: upgrade guide "<标题>"`；作者 `CloverTools Content Bot <content-bot@clovertools.cn>`。
11. **推送**：`node scripts/editorial/push-main.mjs`（校验作者/允许路径/人工批准列表后带 PAT 推送 `main`）。
    保护分支/权限失败 → 推 `editorial/auto/<date>-<slug>` 分支并用 API 开 PR（降级人工合并）。
12. **记录与摘要**：`node scripts/editorial/finish-run.mjs --run <runKey> --status <published|local-commit|failed|reverted> ...`
    写 `.editorial/runs/<runKey>.json`（状态、指标、证据、workflow/生产 URL），同步更新队列与安全计数，并输出对话摘要。
    推送成功后 `deploy.status=pending`，由**下一次 tick 的步骤 2** 轮询 GitHub Actions 与生产页面完成验证；
    失败自动 `rollback.mjs`（revert + push）并暂停。

### 失败处理矩阵

| 场景 | 处理 |
| --- | --- |
| Writer/Reviewer 失败、超时或不合规 | 先走 1 轮修复 + 复审；仍失败则队列 `failed` + `attempts+1`；连续 2 次失败 → 写 PAUSED 并通知 |
| 门禁/构建失败 | 按 `.editorial/runs/<runKey>/apply.json` 快照回滚；main 保持干净；记录日志 |
| 推送失败（网络/鉴权） | 保留本地提交，下一次 tick 续传；连续 2 次 → 暂停 |
| Actions 质量检查失败 | 自动 revert + push；暂停并通知 |
| 生产页面校验失败 | 自动 revert + push；暂停并通知 |
| Host 停机错过槽位 | 不补批量，恢复后只执行最近到期的一次，队列顺延 |
| 工作区脏/分叉/出现允许路径外改动 | 立即中止，不写任何文件 |

## 五、选题与需求数据

**GSC 导入**：把 Search Console「效果 → 查询」和「网页」两个 CSV 导出放到 `.editorial/gsc/`（中英文表头均可），
运行 `node scripts/editorial/import-gsc.mjs --write`。脚本用
`展示 ×(1−CTR)× 排名权重(4–20 名最高)` 打分，映射到工具/指南，生成 `candidate`；
Lead 在 tick 中按分数与理由把 `candidate` 升为 `ready`（不自动盲选），并记录理由。

**无凭证需求层（GSC 的替代）**：在无法接入 GSC API 时，运行
`node scripts/editorial/import-suggest.mjs --write --replace`：从 Bing / Google / Baidu 的公开搜索建议
采集真实搜索短语（免凭证、免登录），与工具注册表、现有指南、CSDN 语料对齐后生成 `candidate`。
规则：过滤品牌词与"xxx 在线/工具/下载"这类工具页导航查询；同一工具只保留最强 2 条变体；
优先级 = 出现的 provider 数 × 120 + 名次权重 + 文章意图 + 覆盖缺口。原始采集留档在 `.editorial/suggest/`。
它只用于"发现候选"，不等同于 GSC 的曝光/点击数据；拿到 GSC 服务账号后可切回真实数据。

**任务配比**：每 3 篇 ≈ 2 篇 `new-guide` + 1 篇 `upgrade-guide`；GSC 显示"现有页面有曝光但点击低"的优先升级现有 URL。

**队列 schema**：`{id,type,status,priority,toolSlug,slug,primaryQuery,angle,source,attempts,lastError,runId,createdAt,updatedAt}`；
状态机 `candidate → ready → in_progress → published | failed | reverted | skipped`。

**种子队列**：`node scripts/editorial/seed-queue.mjs` 写入 16 篇升级 + 20 篇零内容工具新指南（见脚本内清单）。

**停止过度覆盖**：regex/json-formatter/http-tester 已有大量内容，不再新增；同工具 30 天限 1 篇。

## 六、站点信任层（E-E-A-T）

- `/editorial/` 透明页：说明选题依据、AI 辅助写作、独立复核、自动化门禁、来源与纠错方式。
- 指南页展示真实"发布于/更新于"日期，侧栏"内容与验证"卡片链接透明页。
- 作者保持 Organization（不伪造个人作者）；FAQ 富结果已停用，不添加 FAQPage/HowTo 结构化数据。
- AI 辅助披露写在透明页与文章侧栏；不声称"人工亲测"除非有真实运行证据。

## 六·五、GitHub 授权（无需在对话里粘贴 token）

推送需要 `public_repo` 写权限。不要在对话里粘贴 token；使用设备授权：

```bash
node scripts/editorial/github-device-login.mjs --timeout 900
```

1. 按脚本输出在浏览器打开 https://github.com/login/device；
2. 输入脚本给出的一次性代码（形如 `1234-ABCD`）并授权；
3. 脚本自动把 token 写入 `.editorial/secrets/github-token`（600，gitignored），后续 `push-main.mjs` / `deploy-verify.mjs` / `rollback.mjs` 会自动读取。

撤销：GitHub → Settings → Applications → Authorized OAuth Apps → 移除 "GitHub CLI"；或删除 token 文件。
如果设备授权不可用，备选：由维护者在自己的电脑上 `git push`（可导出 `git bundle`），或改用 SSH deploy key（把我们生成的公钥加到仓库 Deploy keys 并勾选写权限）。

## 七、常用命令

```bash
npm run editorial:report      # 队列/运行状态
npm run editorial:gsc         # 导入 GSC（加 --write 落队列）
npm run editorial:seed        # 播种队列
npm run editorial:probe       # 浏览器能力探针
npm run editorial:rollback    # 回滚（需 --slug）
node scripts/editorial/tick-prepare.mjs --slot manual   # 手动准备一次
node scripts/editorial/deploy-verify.mjs --run <runKey> # 补验部署
node scripts/check-guides-quality.mjs                   # CI 门禁（手工复核）
```

## 七·五、首次演练记录（2026-11-01）

- 演练模式：`manual` 槽位、`local-commit`（不推送），用于验证全链路与门禁。
- 选题：`uuid-generator`（零指南工具，priority 90）。
- 结果：**1 篇**，正文 2489 汉字、9 个 H2、1 个表格、5 条来源（4 条一手）、3 个工具内链、39 条证据；
  `npm run check:all` 全绿（467 页、144 条可收录 URL、37 篇指南）；站内/CSDN 8-gram 相似度 0.0006/0.0042。
- 复核过程：第一轮 Reviewer 判 **fail**（4 个 blocking：Node 示例版本矛盾、回环 http 安全上下文、v4 大写变体、证据行号错），
  Writer 修复后第二轮 Reviewer 判 **pass**（confidence 0.84）。这验证了"独立复核 + 一轮修复"的门禁确实能拦住事实错误。
- 已知非阻塞遗留：v7 rand_a 句略含糊、部分证据行号精度、Hash 生成器构造 v3/v5 的说明可更充分，留待后续编辑优化。
- 截图：演练跳过（通过表格满足视觉证据要求）；浏览器探针已通过，后续正式运行按需启用。

## 八、Writer 任务书模板

```
你是 CloverTools 的 Writer 子代理。目标：为 <runKey> 写一篇满足 docs/EDITORIAL-AUTOMATION.md 质量门禁的文章。
选题卡：<tick-prepare 输出的 item JSON>
允许写入：.editorial/drafts/<slug>/ 与 scripts/editorial/cases/<slug>.mjs；其他仓库文件一律不改。
必须产出：
1) guide.json：字段与 Guide 接口一致，另含 _meta:{auto:true, mode, runId, primaryQuery, type}；
   title ≤40 汉字、description 40–120 汉字、readingMinutes=ceil(汉字/400)、published=updated=<今天>、
   content 为可信 HTML（≥1500 汉字、≥5 个 h2、列表、表格或图片、≥2 个工具内链、边界与限制专节）。
2) evidence.json：≥5 条断言，类型 source/code/run 可回查；来源只需列出 URL，由 Lead 抓取核验；
   code 写 `<path>:<line>`；run 写命令、exitCode=0 与 outputs/ 下的真实输出文件。
3) 如需要截图：写 scripts/editorial/cases/<slug>.mjs，默认导出 async ({page, base, shot}) => {...}，
   用 shot(locator, '<name>', {alt, caption, source, purpose}) 记录；正文用 [[figure:<name>|<图注>]] 占位。
禁止：编造作者/亲测经历/来源/数字；写 YMYL 建议；emoji；占位文本；复制现有文章；添加脚本；修改构建配置。
完成后返回 <300 字：文章要点、证据清单、仍有不确定的地方。
```

## 九、Reviewer 任务书模板

```
你是独立 Reviewer。只做对抗式复核，不美化、不代写。输入：
- 草稿 .editorial/drafts/<slug>/guide.json + evidence.json
- 真实抓取记录 .editorial/runs/<runKey>/sources.json
- 质量规则 docs/EDITORIAL-AUTOMATION.md 第三节与 scripts/editorial/lib/quality.mjs
检查：每个具体断言是否有证据支撑；来源是否真能支撑对应说法；是否存在夸大/误导/过时；
内容是否与现有指南或 CSDN 语料同质；结构是否达标；是否出现编造的作者/经历/数据。
输出 .editorial/runs/<runKey>/review.json：
{ "verdict":"pass|fail", "confidence":0.0-1.0, "blockingIssues":[], "nonBlocking":[], "notes":"" }
要求：只要存在一个无法核实的具体断言或误导表述，就 fail 并写清位置。
```

## 十、官方依据与参考

- [Google 垃圾政策：scaled content abuse（2026-08-28）](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google：使用生成式 AI 内容（2026-10-01）](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google：创建有帮助的、以人为本的内容（2026-10-05）](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google 搜索排名系统总览（2025-12-10）](https://developers.google.com/search/docs/appearance/ranking-systems-guide)
- [Article 结构化数据（2026-09-08）](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google 发布商政策：复制内容（AdSense）](https://support.google.com/publisherpolicies/answer/11190248)
- [AdSense 内容指南](https://support.google.com/adsense/answer/10015918)
- [Google 搜索更新日志（FAQ 富结果 2026-05-07 停止展示）](https://developers.google.com/search/updates)
- 项目内依据：[内容质量说明](QUALITY.md)、[AdSense 与 SEO 整改记录](ADSENSE-SEO-REMEDIATION.md)、[推进策略](STRATEGY.md)
