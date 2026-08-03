# API调用报invalid request怎么办？5步排查与修复指南

> 调用API时遇到invalid request错误是常见问题。本文从请求头、参数格式、认证信息、跨域限制、负载大小5个维度提供系统性排查思路，附详细修复步骤和在线工具。

## invalid request错误的常见原因

当API返回invalid request报错时，通常意味着服务端无法解析你的请求。常见原因包括：请求体格式错误、Content-Type不匹配、缺少必需参数、认证信息无效。

## 5步排查流程

### Step 1：检查请求头

```
headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + token
}
```

### Step 2：验证JSON参数

使用CloverTools JSON格式化工具检查参数是否合法：打开工具

### Step 3：检查认证信息

Token是否过期？格式是否正确（Bearer前是否有空格）？

### Step 4：跨域限制

浏览器环境下调用API需要服务器允许CORS，或使用服务端代理。

### Step 5：请求体大小

某些API对请求体有大小限制，尝试压缩或简化参数。

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
