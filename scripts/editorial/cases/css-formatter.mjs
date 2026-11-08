// CSS 格式化工具文章（slug: css-formatter）的截图用例。
// 只做真实页面操作 + 真实截图：填入样例，点击站内工具自己的按钮，截取工作区。
export default async function ({ page, base, shot }) {
  await page.goto(`${base}/tools/dev/css-formatter/`);
  await page.waitForSelector('#cssInput');

  const workspace = page.locator('.tool-workspace');

  // 1) 格式化一段压缩过的样式表：缩进、换行与声明拆分
  await page.fill(
    '#cssInput',
    '.card{margin:0 auto;padding:16px;border-radius:8px}.card h2{font-size:18px;color:#c9a96e}@media(max-width:640px){.card{padding:8px}}',
  );
  await page.click('#cssFmt');
  await page.waitForFunction(() => document.querySelector('#cssOutput').value.includes('border-radius'));
  await shot(workspace, 'format-sample.jpg', {
    alt: 'CSS 格式化工具把压缩写法的样式表展开成带缩进的多行结果',
    caption: '同一段压缩写法经格式化后按选择器与声明展开，@media 里的规则多缩进一层',
    source: '/tools/dev/css-formatter/',
    purpose: '展示格式化只重排空白、注释被丢弃，且在浏览器本地完成',
  });

  // 2) 勾选属性排序：简写 font 被排到 font-size 之前，最终字号由 font-size 决定
  await page.fill('#cssInput', '.cascade-test{font-size:20px;font:14px serif}');
  await page.check('#cssSort');
  await page.click('#cssFmt');
  await page.waitForFunction(() => document.querySelector('#cssOutput').value.includes('font: 14px serif'));
  await shot(workspace, 'sort-cascade.jpg', {
    alt: 'CSS 格式化工具勾选属性排序后 font 简写被排到 font-size 之前',
    caption: '排序按属性名字典序进行：font 被提前、font-size 落到最后，简写对字号的覆盖关系随之改变',
    source: '/tools/dev/css-formatter/',
    purpose: '展示属性排序会改变声明先后，从而改变层叠结果',
  });
}
