// HTML 格式化工具文章（slug: html-formatter）的截图用例。
// 只做真实页面操作 + 真实截图：输入框填入样例，点击站内工具自己的按钮，截取结果面板。
export default async function ({ page, base, shot }) {
  await page.goto(`${base}/tools/dev/html-formatter/`);
  await page.waitForSelector('#htmlInput');

  const workspace = page.locator('.tool-workspace');

  // 1) 格式化整篇文档：doctype 与 head 内容在输出里消失
  const documentHtml =
    '<!DOCTYPE html><html><head><title>页面标题</title></head><body><div class="card"><h2>标题</h2><p>内容 &amp; 更多</p></div></body></html>';
  await page.fill('#htmlInput', documentHtml);
  await page.click('#htmlFmt');
  await page.waitForFunction(() => document.querySelector('#htmlOutput').value.length > 0);
  await shot(workspace, 'format-document.jpg', {
    alt: 'HTML 格式化工具处理整篇文档后的输入与输出对照',
    caption: '输入含 doctype 与 head 的完整文档，格式化后输出只剩 body 内的元素',
    source: '/tools/dev/html-formatter/',
    purpose: '演示格式化以 body 为根，doctype 与 head 内容不会保留',
  });

  // 2) 压缩 <pre>：换行与缩进被折叠成空格
  await page.fill('#htmlInput', '<pre>line1\n    line2</pre>');
  await page.click('#htmlMin');
  await page.waitForFunction(() => document.querySelector('#htmlOutput').value.includes('line1'));
  await shot(workspace, 'minify-pre.jpg', {
    alt: 'HTML 压缩工具把 pre 元素的换行压缩成空格',
    caption: '压缩 <pre> 后换行与缩进合并为一个空格，预格式化文本的排版随之改变',
    source: '/tools/dev/html-formatter/',
    purpose: '演示压缩会折叠空白，含预格式化文本时不能只看体积变小',
  });
}
