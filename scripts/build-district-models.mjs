// Builds the 3D model of a whole district for the projects map (public/models/district-<id>.glb, plus the buildings'
// footprints in district-<id>.geojson for picking them on the map) from
// data/districts/<id>.json: every building is extruded from its footprint to its floor count, with a facade of window
// rows, a flat roof behind a parapet and its own ground height on the map's terrain. The inputs come from Overture Maps
// (OpenStreetMap and Microsoft ML footprints); floor counts the data lacks are estimated, and flagged so.
// data/districts/complexes.json overrides a residential complex's floor count with a sourced figure and picks its
// facade: Sea Breeze is drawn in its resort style (white walls, panoramic glazing, balcony bands with glass railings,
// glass towers, the stepped decks of the Caspian Dream Liner); Ağ Şəhər keeps plain window rows.
//   node scripts/build-district-models.mjs seabreeze whitecity
// Units are metres; +Y up, +X east, +Z south (the map places district models with bearing 180). Origin: the district's
// `origin` at its terrain height, so the model stands on the terrain when placed at queryTerrainElevation(origin).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const FLOOR = 3.2; // storey height
const BAY = 3.0; // width of one window bay
const PARAPET = 0.9;
const SKIRT = 1.5; // walls reach below the lowest ground point, so slopes never show a gap
const RAIL = 1.05; // glass railing height
const MIN_COMPLEX_AREA = 300; // a complex's floor count applies to its blocks, not to its kiosks and pavilions

// facade colours per district: wall, glass, frame, roof
const PALETTES = {
  seabreeze: { wall: [247, 245, 240], glass: [146, 168, 176], frame: [228, 225, 218], roof: [226, 223, 216] },
  whitecity: { wall: [245, 241, 232], glass: [138, 150, 158], frame: [226, 220, 207], roof: [224, 219, 209] },
};
// districts drawn in the resort style; the others keep plain window rows
const RESORT = new Set(["seabreeze"]);
const COMPLEXES = JSON.parse(readFileSync(path.join(root, "data/districts/complexes.json"), "utf8"));

const EARTH = 40075016.686;
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/**
 * One window bay of one storey; image rows run from floor level (top) to the next floor (bottom), as glTF reads v.
 *   window: a punched window (villas, Ağ Şəhər)    panorama: floor-to-ceiling glazing between white slab edges
 *   curtain: a glass curtain wall with spandrels   strip: the continuous window band of a ship's deck
 */
async function facadeTexture(kind, { wall, glass, frame }) {
  const S = 128;
  const px = (m, total) => Math.round((m / total) * S);
  const rect = (x0, y0, x1, y1, [r, g, b]) =>
    `<rect x="${px(x0, BAY)}" y="${px(y0, FLOOR)}" width="${px(x1, BAY) - px(x0, BAY)}" height="${px(y1, FLOOR) - px(y0, FLOOR)}" fill="rgb(${r},${g},${b})"/>`;
  const dark = (c, k) => c.map((v) => Math.round(v * k));
  const sky = glass.map((v, i) => Math.round(v * 0.62 + [232, 240, 245][i] * 0.38)); // glass reflecting a pale sky
  const parts = {
    window: [rect(0.55, 0.85, 2.45, 2.8, frame), rect(0.62, 0.92, 2.38, 2.73, glass), rect(1.47, 0.92, 1.53, 2.73, frame), rect(0, 0, BAY, 0.08, dark(frame, 0.95))],
    // floor-to-ceiling glass catching the sky, between white slab edges and mullions
    panorama: [rect(0, 0.25, BAY, 2.7, sky), rect(0, 1.8, BAY, 2.7, dark(sky, 0.94)), rect(0, 0.25, 0.14, 2.7, wall), rect(1.43, 0.25, 1.57, 2.7, frame)],
    curtain: [rect(0, 0, BAY, FLOOR, sky), rect(0, 1.6, BAY, FLOOR, dark(sky, 0.93)), rect(0, 0, BAY, 0.7, dark(glass, 0.95)),
      rect(0, 0, 0.06, FLOOR, frame), rect(1.47, 0, 1.53, FLOOR, frame), rect(0, 0.68, BAY, 0.74, frame)],
    strip: [rect(0, 0.9, BAY, 2.55, sky), rect(0, 1.8, BAY, 2.55, dark(sky, 0.93)), rect(1.47, 0.9, 1.53, 2.55, frame), rect(0, 0.84, BAY, 0.9, frame)],
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="rgb(${wall.join(",")})"/>${parts[kind].join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Deterministic 0..1 from a number, for small per-building tint changes. */
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const ringArea = (ring) => Math.abs(THREE.ShapeUtils.area(ring.map(([x, z]) => new THREE.Vector2(x, z))));

/** The ring moved `d` metres inwards (mitred corners, clamped at sharp ones), or null if it collapses. */
function insetRing(ring, d) {
  const n = ring.length;
  const lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let m = [-t[1], t[0]];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!inRing(ring, mid[0] + m[0] * 0.05, mid[1] + m[1] * 0.05)) m = [-m[0], -m[1]];
    return { p: [a[0] + m[0] * d, a[1] + m[1] * d], t, m };
  });
  const out = ring.map((v, i) => {
    const A = lines[(i + n - 1) % n], B = lines[i];
    const det = A.t[0] * B.t[1] - A.t[1] * B.t[0];
    let p;
    if (Math.abs(det) < 1e-6) p = B.p;
    else {
      const s = ((B.p[0] - A.p[0]) * B.t[1] - (B.p[1] - A.p[1]) * B.t[0]) / det;
      p = [A.p[0] + A.t[0] * s, A.p[1] + A.t[1] * s];
    }
    const dx = p[0] - v[0], dz = p[1] - v[1], k = Math.hypot(dx, dz);
    return k > 3 * d ? [v[0] + (dx / k) * 3 * d, v[1] + (dz / k) * 3 * d] : p;
  });
  if (!out.every(([x, z]) => inRing(ring, x, z))) return null;
  return ringArea(out) > ringArea(ring) * 0.15 ? out : null;
}

function buildDistrict(id) {
  const district = JSON.parse(readFileSync(path.join(root, "data/districts", `${id}.json`), "utf8"));
  const facts = COMPLEXES[id] ?? {};
  const resort = RESORT.has(id);
  const [lng0, lat0] = district.origin;
  const k = EARTH * Math.cos((lat0 * Math.PI) / 180); // metres per Mercator unit at the origin
  const local = ([lng, lat]) => [(mercX(lng) - mercX(lng0)) * k, (mercY(lat) - mercY(lat0)) * k];

  // geometry buckets, one per material
  const buckets = {};
  const bucket = (mat) => (buckets[mat] ??= { mat, pos: [], nor: [], uv: [], col: [], idx: [] });
  const vertex = (b, p, n, uv, c) => {
    b.pos.push(...p);
    b.nor.push(...n);
    b.uv.push(...uv);
    b.col.push(...c);
    return b.pos.length / 3 - 1;
  };
  /** A flat quad (corners in order around it), its front towards n. */
  const quad = (b, corners, n, uvs, c) => {
    const [i0, i1, i2, i3] = corners.map((p, j) => vertex(b, p, n, uvs?.[j] ?? [0, 0], c ?? [1, 1, 1, 1]));
    const [p0, p1, p2] = corners;
    const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const front = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0;
    b.idx.push(...(front ? [i0, i1, i2, i0, i2, i3] : [i0, i2, i1, i0, i3, i2]));
  };
  /** Edges of a ring with their outward normal (away from `solid`) and length. */
  const edges = (ring, solid) =>
    ring.flatMap((a, j) => {
      const b = ring[(j + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) return [];
      let n = [-dz / len, dx / len];
      if (solid((a[0] + b[0]) / 2 + n[0] * 0.05, (a[1] + b[1]) / 2 + n[1] * 0.05)) n = [-n[0], -n[1]];
      return [{ a, b, len, n, t: [dx / len, dz / len], j }];
    });

  /** Walls of one ring from y0 to y1, textured by bay and storey counted from `ground`. */
  const walls = (mat, ring, solid, y0, y1, ground, tint) => {
    const b = bucket(mat);
    let run = 0;
    for (const e of edges(ring, solid)) {
      const u0 = run / BAY, u1 = (run + e.len) / BAY;
      run += e.len;
      const v = (y) => (y - ground) / FLOOR;
      quad(b, [[e.a[0], y0, e.a[1]], [e.b[0], y0, e.b[1]], [e.b[0], y1, e.b[1]], [e.a[0], y1, e.a[1]]], [e.n[0], 0, e.n[1]],
        [[u0, v(y0)], [u1, v(y0)], [u1, v(y1)], [u0, v(y1)]], tint);
    }
  };
  /** A flat roof over a ring (with holes) at height y, facing up. */
  const roof = (mat, rings, y) => {
    const b = bucket(mat);
    const contour = rings[0].map(([x, z]) => new THREE.Vector2(x, z));
    const holes = rings.slice(1).map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
    const flat = [...contour, ...holes.flat()];
    const base = b.pos.length / 3;
    for (const p of flat) vertex(b, [p.x, y, p.y], [0, 1, 0], [p.x / 4, p.y / 4], [1, 1, 1, 1]);
    for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      const A = flat[p], B = flat[q], C = flat[r];
      // facing up (+Y) in a frame where +Z points south: (B - A) × (C - A) must have a positive y
      const up = (C.x - A.x) * (B.y - A.y) - (B.x - A.x) * (C.y - A.y) > 0;
      b.idx.push(...(up ? [base + p, base + q, base + r] : [base + p, base + r, base + q]));
    }
  };
  /** A glass railing along every edge of a ring, standing on y. */
  const railing = (ring, solid, y) => {
    for (const e of edges(ring, solid))
      quad(bucket("rail"), [[e.a[0], y, e.a[1]], [e.b[0], y, e.b[1]], [e.b[0], y + RAIL, e.b[1]], [e.a[0], y + RAIL, e.a[1]]], [e.n[0], 0, e.n[1]]);
  };
  /** A balcony slab along an edge, from s0 to s1 metres along it, `depth` out, its top at y; glass railing on top. */
  const balcony = (e, s0, s1, depth, y) => {
    const at = (s, out) => [e.a[0] + e.t[0] * s + e.n[0] * out, e.a[1] + e.t[1] * s + e.n[1] * out];
    const [p0, p1, p2, p3] = [at(s0, 0), at(s1, 0), at(s1, depth), at(s0, depth)];
    const y0 = y - 0.24, slab = bucket("slab"), rail = bucket("rail");
    const P = ([x, z], h) => [x, h, z];
    // seen from map heights only the slab's top and edge and the railing's face show
    quad(slab, [P(p0, y), P(p1, y), P(p2, y), P(p3, y)], [0, 1, 0]);
    quad(slab, [P(p3, y0), P(p2, y0), P(p2, y), P(p3, y)], [e.n[0], 0, e.n[1]]);
    quad(rail, [P(p3, y), P(p2, y), P(p2, y + RAIL), P(p3, y + RAIL)], [e.n[0], 0, e.n[1]]);
  };
  /** Balconies on every long edge of a ring, for each upper storey, in the given pattern. */
  const balconies = (pattern, ring, solid, ground, floors, seed) => {
    for (const e of edges(ring, solid)) {
      if (e.len < 7) continue;
      const s0 = 0.7, s1 = e.len - 0.7;
      for (let f = 1; f < floors; f++) {
        const y = ground + f * FLOOR;
        if (pattern === "bands") balcony(e, s0, s1, 1.5, y);
        else {
          // bays of BAY metres: the wave swells and recedes along the facade and up it; the rhythm pairs balconies
          // with loggia bays, shifted a bay every other storey
          const bays = Math.max(1, Math.floor((s1 - s0) / BAY));
          const w = (s1 - s0) / bays;
          if (pattern === "wave")
            for (let i = 0; i < bays; i++) {
              const depth = 1.1 + 0.75 * Math.sin((2 * Math.PI * (s0 + (i + 0.5) * w)) / 21 + f * 0.75 + e.j + seed);
              balcony(e, s0 + i * w, s0 + (i + 1) * w, depth, y);
            }
          else
            // runs of balcony bays between single loggia bays
            for (let i = 0; i < bays; ) {
              if ((i + f) % 3 === 2) { i++; continue; }
              let j = i + 1;
              while (j < bays && (j + f) % 3 !== 2) j++;
              balcony(e, s0 + i * w + 0.05, s0 + j * w - 0.05, 1.6, y);
              i = j;
            }
        }
      }
    }
  };

  const out = [];
  district.buildings.forEach((bld, i) => {
    const pts0 = bld.polygons.map((rings) => rings.map((ring) => ring.map(local)));
    const area = pts0.reduce((s, rings) => s + ringArea(rings[0]), 0);
    const fact = bld.complex && area >= MIN_COMPLEX_AREA ? facts[bld.complex] : undefined;
    const floors = fact?.floors ?? bld.floors;
    const estimated = fact?.floors ? false : bld.estimated;
    const status = fact?.status;
    const t = 0.93 + hash(i + 1) * 0.07;
    const tint = [t, t, t * 0.995, 1];
    const bottom = bld.low - SKIRT;
    // what the building looks like
    let top;
    for (const rings of pts0) {
      const solid = (x, z) => inRing(rings[0], x, z) && !rings.slice(1).some((h) => inRing(h, x, z));
      const partArea = ringArea(rings[0]);
      if (resort && fact?.shape === "liner") {
        // a ship: the hull, then decks stepping back, each with a glass railing round its terrace
        const decks = [{ to: Math.round(floors * 0.55), inset: 0 }, { to: Math.round(floors * 0.82), inset: 4 }, { to: floors, inset: 10 }];
        let from = 0, ring = rings[0];
        for (const { to, inset } of decks) {
          const r = inset ? insetRing(rings[0], inset) : rings[0];
          if (!r || to <= from) break;
          ring = r;
          const deckSolid = (x, z) => inRing(ring, x, z);
          const y0 = from ? bld.ground + from * FLOOR : bottom, y1 = bld.ground + to * FLOOR;
          walls("strip", ring, deckSolid, y0, y1 + (to === floors ? PARAPET : 0), bld.ground, tint);
          roof("roof", [ring], y1);
          if (to < floors) railing(ring, deckSolid, y1);
          from = to;
          top = y1 + (to === floors ? PARAPET : 0);
        }
        continue;
      }
      const height = floors * FLOOR + (floors >= 2 ? PARAPET : 0.3);
      top = bld.ground + height;
      let mat, pattern = null;
      if (!resort) mat = floors >= 2 || partArea >= 150 ? "window" : "plain";
      else if (floors >= 15) mat = "curtain";
      else if (floors >= 3 && partArea >= 250) {
        mat = "panorama";
        pattern = fact?.balconies ?? facts[bld.complex]?.balconies ?? "bands";
      } else mat = floors >= 2 || partArea >= 150 ? "window" : "plain";
      for (const ring of rings) walls(mat, ring, solid, bottom, top, bld.ground, tint);
      roof("roof", rings, floors >= 2 ? top - PARAPET : top);
      if (pattern) balconies(pattern, rings[0], solid, bld.ground, floors, i);
      if (mat === "curtain") {
        // plant room on the roof of a tower
        const r = insetRing(rings[0], 6);
        if (r) {
          const y0 = top - PARAPET, y1 = y0 + 3.6;
          walls("plain", r, (x, z) => inRing(r, x, z), y0, y1, bld.ground, tint);
          roof("roof", [r], y1);
        }
      }
    }
    out.push({ bld, floors, estimated, status, height: Math.round((top - bld.ground) * 10) / 10 });
  });
  return { district, buckets, buildings: out };
}

for (const id of process.argv.slice(2)) {
  const palette = PALETTES[id];
  if (!palette) throw new Error(`no palette for district "${id}"`);
  const { district, buckets, buildings } = buildDistrict(id);
  const doc = new Document();
  doc.createBuffer();
  const buffer = doc.getRoot().listBuffers()[0];
  const scene = doc.createScene(id);
  const rgb = (c) => [...c.map((v) => (v / 255) ** 2.2), 1]; // sRGB to linear
  // a little self-light keeps the shaded sides as pale as the map's own white blocks
  const GLOW = 0.32;
  const glow = (c) => rgb(c).slice(0, 3).map((v) => v * GLOW);
  const textured = async (kind) => {
    const tex = doc.createTexture(kind).setImage(await facadeTexture(kind, palette)).setMimeType("image/png");
    return doc.createMaterial(kind).setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([GLOW, GLOW, GLOW])
      .setRoughnessFactor(kind === "curtain" ? 0.35 : 0.85).setMetallicFactor(0).setDoubleSided(true);
  };
  const used = new Set(Object.keys(buckets));
  const materials = {
    plain: doc.createMaterial("plain").setBaseColorFactor(rgb(palette.wall)).setEmissiveFactor(glow(palette.wall))
      .setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true),
    roof: doc.createMaterial("roof").setBaseColorFactor(rgb(palette.roof)).setEmissiveFactor(glow(palette.roof)).setRoughnessFactor(0.95).setMetallicFactor(0),
    slab: doc.createMaterial("slab").setBaseColorFactor(rgb(palette.wall)).setEmissiveFactor(glow(palette.wall))
      .setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(true),
    rail: doc.createMaterial("rail").setBaseColorFactor([...rgb(palette.glass).slice(0, 3), 0.42]).setAlphaMode("BLEND")
      .setRoughnessFactor(0.2).setMetallicFactor(0).setDoubleSided(true),
  };
  for (const kind of ["window", "panorama", "curtain", "strip"]) if (used.has(kind)) materials[kind] = await textured(kind);
  const mesh = doc.createMesh(id);
  // opaque first, the glass railings last
  for (const b of Object.values(buckets).sort((x, y) => (x.mat === "rail") - (y.mat === "rail"))) {
    if (!b.idx.length) continue;
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.nor)).setBuffer(buffer))
      .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(b.uv)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(b.idx)).setBuffer(buffer))
      .setMaterial(materials[b.mat]);
    // per-building tints on the walls only
    if (!["roof", "slab", "rail"].includes(b.mat))
      prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(new Float32Array(b.col)).setBuffer(buffer));
    mesh.addPrimitive(prim);
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));
  // meshopt: quantised and compressed (the map's GLTFLoader has the decoder)
  await MeshoptEncoder.ready;
  await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const glb = await new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ "meshopt.encoder": MeshoptEncoder }).writeBinary(doc);
  const file = path.join(root, "public/models", `district-${id}.glb`);
  writeFileSync(file, glb);
  // footprints for the map: tapping a building opens its card
  const footprints = {
    type: "FeatureCollection",
    features: buildings.map(({ bld: b, floors, estimated, status, height }) => ({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: b.polygons.map((rings) => rings.map((ring) => [...ring, ring[0]])) },
      properties: {
        id: b.id,
        ...(b.name ? { name: b.name } : {}),
        ...(b.complex ? { complex: b.complex } : {}),
        floors,
        estimated,
        ...(status ? { status } : {}),
        height,
      },
    })),
  };
  writeFileSync(path.join(root, "public/models", `district-${id}.geojson`), JSON.stringify(footprints));
  const tris = Object.values(buckets).reduce((n, b) => n + b.idx.length / 3, 0);
  const est = buildings.filter((b) => b.estimated).length;
  console.log(`${path.relative(root, file)}: ${(glb.length / 1024).toFixed(0)} KB, ${district.buildings.length} buildings (${est} with estimated floors), ${tris} triangles`);
}
