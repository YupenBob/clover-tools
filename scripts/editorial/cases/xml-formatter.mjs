// XML 格式化工具文章（slug: xml-formatter）的截图用例。
// 只做真实页面操作 + 真实截图：填入样例，点击站内工具自己的按钮，截取工作区。
export default async function ({ page, base, shot }) {
  await page.goto(`${base}/tools/dev/xml-formatter/`);
  await page.waitForSelector('#xmlInput');

  const workspace = page.locator('.tool-workspace');

  // 1) 格式化一段压缩写法的 XML：声明被替换、两空格缩进、文本单独一行
  await page.fill(
    '#xmlInput',
    '<catalog><book id="1"><title>XML 入门</title><price currency="CNY">59</price></book><book id="2"><title>规范与实践</title><price currency="CNY">88</price></book></catalog>',
  );
  await page.click('#xmlFmt');
  await page.waitForFunction(
    () =>
      document.querySelector('#xmlStatus')?.textContent?.includes('格式化完成') &&
      document.querySelector('#xmlOutput')?.value?.includes('<catalog>'),
  );
  await shot(workspace, 'format-sample.jpg', {
    alt: 'XML 格式化工具把一行压缩的 catalog 数据展开成多行，补上 XML 声明并按两空格逐层缩进',
    caption: '同一段压缩写法的 XML 经格式化后补上固定声明、按两空格缩进展开，文本内容单独成行，状态栏显示格式化完成',
    source: '/tools/dev/xml-formatter/',
    purpose: '展示格式化会补声明、改缩进并重排元素，且在浏览器本地完成',
  });

  // 2) 压缩一段带注释与 CDATA 的 XML：注释与 CDATA 不进入输出
  await page.fill(
    '#xmlInput',
    '<article>\n  <!-- 草稿，发布前删除 -->\n  <title>XML 压缩</title>\n  <body><![CDATA[x < y 的原始文本]]></body>\n</article>',
  );
  await page.click('#xmlMin');
  await page.waitForFunction(
    () =>
      document.querySelector('#xmlStatus')?.textContent?.includes('压缩完成') &&
      (document.querySelector('#xmlOutput')?.value?.length ?? 0) > 0,
  );
  await shot(workspace, 'minify-sample.jpg', {
    alt: 'XML 压缩工具把带注释与 CDATA 的 XML 压成一行，注释和 CDATA 里的文本没有出现在输出中',
    caption: '压缩后标签间空白消失、结果只剩一行；注释与 CDATA 段没有进入输出，状态栏显示压缩完成',
    source: '/tools/dev/xml-formatter/',
    purpose: '展示压缩的去空白效果，以及注释与 CDATA 在压缩路径上被丢弃',
  });
}
