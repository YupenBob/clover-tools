# JSON多了尾部逗号怎么修复？3种方法一键解决

> JSON尾部逗号（trailing comma）是导致解析失败的最常见原因之一。本文提供3种快速修复方法：正则删除、Python修复、在线工具处理。

## 为什么尾部逗号会报错

JSON规范严格禁止尾部逗号，但JavaScript曾允许双标签模式下使用，所以很多人在手动编辑时容易犯这个错误。

## 3种修复方法

### 1. 正则删除（JavaScript）

```
str = str.replace(/,(\s*[\]\}])/g, "$1");
```

### 2. Python修复

```
import json, re
with open("file.json") as f:
    text = f.read()
text = re.sub(r",(\s*\])", r"\1", text)
data = json.loads(text)
```

### 3. Node.js修复

```javascript
import { parse } from "jsonc-parser";
const errors = [];
const data = parse(text, errors);
```

## 在线工具

使用CloverTools JSON格式化工具一键移除尾部逗号：打开工具

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
