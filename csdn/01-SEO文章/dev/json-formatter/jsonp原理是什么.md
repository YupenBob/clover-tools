# JSONP原理是什么？为什么现在不推荐使用了？

> JSONP是早期解决跨域问题的方案，现在已被CORS取代。本文讲解JSONP的工作原理、为什么能跨域、以及为什么CORS更好。

## JSONP的原理

HTML的script标签不受同源策略限制。JSONP利用这一点：服务器返回一段JavaScript代码（函数调用），浏览器当作JS执行，从而拿到数据。

## 工作流程

```
// CORS示例（服务端设置）
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST
Access-Control-Allow-Headers: Content-Type
```

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
