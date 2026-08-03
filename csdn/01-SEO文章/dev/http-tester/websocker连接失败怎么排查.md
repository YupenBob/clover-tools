# WebSocket连接失败怎么排查？从握手到生产环境的完整指南

> WebSocket连接失败是实时应用开发中的常见问题。本文分析握手失败的原因，提供各环境的排查方法，以及生产环境部署注意事项。

## WebSocket连接过程

```
1. 浏览器发起HTTP请求（Upgrade头）
2. 服务器返回101 Switching Protocols
3. TCP连接升级为WebSocket长连接
```

## 常见错误与修复

### 1. 握手失败（403/401）

```
// 检查Origin头
// 某些服务器默认拒绝非浏览器的握手请求
// 解决：配置服务器允许指定Origin
```

### 2. 代理阻止WebSocket

```
// Nginx代理需要配置
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 3. CORS问题

```
// 服务器需要处理WebSocket的CORS
// 某些共享主机可能不支持WebSocket
```

## 前端调试

```javascript
const ws = new WebSocket('wss://example.com/socket');

ws.onerror = (e) => {
  console.log('WebSocket error:', e);
};

ws.onclose = (e) => {
  console.log('Closed:', e.code, e.reason);
};
```

## 心跳保活

```
// 定期发送ping防止连接断开
setInterval(() => {
  if(ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({type: 'ping'}));
  }
}, 30000);
```

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
