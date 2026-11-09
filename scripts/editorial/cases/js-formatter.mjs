// JavaScript 格式化工具文章（slug: js-formatter）的截图用例。
// 只做真实页面操作 + 真实截图：填入样例，点击站内工具自己的按钮，截取工作区。
export default async function ({ page, base, shot }) {
  await page.goto(`${base}/tools/dev/js-formatter/`);
  await page.waitForSelector('#jsInput');

  const workspace = page.locator('.tool-workspace');

  // 1) 格式化一段压缩写法的代码：引号、分号、缩进与换行变化
  await page.fill(
    '#jsInput',
    'const tools=["json","base64"];function greet(name){return "Hello "+name} const upper=tools.map(t=>t.toUpperCase());console.log(greet("Clover"),upper)',
  );
  await page.click('#jsFmt');
  await page.waitForFunction(
    () =>
      document.querySelector('#jsStatus')?.textContent?.includes('格式化完成') &&
      document.querySelector('#jsOutput')?.value?.includes("const tools = ['json', 'base64'];"),
  );
  await shot(workspace, 'format-sample.jpg', {
    alt: 'JavaScript 格式化工具把压缩写法展开成多行，双引号变单引号、语句补分号并缩进',
    caption: '同一段压缩写法经格式化后按语句换行，字符串引号统一为单引号，缺分号的语句被补上分号，状态栏显示格式化完成',
    source: '/tools/dev/js-formatter/',
    purpose: '展示格式化除了空白之外还会改引号与分号，且在浏览器本地完成',
  });

  // 2) 压缩一段带长变量名与注释的函数：改名、去注释、长度下降
  await page.fill(
    '#jsInput',
    '// 统计订单总价\nfunction calculateOrderTotal(orderItems, taxRate) { const subtotal = orderItems.reduce((accumulator, item) => accumulator + item.price * item.quantity, 0); return subtotal * (1 + taxRate); }\nconsole.log(calculateOrderTotal([{ price: 12, quantity: 2 }], 0.1));',
  );
  await page.click('#jsMin');
  await page.waitForFunction(
    () =>
      document.querySelector('#jsStatus')?.textContent?.includes('压缩完成') &&
      (document.querySelector('#jsOutput')?.value?.length ?? 0) > 0,
  );
  await shot(workspace, 'minify-sample.jpg', {
    alt: 'JavaScript 压缩工具把带长参数名与注释的函数压成一行，参数被改名、注释被删除',
    caption: '压缩后长参数名与局部变量被缩短、注释被删除，函数体压成一行，状态栏显示压缩完成且字符数明显下降',
    source: '/tools/dev/js-formatter/',
    purpose: '展示压缩会改名、删注释并缩短输出，与格式化方向相反',
  });
}
