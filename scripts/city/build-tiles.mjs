// Cuts the city buildings (data/city/*.geojson, made by scripts/city/build_city.py) into the static vector tiles the
// projects map draws Baku from: public/tiles/buildings/14/<x>/<y>.pbf, one layer "buildings", plus index.json listing
// the tiles and the areas covered. Each building goes whole into the tile holding its centroid (no clipping), so the
// 3D layer builds every building once and a tap finds it whole.
//   node scripts/city/build-tiles.mjs
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fromGeojsonVt } from "@maplibre/vt-pbf";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "../..");
const Z = 14;
const EXTENT = 8192;
const out = path.join(root, "public/tiles/buildings");
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

const tiles = new Map();
const areas = [];
for (const file of readdirSync(path.join(root, "data/city")).filter((f) => f.endsWith(".geojson")).sort()) {
  const fc = JSON.parse(readFileSync(path.join(root, "data/city", file), "utf8"));
  areas.push({ name: fc.name, bounds: fc.bounds, buildings: fc.features.length });
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    // tile of the centroid of the outer ring of the largest part
    const outer = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0];
    const cx = outer.reduce((s, p) => s + p[0], 0) / outer.length;
    const cy = outer.reduce((s, p) => s + p[1], 0) / outer.length;
    const tx = Math.floor(mercX(cx) * 2 ** Z), ty = Math.floor(mercY(cy) * 2 ** Z);
    const rings = [];
    for (const poly of polys) {
      poly.forEach((ring, i) => {
        const pts = ring.map(([lng, lat]) => [Math.round((mercX(lng) * 2 ** Z - tx) * EXTENT), Math.round((mercY(lat) * 2 ** Z - ty) * EXTENT)]);
        if (pts.length && (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1])) pts.push(pts[0]);
        // vector tile winding: outer rings have a positive area in tile coordinates, holes a negative one
        let a = 0;
        for (let k = 0; k < pts.length - 1; k++) a += pts[k][0] * pts[k + 1][1] - pts[k + 1][0] * pts[k][1];
        if ((i === 0) !== (a > 0)) pts.reverse();
        if (pts.length >= 4) rings.push(pts);
      });
    }
    const key = `${tx}/${ty}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push({ type: 3, geometry: rings, tags: f.properties });
  }
}

rmSync(out, { recursive: true, force: true });
let bytes = 0;
for (const [key, features] of tiles) {
  const [x, y] = key.split("/");
  mkdirSync(path.join(out, String(Z), x), { recursive: true });
  const pbf = fromGeojsonVt({ buildings: { features } }, { version: 2, extent: EXTENT });
  writeFileSync(path.join(out, String(Z), x, `${y}.pbf`), pbf);
  bytes += pbf.length;
}
writeFileSync(path.join(out, "index.json"), JSON.stringify({ zoom: Z, extent: EXTENT, tiles: [...tiles.keys()].sort(), areas }));
console.log(`${tiles.size} tiles, ${(bytes / 1048576).toFixed(1)} MB, ${areas.reduce((n, a) => n + a.buildings, 0)} buildings in ${areas.map((a) => a.name).join(", ")}`);
