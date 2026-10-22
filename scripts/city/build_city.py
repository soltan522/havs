# Builds the city buildings layer input for one area of Baku: every Overture building (OpenStreetMap + Microsoft ML
# footprints) with a stable id, its floor count (mapped, or estimated from mapped buildings of similar size nearby),
# a facade type for the 3D style, its ground height on the map's terrain (raw metres) and its name/complex.
#   python3 build_city.py <name> <west> <south> <east> <north> <out.geojson>
import io, json, math, os, statistics, sys, urllib.request, collections
import pyarrow.dataset as ds, pyarrow.compute as pc
from pyarrow import fs
import shapely.wkb, shapely.geometry as sg
from shapely.strtree import STRtree
from PIL import Image
name, W, S, E, N, OUT = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
HAVS = "/home/user/havs"
s3 = fs.S3FileSystem(anonymous=True, region="us-west-2", proxy_options=os.environ.get("HTTPS_PROXY"))
REL = "overturemaps-us-west-2/release/2026-10-21.0/"
# every building touching the area, kept when its centroid is inside, so neighbouring areas share no building and miss none
bb = (pc.field("bbox", "xmax") > W) & (pc.field("bbox", "xmin") < E) & (pc.field("bbox", "ymax") > S) & (pc.field("bbox", "ymin") < N)
M = 111320 * math.cos(math.radians((S + N) / 2))
def area_m2(g): return g.area * M * 110540

# areas already drawn by their own models: the 3D districts and the single buildings with a model
skip = []
for d in ("seabreeze", "whitecity"):
    z = json.load(open(f"{HAVS}/data/districts/{d}.json"))["zone"]
    skip.append(sg.shape(z))
for p in json.load(open(f"{HAVS}/data/plans.json")) if isinstance(json.load(open(f"{HAVS}/data/plans.json")), list) else []:
    m = p.get("model")
    if m and m.get("origin"):
        lng, lat = m["origin"]; b = math.radians(m["bearing"]); kx = 111320 * math.cos(math.radians(lat))
        skip.append(sg.MultiPoint([(lng + k * math.sin(b) / kx, lat + k * math.cos(b) / 110540) for k in (-7, 0, 7)]).buffer(0.00001))
skip_tree = STRtree(skip)

rows = []
for typ in ("building", "building_part"):
    d = ds.dataset(f"{REL}theme=buildings/type={typ}/", filesystem=s3, format="parquet")
    cols = [c for c in ["id", "geometry", "names", "height", "num_floors", "has_parts", "is_underground", "sources"] if c in d.schema.names]
    for r in d.to_table(columns=cols, filter=bb).to_pylist():
        if r.get("is_underground"): continue
        g = shapely.wkb.loads(r["geometry"])
        if g.geom_type not in ("Polygon", "MultiPolygon") or not g.is_valid: g = g.buffer(0)
        c = g.centroid
        if not (W <= c.x < E and S <= c.y < N): continue
        a = area_m2(g)
        if a < 12: continue
        if any(skip[i].intersects(g.representative_point()) or skip[i].intersects(g) for i in skip_tree.query(g)): continue
        fl = r.get("num_floors") or (round(r["height"] / 3.2) if r.get("height") else None)
        rows.append({"id": r["id"], "g": g, "a": a, "floors": int(fl) if fl else None, "part": typ == "building_part", "has_parts": bool(r.get("has_parts")),
                     "name": (r.get("names") or {}).get("primary"), "osm": any(s["dataset"] == "OpenStreetMap" for s in (r.get("sources") or []))})
print(name, "buildings", len(rows), "known floors", sum(1 for r in rows if r["floors"]))

# floor estimates: median of mapped buildings of similar size within 250 m, else of the same size class in the area
known = [r for r in rows if r["floors"] and not r["part"]]
CELL = 250 / 110540
grid = collections.defaultdict(list)
for r in known:
    c = r["g"].centroid; grid[(int(c.x / CELL), int(c.y / CELL))].append(r)
BINS = [0, 40, 100, 200, 400, 800, 1500, 3000, 1e12]
def bin_of(a): return next(i for i in range(len(BINS) - 1) if BINS[i] <= a < BINS[i + 1])
by_bin = collections.defaultdict(list)
for r in known: by_bin[bin_of(r["a"])].append(r["floors"])
DEFAULTS = [1, 1, 2, 2, 3, 5, 5, 5]
bin_median = {b: int(round(statistics.median(v))) if len(v) >= 5 else DEFAULTS[b] for b, v in ((b, by_bin.get(b, [])) for b in range(8))}
for r in rows:
    r["est"] = not r["floors"]
    if not r["est"]: continue
    c = r["g"].centroid; cx, cy = int(c.x / CELL), int(c.y / CELL)
    near = [k["floors"] for dx in (-1, 0, 1) for dy in (-1, 0, 1) for k in grid.get((cx + dx, cy + dy), [])
            if 0.4 < k["a"] / r["a"] < 2.5 and k["g"].centroid.distance(c) * 110540 < 250]
    r["floors"] = int(round(statistics.median(near))) if len(near) >= 3 else bin_median[bin_of(r["a"])]

# facade type for the 3D style: 0 house, 1 old stone (historic centre), 2 Soviet slab, 3 tower, 4 mid-rise
OLD_CENTRE = sg.box(49.826, 40.360, 49.866, 40.386)
def facade(r):
    g, f = r["g"], r["floors"]
    if f <= 2 and r["a"] < 400: return 0
    if f >= 17: return 3
    rect = g.minimum_rotated_rectangle
    xs, ys = rect.exterior.coords.xy
    sides = sorted(math.hypot((xs[i + 1] - xs[i]) * M, (ys[i + 1] - ys[i]) * 110540) for i in range(2))
    depth, length = sides[0], sides[1]
    fill = g.area / rect.area if rect.area else 1
    if OLD_CENTRE.contains(g.centroid) and f <= 7: return 1
    if f >= 10 and length / max(depth, 1) < 1.8: return 3
    if 4 <= f <= 16 and fill > 0.85 and length / max(depth, 1) >= 2.2 and 9 <= depth <= 17: return 2
    return 4

# complex: the smallest named land use area around a building
lu = ds.dataset(REL + "theme=base/type=land_use/", filesystem=s3, format="parquet").to_table(columns=["geometry", "names", "class"], filter=bb).to_pylist()
LAND = [((x["names"] or {}).get("primary"), shapely.wkb.loads(x["geometry"])) for x in lu
        if (x["names"] or {}).get("primary") and x["class"] in ("residential", "construction", "commercial", "retail", "apartments", "mixed_use")]
LAND = [(n, g) for n, g in LAND if g.geom_type in ("Polygon", "MultiPolygon") and area_m2(g) < 400000]
LAND.sort(key=lambda x: x[1].area)
land_tree = STRtree([g for _, g in LAND])
def complex_of(g):
    pt = g.representative_point()
    hits = sorted((i for i in land_tree.query(pt) if LAND[i][1].contains(pt)), key=lambda i: LAND[i][1].area)
    return LAND[hits[0]][0] if hits else None

# ground height: the map's AWS Terrarium tiles at zoom 14, bilinear like MapLibre (raw metres)
Z = 14; tiles = {}
def tile(x, y):
    if (x, y) not in tiles:
        with urllib.request.urlopen(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png", timeout=60) as resp:
            tiles[(x, y)] = Image.open(io.BytesIO(resp.read())).convert("RGB").load()
    return tiles[(x, y)]
def elev(lng, lat):
    n = 2 ** Z
    fx = (lng + 180) / 360 * n * 256 - 0.5
    fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n * 256 - 0.5
    def px(X, Y):
        r, g, b = tile(X // 256, Y // 256)[X % 256, Y % 256]
        return r * 256 + g + b / 256 - 32768
    x0, y0 = math.floor(fx), math.floor(fy); tx, ty = fx - x0, fy - y0
    return px(x0, y0) * (1 - tx) * (1 - ty) + px(x0 + 1, y0) * tx * (1 - ty) + px(x0, y0 + 1) * (1 - tx) * ty + px(x0 + 1, y0 + 1) * tx * ty

feats = []
for r in rows:
    g = r["g"].simplify(0.000003, preserve_topology=True)
    vs = [elev(x, y) for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]) for x, y in list(p.exterior.coords)[:-1]]
    props = {"id": r["id"], "f": r["floors"], "e": 1 if r["est"] else 0, "t": facade(r), "g": round(statistics.median(vs), 1), "l": round(min(vs), 1)}
    if r["name"]: props["n"] = r["name"]
    c = complex_of(r["g"])
    if c: props["c"] = c
    if r["part"]: props["p"] = 1
    geo = json.loads(json.dumps(sg.mapping(g)))
    def rnd(o): return [rnd(v) for v in o] if isinstance(o, (list, tuple)) and o and isinstance(o[0], (list, tuple)) else [round(o[0], 6), round(o[1], 6)]
    geo["coordinates"] = rnd(geo["coordinates"])
    feats.append({"type": "Feature", "geometry": geo, "properties": props})
import gzip
with gzip.open(OUT, "wt", encoding="utf-8") as fh:
    json.dump({"type": "FeatureCollection", "name": name, "bounds": [W, S, E, N], "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
print("written", OUT, len(feats), "features;", sum(1 for f in feats if f["properties"]["e"]), "estimated;", "facade types", collections.Counter(f["properties"]["t"] for f in feats), "terrain tiles", len(tiles))
