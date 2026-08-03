# JSON多了逗号怎么修复 - CloverTools

> JSON文件末尾多了一个逗号会导致解析失败，本文提供3种快速修复方法：手动删除、正则替换、在线工具一键处理，附Python/JavaScript/Go示例。

## JSON尾部逗号为什么会报错？

JSON规范不允许尾部逗号（trailing comma），但JavaScript曾经允许双标签模式，所以很多人会犯这个错误。

## 3种修复方法

### 1. 正则删除尾部逗号

```
s = s.replace(/,(s*[]}]))/g, "$1");
```

### 2. Python修复

```
import json
with open("file.json") as f:
    data = json.load(f)  # 自动报尾部逗号错
```

### 3. 在线工具修复

使用CloverTools JSON格式化工具，一键移除尾部逗号并格式化：打开工具 →

## 常见场景

- 手动编辑JSON配置
- AI生成JSON后忘记清理
- 从Excel导出JSON

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
