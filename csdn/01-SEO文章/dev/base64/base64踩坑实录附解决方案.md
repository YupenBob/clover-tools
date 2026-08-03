# Base64编码的坑，看这篇就够了

> 5个Base64翻车案例：Unicode中文乱码、填充丢失、URL-safe变种、Data URI大小膨胀、btoa限制，附JS/Python修复方案。

## Base64编码的坑，看这篇就够了

Base64是开发中常用的编码方式，但各种边界情况经常让人踩坑。

## 坑1：中文编码问题

```javascript
// ❌ btoa无法处理中文
btoa('你好');  // DOMException

// ✅ 先encodeURIComponent
function toBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  ));
}
toBase64('你好世界');
```

## 坑2：URL-safe Base64

```javascript
// 标准Base64：+ / =
// URL-safe Base64：- _ （去掉=padding）

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

## 坑3：图片Base64格式错误

```javascript
// ❌ Data URL格式不完整
const bad = 'iVBORw0KGgoAAAAN...';

// ✅ 必须包含MIME类型
const good = 'data:image/png;base64,iVBORw0KGgoAAAAN...';
```

## 常见问题 FAQ

Q: Base64是加密吗？
A: 不是加密，只是编码。任何人都能轻易解码。

Q: Base64编码后解码得到乱码？
A: 检查编码时用的字符集是否一致（UTF-8 vs GBK）。

---

## 相关工具推荐

**Base64 编解码** — 文本与 Base64 互转，支持图片数据转码。

在线使用：[Base64 编解码](https://clovertools.cn/tools/dev/base64/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
