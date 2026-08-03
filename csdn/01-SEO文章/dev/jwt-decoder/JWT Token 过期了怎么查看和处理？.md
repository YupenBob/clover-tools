# JWT Token 过期了怎么查看和处理？

> JWT Token 的 exp 字段声明了过期时间。本文教你三种方法快速查看 JWT 是否已过期，以及 Token 过期后的正确处理方式。

## JWT Token 过期了怎么查看？

JWT（JSON Web Token）是现代Web开发中最常用的身份认证方案之一。当你在浏览器控制台、网络请求或服务端日志中看到Token过期的错误时，意味着客户端携带的Token已经超过了预设的有效期，需要重新获取。

## 如何判断 Token 是否已过期

JWT的Payload部分包含三个标准字段：iss（签发者）、exp（过期时间）和nbf（生效时间）。其中exp是一个Unix时间戳（10位），表示该Token的失效时刻。

```javascript
// Node.js解码
const jwt = require('jsonwebtoken');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const decoded = jwt.decode(token);
console.log('过期时间:', new Date(decoded.exp * 1000));
console.log('是否已过期:', Date.now() > decoded.exp * 1000);
```

## 常见报错场景

- 401 Unauthorized：服务端返回此状态码，通常是Authorization头携带的Token已过期
- TokenExpiredError：Node.js jsonwebtoken库的专属错误，表示Payload中的exp已早于当前时间
- 401 Invalid token：部分服务返回此状态，可能是Token格式错误或Signature验证失败

## 自动刷新 Token 的策略

最佳实践是使用双Token机制：Access Token（短期，有效期15分钟）和Refresh Token（长期，有效期7天）。当Access Token过期时，前端使用Refresh Token自动换取新的Access Token，用户无感知。

```javascript
async function fetchWithAutoRefresh(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    const { refreshToken } = JSON.parse(localStorage.getItem('tokens'));
    const refreshRes = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (refreshRes.ok) {
      const { accessToken } = await refreshRes.json();
      localStorage.setItem('accessToken', accessToken);
      options.headers['Authorization'] = `Bearer ${accessToken}`;
      return fetch(url, options);
    }
  }
  return response;
}
```

## 预防措施

1. 前端在Token颁发时记录过期时间，使用定时器提前5分钟刷新
2. 服务端开启Token黑名单机制，logout时将Token加入黑名单
3. 生产环境务必校验Token的Signature，防止伪造攻击

## 常见问题 FAQ

Q: Token过期时间可以设为永不过期吗？
A: 绝不推荐。永不过期的Token一旦泄露，攻击者可以永久使用该身份凭证。

Q: 前端如何优雅处理Token刷新？
A: 使用请求拦截器，统一处理401并触发刷新流程，避免每个请求单独处理。

Q: 为什么我的Token实际过期时间比exp声明的早？
A: 请检查服务器时区设置，确保服务器时间与NTP时间同步。

---

## 相关工具推荐

**JWT 解码器** — 解析 JWT 三段结构，Payload 一目了然。

在线使用：[JWT 解码器](https://clovertools.cn/tools/dev/jwt-decoder/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
