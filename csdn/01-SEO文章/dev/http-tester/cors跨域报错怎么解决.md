# cors跨域报错怎么解决 - CloverTools

> Access-Control-Allow-Origin 报错？CORS预检请求详解，4种常用解决方案，从JSONP到代理服务器一次性说清楚。

## CORS跨域报错怎么解决？

CORS（Cross-Origin Resource Sharing）是浏览器的安全机制，当JavaScript向不同源发起请求时，浏览器会先发送OPTIONS预检请求。

## 典型CORS报错信息

- Access to fetch at 'http://api.example.com'... has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
- Response to preflight request doesn't pass access control check

## 服务端配置CORS

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());  // 允许所有来源（开发环境）

app.use(cors({
  origin: ['https://clovertools.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
```

## 处理OPTIONS预检请求

```
app.options('/api/data', cors());

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
  } else {
    next();
  }
});
```

## 携带Cookie时的CORS配置

```
fetch('https://api.example.com', { credentials: 'include' });

app.use(cors({
  origin: 'https://clovertools.com',
  credentials: true
}));
```

## 常见问题 FAQ

Q: CORS报错发生在Node.js后端，但浏览器不报错？
A: CORS是浏览器安全机制。服务端必须配置CORS头，前端才能正常访问。

Q: POST请求有时会触发OPTIONS预检？
A: 当Content-Type是application/json或使用了自定义请求头时，会触发预检请求。

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
