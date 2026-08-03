/**
 * Markdown 编辑器功能冒烟测试。
 * 用法：node scripts/smoke-markdown.mjs
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

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

// 18. 任务列表回车续行
await page.locator('#mdSource').fill('- [ ] 待办');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const taskVal = await page.locator('#mdSource').inputValue();
check('任务列表续行', taskVal === '- [ ] 待办\n- [ ] ', JSON.stringify(taskVal));

// 19. 代码块内回车不续行
await page.locator('#mdSource').fill('```\n- 代码内容\n```');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  const idx = el.value.indexOf('- 代码内容') + '- 代码内容'.length;
  el.setSelectionRange(idx, idx);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const fenceVal = await page.locator('#mdSource').inputValue();
check('代码块内不续行', fenceVal.includes('```\n- 代码内容\n\n```'), JSON.stringify(fenceVal));

// 20. 空列表项回车退出列表
await page.locator('#mdSource').fill('- \n后文');
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  el.setSelectionRange(2, 2);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const exitVal = await page.locator('#mdSource').inputValue();
check('空列表项退出', exitVal === '\n后文', JSON.stringify(exitVal));

// 21. 查找 / 替换（Ctrl+F）
await page.locator('#mdSource').fill('hello world hello');
await page.keyboard.press('Control+f');
await page.waitForTimeout(150);
check('查找栏打开', await page.locator('#mdFindBar').isVisible());
await page.locator('#mdFind').fill('hello');
await page.waitForTimeout(150);
const findCountText = await page.locator('#mdFindCount').innerText();
check('查找计数', findCountText.includes('2 个匹配'), findCountText);
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
const selAfterFind = await page.locator('#mdSource').evaluate((el) => {
  const s = el.selectionStart;
  const e2 = el.selectionEnd;
  return el.value.slice(s, e2);
});
check('查找选中', selAfterFind === 'hello', selAfterFind);
await page.locator('#mdReplace').fill('hi');
await page.locator('#mdReplaceAll').click();
await page.waitForTimeout(150);
const afterReplace = await page.locator('#mdSource').inputValue();
check('全部替换', afterReplace === 'hi world hi', afterReplace);

// 22. 预览代码块复制按钮
await page.locator('#mdSource').fill('```js\nconst a = 1;\n```');
await page.waitForTimeout(400);
const copyBtnCount = await page.locator('#mdPreview .code-copy-btn').count();
check('代码复制按钮', copyBtnCount === 1, `count=${copyBtnCount}`);

// 23. 字数目标
await page.locator('#mdTarget').fill('10');
await page.locator('#mdTarget').dispatchEvent('change');
await page.waitForTimeout(100);
const targetStats = await page.locator('#mdStats').innerText();
check('字数目标', /\/10 字/.test(targetStats), targetStats);

// 24. 带样式 HTML 下载（富文本/导出共用 styledHtml）
await page.locator('#mdSource').fill('# 标题\n\n**加粗**');
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.locator('#mdDownloadHtml').click(),
]);
const dlPath = await download.path();
const dlHtml = readFileSync(dlPath, 'utf8');
check('HTML 下载含样式', dlHtml.includes('<style>') && dlHtml.includes('<h1>') && dlHtml.includes('border-bottom'), `len=${dlHtml.length}`);

// 25. 打开本地 .md 文件
page.on('dialog', (d) => d.accept());
await page.locator('#mdOpenFile').setInputFiles({
  name: 'import.md',
  mimeType: 'text/markdown',
  buffer: Buffer.from('# 导入内容\n\n导入成功'),
});
await page.waitForTimeout(300);
const imported = await page.locator('#mdSource').inputValue();
check('打开 .md 文件', imported.includes('# 导入内容'), imported.slice(0, 20));

// 26. 导出文件名取标题
await page.locator('#mdSource').fill('# 我的标题\n\n正文');
await page.waitForTimeout(300);
const [dl2] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.locator('#mdDownloadHtml').click(),
]);
check('导出文件名取标题', dl2.suggestedFilename() === '我的标题.html', dl2.suggestedFilename());

// 27. 源码行号
await page.locator('#mdSource').fill('第一行\n第二行\n第三行');
await page.waitForTimeout(200);
const lineNums = await page.locator('#mdLines').innerText();
check('行号渲染', lineNums.trim() === '1\n2\n3', JSON.stringify(lineNums.slice(0, 20)));

// 27b. 当前行高亮
await page.locator('#mdSource').evaluate((el) => {
  el.focus();
  const idx = el.value.indexOf('第二行');
  el.setSelectionRange(idx, idx);
  el.dispatchEvent(new Event('click', { bubbles: true }));
});
await page.waitForTimeout(150);
const activeLineInfo = await page.locator('#mdLines').evaluate((el) => {
  const spans = el.querySelectorAll('span');
  let active = -1;
  spans.forEach((s, i) => { if (s.classList.contains('md-line-active')) active = i + 1; });
  return { count: spans.length, active };
});
check('当前行高亮', activeLineInfo.active === 2 && activeLineInfo.count === 3, JSON.stringify(activeLineInfo));

// 27c. 段落数统计
await page.locator('#mdSource').fill('第一段\n\n第二段\n\n第三段');
await page.waitForTimeout(300);
const paraStats = await page.locator('#mdStats').innerText();
check('段落数统计', /3 段/.test(paraStats), paraStats);

// 行号随源码滚动同步
await page.locator('#mdSource').fill('第一行\n第二行\n第三行\n第四行\n第五行\n第六行\n第七行\n第八行\n第九行\n第十行\n第十一行\n第十二行\n第十三行\n第十四行\n第十五行\n第十六行\n第十七行\n第十八行\n第十九行\n第二十行');
await page.waitForTimeout(200);
await page.locator('#mdSource').evaluate((el) => { el.scrollTop = 100; });
await page.waitForTimeout(300);
const linesScroll = await page.locator('#mdLines').evaluate((el) => el.scrollTop);
check('行号滚动同步', linesScroll > 0, `linesScroll=${Math.round(linesScroll)}`);

console.log(errors.length ? `\nJS 报错:\n${errors.join('\n')}` : '\n无 JS 报错');
await browser.close();
process.exit(results.some((r) => !r.ok) || errors.length ? 1 : 0);
