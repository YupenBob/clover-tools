# 文章截图 / 浏览器验证用例

每个 `<slug>.mjs` 对应一篇自动文章，由 Writer 子代理编写、Lead 通过
`node scripts/editorial/capture-tool.mjs --slug <slug>` 执行：

```js
// 默认导出 async 函数；帮助函数由 capture-tool 注入
export default async function ({ page, base, shot }) {
  await page.goto(`${base}/tools/dev/uuid-generator/`);
  await page.fill('#uuid-count', '5');
  const panel = page.locator('.uuid-output');
  await shot(panel, 'uuid-output', {
    alt: 'UUID 生成结果面板',
    caption: '输入 5 条后工具实际输出',
    source: '/tools/dev/uuid-generator/',
    purpose: '演示批量生成结果',
  });
}
```

约束：
- 只用真实页面操作与真实截图，不做图像生成或二次重绘；
- 截图文件名由 `<slug>-<name>` 自动加前缀，登记到 `public/article-images/<YYYY-MM>/captures.json`；
- 用例必须可重复运行（固定视口 1280×1000、简体、浅色、禁用动画）；
- 用例失败时不要留下半成品文件：确认选择器后再提交用例。

规范见 `docs/EDITORIAL-AUTOMATION.md`。
