#!/usr/bin/env python3
"""Builds the Live World planet data (run once; the results are shipped in public/media and public/data).

  node scripts/world-data/topo2geo.js      -> countries.geo.json   (needs: npm i world-atlas topojson-client world-countries)
  python3 scripts/world-data/build_world.py countries.geo.json public/

Outputs
  media/world-ids.png   4096x2048 RGBA   R = biome id, G = country id (0 = sea), B = height hint, A = 255
  media/world-sdf.png   2048x1024 gray   land distance field (128 = coast, >128 land, <128 sea), smooth, for clean coasts
  data/countries.json   [{i, n, cc, f, r, c, lat, lng, la, lo}]   (la/lo = label position, lat/lng = capital)

Biomes: 0 sea, 1 grass, 2 forest, 3 jungle, 4 savanna, 5 desert, 6 mountain rock, 7 snow / ice, 8 tundra
Deserts, jungles and mountains come from hand-drawn outlines of the real ones (approximate, edges are wobbled so they look natural).
"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
W, H = 4096, 2048
rng = np.random.default_rng(7)
countries = json.load(open(src))

def px(lon, lat):
    return ((lon + 180.0) / 360.0 * W, (90.0 - lat) / 180.0 * H)


CITIES = [  # name, lat, lng, size 1-5 (big cities of the world; capitals come from countries.json)
 ("Lahore",31.55,74.34,4),("Karachi",24.86,67.01,5),("Islamabad",33.69,73.05,3),("Faisalabad",31.42,73.08,3),("Peshawar",34.01,71.58,3),("Quetta",30.18,66.99,2),("Multan",30.2,71.47,2),
 ("Delhi",28.61,77.21,5),("Mumbai",19.08,72.88,5),("Kolkata",22.57,88.36,4),("Bangalore",12.97,77.59,4),("Dhaka",23.81,90.41,5),("Kabul",34.53,69.17,3),("Tehran",35.69,51.39,5),
 ("Dubai",25.2,55.27,4),("Abu Dhabi",24.45,54.38,3),("Riyadh",24.71,46.68,4),("Jeddah",21.49,39.19,3),("Makkah",21.42,39.83,3),("Madinah",24.47,39.61,2),("Doha",25.29,51.53,3),
 ("Istanbul",41.01,28.98,5),("Ankara",39.93,32.86,3),("Cairo",30.04,31.24,5),("Lagos",6.52,3.38,5),("Nairobi",-1.29,36.82,4),("Johannesburg",-26.2,28.05,4),("Cape Town",-33.92,18.42,3),
 ("Addis Ababa",9.03,38.74,3),("Kinshasa",-4.44,15.27,4),("Casablanca",33.57,-7.59,3),("Moscow",55.76,37.62,5),("London",51.51,-0.13,5),("Paris",48.86,2.35,5),("Berlin",52.52,13.4,4),
 ("Madrid",40.42,-3.7,4),("Rome",41.9,12.5,4),("New York",40.71,-74.0,5),("Los Angeles",34.05,-118.24,5),("Chicago",41.88,-87.63,4),("Toronto",43.65,-79.38,4),("Mexico City",19.43,-99.13,5),
 ("Sao Paulo",-23.55,-46.63,5),("Rio de Janeiro",-22.9,-43.17,4),("Buenos Aires",-34.6,-58.38,5),("Bogota",4.71,-74.07,4),("Lima",-12.05,-77.04,4),("Beijing",39.9,116.4,5),
 ("Shanghai",31.23,121.47,5),("Hong Kong",22.32,114.17,4),("Tokyo",35.68,139.69,5),("Seoul",37.57,126.98,5),("Bangkok",13.76,100.5,4),("Singapore",1.35,103.82,4),("Jakarta",-6.2,106.85,5),
 ("Manila",14.6,120.98,4),("Sydney",-33.87,151.21,4),("Melbourne",-37.81,144.96,3),("Auckland",-36.85,174.76,2),("Tashkent",41.3,69.24,3),("Baghdad",33.31,44.37,4),("Damascus",33.5,36.29,3),
 ("Jerusalem",31.77,35.21,3),("Kuwait City",29.38,47.99,3),("Muscat",23.59,58.41,2),("Colombo",6.93,79.86,3),("Kathmandu",27.72,85.32,3),("Hanoi",21.03,105.85,4),("Ho Chi Minh City",10.82,106.63,4),
 ("Dallas",32.78,-96.8,4),("Miami",25.76,-80.19,3),("San Francisco",37.77,-122.42,4),("Vancouver",49.28,-123.12,3),("Santiago",-33.45,-70.67,4),("Caracas",10.48,-66.9,3),("Havana",23.11,-82.37,3),
 ("Accra",5.6,-0.19,3),("Dakar",14.69,-17.45,3),("Algiers",36.75,3.06,3),("Tunis",36.8,10.18,2),("Khartoum",15.5,32.56,3),("Luanda",-8.84,13.23,3),("Dar es Salaam",-6.79,39.21,3),
 ("Kyiv",50.45,30.52,4),("Warsaw",52.23,21.01,3),("Stockholm",59.33,18.07,3),("Oslo",59.91,10.75,2),("Athens",37.98,23.73,3),("Vienna",48.21,16.37,3),("Reykjavik",64.15,-21.94,1),
]

# ---- country id map + land mask -------------------------------------------------------------
def area(g):
    def ring_area(r):
        a = 0
        for (x1, y1), (x2, y2) in zip(r, r[1:]):
            a += x1 * y2 - x2 * y1
        return abs(a) / 2
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    return sum(ring_area(p[0]) for p in polys)

order = sorted(range(len(countries)), key=lambda i: -area(countries[i]['geom']))   # big first, small enclaves painted on top
def unwrap(ring):
    pts, off, prev = [], 0.0, None
    for lo, la in [c[:2] for c in ring]:
        if prev is not None:
            if lo + off - prev > 180: off -= 360
            elif lo + off - prev < -180: off += 360
        prev = lo + off
        pts.append((prev, la))
    if abs(pts[-1][0] - pts[0][0]) > 180:          # the ring goes round a pole (Antarctica): close it through the pole
        pole = -90.0 if sum(la for _, la in pts) < 0 else 90.0
        pts += [(pts[-1][0], pole), (pts[0][0], pole)]
    return pts

def draw_ring(dr, ring, fill):
    pts = unwrap(ring)
    for sh in (-360, 0, 360):
        dr.polygon([px(lo + sh, la) for lo, la in pts], fill=fill)

idimg = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(idimg)
for i in order:
    g = countries[i]['geom']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for p in polys:
        draw_ring(d, p[0], i + 1)
cid = np.array(idimg, dtype=np.uint8)
land = cid > 0
print('countries', len(countries), 'land %', round(land.mean() * 100, 1))

# ---- natural-looking noise (low frequency, wraps nicely enough) ---------------------------
def fbm(scale, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((H, W), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        small = r.random((H // s + 2, W // s + 2)).astype(np.float32)
        big = ndi.zoom(small, s, order=3)[:H, :W]
        acc += big * amp; tot += amp; amp *= 0.5
    return acc / tot

wx, wy = fbm(180, 4, 1), fbm(180, 4, 2)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
WARP = 22.0
wxs, wys = xx + (wx - 0.5) * 2 * WARP, yy + (wy - 0.5) * 2 * WARP

def region_mask(polys_ll, blur=0):
    img = Image.new('L', (W, H), 0)
    dd = ImageDraw.Draw(img)
    for poly in polys_ll:
        dd.polygon([px(lo, la) for lo, la in poly], fill=255)
    m = np.array(img, dtype=np.float32) / 255.0
    if blur:
        m = ndi.gaussian_filter(m, blur)
    # wobble the edges so they are not straight lines
    return ndi.map_coordinates(m, [wys, wxs], order=1, mode='nearest')

DESERT = [
 [(-17,16),(-17,21),(-13,27.5),(-8,31),(-2,32.5),(9,33.5),(11,32),(20,31),(25,31),(32,30),(34,27),(33,22),(37,19),(37,15),(30,14),(22,13),(15,13),(8,14),(0,15),(-8,15)],
 [(35,29),(39,32),(44,32),(48,29.5),(51,25),(56,24.5),(59,22),(55,17),(48,14),(44,13),(43,17),(39,22),(35,28)],
 [(37,35),(41,34.5),(44,32.5),(41,30),(38,31)],
 [(49,22.5),(49,28),(58,28),(59,23.5),(54,22)],
 [(52,35),(57,36),(60,33),(60,29),(58,27),(55,28),(52,31)],
 [(60,29),(63,29.8),(66,29),(68,28),(69,27),(70.2,28.7),(72,29),(73.3,28),(74.5,26.5),(73.5,24),(70,24),(68,25),(66,26),(63,26),(60,27)],
 [(61,32),(65,32.5),(67,30.5),(64,29.5),(61,30)],
 [(53,41),(58,42),(62,43.5),(66,43),(67,41),(64,38),(60,36),(56,37),(53,38)],
 [(77,40),(82,41),(88,41),(90,39),(86,37),(80,36.5),(77,38)],
 [(91,43),(100,45),(108,45.5),(113,43),(110,40),(104,39),(98,40),(92,41)],
 [(115,-26),(120,-21),(128,-20),(136,-23),(140,-26),(142,-30),(137,-33),(130,-31.5),(122,-32),(116,-30)],
 [(12,-17),(15,-23),(16,-28),(19,-30),(24,-28),(25,-22),(21,-18),(17,-17)],
 [(-71,-15),(-69,-20),(-69,-27),(-70.5,-28),(-71,-20)],
 [(-118,36),(-112,36.5),(-107,33),(-103,29),(-105,25),(-110,26),(-113,30),(-116,32)],
 [(43,11),(51,11.5),(50,8),(45,7),(42,9)],
 [(-120,41),(-113,41),(-112,37),(-117,35)],
]
JUNGLE = [
 [(-76,2),(-70,2.5),(-62,4.5),(-54,4),(-50,1),(-47,-1),(-48,-5),(-52,-9),(-56,-13),(-62,-13),(-68,-12),(-73,-11),(-76,-6),(-78,-3)],
 [(9,3),(13,2.5),(18,4),(25,4),(29,2),(30,-2),(27,-5),(22,-6),(17,-5),(12,-4),(10,-1)],
 [(-13,7),(-8,7.5),(-3,6.5),(2,6.8),(8,6.5),(9.5,4.5),(5,4.3),(-2,4.5),(-9,5.5)],
 [(48,-13),(50,-15),(49.5,-18),(48,-24),(47.3,-22),(48,-16)],
 [(73,8),(76,8),(77.5,11),(76,14),(74,16),(73.3,13)],
 [(88,22),(92,22),(95,23),(97,25),(96,28),(92,27),(90,25.5)],
 [(95,17),(98,17),(101,17),(106,18),(108,15),(106,10),(104,9),(103,3),(101,1.5),(100,6),(98,9),(98,14)],
 [(95,5),(98,4),(104,-2),(106,-5.5),(102,-4),(98,0.5)],
 [(109,2),(115,5),(119,5),(118,1),(116,-3),(111,-3),(109,-1)],
 [(105,-6),(114,-8),(111,-7)],
 [(131,-1),(141,-3),(150,-7),(146,-9),(141,-8.5),(135,-4)],
 [(119.5,1.5),(125,1.5),(122,-1),(121,-5),(119,-3)],
 [(120,17),(124,13),(126,8),(125,6),(122,9),(120,14)],
 [(-92,17),(-86,16),(-83,10),(-80,8),(-77,6),(-76,2),(-78,4),(-81,8.5),(-85,11)],
 [(79.8,6.5),(81,7),(81,6),(80,5.8)],
 [(145,-16),(146.5,-18),(145.5,-19),(144.5,-17)],
 [(8,6),(10,4),(13,2),(10,0.5),(9,3)],
]
MOUNT = [
 [(70,36.5),(74,37),(78,35.5),(82,31),(88,28),(92,28),(97,28.5),(97,27),(92,26.8),(86,27),(80,28.5),(77,31),(74,33.5),(72,34),(70,34.5)],
 [(80,35),(90,35),(100,34),(100,30),(92,29),(84,30)],
 [(70,39),(75,40),(82,43),(88,43.5),(80,41),(74,38)],
 [(84,48),(92,50),(90,47),(86,46)],
 [(37,44),(44,43),(48,41.5),(46,41),(40,43)],
 [(5.5,44.5),(8,46.5),(12,47),(15,47),(13,46),(8,45)],
 [(-2,43),(3,42.8),(3,42.3),(-2,42.8)],
 [(44,38),(48,36),(52,32),(55,29),(53,28),(50,31),(46,34)],
 [(48,37),(54,37),(56,36),(52,35.5)],
 [(-10,31),(-5,34),(0,35),(8,36),(10,36),(5,34),(-3,32)],
 [(36,14),(40,13),(40,8),(37,5),(36,9)],
 [(-117,59),(-112,56),(-108,48),(-106,40),(-107,35),(-110,38),(-113,44),(-116,50)],
 [(-124,48),(-121,45),(-119,38),(-117,35),(-120,38),(-122,42)],
 [(-76,10),(-75,5),(-78,-2),(-76,-10),(-72,-15),(-70,-20),(-70,-30),(-71,-40),(-72,-50),(-71,-52),(-73,-50),(-72,-40),(-71,-30),(-69,-20),(-71,-12),(-74,-5),(-77,0),(-74,8)],
 [(59,52),(60,58),(63,64),(66,68),(64,68),(58,60)],
 [(5,59),(8,62),(12,64),(18,68),(22,70),(19,68),(14,64),(10,61)],
 [(30,37),(36,37.5),(42,38),(36,38)],
 [(28,-27),(30,-29),(28,-31),(26,-29)],
 [(168,-44),(171,-43),(170,-44.5)],
 [(68.5,28),(70,30),(70,33),(69,33.5),(68,31),(67.5,29)],
 [(66.5,24.5),(67.5,27),(67,27),(66,25)],
 [(-108,30),(-105,26),(-104,22),(-100,19),(-97,18),(-102,18),(-106,22),(-109,27)],
 [(37,26),(40,21),(43,15),(45,13.5),(43,13),(39,19),(37,24)],
 [(145,-16),(150,-24),(151,-30),(149,-37),(146,-36),(148,-30),(145,-22)],
 [(138,35),(140,38),(141,41),(139,38)],
]
FOREST = [
 [(-10,44),(-8,60),(30,62),(60,60),(60,48),(40,46),(25,45),(10,44)],
 [(-95,30),(-67,36),(-67,47),(-90,50),(-95,42)],
 [(100,22),(125,20),(135,35),(142,45),(120,40),(105,30)],
 [(-125,40),(-120,56),(-135,60),(-130,48)],
 [(-74,-38),(-72,-52),(-73,-45)],
 [(-13,52),(-4,59),(-5,50)],
]
STEPPE = [  # dry grass
 [(48,45),(75,52),(90,50),(110,48),(105,43),(75,43),(52,43)],
 [(-110,50),(-97,49),(-97,33),(-104,33),(-109,40)],
]

dm = region_mask(DESERT, 2)
jm = region_mask(JUNGLE, 2)
mm = region_mask(MOUNT, 3)
fm = region_mask(FOREST, 6)
sm = region_mask(STEPPE, 4)

lat = (90 - (yy + 0.5) / H * 180).astype(np.float32)
alat = np.abs(lat)
wl = alat + (fbm(300, 3, 11) - 0.5) * 18        # latitude with a wobble, so climate bands are not ruler-straight
moist = fbm(120, 4, 12)
biome = np.ones((H, W), np.uint8)            # grass
biome[(wl < 22)] = 4                         # tropics: savanna ...
biome[(wl < 22) & (moist > 0.58)] = 1        # ... with green patches
biome[(wl >= 22) & (wl < 38) & (moist < 0.32)] = 4
biome[(wl >= 46) & (wl < 66)] = 2            # boreal forest
biome[(wl >= 40) & (wl < 46) & (moist > 0.55)] = 2
biome[fm > 0.5] = 2
biome[sm > 0.5] = 4
biome[wl >= 66] = 8                          # tundra
biome[jm > 0.5] = 3
biome[dm > 0.5] = 5
n1 = fbm(40, 3, 5)
biome[(mm > 0.5)] = 6
core = (ndi.gaussian_filter(mm, 8) > 0.68) & (n1 > 0.46)       # high parts of the big ranges carry snow
biome[core] = 7
# Greenland and Antarctica: ice
cname = {i + 1: c['name'] for i, c in enumerate(countries)}
for nm in ('Greenland', 'Antarctica'):
    ids = [k for k, v in cname.items() if v == nm]
    for k in ids:
        biome[cid == k] = 7
biome[(alat > 78)] = 7
biome[~land] = 0

# height hint (0..255): ranges are high, snow higher, plus gentle noise
hh = np.clip(ndi.gaussian_filter(mm, 4) * 0.8 + (n1 - 0.5) * 0.25 * (mm > 0.1), 0, 1)
hh = np.where(land, 0.06 + hh * 0.9 + (fbm(60, 3, 9) - 0.5) * 0.08, 0)
hh[(biome == 7) & (alat > 60)] = np.maximum(hh[(biome == 7) & (alat > 60)], 0.18)
height = (np.clip(hh, 0, 1) * 255).astype(np.uint8)

rgba = np.dstack([biome, cid, height, np.full((H, W), 255, np.uint8)])
os.makedirs(os.path.join(out, 'media'), exist_ok=True); os.makedirs(os.path.join(out, 'data'), exist_ok=True)
Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'media', 'world-ids.png'), optimize=True)

# cities sit on flat ground: smooth the height hint away around every city and capital
pts = [(c[1], c[2]) for c in CITIES] + [(c['capLL'][0], c['capLL'][1]) for c in countries if c.get('capLL')]
mark = np.zeros((H, W), bool)
for la, lo in pts:
    x, y = px(lo, la); xi, yi = int(x) % W, min(H - 1, max(0, int(y))); mark[yi, xi] = True
dpx = ndi.distance_transform_edt(~mark)
flat = np.clip((dpx - 10) / 36.0, 0, 1)
hh2 = 0.06 + (height.astype(np.float32) / 255.0 - 0.06) * flat
height = (np.clip(np.where(land, hh2, 0), 0, 1) * 255).astype(np.uint8)
rgba[:, :, 2] = height
Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'media', 'world-ids.png'), optimize=True)

# ---- smooth land distance field (half resolution) ------------------------------------------
inside = ndi.distance_transform_edt(land); outside = ndi.distance_transform_edt(~land)
sd = (inside - outside).astype(np.float32)                 # px at 4096 scale, + on land
R = 14.0
v = np.clip(0.5 + sd / (2 * R), 0, 1)
v = ndi.zoom(v, 0.5, order=1)
Image.fromarray((v * 255).astype(np.uint8), 'L').save(os.path.join(out, 'media', 'world-sdf.png'), optimize=True)

# ---- countries.json -------------------------------------------------------------------------
res = []
for i, c in enumerate(countries):
    k = i + 1
    m = cid == k
    la = lo = None
    if m.any():
        lab, n = ndi.label(m)
        sizes = ndi.sum(m, lab, range(1, n + 1))
        big = int(np.argmax(sizes)) + 1
        ys, xs = np.nonzero(lab == big)
        la = round(90 - (np.mean(ys) + 0.5) / H * 180, 2); lo = round(-180 + (np.mean(xs) + 0.5) / W * 360, 2)
    ll = c.get('capLL')
    res.append({'i': k, 'n': c['name'], 'cc': c['cc'], 'f': c['flag'], 'r': c['region'], 'c': c['cap'],
                'lat': round(ll[0], 3) if ll else la, 'lng': round(ll[1], 3) if ll else lo, 'la': la, 'lo': lo,
                'px': int(m.sum())})
json.dump(res, open(os.path.join(out, 'data', 'countries.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump([{'n': c[0], 'lat': c[1], 'lng': c[2], 's': c[3]} for c in CITIES], open(os.path.join(out, 'data', 'cities.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
for f in ('media/world-ids.png', 'media/world-sdf.png', 'data/countries.json'):
    print(f, os.path.getsize(os.path.join(out, f)) // 1024, 'KB')
