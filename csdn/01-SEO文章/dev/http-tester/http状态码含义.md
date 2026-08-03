# HTTP状态码含义？1xx/2xx/3xx/4xx/5xx 完整对照表

> HTTP状态码是API开发必掌握的基础知识。本文整理所有常用状态码含义，按1xx到5xx分类，提供快速查询对照表和实际场景说明。

## 1xx - 信息性状态码

- 100 Continue：继续发送请求
- 101 Switching Protocols：协议升级（如HTTP→WebSocket）

## 2xx - 成功状态码

- 200 OK：请求成功
- 201 Created：资源创建成功（POST成功）
- 204 No Content：成功但无返回内容（DELETE成功）

## 3xx - 重定向状态码

- 301 Moved Permanently：永久重定向（缓存）
- 302 Found：临时重定向（不缓存）
- 304 Not Modified：缓存未修改
- 307 Temporary Redirect：临时重定向（保持方法）

## 4xx - 客户端错误

- 400 Bad Request：请求格式错误
- 401 Unauthorized：未认证（需登录）
- 403 Forbidden：无权限
- 404 Not Found：资源不存在
- 429 Too Many Requests：请求过于频繁（限流）

## 5xx - 服务器错误

- 500 Internal Server Error：服务器内部错误
- 502 Bad Gateway：网关错误（上游服务挂了）
- 503 Service Unavailable：服务不可用（过载/维护）
- 504 Gateway Timeout：网关超时

## 实际开发建议

```
// 统一错误响应格式
{
  "code": 40401,
  "message": "用户不存在",
  "data": null
}
```

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
