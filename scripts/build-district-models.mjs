// Builds the 3D model of a whole district for the projects map (public/models/district-<id>.glb) from
// data/districts/<id>.json: every building is extruded from its footprint to its floor count, with a facade of window
// rows, a flat roof behind a parapet and its own ground height on the map's terrain. The inputs come from Overture Maps
// (OpenStreetMap and Microsoft ML footprints); floor counts the data lacks are estimated, and flagged so.
//   node scripts/build-district-models.mjs seabreeze whitecity
// Units are metres; +Y up, +X east, +Z south (the map places district models with bearing 180). Origin: the district's
// `origin` at its terrain height, so the model stands on the terrain when placed at queryTerrainElevation(origin).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import { KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";
import sharp from "sharp";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const FLOOR = 3.2; // storey height
const BAY = 3.0; // width of one window bay
const PARAPET = 0.9;
const SKIRT = 1.5; // walls reach below the lowest ground point, so slopes never show a gap

// facade colours per district: wall, glass, frame, roof
const PALETTES = {
  seabreeze: { wall: [247, 245, 240], glass: [146, 168, 176], frame: [228, 225, 218], roof: [226, 223, 216] },
  whitecity: { wall: [245, 241, 232], glass: [138, 150, 158], frame: [226, 220, 207], roof: [224, 219, 209] },
};

const EARTH = 40075016.686;
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/** One window bay of one storey; image rows run from floor level (top) to the next floor (bottom), as glTF reads v. */
async function facadeTexture({ wall, glass, frame }) {
  const S = 128;
  const px = (m, total) => Math.round((m / total) * S);
  const rect = (x0, y0, x1, y1, [r, g, b]) =>
    `<rect x="${px(x0, BAY)}" y="${px(y0, FLOOR)}" width="${px(x1, BAY) - px(x0, BAY)}" height="${px(y1, FLOOR) - px(y0, FLOOR)}" fill="rgb(${r},${g},${b})"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="rgb(${wall.join(",")})"/>
    ${rect(0.55, 0.85, 2.45, 2.8, frame)}
    ${rect(0.62, 0.92, 2.38, 2.73, glass)}
    ${rect(1.47, 0.92, 1.53, 2.73, frame)}
    ${rect(0, 0, BAY, 0.08, frame.map((c) => c - 12))}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Deterministic 0..1 from a number, for small per-building tint changes. */
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function buildDistrict(id) {
  const district = JSON.parse(readFileSync(path.join(root, "data/districts", `${id}.json`), "utf8"));
  const [lng0, lat0] = district.origin;
  const k = EARTH * Math.cos((lat0 * Math.PI) / 180); // metres per Mercator unit at the origin
  const local = ([lng, lat]) => [(mercX(lng) - mercX(lng0)) * k, (mercY(lat) - mercY(lat0)) * k];

  // geometry buckets: mapped / estimated floor counts (kept apart so they can be told apart), by material
  const buckets = {};
  const bucket = (group, mat) => (buckets[`${group}/${mat}`] ??= { group, mat, pos: [], nor: [], uv: [], col: [], idx: [] });
  const vertex = (b, p, n, uv, c) => {
    b.pos.push(...p);
    b.nor.push(...n);
    b.uv.push(...uv);
    b.col.push(...c);
    return b.pos.length / 3 - 1;
  };

  district.buildings.forEach((bld, i) => {
    const group = bld.estimated ? "estimated" : "mapped";
    const height = bld.floors * FLOOR + (bld.floors >= 2 ? PARAPET : 0.3);
    const top = bld.ground + height;
    const bottom = bld.low - SKIRT;
    const t = 0.93 + hash(i + 1) * 0.07;
    const tint = [t, t, t * 0.995, 1];
    for (const rings of bld.polygons) {
      const pts = rings.map((ring) => ring.map(local));
      const area = Math.abs(THREE.ShapeUtils.area(pts[0].map(([x, z]) => new THREE.Vector2(x, z))));
      const facade = bld.floors >= 2 || area >= 150 ? "wall" : "plain";
      const walls = bucket(group, facade);
      const inSolid = (x, z) => inRing(pts[0], x, z) && !pts.slice(1).some((h) => inRing(h, x, z));
      for (const ring of pts) {
        let run = 0;
        ring.forEach((a, j) => {
          const b = ring[(j + 1) % ring.length];
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const len = Math.hypot(dx, dz);
          if (len < 0.05) return;
          // outward normal: away from the building's solid
          let n = [-dz / len, 0, dx / len];
          const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          if (inSolid(mx + n[0] * 0.05, mz + n[2] * 0.05)) n = n.map((v) => -v);
          const u0 = run / BAY, u1 = (run + len) / BAY;
          run += len;
          const v = (y) => (y - bld.ground) / FLOOR;
          const a0 = vertex(walls, [a[0], bottom, a[1]], n, [u0, v(bottom)], tint);
          const b0 = vertex(walls, [b[0], bottom, b[1]], n, [u1, v(bottom)], tint);
          const b1 = vertex(walls, [b[0], top, b[1]], n, [u1, v(top)], tint);
          const a1 = vertex(walls, [a[0], top, a[1]], n, [u0, v(top)], tint);
          // front face towards the normal
          const facing = -dz * n[0] + dx * n[2] > 0;
          walls.idx.push(...(facing ? [a0, b0, b1, a0, b1, a1] : [a0, b1, b0, a0, a1, b1]));
        });
      }
      // roof slab, sunk behind the parapet
      const roof = bucket(group, "roof");
      const y = bld.floors >= 2 ? top - PARAPET : top;
      const contour = pts[0].map(([x, z]) => new THREE.Vector2(x, z));
      const holes = pts.slice(1).map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
      const flat = [...contour, ...holes.flat()];
      const base = roof.pos.length / 3;
      for (const p of flat) vertex(roof, [p.x, y, p.y], [0, 1, 0], [p.x / 4, p.y / 4], [1, 1, 1, 1]);
      for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        const A = flat[p], B = flat[q], C = flat[r];
        // facing up (+Y) in a frame where +Z points south: (B - A) × (C - A) must have a positive y
        const up = (C.x - A.x) * (B.y - A.y) - (B.x - A.x) * (C.y - A.y) > 0;
        roof.idx.push(...(up ? [base + p, base + q, base + r] : [base + p, base + r, base + q]));
      }
    }
  });
  return { district, buckets };
}

function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

for (const id of process.argv.slice(2)) {
  const palette = PALETTES[id];
  if (!palette) throw new Error(`no palette for district "${id}"`);
  const { district, buckets } = buildDistrict(id);
  const doc = new Document();
  doc.createBuffer();
  const buffer = doc.getRoot().listBuffers()[0];
  const scene = doc.createScene(id);
  const rgb = (c) => [...c.map((v) => (v / 255) ** 2.2), 1]; // sRGB to linear
  const tex = doc.createTexture("facade").setImage(await facadeTexture(palette)).setMimeType("image/png");
  // a little self-light keeps the shaded sides as pale as the map's own white blocks
  const GLOW = 0.32;
  const glow = (c) => rgb(c).slice(0, 3).map((v) => v * GLOW);
  const materials = {
    wall: doc.createMaterial("wall").setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([GLOW, GLOW, GLOW])
      .setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(true),
    plain: doc.createMaterial("plain").setBaseColorFactor(rgb(palette.wall)).setEmissiveFactor(glow(palette.wall))
      .setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true),
    roof: doc.createMaterial("roof").setBaseColorFactor(rgb(palette.roof)).setEmissiveFactor(glow(palette.roof)).setRoughnessFactor(0.95).setMetallicFactor(0),
  };
  const groups = {};
  for (const b of Object.values(buckets)) {
    if (!b.idx.length) continue;
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.nor)).setBuffer(buffer))
      .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(b.uv)).setBuffer(buffer))
      .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(new Float32Array(b.col)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(b.idx)).setBuffer(buffer))
      .setMaterial(materials[b.mat]);
    groups[b.group] ??= doc.createMesh(b.group);
    groups[b.group].addPrimitive(prim);
  }
  for (const [name, mesh] of Object.entries(groups)) scene.addChild(doc.createNode(name).setMesh(mesh));
  await doc.transform(weld(), dedup(), quantize({ quantizePosition: 16, quantizeNormal: 8, quantizeColor: 8 }), prune());
  const glb = await new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(doc);
  const out = path.join(root, "public/models", `district-${id}.glb`);
  writeFileSync(out, glb);
  const tris = Object.values(buckets).reduce((n, b) => n + b.idx.length / 3, 0);
  const est = district.buildings.filter((b) => b.estimated).length;
  console.log(`${path.relative(root, out)}: ${(glb.length / 1024).toFixed(0)} KB, ${district.buildings.length} buildings (${est} with estimated floors), ${tris} triangles`);
}
