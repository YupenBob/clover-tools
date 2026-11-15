import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {TOOLS} from '../../src/lib/tools.ts';
import {GUIDES} from '../../src/lib/guides.ts';
import {TRANSLATED_GUIDES} from '../../src/lib/guides-translated.ts';
import {LOCALES,languageFromPath,stripLanguage,isIndexablePath} from '../../config/routes.mjs';
import {walk,pagePath,htmlTags,attributes,isVerificationFile} from '../../scripts/lib/artifacts.mjs';
const out='audit/evidence', origin='https://clovertools.cn';
const text=h=>h.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;\s]+;/g,' ').replace(/\s+/g,' ').trim();
const words=h=>(text(h).match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}_]+/gu)||[]).length;
const guideMap=new Map();
for(const [lang,list] of Object.entries({zh:GUIDES,...TRANSLATED_GUIDES}))for(const g of list)guideMap.set(`${LOCALES[lang].prefix}/guides/${g.slug}/`,g);
const expected=[];
for(const [lang,locale] of Object.entries(LOCALES))for(const [cat,list] of Object.entries(TOOLS))for(const t of list)expected.push(`${locale.prefix}/tools/${cat}/${t.slug}/`);
for(const p of guideMap.keys())expected.push(p);
const pages=[];const hashes=[];
for(const file of walk('dist').filter(f=>f.endsWith('.html')&&!isVerificationFile(f.slice(5)))){
 const h=fs.readFileSync(file,'utf8'),p=pagePath(file.slice(5)),base=stripLanguage(p),tags=htmlTags(h).map(attributes);
 const canonical=tags.find(t=>t.rel==='canonical')?.href||'';
 const metaRobots=tags.find(t=>t.name==='robots')?.content||'';
 const main=h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||h;
 const primary=main.match(/<(?:article|section)\b[^>]*class="[^"]*(?:guide-content|article-content)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|section)>/i)?.[1]||main;
 const g=guideMap.get(p);
 const type=base==='/'?'首页':/^\/tools\/(dev|daily|fun)\/$/.test(base)?'分类':/^\/tools\//.test(base)?'工具':base.startsWith('/guides/')&&base!='/guides/'?'指南':base==='/guides/'?'分类':'系统页';
 const body=g?g.content:primary;
 const n=words(body),flag=[];
 if(type==='工具'&&n<500)flag.push('short_main_under_500');
 if(type==='指南'&&n<600)flag.push('short_article_under_600');
 if(type==='工具'&&languageFromPath(p)!=='zh')flag.push('localized_tool_review_needed');
 if(type==='指南'&&languageFromPath(p)!=='zh')flag.push('translation_review_needed');
 if(p.includes('m3u8-downloader'))flag.push('streaming_policy_review');
 if(!canonical)flag.push('missing_canonical');
 const risk=flag.includes('streaming_policy_review')?'P0':flag.length?'P1':'P2';
 const links=[...main.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(v=>v.startsWith('/')&&!v.startsWith('//')||v.startsWith(origin));
 pages.push({url:origin+p,type,title:text(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),lang:languageFromPath(p),indexable:isIndexablePath(p)&&!metaRobots.includes('noindex'),canonical,updated:g?.updated||h.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1]||'',approx_word_count:n,internal_links:links.length,thin_or_duplicate_flag:flag.join(';'),risk,_path:p,_text:text(body),_links:links,_mtime:fs.statSync(file).mtime.toISOString()});
 hashes.push({file,mtime:fs.statSync(file).mtime.toISOString(),sha256:crypto.createHash('sha256').update(h).digest('hex')});
}
const paths=new Set(pages.map(p=>p._path));
const broken=[];for(const p of pages)for(const l of new Set(p._links)){let u;try{u=new URL(l,origin)}catch{continue}if(u.origin!==origin)continue;let q;try{q=decodeURIComponent(u.pathname)}catch{continue}if(!paths.has(q)&&!fs.existsSync(path.join('dist',q)))broken.push({from:p._path,to:q});}
const sets=new Map(pages.filter(p=>['工具','指南'].includes(p.type)).map(p=>{const s=p._text.toLowerCase().replace(/\s+/g,'');return[p._path,new Set(Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5)))];}));
const sim=[];for(let i=0;i<pages.length;i++)for(let j=i+1;j<pages.length;j++){const a=pages[i],b=pages[j];if(a.type!==b.type||a.lang!==b.lang||!sets.has(a._path)||!sets.has(b._path))continue;const x=sets.get(a._path),y=sets.get(b._path);let common=0;for(const z of x)if(y.has(z))common++;const score=common/(x.size+y.size-common||1);if(score>=0.45)sim.push({a:a._path,b:b._path,jaccard_5char:+score.toFixed(3)});}
sim.sort((a,b)=>b.jaccard_5char-a.jaccard_5char);
const columns=['url','type','title','lang','indexable','canonical','updated','approx_word_count','internal_links','thin_or_duplicate_flag','risk'];
const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
fs.writeFileSync('audit/content-quality.csv',[columns,...pages.map(p=>columns.map(k=>p[k]))].map(r=>r.map(quote).join(',')).join('\n')+'\n');
const files=fs.readdirSync('data/editorial-guides').filter(f=>f.endsWith('.json'));
const unregistered=[];for(const f of files){const d=JSON.parse(fs.readFileSync('data/editorial-guides/'+f));if(!d.slug||!d.content)continue;const lang=f.match(/\.(tw|en|ko|ja)\.json$/)?.[1]||'zh';if(!guideMap.has(`${LOCALES[lang].prefix}/guides/${d.slug}/`))unregistered.push({file:f,slug:d.slug,lang});}
const summary={generatedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTools:Object.fromEntries(Object.entries(TOOLS).map(([k,v])=>[k,v.length])),sourceToolsTotal:Object.values(TOOLS).flat().length,registeredGuides:Object.fromEntries(Object.entries({zh:GUIDES,...TRANSLATED_GUIDES}).map(([k,v])=>[k,v.length])),unregisteredJson:unregistered,distPages:pages.length,indexable:pages.filter(p=>p.indexable).length,byType:Object.fromEntries([...new Set(pages.map(p=>p.type))].map(t=>[t,pages.filter(p=>p.type===t).length])),missingExpected:expected.filter(p=>!paths.has(p)),distMtimeMin:hashes.map(x=>x.mtime).sort()[0],distMtimeMax:hashes.map(x=>x.mtime).sort().at(-1),brokenInternalTargets:broken.length,similarPairs:sim.length,topRisk:pages.filter(p=>p.risk==='P0'||p.thin_or_duplicate_flag.startsWith('short')).map(({url,approx_word_count,thin_or_duplicate_flag,risk})=>({url,approx_word_count,thin_or_duplicate_flag,risk}))};
for(const [name,data] of Object.entries({'content-summary':summary,'dist-manifest':hashes,'similarity':sim,'internal-links':broken,'page-metrics':pages.map(({_text,_links,...p})=>p)}))fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
