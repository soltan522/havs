# Fetches the Overture building under each given point, for landmarks outside the city layer's areas, with its ground
# and lowest ground height (raw metres, AWS terrain tiles), into data/landmarks.extra.geojson (merged by key).
#   python3 fetch_footprints.py <key>:<lng>,<lat> [...]
import io, json, math, os, sys, urllib.request
import pyarrow.dataset as ds, pyarrow.compute as pc
from pyarrow import fs
import shapely.wkb, shapely.geometry as sg
from PIL import Image

HAVS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.join(HAVS, "data", "landmarks.extra.geojson")
s3 = fs.S3FileSystem(anonymous=True, region="us-west-2", proxy_options=os.environ.get("HTTPS_PROXY"))
REL = "overturemaps-us-west-2/release/2026-10-21.0/"

tiles = {}
def elevation(lng, lat, z=14):
    """Terrain height at a point from the AWS terrarium tiles, bilinear."""
    n = 2 ** z
    x = (lng + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    tx, ty = int(x), int(y)
    if (tx, ty) not in tiles:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png"
        tiles[(tx, ty)] = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
    img = tiles[(tx, ty)]
    px, py = (x - tx) * 256 - 0.5, (y - ty) * 256 - 0.5
    x0, y0 = max(0, min(254, int(px))), max(0, min(254, int(py)))
    fx, fy = px - x0, py - y0
    def h(i, j):
        r, g, b = img.getpixel((i, j))
        return r * 256 + g + b / 256 - 32768
    return (h(x0, y0) * (1 - fx) + h(x0 + 1, y0) * fx) * (1 - fy) + (h(x0, y0 + 1) * (1 - fx) + h(x0 + 1, y0 + 1) * fx) * fy

out = json.load(open(OUT)) if os.path.exists(OUT) else {"type": "FeatureCollection", "features": []}
d = ds.dataset(f"{REL}theme=buildings/type=building/", filesystem=s3, format="parquet")
for arg in sys.argv[1:]:
    key, ll = arg.split(":")
    lng, lat = map(float, ll.split(","))
    e = 0.002
    bb = (pc.field("bbox", "xmax") > lng - e) & (pc.field("bbox", "xmin") < lng + e) & (pc.field("bbox", "ymax") > lat - e) & (pc.field("bbox", "ymin") < lat + e)
    p = sg.Point(lng, lat)
    best = None
    for r in d.to_table(columns=["id", "geometry", "names", "num_floors"], filter=bb).to_pylist():
        g = shapely.wkb.loads(r["geometry"])
        dist = 0 if g.contains(p) else g.distance(p)
        if best is None or dist < best[0]: best = (dist, r, g)
    if not best or best[0] * 111000 > 40:
        print(key, "no building within 40 m"); continue
    _, r, g = best
    ring = list(g.exterior.coords) if g.geom_type == "Polygon" else list(max(g.geoms, key=lambda q: q.area).exterior.coords)
    hs = [elevation(x, y) for x, y in ring]
    c = g.centroid
    feat = {"type": "Feature", "geometry": sg.mapping(g),
            "properties": {"id": r["id"], "key": key, "f": r.get("num_floors") or 0, "g": round(elevation(c.x, c.y), 1), "l": round(min(hs), 1),
                           **({"n": r["names"]["primary"]} if r.get("names") else {})}}
    out["features"] = [f for f in out["features"] if f["properties"]["key"] != key] + [feat]
    print(key, r["id"], round(g.area * 111000 * 85000), "m2", feat["properties"])
json.dump(out, open(OUT, "w"))
