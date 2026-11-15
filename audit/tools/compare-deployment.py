import pathlib,json,re,hashlib
p=pathlib.Path('audit/evidence');rows=[]
def visible(h):
 h=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',h)
 return re.sub(r'\s+',' ',re.sub('<[^>]*>',' ',h)).strip()
for name,local in [('home','dist/index.html'),('tool','dist/tools/dev/json-formatter/index.html'),('guide','dist/guides/json-unexpected-token-html/index.html'),('ads','public/ads.txt'),('sitemap-0','dist/sitemap-0.xml')]:
 a=(p/(name+'.html')).read_bytes();b=pathlib.Path(local).read_bytes();rows.append({'live':name,'local':local,'byteEqual':a==b,'visibleTextEqual':visible(a.decode())==visible(b.decode()),'liveSha256':hashlib.sha256(a).hexdigest(),'localSha256':hashlib.sha256(b).hexdigest()})
a=set(re.findall('<loc>(.*?)</loc>',(p/'sitemap-0.html').read_text()));b=set(re.findall('<loc>(.*?)</loc>',pathlib.Path('dist/sitemap-0.xml').read_text()))
(p/'deployment-comparison.json').write_text(json.dumps({'comparedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'comparisons':rows,'liveOnly':sorted(a-b),'distOnly':sorted(b-a)},indent=2)+'\n');print('saved deployment comparisons; sitemap',len(a))
