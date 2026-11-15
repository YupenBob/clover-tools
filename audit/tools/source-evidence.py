import subprocess,pathlib,hashlib,json,re,collections
out=pathlib.Path('audit/evidence'); files=['src/lib/ads.ts','src/components/AdUnit.astro','src/components/GridAdFiller.astro','src/layouts/BaseLayout.astro','src/layouts/ToolLayout.astro','src/styles/global.css','src/styles/tool-workspace.css','src/styles/fun-workspaces.css','src/pages/index.astro','src/components/GuideArticle.astro','src/lib/hls/copy.ts','src/lib/hls/playlist.ts','src/lib/hls/downloader.ts','src/components/M3u8Downloader.astro','config/routes.mjs','public/_redirects','src/pages/robots.txt.ts']
head='2de17e51ae2b7fc8983a6964e31ade6c61dfd816';records=[]
for f in files:
 p=subprocess.run(['git','show',head+':'+f],capture_output=True)
 if p.returncode:continue
 target=out/'source-baseline'/f;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.stdout);records.append({'file':f,'head':head,'sha256':hashlib.sha256(p.stdout).hexdigest()})
(out/'source-baseline.json').write_text(json.dumps(records,indent=2)+'\n')
clusters=collections.defaultdict(list)
for r in json.loads((out/'page-metrics.json').read_text()):
 if r['type']!='工具':continue
 f=pathlib.Path('dist')/r['_path'].lstrip('/')/'index.html';h=f.read_text(); labels=tuple(re.sub('<[^>]*>','',x).strip() for x in re.findall('<h2[^>]*>(.*?)</h2>',h,re.S));clusters[(r['lang'],labels)].append(r['_path'])
result=[{'lang':k[0],'h2':list(k[1]),'pages':v,'count':len(v)}for k,v in clusters.items() if len(v)>1];result.sort(key=lambda x:-x['count'])
(out/'structure-clusters.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print([(x['lang'],x['count'],x['h2']) for x in result[:8]])

phrases=['先看示例，再把步骤带回工具','结果用于生产系统前','输入内容在浏览器本地处理。请勿把真实密码']
boiler={x:[] for x in phrases}
for r in json.loads((out/'page-metrics.json').read_text()):
 if r['type']!='指南':continue
 h=(pathlib.Path('dist')/r['_path'].lstrip('/')/'index.html').read_text()
 for phrase in phrases:
  if phrase in h:boiler[phrase].append(r['_path'])
(out/'guide-boilerplate-clusters.json').write_text(json.dumps(boiler,ensure_ascii=False,indent=2)+'\n')
