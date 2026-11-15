# 侧栏访问数据（Traffic snapshot）

更新：2026-11-15。对应首页侧栏「访问数据」卡与 `data/site-traffic.json`。

## 为什么做、口径是什么

首页侧栏展示的访问数据来自 **Cloudflare 边缘统计**（GraphQL `httpRequests1dGroups`），不是第三方计数器，也不是客户端埋点：

| 展示项 | 定义 | 口径与限制 |
| --- | --- | --- |
| 近 7 天页面浏览 | 最近 7 个**完整 UTC 自然日**的 `sum.pageViews` 之和 | 不含当天（进行中）；UTC 自然日原样标注 |
| 日均独立访客 | 这 7 天每日 `uniq.uniques` 的平均值 | 按天近似去重（IP/UA 特征）；**日与日相加不等于跨日去重**，所以用"日均"而非"7 天访客总数" |
| 每 7 天柱图 | 每日页面浏览量的相对高度 | 自绘内联 SVG/CSS，无第三方图表库 |
| 累计访问次数 | 仓库快照中所有已记录完整日的 `pageViews` 之和（含 `seedPageViews`，若有） | 起始日 = 快照第一条日期；**不宣称建站以来**、不把 PV 说成"帮助人数/用户数" |

其它约定：
- 边缘统计**包含搜索引擎与其它爬虫请求**，页面已明确标注；它不是"真人用户数"，也不是工具使用次数。
- 没有可靠历史导出时，累计从 Cloudflare 保留期（当前约 30 天）内的最早完整日开始，并标注"自 … 起"。
- 数据更新超过 48 小时显示滞后提示；超过 14 天不展示数字、回退为"访问数据暂未接入"，**任何情况不填估算值**。
- 页面不加载任何新的第三方脚本、不写 Cookie、不做客户端追踪；隐私政策已补充聚合统计说明。

## 文件与数据流

```
Cloudflare GraphQL API
   └─ scripts/traffic/fetch-cloudflare.mjs   （只在 CI / 本地有 token 时运行）
        └─ data/site-traffic.json            （提交仓库，可审计）
             └─ scripts/check-traffic.mjs    （npm run check 校验 schema/累计一致性）
                  └─ src/lib/site-traffic.ts（构建期派生展示值）
                       └─ src/components/HomeDiscovery.astro（侧栏卡片）
```

`scripts/traffic/schema.mjs` 定义 schema、校验与展示派生（纯函数，单测见 `scripts/tests/traffic.test.mjs`）。

数据文件结构（示例）：

```json
{
  "source": "cloudflare-zone-analytics",
  "generatedAt": "2026-11-15T07:22:43.686Z",
  "timezone": "UTC",
  "includesBots": true,
  "history": [{ "date": "2026-11-14", "pageViews": 4140, "uniqueVisitors": 783, "requests": 15807 }],
  "cumulative": { "pageViews": 48948, "since": "2026-10-15", "seedPageViews": 0 }
}
```

- 刷新脚本按日期 upsert：保留期内缺失的完整日会回填；`cumulative.pageViews` 恒等于 `seedPageViews + Σhistory.pageViews`，由校验强制。
- 历史一旦记录就不删除，因此累计值不会随 Cloudflare 保留窗口滚动而回退。

## 刷新方式

### 自动（推荐）

`.github/workflows/traffic.yml` 每天 01:20 UTC 运行（也可手动 `workflow_dispatch`）：

1. `npm ci`
2. `node scripts/traffic/fetch-cloudflare.mjs`
3. 仅当 `data/site-traffic.json` 变化时提交并推送（`[skip ci]`）。

需要仓库 Secret **`CLOUDFLARE_ANALYTICS_TOKEN`**（只读 token，权限 `Zone → Zone: Read` + `Zone → Analytics: Read`）。
若未配置，会回退使用已有 `CLOUDFLARE_API_TOKEN`（当前 CI 已验证该 token 可读该 zone 的访问统计）。

注意：用 `GITHUB_TOKEN` 推送的数据提交不会触发其它 workflow；线上页面会在下一次正常发布（内容流水线 push）时带上最新快照。需要立即上线时，手动触发一次 `Quality checks`。

### 本地

```bash
# 从 .env 或环境变量提供只读 token（不要提交）
CLOUDFLARE_ANALYTICS_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run traffic:refresh
npm run traffic:refresh -- --dry-run   # 只取数不写文件
node scripts/check-traffic.mjs         # 校验已提交快照
```

`CLOUDFLARE_ZONE_ID` 可省略：脚本会用 `CLOUDFLARE_ZONE_NAME`（默认 `clovertools.cn`）与 token 解析唯一 zone。

## 失败与降级

| 情况 | 行为 |
| --- | --- |
| 无 token / token 无效 | 脚本非 0 退出并提示所需权限；已提交快照不动；页面继续显示旧快照或"接入中" |
| 权限不足（403 / GraphQL 报错） | 报错带 HTTP 状态与 GraphQL 消息，提示配置 `CLOUDFLARE_ANALYTICS_TOKEN` |
| API 5xx / 超时 / 429 | 重试 2 次后失败，不写半成品 |
| 数据为空（新站/无完整日） | 视为不可用，不写 0 假数 |
| 快照损坏/累计不一致 | `npm run check` 失败，阻止发布 |
| 快照超过 14 天 | 页面回退"暂未接入"，不显示可能误导的数字 |

## 为什么不用不蒜子等第三方计数器

第三方计数服务（如 busuanzi）由个人维护、无 SLA/隐私政策、计数口径不可审计、客户端脚本依赖单点域名且历史上多次停服；数字既无法向审核方证明"真实内容价值"，又增加第三方依赖与隐私披露负担。Cloudflare 边缘统计是第一方、服务端聚合、可审计（快照提交在仓库里）的方案。

## 验证记录

- `npm test` 含 `scripts/tests/traffic.test.mjs`（schema、累计一致性、7 天窗口、日均、柱图、过期/缺失降级）。
- `npm run check` 包含 `node scripts/check-traffic.mjs`：缺失快照通过（降级态），损坏快照失败。
- 构建后首页侧栏应出现"访问数据"卡；数字与 `data/site-traffic.json` 一致；无数据时只出现"访问数据暂未接入"。
- 该功能不改变广告开关、不引入广告位；AdSense 是否通过仍由 Google 决定，访问数据仅作为站点透明度补充。
