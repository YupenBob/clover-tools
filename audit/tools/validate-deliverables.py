import csv,json,pathlib,struct,hashlib,datetime,re
root=pathlib.Path('audit');e=root/'evidence';rows=list(csv.DictReader((root/'content-quality.csv').open()));summary=json.loads((e/'content-summary.json').read_text());browser=json.loads((e/'browser-results.json').read_text());checks={}
checks['csv_schema']=list(rows[0])==['url','type','title','lang','indexable','canonical','updated','approx_word_count','internal_links','thin_or_duplicate_flag','risk']
checks['csv_unique_count']=len(rows)==summary['distPages']==len({r['url'] for r in rows})==578
checks['indexable_count']=sum(r['indexable']=='true' for r in rows)==summary['indexable']==573
checks['browser_22_success']=len(browser)==22 and all(r.get('status')==200 for r in browser)
checks['no_ad_dom_or_requests']=all(r['ads']==0 and not r['adRequests'] for r in browser)
manifest=[]
for r in browser:
 f=pathlib.Path(r['file']);b=f.read_bytes();w,h=struct.unpack('>II',b[16:24]);manifest.append({'file':str(f),'width':w,'height':h,'url':r['url'],'time':r['time'],'sha256':hashlib.sha256(b).hexdigest()})
checks['six_exact_viewport_screenshots']=all((r['width'],r['height'])==((1280,900) if 'desktop' in r['file'] else (390,844)) for r in manifest if re.search('live-(home|tool|guide)-(desktop|mobile)\\.png$',r['file']))
checks['all_22_screenshots']=len(manifest)==22
checks['required_reports']=all((root/f).exists() for f in ['adsense-current-state.md','ad-placement-inventory.md','content-quality.csv','unresolved.md'])
dist_unchanged=all(pathlib.Path(r['file']).exists() and hashlib.sha256(pathlib.Path(r['file']).read_bytes()).hexdigest()==r['sha256'] for r in json.loads((e/'dist-manifest.json').read_text()))
links=[]
for f in root.glob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  if not target.startswith(('https:','http:','#')) and not (f.parent/target.split('#')[0]).exists():links.append({'file':str(f),'target':target})
checks['local_report_links_exist']=not links
(e/'screenshot-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
result={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'badLinks':links,'observations':{'distUnchangedSinceInitialInventory':dist_unchanged,'distDriftEvidence':'audit/evidence/dist-drift.json'},'overflowPages':[r['url'] for r in browser if r['bodyWidth']>r.get('clientWidth',r['viewport']['width'])]}
(e/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2));assert all(checks.values())
