/** P3-only evidence; reads a completed dist via a dedicated Astro preview. */
import assert from 'node:assert/strict';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:4337';
const out = 'audit/evidence/p3';
await mkdir(out, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const initialHash = await digest('dist/index.html');
const evidence = { startedAt: new Date().toISOString(), head, base, buildHomeSha256: initialHash, buildHomeMtime: (await stat('dist/index.html')).mtime.toISOString(), captures: [], layouts: [], locales: [], guides: [], cls: [], errors: [] };
const browser = await chromium.launch({ executablePath: '.playwright-browsers/chromium-1234/chrome-linux/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const widthMetrics = page => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.getBoundingClientRect().width, bodyScrollWidth: document.body.scrollWidth }));
const ads = page => page.locator('ins.adsbygoogle, .ad-slot, [data-grid-filler], script[src*="adsbygoogle"], script[src*="pagead2.googlesyndication"]').count();
async function contextFor(theme, width, height, lang = 'zh') {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: theme, reducedMotion: 'reduce' });
  await context.addInitScript(({ theme, lang }) => { localStorage.setItem('clover-theme', theme); localStorage.setItem('clover-lang', lang); }, { theme, lang });
  return context;
}
async function capture(page, name, fullPage = false, locator = null) {
  const path = `audit/screenshots/after-${name}.png`;
  await (locator || page).screenshot({ path, fullPage: locator ? undefined : fullPage, animations: 'disabled' });
  evidence.captures.push({ path, url: page.url(), at: new Date().toISOString(), viewport: page.viewportSize(), fullPage, theme: await page.locator('html').getAttribute('data-theme'), sha256: await digest(path) });
}
try {
  for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop',1280,900],['mobile',390,844]]) {
    const context = await contextFor(theme, width, height);
    const page = await context.newPage();
    page.on('pageerror', error => evidence.errors.push({ url: page.url(), message: error.message }));
    const requests = [];
    page.on('request', req => { if (/googlesyndication|doubleclick|googleadservices/.test(req.url())) requests.push(req.url()); });
    assert.equal((await page.goto(base, { waitUntil: 'networkidle' })).status(), 200);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const firstScreen = await page.evaluate(() => Object.fromEntries(['.hero-sub','#toolSearch','.home-tabs','.home-featured','.home-guides','.home-fortune'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [selector, { top:r.top, bottom:r.bottom, visibleInFirstScreen:r.top < innerHeight && r.bottom > 0 }]; })));
    await capture(page, `home-${device}-${theme}-top`);
    await page.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=600) { scrollTo({top:y,behavior:'instant'}); await new Promise(r=>setTimeout(r,40)); } await Promise.all([...document.images].filter(img=>img.getClientRects().length).map(img=>img.decode().catch(()=>{}))); scrollTo({top:0,behavior:'instant'}); });
    await capture(page, `home-${device}-${theme}-full`, true);
    const images = await page.locator('.hero img, .home-discovery img').evaluateAll(images => images.map(img => ({ src:img.getAttribute('src'), alt:img.getAttribute('alt'), width:img.getAttribute('width'), height:img.getAttribute('height'), naturalWidth:img.naturalWidth, naturalHeight:img.naturalHeight, loaded:img.complete })));
    assert.ok(images.every(img=>img.alt && Number(img.width)>0 && Number(img.height)>0 && img.naturalWidth>0));
    const decorativeGenericIcons=await page.locator('.home-pick-visual .icon,.home-side-card h2 .icon').count();
    assert.equal(decorativeGenericIcons,0);
    const footerContrast=await page.locator('.home-footer').evaluate(el=>{const lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=lum(getComputedStyle(el.querySelector('.footer-project-links a')).color),b=lum(getComputedStyle(el).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
    assert.ok(footerContrast>=4.5);
    for (const [name, selector] of Object.entries({stats:'.home-stats', 'recommended-articles':'.home-recommended-guides', guides:'.home-guides', 'recommended-tools':'.home-recommended-tools', fortune:'.home-fortune', footer:'.home-footer'})) {
      const module = page.locator(selector);
      const box = await module.boundingBox();
      await page.setViewportSize({width,height:Math.max(height,Math.ceil(box.height)+140)});
      await module.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      await page.evaluate(()=>scrollBy({top:-85,behavior:'instant'}));
      await module.evaluate(async el=>Promise.all([...el.querySelectorAll('img')].map(img=>img.decode())));
      await capture(page, `home-${device}-${theme}-${name}`, false, module);
    }
    for (const testWidth of [320,390,768,1280]) {
      await page.setViewportSize({width:testWidth,height});
      await page.reload({waitUntil:'networkidle'});
      const metrics = await widthMetrics(page);
      const cards = await page.locator('.home-pick,.home-guide-card').evaluateAll(cards=>cards.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
      const overlaps = cards.flatMap((a,i)=>cards.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
      assert.equal(overlaps.length,0);
      assert.ok(metrics.scrollWidth<=metrics.viewport,JSON.stringify(metrics));
      await page.locator('#cat-fun').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      await page.evaluate(()=>scrollBy({top:-85,behavior:'instant'}));
      await page.waitForTimeout(150);
      const category = await page.locator('#cat-fun').evaluate(el=>({contentVisibility:getComputedStyle(el).contentVisibility, cardHeight:el.querySelector('.tool-card').getBoundingClientRect().height}));
      assert.ok(category.cardHeight>0);
      await capture(page, `directory-${device}-${theme}-${testWidth}`);
      evidence.layouts.push({theme,device,testWidth,...metrics,overlaps:overlaps.length,category});
    }
    assert.equal(await ads(page),0); assert.equal(requests.length,0);
    evidence.layouts.push({theme,device,firstScreen,images,decorativeGenericIcons,footerContrast,adNodes:0,adRequests:requests});
    await context.close();
  }
  for (const [lang,prefix] of [['zh',''],['tw','/zh-hant'],['en','/en'],['ko','/ko'],['ja','/ja']]) {
    const context = await contextFor('light',390,844,lang);
    const page = await context.newPage();
    await page.goto(base+prefix+'/',{waitUntil:'networkidle'});
    const links = [...new Set(await page.locator('.home-discovery a,.site-footer a').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(href=>href.startsWith('/')&&!href.startsWith('/#'))))];
    const checked = [];
    for (const href of links) { const response=await context.request.get(base+href); checked.push({href,status:response.status()}); assert.equal(response.status(),200,href); }
    const fallbacks = await page.locator('.home-guide-card').evaluateAll(cards=>cards.map(card=>({text:card.querySelector('.home-guide-meta').textContent,href:card.querySelector('h3 a').getAttribute('href'),tool:card.querySelector('.home-guide-actions a:last-child').getAttribute('href')})));
    const stats = await page.locator('.home-stat-numbers dd').allTextContents();
    const fortune = await page.locator('[data-fortune-message]').textContent();
    await page.reload({waitUntil:'networkidle'}); assert.equal(await page.locator('[data-fortune-message]').textContent(),fortune);
    await page.goto(base+prefix+'/?q=json',{waitUntil:'networkidle'});
    assert.equal(await page.locator('#toolSearch').inputValue(),'json');
    await page.waitForFunction(()=>document.querySelector('.home-discovery').classList.contains('is-filtering'));
    const searchMatches=await page.locator('.tool-card:visible').count(); assert.ok(searchMatches>0);
    await page.locator('#toolSearch').fill('zzzz-no-such-tool-zzzz'); await page.locator('#searchEmpty.show').waitFor(); await page.locator('#emptyReset').click();
    const resetCount=await page.locator('.tool-card:visible').count();
    await page.locator('[data-tab="dev"]').click(); assert.equal(await page.locator('[data-category]:visible').count(),1);
    await page.locator('[data-tab="all"]').click();
    assert.equal(await page.locator('.tool-card:visible').count(),resetCount);
    evidence.locales.push({lang,checked,fallbacks,stats,fortuneStable:true,searchMatches,resetCount,filter:'pass'});
    await context.close();
  }
  // Two P0 table defects: compare viewport clientWidth, never expanded innerWidth.
  for (const slug of ['base64-not-encryption','ascii-art']) for (const width of [320,390,768,1280]) {
    const context=await contextFor('light',width,844); const page=await context.newPage();
    await page.goto(`${base}/guides/${slug}/`,{waitUntil:'networkidle'});
    const metrics=await widthMetrics(page);
    assert.ok(metrics.scrollWidth<=metrics.viewport,`${slug}/${width}: ${JSON.stringify(metrics)}`);
    const tables=await page.locator('.article-content table').evaluateAll(tables=>tables.map(el=>{const r=el.getBoundingClientRect(),p=el.parentElement;return {left:r.left,right:r.right,width:r.width,parent:p.className,parentClientWidth:p.clientWidth,parentScrollWidth:p.scrollWidth,overflowX:getComputedStyle(p).overflowX};}));
    evidence.guides.push({slug,width,...metrics,tables});
    if(width===390){
      const index=tables.findIndex(table=>table.parentScrollWidth>table.parentClientWidth);
      const table=page.locator('.article-content table').nth(Math.max(0,index));
      await table.evaluate(el=>el.parentElement.scrollIntoView({block:'center',behavior:'instant'}));
      const scroll=await table.evaluate(el=>{const p=el.parentElement;p.scrollLeft=40;const moved=p.scrollLeft;p.scrollLeft=0;return moved;});
      assert.ok(scroll>0,'Wide table must remain horizontally scrollable locally');
      evidence.guides.at(-1).localScrollLeftVerified=scroll;
      await capture(page,`guide-${slug}-mobile-table`);
    }
    await context.close();
  }
  // True midnight without reloading, plus foreground refresh; clock is only in this test context.
  {
    const context=await contextFor('light',390,844); const page=await context.newPage();
    await page.clock.install({time:new Date('2026-11-15T15:59:40Z')});
    await page.goto(base,{waitUntil:'networkidle'}); await page.clock.pauseAt(new Date('2026-11-15T15:59:50Z'));
    const read=()=>page.locator('[data-home-fortune]').evaluate(el=>({date:el.querySelector('time').dateTime,message:el.querySelector('[data-fortune-message]').textContent}));
    const before=await read(); await page.clock.runFor(11000); const justAfter=await read(); await page.clock.runFor(60000); const tickAfter=await read();
    assert.equal(before.date,'2026-11-15'); assert.equal(tickAfter.date,'2026-11-16'); assert.notEqual(before.message,tickAfter.message);
    await page.clock.setSystemTime(new Date('2026-11-17T00:00:00+08:00'));
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); const foreground=await read(); assert.equal(foreground.date,'2026-11-17');
    evidence.midnight={timezone:'Asia/Shanghai',before,justAfter,tickAfter,foreground,note:'Refresh on the next 60-second tick or foreground visibilitychange; not an exact midnight timeout.'};
    await context.close();
  }
  for(const theme of ['light','dark']) for(const [device,width,height] of [['desktop',1280,900],['mobile',390,844]]) {
    const context=await contextFor(theme,width,height); const page=await context.newPage();
    await page.addInitScript(()=>{window.p3CLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.p3CLS+=e.value;}).observe({type:'layout-shift',buffered:true});});
    await page.goto(base,{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
    const cls=await page.evaluate(()=>window.p3CLS); evidence.cls.push({theme,device,value:cls,window:'initial networkidle + 1500ms, reduced motion, local build'});
    assert.ok(cls<=0.01,JSON.stringify(evidence.cls.at(-1))); await context.close();
  }
  for (const path of ['/tools/dev/json-formatter/','/tools/dev/base64/','/tools/daily/calculator/','/tools/fun/reaction-test/','/tools/daily/m3u8-downloader/','/guides/json-unexpected-token-html/','/about/','/privacy/','/contact/','/terms/']) {
    const context=await contextFor('light',390,844); const page=await context.newPage(); const requests=[];
    page.on('request',r=>{if(/googlesyndication|doubleclick|googleadservices/.test(r.url()))requests.push(r.url());});
    assert.equal((await page.goto(base+path,{waitUntil:'networkidle'})).status(),200); assert.equal(await ads(page),0); assert.equal(requests.length,0);
    (evidence.pageSamples??=[]).push({path,status:200,adNodes:0,adRequests:requests,...await widthMetrics(page)}); await context.close();
  }
  assert.equal(await digest('dist/index.html'),initialHash,'Build changed during capture');
  assert.deepEqual(evidence.errors,[]);
  evidence.completedAt=new Date().toISOString(); evidence.complete=true;
} catch(error) { evidence.failure=error.stack; throw error; }
finally { await writeFile(`${out}/browser.json`,JSON.stringify(evidence,null,2)+'\n'); await browser.close(); }
