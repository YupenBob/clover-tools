# Bing / Google 自动提交

更新：2026-10-05。这里的 GA 指 GitHub Actions，不是 Google Analytics。

工作流：`.github/workflows/search-submission.yml`。Bing 和 Google 是独立任务，单个引擎失败不会阻止另一个提交。无需重新构建网站，始终读取正式域名已经公开的 sitemap，避免把未上线或 noindex 的地址推送给引擎。

## 触发与结果

| 触发 | 行为 |
| --- | --- |
| 每日定时 | UTC 01:00，即北京时间 09:00；GitHub 调度可能延迟 |
| 正式部署通过 | `Quality checks` 的 main / push 运行成功，且提交仍对应当前 main 时提交 |
| 修改提交脚本或工作流 | 在 main 上立即检查并提交当前已发布 sitemap |
| 手动 | Actions → Search engine submission → Run workflow，选择 main |

每次读取 `https://clovertools.cn/sitemap-index.xml`，递归收集子 sitemap，校验同源、无查询参数、无片段与当前收录策略。Bing 批次最多 10000 个 URL；两种提交都有超时、有限重试和 429 等待。结果显示在 Action Summary，JSON 报告保存为 artifact 7 天；失败退出非零。Google 尚未配置时显示“未配置，未提交”，不把跳过当作提交成功。

## Bing / IndexNow

已有 `public/0bc8551f6fe630e1f74bb9e3385b0b86.txt`，无需额外 Secret。脚本先确认正式域名上的 key 文件与仓库一致，再向 `https://api.indexnow.org/indexnow` 提交 sitemap 中的规范 URL。IndexNow 会与 Bing 等参与引擎共享通知。

HTTP 200 表示请求接受；202 表示接受并等待 key 验证。两者都不能证明抓取、收录或排名。每日会重新提交当前允许收录的公开 URL；只有网站内容发生变化时才通常需要通知，但定时提交按本工作流需求保留。

本地可在网络允许的环境执行 `npm run indexnow`，不依赖 `dist/`。协议参考：[IndexNow 文档](https://www.indexnow.org/documentation)。

## Google Search Console 设置

Google 对普通工具页使用 Search Console 的 **sitemap 提交接口**，不调用已停用的 sitemap ping，也不使用仅适用于 JobPosting / BroadcastEvent 的 Indexing API。提交 sitemap 不能强制收录全部页面。

1. 在 [Search Console](https://search.google.com/search-console) 验证站点属性。推荐域名属性 `clovertools.cn`，按指引添加 DNS 验证记录；已有验证则无需重做。
2. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建或选择项目，进入 API 与服务，启用 **Google Search Console API**。API 控制台入口：[Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com)。
3. 进入 IAM 与管理 → 服务账号，创建一个服务账号；无需为该账号添加项目级管理角色。打开该账号的“密钥”→ 添加密钥 → 创建新密钥 → JSON。
4. 将 JSON 中的 `client_email` 添加到 Search Console 对应站点的“设置 → 用户和权限”，授予 **完全权限**。只读权限不能提交 sitemap。
5. 在 [仓库 Repository secrets](https://github.com/YupenBob/clover-tools/settings/secrets/actions) 新建 `GOOGLE_SERVICE_ACCOUNT_JSON`，值为完整 JSON 文件内容。不要作为普通 Variable，也不要提交 JSON 文件或把内容发到聊天里。
6. 如果站点使用的是 URL 前缀属性而非域名属性，在 Actions **Variables** 添加 `GSC_SITE_URL=https://clovertools.cn/`。域名属性默认 `sc-domain:clovertools.cn`，无需额外变量；名称必须与 Search Console 中已有的属性完全一致。
7. 打开 Search engine submission 手动运行，确认 Google 任务真正执行“Submit live sitemap to Search Console”，Summary 显示 submitted，HTTP 200 / 204；之后由每日任务和部署事件自动提交。

服务账号私钥仅用于签名短期 JWT，令牌只发送给固定 Google OAuth 和 Search Console 端点，不写入报告。所需 OAuth scope 为 `https://www.googleapis.com/auth/webmasters`，接口为 `PUT /webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}`。

官方说明：[Sitemaps.submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)、[服务账号 OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)、[Indexing API 适用范围](https://developers.google.com/search/apis/indexing-api/v3/using-api)。方法与权限也按 Google 官方 [API discovery 定义](https://github.com/googleapis/google-api-go-client/blob/main/webmasters/v3/webmasters-api.json) 核对。

## 验证与排障

`node --test scripts/tests/search-submission.test.mjs` 验证 sitemap 与 noindex 边界、批次、递归限制、限流重试、Google JWT 签名和真实接口请求形状，完全离线，不使用生产凭据。

- Google 显示未配置：添加上面的 Repository Secret，再手动运行。
- Google HTTP 401：检查服务账号 JSON 是否有效、密钥是否已撤销。
- Google HTTP 403：检查 API 是否启用、服务账号是否拥有该 Search Console 属性的完全权限，以及 `GSC_SITE_URL` 是否匹配。
- Bing key 验证失败：确认 key 文件在正式域名可公开访问，内容与文件名一致。
- HTTP 429 / 5xx：自动有限重试；持续失败时查看 Summary 并稍后重跑相应失败任务。

自动提交结果与搜索引擎实际收录数据分开判断。真实曝光、点击和索引问题仍需在 Bing Webmaster Tools / Search Console 中查看。
