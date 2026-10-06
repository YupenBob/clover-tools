"""Offline SVG geography: python scripts/prepare-flight-geography.py /path/to/sources.
Requires Shapely (build-time only). Public-domain originals are not shipped.
Land, lakes and physical terrain regions retain their actual geographic positions.
"""
from pathlib import Path
from shapely.geometry import shape, box
import hashlib, json, math, sys

task_source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
bounds = (80, -35, 160, 60)
region = box(*bounds)
scale = 800 / math.radians(70)
merc = lambda lat: math.log(math.tan(math.pi/4+math.radians(lat)/2))
width = math.radians(bounds[2]-bounds[0])*scale
height = (merc(bounds[3])-merc(bounds[1]))*scale
def project(lon, lat):
 return ((lon-bounds[0])*math.pi/180*scale, (merc(bounds[3])-merc(lat))*scale)
def polygons(geometry):
 if geometry.is_empty: return []
 if geometry.geom_type == 'Polygon': return [geometry]
 if hasattr(geometry, 'geoms'):
  return [p for g in geometry.geoms for p in polygons(g)]
 return []
def svg_path(polygon):
 def ring(coords):
  return 'M'+'L'.join(','.join(f'{v:.2f}' for v in project(*point[:2])) for point in coords)+'Z'
 return ring(polygon.exterior.coords)+''.join(ring(r.coords) for r in polygon.interiors)
layers = {}
for name in ['land','lakes','regions']:
 paths = []
 for feature in json.loads((task_source/(name+'.geojson')).read_text())['features']:
  if name == 'regions' and feature['properties']['FEATURECLA'] not in ['Range/mtn','Plateau','Foothills']: continue
  geometry = shape(feature['geometry'])
  if not geometry.is_valid: geometry=geometry.buffer(0)
  for polygon in polygons(geometry.intersection(region).simplify(0.01,preserve_topology=True)):
   if polygon.area >= 0.0005: paths.append(svg_path(polygon))
 layers[name] = ''.join(paths)
data = {'width':round(width,3),'height':round(height,3),'bounds':bounds,**layers}
output = root/'src/lib/flight-geography.json'
output.write_text(json.dumps(data,separators=(',',':'))+'\n')
hash_file = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
sources=[]
for name, upstream in [('land','ne_10m_land'),('lakes','ne_10m_lakes'),('regions','ne_10m_geography_regions_polys')]:
 sources.append({'name':upstream,'url':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'+upstream+'.geojson','sha256':hash_file(task_source/(name+'.geojson')),'license':'Public Domain','terms':'https://www.naturalearthdata.com/about/terms-of-use/'})
sources.append({'name':'OurAirports coordinates','url':'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv','sha256':hash_file(task_source/'airports.csv'),'license':'Public Domain','terms':'https://ourairports.com/data/'})
destination=root/'public/focus-flight'
destination.mkdir(parents=True,exist_ok=True)
(destination/'geography.json').write_text(json.dumps({'prepared':'2026-10-06','projection':'Mercator, equal horizontal and vertical scale','bounds':bounds,'processing':'Geographic clipping and topology-preserving 0.01 degree simplification. SVG paths, without raster textures. Terrain areas are physical geography, not elevation measurements.','sources':sources,'output':{'file':'src/lib/flight-geography.json','bytes':output.stat().st_size,'sha256':hash_file(output)}},ensure_ascii=False,indent=2)+'\n')
print(output.name,output.stat().st_size,'bytes; viewBox 0 0',width,height)
