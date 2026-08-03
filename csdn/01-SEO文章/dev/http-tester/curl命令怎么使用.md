# curl命令怎么使用？HTTP请求完整指南

> curl是命令行最常用的HTTP客户端工具。本文详解curl的各种用法：GET/POST请求、请求头设置、文件上传、代理配置等。

## 基本用法

```bash
# GET请求
curl https://api.example.com/data

# POST请求
curl -X POST https://api.example.com/data

# 带数据POST
curl -X POST https://api.example.com/data \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```

## 常用参数

```
-H "Header: value"  # 设置请求头
-d '{"key":"value"}'  # POST数据
-i  # 显示响应头
-v  # 详细模式（请求+响应）
-X METHOD  # 指定HTTP方法
-u user:pass  # Basic认证
--data-urlencode  # URL编码数据
-L  # 跟随重定向
-k  # 忽略SSL证书错误
```

## 上传文件

```bash
curl -X POST https://example.com/upload \
  -F "file=@/path/to/file.pdf" \
  -F "name=document"
```

## 调试技巧

```bash
# 保存响应
curl -o output.json https://api.example.com/data

# 打印请求和响应详细
curl -v https://api.example.com

# 只打印响应头
curl -I https://api.example.com
```

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
