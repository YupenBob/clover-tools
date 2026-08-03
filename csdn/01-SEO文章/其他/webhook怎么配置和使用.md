# Webhook怎么配置和使用？自动化触发与安全验证完整指南

> Webhook是实现自动化工作流的核心机制。本文讲解Webhook的工作原理、主流平台配置方法、以及如何验证请求真实性防止攻击。

## Webhook是什么

Webhook是一种自动向指定URL发送HTTP请求的机制。当某个事件发生时（如代码提交、支付成功），服务器主动通知你的应用，实现实时自动化。

## GitHub Webhook配置

```
1. Settings -> Webhooks -> Add webhook
2. Payload URL: https://your-server.com/webhook
3. Content type: application/json
4. Secret: 设置签名密钥
5. Events: 选择触发事件（push/pull_request等）
```

## 验证签名（安全必须）

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

## Express处理示例

```javascript
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-hub-signature-256'];
  if(!verifySignature(JSON.stringify(req.body), sig, SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});
```

## 常用Webhook事件

- push - 代码提交
- pull_request - PR创建/合并
- issues - Issue创建/更新
- payment_intent.succeeded - 支付成功

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
