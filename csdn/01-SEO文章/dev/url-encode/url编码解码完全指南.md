# URL编码与解码完全指南

> encodeURI vs encodeURIComponent区别，各语言URL编码方法，UTF-8三字节编码原理解析，Double Encoding等常见错误与避坑指南。

## URL编码与解码完全指南

URL编码（Percent Encoding）是Web开发中处理特殊字符的必备技能。

## 基本规则

```
// 安全字符：字母、数字、- _ . ~
// 其他字符需要编码：% + 十六进制
// 例如：空格 → %20，中文 → %E4%B8%AD%E6%96%87
```

## JavaScript中的URL编解码

```
// 编码整个URL
encodeURI('https://example.com/a b');  // "https://example.com/a%20b"

// 编码URL组件
encodeURIComponent('a b');  // "a%20b"
encodeURIComponent('a/b');  // "a%2Fb"（斜杠也被编码）

// 解码
decodeURIComponent('a%20b');  // "a b"
```

## Python中的URL编解码

```
from urllib.parse import quote, quote_plus, urlencode

quote('a b');       // 'a%20b'
quote_plus('a b');   // 'a+b'
urlencode({'name': '张三'});  // 'name=%E5%BC%A0%E4%B8%89'
```

## 常见踩坑

```
// 坑1：重复编码
encodeURIComponent(encodeURIComponent('张三'));  // 双重编码！

// 坑2：&符号未编码
// 参数值中含有&但未编码，会被误解析为参数分隔符
```

## 常见问题 FAQ

Q: %20和+空格有什么区别？
A: application/x-www-form-urlencoded格式中空格编码为+，标准URL中编码为%20。

Q: 为什么有些URL中文字符没有编码？
A: 浏览器会自动显示Unicode字符，但在URL传输层仍是%编码的。

---

## 相关工具推荐

**URL 编解码** — URL 编码、解码与参数还原，中文不乱码。

在线使用：[URL 编解码](https://clovertools.cn/tools/dev/url-encode/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
