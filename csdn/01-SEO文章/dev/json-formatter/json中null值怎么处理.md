# JSON中null值的处理方法大全 - CloverTools

> JSON里的null值经常让人困惑：null和undefined有什么区别？如何判断、如何过滤、如何替换？本文提供7种实战场景的解决方案，附在线工具实测。

## null在JSON里是什么意思？

JSON中的null是显式的空值，表示这里有值但是空的，和undefined（完全未定义）不同。

## 判断null值

在JavaScript中：obj.key === null 可以精确判断。

## 过滤null值

使用Object.fromEntries + Object.entries：
```
Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==null))
```

## 替换null为默认值

```
JSON.parse(JSON.stringify(obj), (k,v) => v === null ? "" : v)
```

## 在线工具

使用CloverTools的JSON格式化工具，可以一键移除或替换null值：打开工具 →

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
