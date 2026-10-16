# AdSense 与 SEO 整改记录

站点：https://clovertools.cn · 整改完成日期：2026-10-16

Google 没有提供明确拒绝原因，因此以下是依据代码、页面行为和官方规则完成的整改，不是对内部审核原因的断言。AdSense 复审结果仍由 Google 决定。

## 已实施

| 项目 | 处理及验收方式 |
| --- | --- |
| Cloudflare Bot Fight Mode | API 首次读取和再次读取均为 `false`，原本已关闭，未修改其他设置。2026-10-10 10:26:46 UTC 验证。[独立检查记录](https://github.com/YupenBob/clover-tools/actions/runs/38044914563)。正式发布再次验证。 |
| 工具页内容 | 深度说明从 26 份补齐至 76 份：实际步骤、至少两个示例、原理限制、误区、FAQ 与工具输入处理说明。简繁两版输出至静态 HTML；保留 16 篇已有专题指南。检查脚本要求所有工具都有说明。 |
| 功能与文案一致 | 修正 CSV/TSV 与 Excel 导入、XML 转换边界、JSONPath 子集、通用 SQL 排版、RSA-OAEP 加解密、单次油耗、手动效期计算、工资简化估算和目标追踪游戏的说法；对应重点问题同步修正英韩日元信息。 |
| 实际功能问题 | 随机数改为拒绝采样与有界去重，拒绝超范围、非整数和超额数量；JSON 导出校验每一行并清理失败输出；JSONPath 拒绝不支持的条件；油耗校验有限数值并移除错误续航推算；工作日按日历日期计算，补齐普通周末计数，提示未收录年份。 |
| 广告控制 | 默认不加载广告脚本或广告位；保留 Google 支持的站点所有权 meta 及一致的 ads.txt。关闭工具卡片网格里的填充广告。以后启用时，404、隐私、条款、联系和关于页面仍排除广告，独立广告位带当地语言标签。 |
| 隐私与透明度 | 五语补充 Cookie、网络信标、Google 合作伙伴及广告偏好链接、地区同意要求；移除“所有功能 100% 本地”等绝对承诺。联系页可配置真实的私人联系邮箱，未提供时不伪造邮箱。 |
| SEO | 不再按浏览器语言自动跳转；手动切换语言继续可用。首页服务端输出真实工具数量。相关工具按任务关联。更新日期由实际发布日期控制，避免每次构建伪装更新。保留一致的 canonical、hreflang、结构化数据与 sitemap。 |
| 多语言收录 | 简体工具仍为当前索引主版本；外语工具在完整人工校对前保持 `noindex,follow`，不批量放开。noindex 不代表 AdSense 不会审核该页。已存在的四份外语深度说明使用当地语言标题。 |
| 生产验收 | 发布后检查 76 个简体工具页、五语入口、同版本资源、robots.txt、ads.txt、sitemap、缺失 URL 的真实 404，以及五语重点功能浏览器操作，并保存 CI 验证记录。 |
| 构建稳定性 | 锁定依赖的下载地址切换至官方 npm registry，保持版本与完整性校验值不变，避免地区镜像阻塞安装。 |

## 广告重新启用前

默认 `PUBLIC_ADS_ENABLED=false`。保留站点验证不代表正在投放广告。

1. 在 AdSense 的“网站”中确认站点绑定和验证正常；申请复审时记录提交日期与返回信息。
2. 在 AdSense 隐私与消息中核对欧洲经济区、英国、瑞士相关同意设置。个性化广告需满足 Google 认证 CMP 要求，检查选择、撤回与记录实际可用；没有看到本地 CMP 代码不能证明后台没有配置。
3. 如果需要独立联系渠道，提供一个真实、有人查看的地址，设置构建变量 `PUBLIC_CONTACT_EMAIL`。不要在公开 GitHub Issues 中提交私密数据。
4. 审核通过后再设置 `PUBLIC_ADS_ENABLED=true` 并发布。检查真实广告在手机、桌面和不同语言下没有遮挡按钮、冒充工具卡片或截断创意；自动广告的页面排除与数量仍需在 AdSense 后台核对。
5. 若 CMP 注入脚本或框架被 CSP 拦截，只按实际服务所需域名更新 CSP 后再开启广告，不笼统放开所有来源。

这些账户配置与 Google 的再次审核不能靠修改静态网站代办；本次不会把“已整改”写成“已获准”。

## 收录与复审后续

- 上线后检查 Search Console 的网页索引、抓取统计和 URL 检查，提交 `https://clovertools.cn/sitemap-index.xml`。项目已有 Search Console 提交流程；仅在凭据配置且 Google 返回成功时才能称为已提交。没有服务账号时可在后台手动提交。
- 优先检查首页、三个分类页和具有真实使用需求的工具页。Bot Fight Mode 关闭与普通 HTTP 请求成功，都不能替代验证 Googlebot 的真实访问日志。
- 查看 Cloudflare 安全事件是否对经过验证的搜索爬虫或 AdSense 爬虫发出挑战。若存在，修正命中的具体规则；不要仅凭 User-Agent 放行冒充的机器人，也不要整体关闭安全防护。
- 接下来 1–2 周按用户反馈改进内容与交互，观察错误、抓取与索引；不设“必须 30 篇文章”“必须 1000 流量”等非官方门槛，也不靠批量生成空泛文章。
- 复审前确认工具示例可复现、所有页面可读、联系与隐私说明真实、没有空页面或不可用功能。满足这些验收条件后提交一次复审，按照后台处理状态等待结果；不把频繁重提当作修复。
- 逐页校对外语工具后，再通过共享路由策略放开相应语言。同步检查 sitemap 与 hreflang，避免向搜索引擎推荐尚未完成的版本。

## 相关官方依据

- [AdSense 站点准备与所有权验证](https://support.google.com/adsense/answer/7584263?hl=zh-Hans)
- [Google 发布商政策](https://support.google.com/publisherpolicies/answer/10437794?hl=zh-Hans)
- [缺少发布商内容等页面上的广告](https://support.google.com/publisherpolicies/answer/11112688?hl=zh-Hans)
- [AdSense 广告位置政策](https://support.google.com/adsense/answer/1346295?hl=zh-Hans)
- [Google 认证 CMP 要求](https://support.google.com/adsense/answer/13554116?hl=zh-Hans)
- [Google 多地区及多语言站点建议](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites?hl=zh-cn)
- [Cloudflare Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)

## 验证命令

```bash
npm ci
npm run check:all
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run check:browser
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run check:hls-browser
```

GitHub Actions 在质量检查通过后发布并执行生产验收。发布验收报告位于对应运行的 `production-verification` artifact；Cloudflare 独立验证报告位于 `crawler-audit` artifact。报告记录结果，不保存 API token。
