# User-Agent字符串解析失败怎么解决？浏览器识别与正则匹配实战

> User-Agent字符串格式复杂，解析失败是常见问题。本文介绍如何正确解析UA、判断浏览器/系统/设备，并提供正则匹配方案和常见错误修复。

## User-Agent解析失败的常见原因

User-Agent格式不统一，不同浏览器和设备对同一字段使用不同写法，导致解析结果错误或失败。

## 正确解析方法

### 1. 使用现成库

```javascript
const useragent = require('useragent');
const agent = useragent.parse(req.headers['user-agent']);
console.log(agent.browser.toString()); // Chrome 120
```

### 2. 手动正则提取

```javascript
const ua = navigator.userAgent;
const browser = /Chrome\/([\d.]+)/.exec(ua)?.[1];
const isMobile = /Mobile|Android|iPhone/.test(ua);
```

## 常见错误

- 只检查Chrome就匹配到了Edge（Edge也有Chrome字符串）
- iOS设备User-Agent包含"CPU iPhone OS"而不是"iOS"
- 某些国产浏览器伪造UA为Chrome

## 在线工具

使用CloverTools User-Agent解析工具：打开工具

---

## 相关工具推荐

**User-Agent 解析** — 解析 UA 串，识别浏览器、系统与设备。

在线使用：[User-Agent 解析](https://clovertools.cn/tools/dev/ua-parser/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
