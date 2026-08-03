# HTML实体编码详解 - 三种表示方式、XSS防护、实战代码

> 详解HTML实体编码的三种格式（命名/十进制/十六进制），以及XSS注入防护中的正确使用方法。

## 什么是HTML实体编码？

HTML实体编码是将特殊字符转换为HTML实体（Entity）的方法。HTML实体以 & 开头，以 ; 结尾，例如 &lt; 代表小于号（<），&amp; 代表和号（&）。这种方式可以确保特殊字符在HTML文档中被正确显示，而不会被浏览器解析为HTML标签或产生其他意外效果。

## 为什么需要HTML实体编码？

在网页中展示用户输入的内容时，如果不进行HTML实体编码，恶意用户可能通过输入 <script>alert('XSS')</script> 来实施XSS（跨站脚本）攻击。将所有特殊字符转义为HTML实体，是防止XSS的基础手段之一。

## 常用HTML实体

| 字符 | 实体名称 | 十进制 |
| --- | --- | --- |
| < | &lt; | < |
| > | &gt; | > |
| & | &amp; | & |
| " | &quot; | " |
| ' | &apos; | ' |
| 空格 |  |  |

## JavaScript中的HTML实体编码

```javascript
function htmlEscape(str) {
  return str.replace(/[&<>"']/g, match => ({
    '&': '&', '<': '<', '>': '>',
    '"': '"', "'": '''
  }[match]));
}
```

## 使用场景

- 用户生成内容展示：论坛帖子、评论区、用户昵称等必须HTML转义
- 邮件内容渲染：HTML邮件中的特殊字符同样需要编码
- 富文本编辑：如果允许用户输入HTML，需要在渲染前做白名单过滤

## 注意事项

HTML实体编码只对HTML上下文有效。如果字符串要插入到JavaScript、CSS、URL等上下文，还需要使用对应上下文的转义规则。跨站脚本防护是一个系统工程，需要根据不同上下文选择正确的转义策略。

---

## 相关工具推荐

**HTML 格式化与实体转换** — HTML 美化压缩，标签实体编码解码。

在线使用：[HTML 格式化与实体转换](https://clovertools.cn/tools/dev/html-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
