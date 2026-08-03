# Base64编码原理与实战用途

> Base64编码原理解析，3字节→4字符机制，Data URI图片嵌入、API传输、Cookie等用途，JS/Python双语言示例，常见错误避坑。

## Base64编码原理与实战用途

Base64是Web开发中频繁使用的编码方式，用于将二进制数据转换为可打印的ASCII字符。

## 编码原理

```
// Base64将3个字节（24位）映射为4个6位字符
// 字符表：A-Z a-z 0-9 + /

// 示例
btoa('Hello');  // "SGVsbG8="
```

## JavaScript中的Base64

```javascript
// 浏览器环境
const encoded = btoa('Hello');
const decoded = atob('SGVsbG8=');

// 处理中文
function encodeBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  ));
}
```

## Node.js中的Base64

```javascript
const buf = Buffer.from('Hello', 'utf8');
const encoded = buf.toString('base64');
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
```

## 实战：JWT解码

```javascript
const token = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
const payload = token.split('.')[1];
JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
```

## 常见问题 FAQ

Q: Base64是加密吗？
A: Base64只是编码，不是加密。任何人都能轻易解码。

Q: Base64编码后体积会增加多少？
A: 约增加33%。

---

## 相关工具推荐

**Base64 编解码** — 文本与 Base64 互转，支持图片数据转码。

在线使用：[Base64 编解码](https://clovertools.cn/tools/dev/base64/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
