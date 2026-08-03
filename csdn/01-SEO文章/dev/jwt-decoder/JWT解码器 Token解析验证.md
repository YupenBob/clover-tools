# JWT 解码器完全指南 - 解析 Token Header 和 Payload

> 在线解析 JWT Token，无需服务器即可查看 Header、Payload、签名信息，支持 HS256/RS256 等算法验证。

## JWT 是什么？

JWT（JSON Web Token）是一种用于身份验证和信息交换的开放标准（RFC 7519）。它由三部分组成，用点号分隔：Header.Payload.Signature

## JWT 结构详解

### Header（头部）

包含令牌类型（通常是 JWT）和使用的签名算法（如 HS256、RS256、ES256）。Base64URL 编码。

```
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload（载荷）

包含声明（claims），分为三类：注册声明（如 exp 过期时间、sub 用户ID）、公开声明（自定义）、私有声明（双方约定）。

```
{
  "sub": "1234567890",
  "name": "John Doe",
  "exp": 1699999999,
  "iat": 1699996399
}
```

### Signature（签名）

将编码后的 Header 和 Payload 用指定算法加密，验证数据没有被篡改。

## 在线解码

使用 JWT 解码器 无需服务器，直接在浏览器解析 JWT：

1. 粘贴 Token 到输入框
2. 实时显示 Header 和 Payload 的 JSON 格式化内容
3. 查看各字段含义和有效期
4. 复制解析结果

## HS256 vs RS256

HS256：对称加密，签名和验证使用同一密钥。适合服务端内部使用，不需要公钥分发。

RS256：非对称加密，签名用私钥，验证用公钥。适合开放 API（如 OAuth），客户端可以使用公钥验证令牌真实性。

## 常见问题

Q: Token 过期了怎么查？
看 Payload 里的 exp 字段，是 Unix 时间戳。可以用 Unix 时间戳转换工具直接转成北京时间。

Q: JWT 安全吗？
Token 本身只做了 Base64 编码（不是加密！），敏感信息不要写在 Payload 里。签名可以防止篡改，但不能防止信息泄露。

Q: 如何安全存储 Token？
推荐 HttpOnly Cookie（防 XSS），避免 localStorage 存储（可被 XSS 窃取）。

---

## 相关工具推荐

**JWT 解码器** — 解析 JWT 三段结构，Payload 一目了然。

在线使用：[JWT 解码器](https://clovertools.cn/tools/dev/jwt-decoder/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
