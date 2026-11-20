# IP 风险与纯净度查询

本工具在五语言 `/tools/dev/ip-reputation/` 页面提供公网 IP 数据库来源对照。页面标题中的“纯净度”对应搜索习惯，工具不计算风险分、纯净百分比或安全等级。结果不能用于判断用户身份、预测平台处置或保证安全。

## 功能与现有工具的分工

- 对照国家、国家代码、城市、ASN、ASN 组织和注册组织，保留每个来源的原值、获取时间、缓存状态和缺失原因。只归并空白、忽略大小写比较，不模糊匹配组织或地名，不多数投票。
- 查询公网 IPv4、IPv6；域名先解析 A/AAAA，再由用户从最多八个公网地址中选择一个并再次提交。本次结果仅对应所选地址。
- 增强来源逐项展示机房、VPN、开放代理、Tor 节点、爬虫和滥用标记。缺失、不可用、未启用与明确 `false` 分开处理。
- 查看与复制白名单 JSON；分享仅包含规范化查询条件；五语言共用最近十条本机快照。查看快照、筛选和复制不查询数据库，重新查询才联网。

现有 `ip-lookup` 处理本机地址、进制、CIDR 和子网；`http-tester` 调试 HTTP；`ua-parser` 分析客户端声明。本工具组件实际渲染这三个工具的同语言链接。没有修改共享推荐算法，也没有新增其他工具的直接反向链接。

## 模块与运行入口

`functions/lib/ip-reputation.ts` 是浏览器与服务器共用的无副作用模块，包含输入、数值 CIDR、DNS 答案筛选、来源适配器和契约类型，不读取环境、不请求网络。

`functions/api/ip-reputation.ts` 是唯一服务端运行入口，处理环境变量、网络、受限流读取、缓存和结构化响应。它只复用 HTTP helper 的目标预检、受限读取和 no-store 能力；本工具自行补充精确匹配和覆盖响应体读取的组合超时，不改动共享 helper，也不使用 helper 的通配 CORS。

`src/lib/ip-reputation.ts` 校验并重建白名单响应、生成对照行、筛选、规范化分享和历史。需要格式化时间时显式接收 ISO 时间与语言，不自行采集时钟或存储。`src/scripts/ip-reputation.ts` 管理请求编号、取消、DOM、剪贴板与存储。五个薄路由共用 `IpReputation.astro`，显式传入 `wide` / `dashboard`。

## 固定网络目标与可选配置

| 来源 | 固定 HTTPS 目标 | 内容 |
| --- | --- | --- |
| ipwho.is | `https://ipwho.is/<编码后的IP>` | 无密钥基础记录，不使用免费响应中的安全字段 |
| ipapi.co | `https://ipapi.co/<编码后的IP>/json/` | 无密钥第二份基础记录，IPv4/IPv6 均使用单地址路径 |
| ipapi.is | `https://api.ipapi.is/`，POST JSON `{q, key}` | 可选增强来源及其基础字段 |
| Cloudflare DNS | `https://cloudflare-dns.com/dns-query?name=…&type=A或AAAA` | `Accept: application/dns-json`，独立解析，不计入信誉来源数 |

地址数据库只收到用户提交或所选的规范化公网 IP；域名只先发送给 DNS 服务。不访问输入域名、解析地址或上游返回的链接。协议、host、端口和路径精确匹配，零次跟随重定向。客户端不能选择来源、任意 URL、请求头、批量地址或提交密钥。

在 Pages 项目的服务端环境配置可选 Secret `IPAPI_IS_KEY`；代码仅从 `context.env.IPAPI_IS_KEY` 读取，无 `.env` 文件变更。密钥只放在增强接口的 POST JSON 中，不进入 URL。访客无需申请或输入密钥。本轮没有配置或验证任何生产密钥。

无密钥时增强请求完全跳过，六项标记为 `key-required`，两个基础来源仍并行查询，均成功时可以 `complete`。配置密钥后鉴权失败、额度限制、超时和缺字段分别保留真实状态，不继续显示“未配置密钥”。基本归属记录来自两个来源，也不能声称增强标记已获多源验证。

## API 契约

唯一入口 `/api/ip-reputation`：

- 无参数 GET：能力响应，200；不读取访客地址，零上游请求。
- POST JSON `{"action":"resolve","query":"example.com"}`：解析域名。该请求不会查询地址数据库。
- POST JSON `{"action":"lookup","query":"8.8.8.8"}`：查询一个公网 IP。
- 其他方法：405，`Allow: GET, POST`。未知参数、action、类型及 URL 参数：400。错误媒体类型：415。流式请求体大于 2 KiB：413。
- 检查存在的 Origin 必须与请求的本站 origin 一致；命令行无 Origin 的请求仍执行全部校验。无通配 CORS，前端使用 `credentials: omit`。

以上仅为**请求格式说明示例**，不是实际查询记录。

每个响应固定包含 `version: 1`、`kind`、`ok`、`status`、`responseAt`、`data`、`error`。kind 为 capabilities / resolution / report / error；status 为 complete / partial / unavailable / invalid，仅描述数据获取情况。时间为 ISO UTC。错误只含稳定 code、retryable 和适用的 sourceId / retryAfterSeconds，不包含上游 URL、正文、原始异常或密钥。

报告来源固定顺序为 ipwho.is、ipapi.co、ipapi.is；每份来源包含 status、fetchedAt、cacheHit、cacheAgeMs、error、fields、crawlerName、networkIndicators。字段仅包含 value、reason 和 upstreamField。归属字段映射按获批 spec 实现；ASN 为有效 1–4294967295 整数对应的 `AS…`，国家代码为两位大写字母。不拿注册组织替代 ASN 组织。

至少两份有效可比值才显示一致或差异；一份为单一来源，零份显示各来源缺失原因。城市或国家文本差异标注“名称不同”，不升级为位置冲突。

单源失败保留其他来源。全部启用来源失败或超时时为 503（Cloudflare 会把 Functions 的 502/504 替换为通用错误页，因此上游类失败统一用 503）。DNS 无可查询地址为 422；DNS 服务失败或超时为 503，不改写为域名不存在。各地址族分别保留状态，即使整体无可用地址也返回受限的解析诊断。

## 地址与 DNS 边界

原始输入最多 256 个 Unicode 字符；严格拒绝 URL、路径、用户信息、端口、CIDR、内部空白、控制符与双向控制符。域名转为小写 ASCII/Punycode，允许移除一个末尾根点，检查总长与标签长度；必须多标签，拒绝内部域名与纯数字伪域名。IPv4 只接受四段十进制，无前导零；IPv6 支持压缩及内嵌 IPv4，不接受方括号或 zone ID。

IPv4-mapped IPv6（包括十六进制形式）先解出 IPv4，再应用同一分类。分类使用 BigInt 数值与 CIDR，不用 IPv6 字符串前缀。特殊用途地址即使有全球可路由例外也保守拒绝，界面称“特殊用途”，不统称私网。

静态表于 **2026-11-18** 核对：

- [IANA IPv4 特殊用途登记](https://www.iana.org/assignments/iana-ipv4-special-registry/)；代码按父范围覆盖登记项，额外拒绝组播 `224.0.0.0/4`，并包含 `240.0.0.0/4` 的保留及广播地址。
- [IANA IPv6 特殊用途登记](https://www.iana.org/assignments/iana-ipv6-special-registry/)；仅放行 `2000::/3`，排除 `2001::/23`、`2001:db8::/32`、`2002::/16`、`2620:4f:8000::/48`、`3fff::/20`。

完整 CIDR 常量在共用纯模块中，运行时不下载登记表。表需要随登记变化人工复核。

DNS 校验问题名称和类型，只采用当前问题及最多八层 CNAME 链上的相应族地址，最多检查 128 条答案；拒绝截断、循环及不受支持的关联，不采用无关答案。仅保留公网地址，按 IP 去重、IPv4 优先、族内数值排序后截取前八个，返回过滤数量和截断标记。服务器不访问 CNAME 或解析目标。

## 增强标记与解释边界

| 标记 | 上游字段 | 解释 |
| --- | --- | --- |
| 机房 | is_datacenter | 托管、云或相关网络分类，不表示恶意 |
| VPN | is_vpn | 数据库中的节点或服务器记录，不证明当前流量使用 VPN |
| 开放代理 | is_proxy | 已知开放代理，不能覆盖所有住宅和移动代理 |
| Tor 节点 | is_tor | 可能是出口或其他中继，不一律称为出口 |
| 爬虫 | is_crawler | 只接受 false 或非空名称；保留限长名称，不等于滥用 |
| 滥用 | is_abuser | 上游近期记录，不判断用户身份或具体行为 |

其他布尔字段只接受真正 true / false。缺失、null、字符串 `"false"` 和来源失败不能显示为未标记。company.abuser_score / asn.abuser_score 仅在展开区显示限长原始字符串及组织网络 / ASN 范围，不转换成当前 IP 的概率或本站分数，不参与排序。

说明示例：A 来源返回 US，B 返回 CA，页面保留两份代码并显示来源不同；不决定哪个正确。说明示例：增强响应缺少 is_tor 时显示未提供，即便两个基础来源都成功，也不能显示为 Tor 未标记。这些不是实测结果。

## 超时、缓存、隐私与历史

每个上游含响应体读取最长 4000 ms，整个操作含请求体预算 4500 ms，浏览器请求 5000 ms。请求及响应体采用流式计数和取消；上游解码后最多 128 KiB，DNS 64 KiB，最终 JSON 128 KiB。基础与增强来源并行，A/AAAA 并行，无自动重试。429 保留有效 Retry-After 并执行来源级退避，不以访客 IP 为键。

内部使用最多 256 项的 isolate 内存缓存：成功来源 60 秒，保留原 fetchedAt，命中时只增加 cacheAgeMs；DNS 不超过相关最小 TTL 与 60 秒，TTL 小于 15 秒不缓存；NXDOMAIN 与无地址记录按 RFC 2308 取 Authority 中 SOA 的 TTL 与 MINIMUM 较小者，没有 SOA、或 SOA 不是完整七字段（MNAME RNAME SERIAL REFRESH RETRY EXPIRE MINIMUM）且后 5 个不是十进制整数时，一律视为不可缓存：不改用 SOA 自身 TTL，也不把截断记录里的其他数字当成 MINIMUM，避免把“暂时无记录”缓存 60 秒后继续报无地址。最终响应 `Cache-Control: no-store`。缓存为尽力而为，isolate 重建会丢失缓存；缓存故障不阻塞查询，不使用过期结果。缓存键按版本、来源、目标和增强配置分区，密钥只用于内部 SHA-256 摘要，不暴露摘要；密钥轮换不复用旧分区。不同 isolate 的缓存与退避不共享，不声称跨实例全局限流。

应用代码不读取或记录访客 IP，不转发 Cookie、Authorization、Referer 或其他来访头，不记录请求正文、密钥、原始响应或异常。增强密钥不在客户端，也不进入缓存值；不采纳意外回显密钥的上游响应。托管平台仍处理连接信息，上游可按其政策处理收到的查询。不能声称基础设施完全不留日志。

存储键 `clover-ip-reputation:v1`，五语言共用。保存 version 与最近十条有效报告白名单快照；按规范化输入＋所选 IP 去重，新结果移到最前，按插入顺序而非设备时间排列。UTF-8 序列化总大小不超过 96 KiB，超限从末尾裁剪。失败不写历史；取消、清空或被新请求替换后的迟到响应不写历史。损坏、未知版本、超限或错误类型不恢复，提示并允许清除；首次没有旧格式迁移。存储拒绝或配额不足时保留内存并提示刷新后丢失。删除历史若被拒绝，会尝试写入空历史；两种写操作均被拒绝时明确提示已存记录可能在刷新后重新出现，不宣称永久删除成功。

JSON 和历史不保存完整上游响应、密钥、访客 IP、请求头或剪贴板内容。分享使用当前语言页面 fragment，仅 q 与可选 ip；重新解析后才判断域名地址提示仍否有效。打开链接不联网。剪贴板拒绝时提供只读文本手动复制。所有上游文本用 textContent 输出，未作为 HTML 或链接执行。

固定免责声明：结果是数据库在所示时间返回的记录，可能缺失、延迟或存在误判。未标记不代表不存在相关行为，已标记也不代表当前使用者实施滥用。归属地不是个人位置，网络或 ASN 指标不是当前 IP 的欺诈概率。

## 来源文档

- [ipwho.is 文档](https://ipwhois.io/documentation)：基础记录边界；不采用完整付费示例冒充免费安全能力。
- [ipapi.co 文档](https://ipapi.co/api/)：两种地址版本的单地址 JSON 查询。
- [ipapi.is 文档](https://ipapi.is/developers.html)：密钥、POST、匿名响应能力、爬虫字段和网络指标边界。
- [Cloudflare JSON DoH 文档](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)：DNS JSON 查询。

## 本轮文件清单

新增：

- `src/components/IpReputation.astro`
- `src/pages/tools/dev/ip-reputation.astro`
- `src/pages/en/tools/dev/ip-reputation.astro`
- `src/pages/ja/tools/dev/ip-reputation.astro`
- `src/pages/ko/tools/dev/ip-reputation.astro`
- `src/pages/zh-hant/tools/dev/ip-reputation.astro`
- `src/lib/ip-reputation.ts`、`src/lib/ip-reputation-i18n.ts`
- `src/scripts/ip-reputation.ts`、`src/styles/ip-reputation.css`
- `functions/api/ip-reputation.ts`、`functions/lib/ip-reputation.ts`
- `scripts/tests/ip-reputation.test.mjs`、`scripts/tests/ip-reputation-api.test.mjs`
- `scripts/lib/tool-cases/ip-reputation.mjs`
- `docs/IP-REPUTATION.md`

修改：

- `src/lib/tools.ts`、`src/lib/tool-seo/dev.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`
- `src/lib/i18n/en.json`、`src/lib/i18n/ja.json`、`src/lib/i18n/ko.json`
- `scripts/gen-search-index.mjs`、`tsconfig.tools.json`、`README.md`（只补工具说明，不改计数）
- 生成的 `data/i18n-tool-pages.json`
- 生成的 `public/search-index.json`、`public/en/search-index.json`、`public/ja/search-index.json`、`public/ko/search-index.json`、`public/zh-hant/search-index.json`

没有改共享布局、HTTP helper、图标登记、质量配置或公共测试入口；没有新增依赖，没有提交或推送。

## 验证记录

环境：当前独立 git worktree，Node v22.23.4。下面只记录实际执行的检查，不把测试 fixture 或浏览器 mock 当作真实数据库记录。

已执行：

- `node --test scripts/tests/ip-reputation.test.mjs scripts/tests/ip-reputation-api.test.mjs`：通过，两个文件共 37 个具名测试组；全部使用确定性 fixture / mock fetch，零真实上游查询。包含来源独立失败、流超限与不结束、总预算、重定向、缓存时间、配置隔离、密钥回显、DNS 与 GET 能力检查。独立生产 verifier 也用 mock 验证了“仅能力成功不足以通过”。
- `npx tsc -p tsconfig.tools.json`：通过。
- `npx tsc -p tsconfig.functions.json`：通过。
- `node scripts/editorial/build-tool-locales.mjs`：生成清单，工具 81 项，ip-reputation 有五个语言路由；现有 vocab-flash 仍只有 zh/tw，与本工具无关。
- `node scripts/gen-search-index.mjs`：生成五份索引，新工具包含本地化词条和别名。
- `node --check scripts/lib/tool-cases/ip-reputation.mjs`：语法检查通过。
- 使用仓库现有 `@astrojs/compiler` 静态编译共用组件与五个路由：无编译错误。另核对简体 SEO 字符长度 51 / 159，五份索引均包含新词条。这不是完整站点构建或浏览器验证。

未执行（本轮运行限制 / 尚未部署）：

- `npm test`、`npm run build`、`npm run check:browser`；浏览器用例已交付，尚无浏览器运行结论或截图，不宣称 360px、CSP 或五语言 HTTP 200 已经实测通过。
- README 工具数量更新：按本轮要求留给流水线；没有手工改计数。
- `node scripts/lib/tool-cases/ip-reputation.mjs --verify https://clovertools.cn`：待本工作区版本部署后执行。未进行生产真实 IPv4、IPv6、域名或增强密钥查询；上游实际可用性、双源覆盖与密钥状态均未验证。

Lead 后续应运行获批 spec 中的完整类型、单测、生成、构建和浏览器检查，再更新工具数量。浏览器用例覆盖五语言核心流、生产 CSP 注入、域名选 IPv6、非法输入零请求、降级、超时、竞态、存储与剪贴板拒绝、键盘、离线、1440px/360px 和深浅色，无 pageerror 断言；截图名均带 mock。

部署后独立 --verify 会真正 POST 查询 `1.1.1.1`、`2606:4700:4700::1111`，解析 `example.com` 后查询一个返回地址，并验证非法输入拒绝。每次要求至少一份基础来源成功；单源记录降级、不宣称双源实测；所有来源失败时退出非零。能力接口 200 不能替代查询验证。输出仅包含规范化状态与来源获取时间，不包含密钥或原始响应。
