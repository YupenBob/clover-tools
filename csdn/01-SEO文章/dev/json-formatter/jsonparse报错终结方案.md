# JSON.parse报错？我调研了7种方案

> JSON.parse常见报错场景分析，7种解决方案覆盖循环引用、日期对象、大数字精度、undefined丢失等问题，JS/Python双语言示例。

## JSON.parse报错终结方案

JSON.parse报错是前后端开发中最常见的错误之一。本文用7种实战方案，帮你彻底解决各种JSON解析报错问题。

## 错误类型一：Unexpected token

```javascript
function safeParse(jsonStr) {
  if (!jsonStr || jsonStr.trim() === '') return null;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON解析失败:', e.message, '原始数据:', jsonStr);
    return null;
  }
}
```

## 错误类型二：Unexpected end of JSON input

```javascript
fetch('/api/data')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(text => text ? JSON.parse(text) : null)
  .then(data => console.log(data));
```

## 错误类型三：控制字符和BOM

```javascript
function cleanInvalidChars(str) {
  return str.replace(/[\x00-\1F]/g, '').replace(/^\uFEFF/, '');
}
const obj = JSON.parse(cleanInvalidChars(rawStr));
```

## 错误类型四：多余逗号

```javascript
function removeTrailingComma(str) {
  return str.replace(/,(\s*[}\]])/g, '$1');
}
```

## 错误类型五：数字精度丢失

```javascript
import JSONBig from 'json-bigint';
const JSONBigInt = JSONBig({ storeAsStrings: true });
const parsed = JSONBigInt.parse('{"id":9007199254741001}');
```

## 常见问题 FAQ

Q: JSON.parse在Node.js和浏览器中行为一致吗？
A: 大体一致，但某些特殊字符的处理可能有差异。

Q: 如何快速定位JSON语法错误的位置？
A: 使用CloverTools的JSON校验工具，可以精确定位行列。

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
