# JSON parse error什么意思？详解5种常见JSON解析错误及修复方法

> JSON.parse报错是前端开发最常见的错误之一。本文用具体示例解释5种最常见的JSON解析错误及其修复方法。

## JSON.parse报错的5种类型

### 1. Unexpected token

JSON中有非法的字符，比如多余逗号、键名用单引号、中文引号等。

```
// 错误
{"name": "张三', "age": 20}  // 单引号
{"items": [1, 2, 3,]}  // 尾部逗号
// 修正
{"name": "张三", "age": 20}  // 双引号
{"items": [1, 2, 3]}  // 无尾部逗号
```

### 2. Unexpected end of input

JSON字符串不完整，缺少闭合括号或引号。

### 3. Syntax error - 键名无引号

```
// 错误
{name: "test"}  // name无引号
// 修正
{"name": "test"}
```

### 4. 中文乱码导致的解析失败

文件保存为GBK但当作UTF-8解析，导致字符变成乱码。

### 5. BOM头导致的解析失败

UTF-8文件开头的EF BB BF三个字节导致首个字符解析错误。

## 工具修复

使用CloverTools JSON格式化工具自动检测和修复以上问题：打开工具

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
