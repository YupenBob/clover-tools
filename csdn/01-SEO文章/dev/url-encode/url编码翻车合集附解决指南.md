# URL编码翻车合集，看这篇就够了

> 6个URL编码翻车场景，encodeURI vs encodeURIComponent对比表格，Double Encoding、路径vs查询参数、特殊字符处理，5语言示例。

## URL编码翻车合集，看这篇就够了

URL编码看似简单，但各种边界情况让人头疼。

## 翻车1：重复编码

```javascript
// ❌ 编码后再次编码
const encoded = encodeURIComponent(name);
const doubleEncoded = encodeURIComponent(encoded);

// ✅ 只编码一次
if (!/%[0-9A-F]{2}/i.test(value)) {
  value = encodeURIComponent(value);
}
```

## 翻车2：&符号未编码

```javascript
// ❌ 参数值中含有&但未编码
const params = 'name=张三&extra=foo&bar';

// ✅ 对每个参数值单独编码
const encodedParams = [['name','张三'],['extra','foo&bar']]
  .map(([k,v]) => `\${encodeURIComponent(k)}=\${encodeURIComponent(v)}`).join('&');
```

## 翻车3：Path和Query混淆

```
// ❌ 对整个URL使用encodeURIComponent
encodeURIComponent('https://example.com/api?name=张三');
// 协议、域名、斜杠都被编码了！

// ✅ 使用URLSearchParams
new URLSearchParams({ 'name': '张三' }).toString();
```

## 常见问题 FAQ

Q: 为什么encodeURIComponent('?')返回%3F而不是?？
A: ?是URL语法字符，在参数值中需要编码以避免歧义。

Q: URL编码和HTML实体编码有什么区别？
A: URL编码用于URL中的特殊字符；HTML实体编码用于HTML文档中的特殊字符。

---

## 相关工具推荐

**URL 编解码** — URL 编码、解码与参数还原，中文不乱码。

在线使用：[URL 编解码](https://clovertools.cn/tools/dev/url-encode/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
