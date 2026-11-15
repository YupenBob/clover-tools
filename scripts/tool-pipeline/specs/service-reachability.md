# 服务可达性检测（service-reachability）选题卡

## 用户与场景
用户想知道 Claude/ChatGPT/TikTok/X 等站点在当前网络/本站服务器视角下是否可达、延迟多少、是否被重定向。**不做账号封禁预测**，不登录、不提交凭据。

## 核心功能
1. 固定服务白名单（claude.ai、chatgpt.com、openai.com、tiktok.com、x.com、youtube.com、google.com、github.com 等）；不可输入任意 URL。
2. 双视角：
   - 服务器视角：`/api/reachability` 从 Cloudflare 边缘发 HEAD/GET（无凭据），返回状态码/延迟/重定向/错误分类。
   - 浏览器视角：客户端 `fetch(mode:'no-cors')` 测可达/耗时（opaque，不能读状态码），明确标注局限。
3. 结果表：服务、视角、可达/超时/被拦截、延迟、状态、时间；支持重测单个/全部。
4. 说明：测量结果只代表“此时刻此网络”，不代表账号是否被封；不绕过地区限制。
5. 5 语言、复制结果、移动端、深浅色、键盘；无外部资源。

## 数据与状态
`functions/api/reachability.ts`：allowlist、超时 4s、重定向 manual、响应体上限 64KB、缓存 30s、并发上限（如 4）、结构化错误。`src/lib/reachability.ts`：分类/排序/文案。

## 边界与错误
上游超时/DNS 失败/TLS 错误/重定向循环；CORS/opaque；离线；重复点击；部分服务拒绝 HEAD（降级 GET）；速率限制。

## 文件清单
`functions/api/reachability.ts`、`functions/lib/http.ts`、`src/lib/reachability.ts`、`src/lib/reachability-i18n.ts`、`src/scripts/reachability.ts`、`src/components/ServiceReachability.astro`、5 薄路由、集成文件、单测、浏览器用例、`docs/SERVICE-REACHABILITY.md`。

## 测试
单测：allowlist 拒绝任意 host、私网拒绝、错误分类、排序/文案。浏览器：5 语言、全量/单项重测、超时显示、复制、360px、深色、CSP。生产 `/api/reachability` 200 且只返回白名单服务。

## 隐私/法律
不记录访客 IP；不登录；不提交 Cookie/Token；不承诺封号结论；不绕过限制。SEO：服务可达性、网络检测、Claude 访问、TikTok 访问（避免“封号”承诺）。
