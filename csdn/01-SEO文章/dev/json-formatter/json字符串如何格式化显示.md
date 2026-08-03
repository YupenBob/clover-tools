# JSON字符串如何格式化显示？在线工具与代码方法详解

> JSON格式化是开发中最常用的操作之一。本文介绍如何用在线工具、JavaScript、Python三种方式快速格式化JSON并美化显示。

## 在线工具（最方便）

使用CloverTools JSON格式化工具，支持语法高亮、压缩、校验：打开工具

## JavaScript格式化

```javascript
// 格式化（缩进2空格）
const formatted = JSON.stringify(obj, null, 2);

// 压缩（无缩进）
const minified = JSON.stringify(obj);

// 美化+语法高亮（在HTML中）
const html = syntaxHighlight(JSON.stringify(obj, null, 2));
```

## Python格式化

```python
import json

# 美化输出
print(json.dumps(data, indent=2, ensure_ascii=False))

# 写入文件
with open("output.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
```

## 格式化选项

- indent: 缩进空格数（2或4）
- ensure_ascii: 是否转义中文（False保留中文）
- sort_keys: 是否按键排序

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
