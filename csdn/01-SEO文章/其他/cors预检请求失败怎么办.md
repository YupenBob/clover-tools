# CORS预检请求失败怎么办？跨域问题全面排查与解决方案

> CORS跨域错误是前端开发中的常见痛点。本文详解CORS预检请求（OPTIONS）的机制，以及常见报错头的正确配置方法。

## CORS预检请求机制

浏览器先发OPTIONS请求询问服务器是否允许，真正的请求在预检通过后才发送。预检失败则真正的请求不会发出，直接报CORS错误。

## 服务端配置（Nginx示例）

```
location / {
  add_header Access-Control-Allow-Origin $http_origin;
  add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
  add_header Access-Control-Allow-Headers "Content-Type, Authorization";
  add_header Access-Control-Allow-Credentials "true";

  if ($request_method = OPTIONS) {
    add_header Access-Control-Allow-Origin $http_origin;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    add_header Access-Control-Max-Age 1728000;
    add_header Content-Length 0;
    return 204;
  }
}
```

## 常见报错

- Missing Allow-Origin：服务器没配CORS头
- Missing Allow-Methods：预检请求的OPTIONS方法不在允许列表
- Credentials+Wildcard：允许凭据时Origin不能是*

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
