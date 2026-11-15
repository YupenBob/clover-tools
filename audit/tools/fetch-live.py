import subprocess,json,datetime,pathlib,concurrent.futures
out=pathlib.Path('audit/evidence');out.mkdir(exist_ok=True)
urls={
'home':'https://clovertools.cn/','tool':'https://clovertools.cn/tools/dev/json-formatter/','guide':'https://clovertools.cn/guides/json-unexpected-token-html/',
'robots':'https://clovertools.cn/robots.txt','ads':'https://clovertools.cn/ads.txt','sitemap-index':'https://clovertools.cn/sitemap-index.xml','sitemap-0':'https://clovertools.cn/sitemap-0.xml','sitemap':'https://clovertools.cn/sitemap.xml',
'404':'https://clovertools.cn/audit-missing-20261115/','http':'http://clovertools.cn/tools/dev/json-formatter/?audit=1','www':'https://www.clovertools.cn/tools/dev/json-formatter/?audit=1','legacy-tool':'https://clovertools.cn/tools/json/formatter.html','legacy-blog':'https://clovertools.cn/blog/audit-missing-20261115',
'github-repo':'https://github.com/YupenBob/clover-tools','github-user':'https://github.com/YupenBob','github-api':'https://api.github.com/repos/YupenBob/clover-tools',
'en-tool':'https://clovertools.cn/en/tools/dev/json-formatter/','en-guide':'https://clovertools.cn/en/guides/ascii-art/',
'm3u8':'https://clovertools.cn/tools/daily/m3u8-downloader/',
'base64':'https://clovertools.cn/tools/dev/base64/','calculator':'https://clovertools.cn/tools/daily/calculator/','reaction':'https://clovertools.cn/tools/fun/reaction-test/',
'guide-base64':'https://clovertools.cn/guides/base64-not-encryption/','guide-bmi':'https://clovertools.cn/guides/bmi-reference-not-diagnosis/','guide-focus':'https://clovertools.cn/guides/focus-flight-first-session/','guide-ascii':'https://clovertools.cn/guides/ascii-art/',
'about':'https://clovertools.cn/about/','privacy':'https://clovertools.cn/privacy/','contact':'https://clovertools.cn/contact/'}
def fetch(item):
 name,url=item;start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 p=subprocess.run(['curl','-sS','-L','--max-time','35','--max-redirs','6','-D',str(out/(name+'.headers')),'-o',str(out/(name+'.html')),'-w','%{json}',url],capture_output=True,text=True)
 try:r=json.loads(p.stdout)
 except:r={'raw':p.stdout}
 r={k:r.get(k) for k in ['http_code','url_effective','num_redirects','content_type','size_download','remote_ip','errormsg']};r.update(name=name,requested=url,time=start,exit=p.returncode,stderr=p.stderr)
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:r=list(pool.map(fetch,urls.items()))
# UA strings provide public response comparison only, never verified Google source IP.
for name,ua in [('googlebot','Googlebot'),('mediapartners','Mediapartners-Google')]:
 for key in ['home','tool','guide']:
  n=name+'-'+key;p=subprocess.run(['curl','-sS','--max-time','30','-A',ua,'-D',str(out/(n+'.headers')),'-o',str(out/(n+'.html')),'-w','%{http_code}',urls[key]],capture_output=True,text=True)
  r.append({'name':n,'requested':urls[key],'ua':ua,'http_code':p.stdout,'exit':p.returncode,'stderr':p.stderr,'time':datetime.datetime.now(datetime.timezone.utc).isoformat()})
(out/'http-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
