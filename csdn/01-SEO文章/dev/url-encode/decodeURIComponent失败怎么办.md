# decodeURIComponent失败怎么办？URL编码解码错误排查与修复

> decodeURIComponent报错"URI malformed"是常见问题，通常因为传入了非法编码字符串。本文提供4种修复方案和安全的解码写法。

## 为什么会报URI malformed错误

decodeURIComponent只能解码合法UTF-8序列，如果字符串含有%XX格式但内容是残缺的（如%0、%GG、中文未经encode直接传入），就会报错。

## 4种修复方案

### 1. try/catch包裹（最常用）

```javascript
function safeDecode(str) {
  try { return decodeURIComponent(str); }
  catch(e) { return str; }
}
```

### 2. 先替换无效字符

```
str = str.replace(/%[0-9A-F]{1}/g, (m) =>
  /%[0-9A-F]{2}/.test(m.padEnd(2,'0')) ? m : '');
decodeURIComponent(str);
```

### 3. 使用decodeURI（更宽松）

```
decodeURI(str); // 不会报malformed错误
```

### 4. 分段解码

```javascript
function decodePart(s) {
  try { return decodeURIComponent(s); }
  catch { return s; }
}
str.split('%').map((part,i) => i ? decodePart('%'+part) : part).join('');
```

## 在线工具

使用CloverTools URL编码解码工具：打开工具

---

## 相关工具推荐

**URL 编解码** — URL 编码、解码与参数还原，中文不乱码。

在线使用：[URL 编解码](https://clovertools.cn/tools/dev/url-encode/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
