/**
 * Markdown 编辑器功能冒烟测试。
 * 用法：node scripts/smoke-markdown.mjs
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://localhost:4321') + '/tools/dev/markdown/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.message)));

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
}

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

// 1. 默认示例已渲染到预览
const previewText = await page.locator('#mdPreview').innerText();
check('默认内容渲染', previewText.includes('CloverTools'));

// 2. 输入 → 预览更新
await page.locator('#mdSource').fill('**加粗测试**\n\n- 列表项');
await page.waitForTimeout(400);
const previewHtml = await page.locator('#mdPreview').innerHTML();
check('输入实时渲染', previewHtml.includes('<strong>') && previewHtml.includes('<ul>'));

// 3. 选中文本 + 加粗按钮
await page.locator('#mdSource').fill('hello world');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  el.setSelectionRange(0, 5);
});
await page.locator('.md-tbtn[data-cmd="bold"]').click();
const boldVal = await page.locator('#mdSource').inputValue();
check('加粗按钮', boldVal.includes('**hello**'), boldVal);

// 4. 标题按钮
await page.locator('#mdSource').evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
await page.locator('.md-tbtn[data-cmd="h1"]').click();
const h1Val = await page.locator('#mdSource').inputValue();
check('标题按钮', h1Val.includes('# '));

// 5. 视图切换
await page.locator('.md-view[data-view="preview"]').click();
const bodyClass = await page.locator('#mdBody').getAttribute('class');
check('预览视图', bodyClass.includes('preview'));
await page.locator('.md-view[data-view="split"]').click();

// 6. 草稿保存
const draft = await page.evaluate(() => localStorage.getItem('ct-markdown-draft'));
check('草稿保存', Boolean(draft && draft.includes('hello')));

// 7. 导出按钮存在
for (const id of ['mdCopyMd', 'mdCopyHtml', 'mdDownloadMd', 'mdDownloadHtml']) {
  check(`导出按钮 ${id}`, (await page.locator('#' + id).count()) === 1);
}

// 8. 状态栏
const stats = await page.locator('#mdStats').innerText();
check('状态栏统计', /字符/.test(stats), stats);

// 9. 代码高亮
await page.locator('#mdSource').fill('```js\nconst x = 42; // 注释\n```');
await page.waitForTimeout(400);
const hlHtml = await page.locator('#mdPreview').innerHTML();
check('代码高亮', hlHtml.includes('hl-kw') && hlHtml.includes('hl-num') && hlHtml.includes('hl-cmt'));

// 10. 撤销 / 重做
await page.locator('#mdSource').fill('hello world');
await page.waitForTimeout(800);
await page.keyboard.press('Control+z');
await page.waitForTimeout(200);
const afterUndo = await page.locator('#mdSource').inputValue();
check('撤销', afterUndo === 'hello world', `got: ${afterUndo.slice(0, 30)}`);
await page.keyboard.press('Control+y');
await page.waitForTimeout(200);
const afterRedo = await page.locator('#mdSource').inputValue();
check('重做', afterRedo.includes('hello world'), `got: ${afterRedo.slice(0, 30)}`);

// 11. 表格按钮
await page.locator('.md-tbtn[data-cmd="table"]').click();
const tableVal = await page.locator('#mdSource').inputValue();
check('表格按钮', tableVal.includes('| 列1 |'));

// 12. 帮助弹窗
await page.locator('.md-tbtn[data-cmd="help"]').click();
await page.waitForTimeout(200);
check('帮助弹窗打开', await page.locator('#mdModal').isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('帮助弹窗关闭', !(await page.locator('#mdModal').isVisible()));

// 13. 全屏按钮存在
check('全屏按钮', (await page.locator('.md-tbtn[data-cmd="fullscreen"]').count()) === 1);

// 14. 回车续行（列表自动延续）
await page.locator('#mdSource').fill('- 第一项');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const listVal = await page.locator('#mdSource').inputValue();
check('回车续行', listVal === '- 第一项\n- ', `got: ${JSON.stringify(listVal)}`);

// 15. 目录大纲
await page.locator('#mdSource').fill('# 标题一\n\n## 标题二\n\n### 标题三');
await page.waitForTimeout(400);
await page.locator('.md-tbtn[data-cmd="toc"]').click();
await page.waitForTimeout(200);
const tocVisible = await page.locator('#mdToc').isVisible();
const tocLinks = await page.locator('#mdToc a').count();
check('目录大纲', tocVisible && tocLinks === 3, `links: ${tocLinks}`);

// 16. Ctrl+1 标题
await page.locator('#mdSource').fill('一段文字');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
});
await page.keyboard.press('Control+1');
await page.waitForTimeout(200);
const ctrl1Val = await page.locator('#mdSource').inputValue();
check('Ctrl+1 标题', ctrl1Val.startsWith('# '), ctrl1Val.slice(0, 20));

// 17. 富文本复制按钮
check('富文本按钮', (await page.locator('#mdCopyRich').count()) === 1);

console.log(errors.length ? `\nJS 报错:\n${errors.join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
