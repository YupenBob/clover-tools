---
title: "failed to fetch 怎么解决？常见原因与排查思路"
description: "详解failed to fetch错误的各种原因与解决方法，附CORS跨域、后端启动、网络断开等场景的调试指南。"
tags: ["fetch", "网络请求", "前端报错"]
category: "前端 / JS 报错"
original: true
planned_date: "2026-08-14"
link: "https://clovertools.cn/tools/dev/http-tester/"
status: draft
---

failed to fetch 应该是前端遇到最多的网络报错之一。它不是一个具体问题，而是一类请求失败的总称，CORS、网络断开、接口地址写错都会触发。这篇把常见原因和对应的排查思路列一下，方便对号入座。

## 什么是 failed to fetch 错误？

Failed to fetch 是浏览器在尝试从服务器获取资源时失败的报错。它不是某个具体的问题，而是一类网络请求失败的总称。常见场景：

- fetch() 或 XMLHttpRequest 请求被浏览器拦截

- CORS 跨域限制导致请求无法发出

- 服务器宕机或网络断开

- 后端 API 未启动或地址错误

## 最常见原因：CORS 跨域限制

```
// 触发 failed to fetch 的典型代码
fetch('https://api.example.com/data')
  .then(r => r.json())
  .then(console.log)
  .catch(err => console.error('Failed to fetch:', err));

// 错误信息可能是：
// "Failed to fetch"（Chrome）
// "NetworkError when attempting to fetch resource"（Firefox）
// "TypeError: Network request failed"（部分环境）
```

### CORS 错误的典型特征

- Network 面板看到请求是红色的（blocked）

- 预检请求（preflight）返回 405 或其他非 2xx 状态码

- 响应头里没有 `Access-Control-Allow-Origin`

### 解决方案：在服务器端加 CORS 头

## 原因二：后端服务未启动

很多开发者在本地跑着前端（`localhost:3000`），但后端没启动，或者后端监听在错误的端口上。

```
// 检查清单：
// 1. 后端服务是否真的在运行？（ps aux | grep node）
// 2. 端口是否匹配？（前端请求 8080，后端监听 3000？）
// 3. 后端是否绑定在 0.0.0.0 而非 127.0.0.1？

// 后端正确示例（Node.js）
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ok: true}));
});
server.listen(8080, '0.0.0.0');  // 绑定所有网卡，而非仅本地

// 错误示例（只绑定本地）
server.listen(8080, '127.0.0.1');  // 外部无法访问！
```

## 原因三：浏览器扩展拦截

AdBlock、uBlock 等扩展会拦截包含某些关键词的请求（如 ad、track、analytics）。如果你的 API URL 包含这些词，就会被静默拦截。

```
// 可能的被拦截关键词：
// /ad/ /analytics/ /track/ /pixel/ /banner/
// 解决：URL 改名或加白名单

// 自检方法：
// 1. 打开浏览器无痕模式（Extensions disabled）
// 2. 换一个浏览器测试
// 3. 检查浏览器 DevTools  Network  筛选 block 状态的请求
```

## 原因四：混合内容（HTTPS 页面请求 HTTP 资源）

如果你的页面是 HTTPS 的，但请求的是 HTTP 资源，浏览器会直接 block（现代浏览器默认阻止混合内容）。

//  正确：全部 HTTPS
fetch('https://api.example.com/data');

// 如果必须用 HTTP（开发环境）：
// 1. 用自签名证书
// 2. 浏览器里手动加信任（dev 环境）
// 3. 或在浏览器地址栏点"高级""继续前往"
```

## 原因五：网络层面断开了

用户网络断开、VPN 干扰、公司防火墙拦截等情况也会导致 fetch 直接失败，错误信息就是 "Failed to fetch"，但没有具体原因。

```
// 检测网络状态的可靠方法
window.addEventListener('online', () => console.log('网络恢复'));
window.addEventListener('offline', () => console.log('网络断开'));

// 带超时控制的 fetch
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

fetch(url, { signal: controller.signal })
  .then(r => r.json())
  .then(data => { clearTimeout(timeout); console.log(data); })
  .catch(err => {
    clearTimeout(timeout);
    if (err.name === 'AbortError') console.error('请求超时');
    else console.error('Failed to fetch:', err);
  });
```

## 调试方法论

### Step 1：确认请求发出了吗？

打开浏览器 DevTools  Network  筛选 XHR/Fetch。看看请求是不是红色的，或者根本没出现。

- **请求没出现**  浏览器 block 了，可能是 CORS 或扩展

- **请求红色但有响应**  服务端返回了错误状态码（4xx/5xx）

- **请求一直转圈**  超时或网络不通

### Step 2：检查 Console 错误信息

```
// 在控制台执行以下命令，查看更详细的错误：
fetch('/your-endpoint').catch(e => console.dir(e));

// Chrome 的 Failed to fetch 通常没有详细 message
// 可以看 Network 面板的 Timing 或 Initator
```

### Step 3：用 curl 测试（绕过浏览器）

```
# 直接 curl 看看服务器返回什么
curl -v https://api.example.com/data

# 看响应头里有没有 CORS 头
curl -I https://api.example.com/data | grep -i 'access-control'
```

## 常见错误场景与解决

### 场景 1：前端在 Vercel，后端在自己服务器

```
// Vercel 走 HTTPS，如果后端是 HTTP，浏览器会 block
// 解决：后端也配 HTTPS（Let's Encrypt 免费）
# apt install certbot
certbot certonly --nginx -d your-domain.com
```

### 场景 2：本地开发时请求远程 API

```
// 前端 localhost:3000  请求 localhost:8080
// 如果后端没启动  Failed to fetch
// 如果后端绑定了 127.0.0.1  Failed to fetch

// 解决：
// 1. 确保后端运行中
// 2. 后端监听 0.0.0.0 而非 127.0.0.1
// 3. 或者用 webpack/vite 的 proxy 配置（开发环境）

// vite.config.js 示例
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
};
```

### 场景 3：请求是自己写的，但返回的不是 JSON

```
// 后端挂了/502/503 时，返回的可能是一个 HTML 错误页面
// fetch 尝试 JSON.parse(html)  报错

// 解决：先检查响应类型
fetch(url)
  .then(async r => {
    const contentType = r.headers.get('content-type');
    if (!contentType.includes('application/json')) {
      const text = await r.text();
      throw new Error(`Expected JSON, got ${contentType}: ${text.slice(0,100)}`);
    }
    return r.json();
  })
  .catch(err => console.error('API Error:', err));
```

### 案例 1：某个工具点了没反应

### 案例 2：JSON 格式化工具输入内容后点处理报错

```
// 报错：返回数据不是合法的json格式
// 原因：工具请求了某个 API，但 API 返回了 HTML 错误页（如 Nginx 502）

// 解决：用纯前端的 JSON 格式化工具（完全本地处理，不请求任何外部 API）
//
```

## 预防措施

### 1. 永远加超时

```
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);
fetch(url, {signal: controller.signal}).catch(handleError);
```

### 2. 做降级处理

```
async function safeFetch(url, options = {}) {
  try {
    const r = await fetch(url, options);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    // 降级：显示友好的错误信息，而不是浏览器默认的失败提示
    console.error('请求失败:', e.message);
    return {error: true, message: '服务暂时不可用，请稍后重试'};
  }
}
```

### 3. 写清楚的用户提示

当 failed to fetch 发生时，不要只显示 "请求失败"，要给用户可操作的提示：

- "网络已断开，请检查网络连接"

- "服务器响应超时，可能是服务器忙碌"

- "跨域请求被拦截，请检查服务端 CORS 配置"

## 总结

| 错误类型 | 特征 | 解决方法 |
| --- | --- | --- |
| CORS 拦截 | 请求预检失败 / 无 CORS 头 | 服务端加 Access-Control-Allow-Origin |
| 后端未启动 | 请求没发出 / 超时 | 启动后端，监听 0.0.0.0 |
| HTTPS 请求 HTTP | Mixed Content 拦截 | 后端也配 HTTPS |
| 扩展拦截 | 请求发出但被 drop | URL 改名或加白名单 |
| 网络断开 | 没有任何请求 | 检查网络 / VPN / 防火墙 |
| 返回非 JSON | JSON.parse 报错 | 先检查 content-type 再解析 |

- — 本地处理，不需要后端，彻底避免 failed to fetch

- — 构造任意请求，调试接口问题

- — 模拟跨域请求，检查 CORS 配置

- — 可视化取色，生成代码

遇到 failed to fetch，先看 Network 面板请求有没有发出去：没发出多是 CORS 或拦截，发出了没响应多是网络或服务端问题。想确认是不是接口本身的问题，可以用[在线接口测试工具](https://clovertools.cn/tools/dev/http-tester/)直接发一次请求，绕开浏览器环境看真实返回。
