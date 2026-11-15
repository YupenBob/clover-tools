# IP 风险与纯净度查询（ip-reputation）选题卡

## 用户与场景
开发者/运维/风控需要判断一个 IP 是否像机房、VPN、代理、Tor 或滥用来源；现有 `ip-lookup` 只做地理位置/ASN。本工具做**信号汇总**，不做“好坏”定性。

## 核心功能
1. 查询 IPv4/IPv6/域名（域名先解析）：基础信息（国家/城市/ASN/组织）+ 风险信号（机房/VPN/代理/Tor/爬虫/滥用置信度，取决于上游可用字段）。
2. 多源对照：至少两个上游；每个字段标注来源与时间；上游失败单独降级。
3. 无密钥降级：`IPAPI_IS_KEY` 未配置时只显示基础字段，明确“增强信号需配置密钥”；不得伪造分数。
4. 结果解释：每个信号的含义与局限；不构成封号/欺诈结论。
5. 复制 JSON/分享链接（不含密钥）；历史最近 10 条（localStorage）；5 语言。

## 数据与状态
`functions/api/ip-reputation.ts`：固定上游 allowlist（ipapi.is / ipwho.is / ipapi.co），IPv4/IPv6 分流；密钥从 `context.env.IPAPI_IS_KEY` 读取；超时 4s；缓存 60s；响应体上限 128KB；错误结构化。`src/lib/ip-reputation.ts` 做字段归一化/解释/排序。

## 边界与错误
非法 IP/域名；私网/保留地址（直接拒绝并说明）；上游限流/超时/字段缺失；无密钥；IPv6；域名解析失败；缓存命中；XSS（所有上游文本转义）。

## 文件清单
`functions/api/ip-reputation.ts`、`functions/lib/http.ts`（复用）、`src/lib/ip-reputation.ts`、`src/lib/ip-reputation-i18n.ts`、`src/scripts/ip-reputation.ts`、`src/components/IpReputation.astro`、5 薄路由、集成文件、单测、浏览器用例、`docs/IP-REPUTATION.md`。

## 测试
单测：归一化、私网拒绝、缺失字段、IPv6、说明文案映射。浏览器：5 语言、合法/非法输入、无密钥降级、上游失败降级、复制、360px、深色、CSP。生产 `/api/ip-reputation` 200。

## 隐私/边界
不记录访客 IP；只把用户输入的 IP 发给固定上游；不承诺“纯净/被封”；密钥不落客户端。SEO：IP 纯净度、IP 风险、VPN 检测、机房 IP。与 ip-lookup 内链互导。
