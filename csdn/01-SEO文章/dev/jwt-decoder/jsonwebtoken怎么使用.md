# JSON Web Token怎么使用？JWT登录认证完整实现教程

> JWT是现代Web应用最常用的身份认证方案。本文讲解JWT的结构、生成与验证过程，以及如何在Express/Koa/Fastify中实现JWT认证中间件。

## JWT结构

JWT由三部分组成，用点号分隔：header.payload.signature

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  # Header（算法）
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.  # Payload（数据）
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  # Signature（签名）
```

## 生成Token

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: 123, role: 'admin' },  // Payload
  SECRET_KEY,
  { expiresIn: '7d' }  // 7天过期
);
```

## 验证Token

```javascript
try {
  const decoded = jwt.verify(token, SECRET_KEY);
  console.log(decoded.userId);  // 123
} catch(err) {
  if(err.name === 'TokenExpiredError') {
    console.log('Token已过期');
  }
}
```

## Express中间件

```javascript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).send('No token');
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}
```

## 在线工具

使用CloverTools JWT解码器：打开工具

---

## 相关工具推荐

**JWT 解码器** — 解析 JWT 三段结构，Payload 一目了然。

在线使用：[JWT 解码器](https://clovertools.cn/tools/dev/jwt-decoder/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
