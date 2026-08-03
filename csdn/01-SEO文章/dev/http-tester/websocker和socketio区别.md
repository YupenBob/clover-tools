# WebSocket和Socket.IO区别？哪个更适合你的应用？

> WebSocket和Socket.IO都是实现实时通信的技术，但原理和使用场景不同。本文对比两者特性、优缺点，以及在不同场景下如何选择。

## WebSocket基础

WebSocket是一种基于TCP的全双工通信协议，浏览器和服务器建立连接后可以互相推送数据，无需HTTP请求。

```javascript
// 建立连接
const ws = new WebSocket('wss://example.com/ws');

ws.onopen = () => ws.send('Hello');
ws.onmessage = (e) => console.log(e.data);
ws.onclose = () => console.log('Disconnected');
```

## Socket.IO基础

Socket.IO是一个封装库，在WebSocket不可用时自动降级为轮询等方案，提供更好的兼容性和更简单的API。

```javascript
// 客户端
const socket = io('https://example.com');
socket.on('connect', () => console.log('Connected'));
socket.emit('message', 'Hello');
socket.on('response', (data) => console.log(data));
```

## 核心区别

| 特性 | WebSocket | Socket.IO |
| --- | --- | --- |
| 协议 | 原生协议 | 封装库 |
| 兼容性 | 现代浏览器 | 自动降级 |
| 断网重连 | 需手动实现 | 自动重连 |
| 广播/房间 | 需手动实现 | 内置支持 |
| 数据包 | 字符串/二进制 | 支持任意类型 |

## 选用建议

- 简单双向通信：直接用WebSocket
- 需要自动重连/断线恢复：用Socket.IO
- 聊天室/游戏/协作：Socket.IO的房间功能很方便
- 高性能低延迟：原生WebSocket更好

## Nginx代理配置

```bash
# WebSocket支持
location /ws {
  proxy_pass http://backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
