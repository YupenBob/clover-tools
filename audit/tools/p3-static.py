"""Read-only checks of the final build; never replaces P0 inventory."""
import datetime
import hashlib
import json
import pathlib
import subprocess
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

root = pathlib.Path('dist')
out = pathlib.Path('audit/evidence/p3')

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.canonicals, self.robots, self.ads, self.links, self.ld = [], [], [], [], []
        self.json_script = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a.get('href'))
        if tag == 'meta' and a.get('name') == 'robots': self.robots.append(a.get('content'))
        if tag == 'a': self.links.append(a.get('href', ''))
        if (tag == 'ins' and 'adsbygoogle' in a.get('class', '')) or 'ad-slot' in a.get('class', '').split() or 'data-grid-filler' in a or (tag == 'script' and ('googlesyndication' in a.get('src', '') or 'adsbygoogle' in a.get('src', ''))): self.ads.append(a)
        if tag == 'script' and a.get('type') == 'application/ld+json': self.json_script = ''

    def handle_data(self, data):
        if self.json_script is not None: self.json_script += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.json_script is not None:
            self.ld.append(json.loads(self.json_script))
            self.json_script = None

records = []
for path in sorted(root.rglob('*.html')):
    if path.name.startswith('baidu_verify_'): continue
    raw = path.read_bytes()
    page = Page(raw.decode())
    assert len(page.canonicals) == 1 and page.canonicals[0].startswith('https://clovertools.cn/'), str(path)
    assert not page.ads, str(path)
    assert page.ld, str(path)
    records.append({'file': str(path), 'sha256': hashlib.sha256(raw).hexdigest(), 'mtime': datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat(), 'canonical': page.canonicals[0], 'robots': page.robots, 'jsonLdBlocks': len(page.ld), 'adNodes': 0})
indexable = {r['canonical'] for r in records if not any('noindex' in item for item in r['robots'])}
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
sitemap = {el.text for el in ET.parse(root/'sitemap-0.xml').findall('s:url/s:loc', ns)}
assert sitemap == indexable
robots = (root/'robots.txt').read_text()
assert 'Sitemap: https://clovertools.cn/sitemap-index.xml' in robots
assert 'Allow: /' in robots
home = Page((root/'index.html').read_text())
assert not any('tools.xsanye.cn' in href for href in home.links)
manifest = json.loads(pathlib.Path('public/illustrations/home-assets.json').read_text())
for asset in manifest['assets']:
    asset['actualBytes'] = pathlib.Path(asset['file']).stat().st_size
    assert asset['actualBytes'] == asset['bytes'] and asset['actualBytes'] <= 200*1024 and asset['width'] <= 1600
assert pathlib.Path(manifest['svg']['file']).stat().st_size < 30000
summary = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'head': subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(), 'htmlPages': len(records), 'indexablePages': len(indexable), 'sitemapUrls': len(sitemap), 'allCanonicalsOfficial': True, 'jsonLdValid': True, 'allHtmlAdNodes': 0, 'homeOldDomainLinks': 0, 'robots': robots, 'assets': manifest, 'svgComponentBytes': pathlib.Path(manifest['svg']['file']).stat().st_size, 'records': records}
(out/'static.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['records','assets','robots']},ensure_ascii=False))
