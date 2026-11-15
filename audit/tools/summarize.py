import json,re,pathlib,hashlib,collections
p=pathlib.Path('audit/evidence');results=json.loads((p/'http-results.json').read_text());summary=[]
for r in results:
 f=p/(r['name']+'.html')
 if not f.exists():continue
 h=f.read_text(errors='replace'); main=re.search(r'<main\b[^>]*>([\s\S]*?)</main>',h);main=main[1] if main else h
 def tags(kind):return re.findall('<'+kind+r'\b[^>]*>',h)
 def attr(t,a):
  m=re.search(r'\b'+a+r'=["\']([^"\']*)',t);return m[1] if m else ''
 metas={attr(t,'name'):attr(t,'content') for t in tags('meta') if attr(t,'name')}
 links=tags('link')
 d={k:r.get(k) for k in ['name','http_code','url_effective','exit']};d.update(title=(re.findall(r'<title>(.*?)</title>',h)or[''])[0],description=metas.get('description',''),canonical=[attr(t,'href') for t in links if attr(t,'rel')=='canonical'],robots=metas.get('robots',''),hreflang={attr(t,'hreflang'):attr(t,'href') for t in links if attr(t,'hreflang')},adsbygoogle=len(re.findall('adsbygoogle',h)),adContainers=len(re.findall(r'class=["\'][^"\']*(?:ad-slot|grid-filler)',h)),sitemapLocs=len(re.findall('<loc>',h)),guideLinksMain=len(re.findall(r'href=["\']/guides/',main)),markers={x:bool(re.search(x,h)) for x in ['home-sidebar','今日运势','站点数据','推荐工具','推荐文章','github.com/YupenBob','tools.xsanye.cn']},sha256=hashlib.sha256(f.read_bytes()).hexdigest())
 if r['name']=='github-api':
  try:d['github_public_api']={k:json.loads(h).get(k) for k in ['full_name','homepage','description','html_url','pushed_at']}
  except:pass
 summary.append(d)
(p/'live-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
for d in summary:print(d['name'],d['http_code'],'ads',d['adsbygoogle'],d['adContainers'],'locs',d['sitemapLocs'],d.get('github_public_api',''))
