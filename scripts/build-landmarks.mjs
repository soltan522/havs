// Builds detailed 3D models of Baku's landmarks for the projects map (public/models/landmark-<id>.glb) from
// data/landmarks.json and their footprints in data/city/*.geojson.gz (Overture Maps), and writes
// data/landmarks.generated.json (each landmark's origin, bounds, footprint and height) for the map, which draws the
// model in place of the city blocks it `replaces`. Each `kind` is a form drawn on the real footprint and height:
//   flame    a Flame Tower: the footprint narrows upwards into a tip leaning to the trio's centre
//   sail     SOCAR Tower: narrowing and turning as it rises into a sharp crest
//   shell    Heydar Aliyev Center: one smooth white surface over the footprint, sweeping to the ground on the plaza
//   stone    Maiden Tower: limestone walls, its buttress included
//   carpet   Carpet Museum: a rolled carpet, round in section, carpet patterns all over
//   lotus    Deniz Mall: petals rising from the star-shaped footprint to the centre
//   crystal  Crystal Hall: a faceted membrane box, its roof rising to the middle
//   tvtower  Baku TV Tower: shaft, restaurant pod and mast
//   glasstower   a glass tower whose top two storeys step back a little
//   stalinist    Government House: limestone wings and a central tower stepping back in tiers to a spire
//   classic      a stone building (arched windows, or Venetian Gothic ones) with its towers and domes
//   colonnade    a modernist palace behind a white colonnade
//   aquatics     the Aquatic Centre: a roof rising like a wave over glass walls
//   mosque   limestone walls, a dome on a drum and minarets on the side away from the qibla (or a mausoleum's dome)
//   hamam    an old bathhouse: low stone walls under small domes
//   beauxarts    stone storeys under a zinc mansard, with cupolas on its corners towards the sea
//   stadium      the Olympic Stadium: a membrane facade, a white roof over the stands and the pitch
//   flagpole     the National Flag Square's pole with the flag flying
//   stonetower   a stone tower whose top storeys step back into a crown
//   node scripts/build-landmarks.mjs [id ...]
// Landmarks outside the city layer take their footprint from data/landmarks.extra.geojson (scripts/city/fetch_footprints.py);
// one with no footprint (a flagpole) stands at its `at` point.
// Units are metres; +Y up, +X east, +Z south (the map places the models with bearing 180). Each model's origin is
// the centre of its footprint at ground level; walls reach below it to the footprint's lowest ground.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import Delaunator from "delaunator";
import earcut from "earcut";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const EX = 1.35; // the map's terrain exaggeration (TERRAIN_EXAGGERATION in lib/map-style.ts)
const GLOW = 0.32; // self-light, as the district models have
const EARTH = 40075016.686;
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

// ---------------------------------------------------------------------------------------------------- 2D helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const signedArea = (r) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
const open = (r) => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r);
const centroid = (r) => {
  let a = 0, x = 0, z = 0;
  r.forEach((p, i) => {
    const q = r[(i + 1) % r.length], c = p[0] * q[1] - q[0] * p[1];
    a += c; x += (p[0] + q[0]) * c; z += (p[1] + q[1]) * c;
  });
  return [x / (3 * a), z / (3 * a)];
};
function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const inside = (rings, x, z) => inRing(rings[0], x, z) && !rings.slice(1).some((h) => inRing(h, x, z));
/** Corner cutting: rounds a polygon. */
function chaikin(r, n) {
  for (let k = 0; k < n; k++) r = r.flatMap((p, i) => { const q = r[(i + 1) % r.length]; return [lerp(p, q, 0.25), lerp(p, q, 0.75)]; });
  return r;
}
/** `count` points evenly spaced along a closed ring. */
function resample(r, count) {
  const segs = r.map((p, i) => len(sub(r[(i + 1) % r.length], p)));
  const total = segs.reduce((a, b) => a + b, 0);
  const out = [];
  let i = 0, at = 0;
  for (let k = 0; k < count; k++) {
    const want = (k / count) * total;
    while (at + segs[i] < want) at += segs[i++];
    out.push(lerp(r[i], r[(i + 1) % r.length], segs[i] ? (want - at) / segs[i] : 0));
  }
  return out;
}
/** Main axis (unit vector) of a set of points, and the axis across it. */
function axes(pts) {
  const c = pts.reduce((s, p) => add(s, p), [0, 0]).map((v) => v / pts.length);
  let xx = 0, xz = 0, zz = 0;
  for (const p of pts) { const d = sub(p, c); xx += d[0] * d[0]; xz += d[0] * d[1]; zz += d[1] * d[1]; }
  const a = 0.5 * Math.atan2(2 * xz, xx - zz);
  return { c, major: [Math.cos(a), Math.sin(a)], minor: [-Math.sin(a), Math.cos(a)] };
}
/** Distance to the nearest edge of any ring, that edge's outward normal and direction. */
function nearestEdge(rings, p, filter) {
  let best = { d: Infinity, n: [0, 0], t: [1, 0] };
  for (const r of rings) {
    r.forEach((a, i) => {
      const b = r[(i + 1) % r.length], ab = sub(b, a), l = len(ab);
      if (l < 1e-6) return;
      const t = mul(ab, 1 / l);
      if (filter && !filter(t)) return;
      const s = Math.max(0, Math.min(l, dot(sub(p, a), t)));
      const d = len(sub(p, add(a, mul(t, s))));
      if (d < best.d) {
        let n = [t[1], -t[0]];
        const m = lerp(a, b, 0.5);
        if (inside(rings, m[0] + n[0] * 0.05, m[1] + n[1] * 0.05)) n = mul(n, -1);
        best = { d, n, t };
      }
    });
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------- mesh parts
/** Geometry for one material: positions, normals and uvs, indexed. */
class Part {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  vertex(p, n, uv) { this.pos.push(...p); this.nor.push(...n); this.uv.push(...uv); return this.pos.length / 3 - 1; }
  /** A triangle facing roughly along `towards` (flipped if its winding says otherwise). */
  tri(a, b, c, towards) {
    const P = (i) => this.pos.slice(i * 3, i * 3 + 3);
    const [A, B, C] = [P(a), P(b), P(c)];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    this.idx.push(...(n[0] * towards[0] + n[1] * towards[1] + n[2] * towards[2] >= 0 ? [a, b, c] : [a, c, b]));
  }
}
const norm3 = (v) => { const l = Math.hypot(...v); return l > 1e-9 ? v.map((x) => x / l) : null; };
const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];

/**
 * A smooth surface through rings of equal length stacked bottom to top (each point [x, y, z]); normals point away
 * from each ring's centre. uv: u along the ring every `uScale` metres, v up every `vScale` metres.
 */
function loft(part, rings, uScale, vScale) {
  const N = rings[0].length;
  const ids = [];
  const centre = rings.map((r) => [r.reduce((s, p) => s + p[0], 0) / N, r.reduce((s, p) => s + p[2], 0) / N]);
  let prevNormals = null;
  rings.forEach((r, i) => {
    let run = 0;
    const row = [];
    const normals = [];
    for (let j = 0; j <= N; j++) {
      const p = r[j % N];
      if (j > 0) run += Math.hypot(p[0] - r[j - 1][0], p[2] - r[j - 1][2]);
      const T = sub3(r[(j + 1) % N], r[(j + N - 1) % N]);
      const B = sub3(rings[Math.min(i + 1, rings.length - 1)][j % N], rings[Math.max(i - 1, 0)][j % N]);
      let n = norm3(cross3(B, T));
      if (n) {
        const out = [p[0] - centre[i][0], 0, p[2] - centre[i][1]];
        if (n[0] * out[0] + n[2] * out[2] < 0) n = n.map((v) => -v);
      } else n = prevNormals?.[j] ?? [0, 1, 0];
      normals.push(n);
      row.push(part.vertex(p, n, [run / uScale, p[1] / vScale]));
    }
    prevNormals = normals;
    ids.push(row);
  });
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < N; j++) {
      const [a, b, c, d] = [ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]];
      const p = rings[i][j], q = rings[i + 1][(j + 1) % N];
      const towards = [(p[0] + q[0]) / 2 - centre[i][0], 0, (p[2] + q[2]) / 2 - centre[i][1]];
      part.tri(a, b, c, towards);
      part.tri(a, c, d, towards);
    }
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** A flat polygon (outer ring with holes, 2D) at height y, facing up or down. */
function cap(part, rings, y, up = true, uvScale = 4) {
  const flat = rings.flat();
  const base = flat.map(([x, z]) => part.vertex([x, y, z], [0, up ? 1 : -1, 0], [x / uvScale, z / uvScale]));
  const holes = [];
  let at = rings[0].length;
  for (const h of rings.slice(1)) { holes.push(at); at += h.length; }
  const t = earcut(flat.flat(), holes);
  for (let k = 0; k < t.length; k += 3) part.tri(base[t[k]], base[t[k + 1]], base[t[k + 2]], [0, up ? 1 : -1, 0]);
}

/** Vertical walls along every ring edge, from y0 to the heights `top(point)` gives at its ends. */
function walls(part, rings, y0, top, uScale = 3, vScale = 3) {
  for (const r of rings) {
    let run = 0;
    r.forEach((a, i) => {
      const b = r[(i + 1) % r.length], l = len(sub(b, a));
      if (l < 0.05) return;
      let n = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
      const m = lerp(a, b, 0.5);
      if (inside(rings, m[0] + n[0] * 0.05, m[1] + n[1] * 0.05)) n = mul(n, -1);
      const N = [n[0], 0, n[1]];
      const ya = top(a), yb = top(b);
      const ids = [
        part.vertex([a[0], y0, a[1]], N, [run / uScale, y0 / vScale]),
        part.vertex([b[0], y0, b[1]], N, [(run + l) / uScale, y0 / vScale]),
        part.vertex([b[0], yb, b[1]], N, [(run + l) / uScale, yb / vScale]),
        part.vertex([a[0], ya, a[1]], N, [run / uScale, ya / vScale]),
      ];
      run += l;
      part.tri(ids[0], ids[1], ids[2], N);
      part.tri(ids[0], ids[2], ids[3], N);
    });
  }
}

/**
 * A surface over a footprint (outer ring with holes) at the heights `height(point)` gives, triangulated through a grid
 * of points `step` metres apart; smooth normals; planar uvs every `uvScale` metres.
 */
function surface(part, rings, step, height, uvScale = 6) {
  const dense = rings.map((r) => r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length], n = Math.max(1, Math.ceil(len(sub(b, a)) / step));
    return Array.from({ length: n }, (_, k) => lerp(a, b, k / n));
  }));
  const xs = dense[0].map((p) => p[0]), zs = dense[0].map((p) => p[1]);
  const steiner = [];
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step)
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step)
      if (inside(dense, x, z) && nearestEdge(dense, [x, z]).d > step * 0.45) steiner.push([x, z]);
  const pts = [...dense.flat(), ...steiner];
  // Delaunay triangles over the edge and grid points (well shaped, so the surface shades smoothly), kept where
  // they lie inside the footprint
  const all = new Delaunator(pts.flat()).triangles;
  const tris = [];
  for (let k = 0; k < all.length; k += 3) {
    const [a, b, c] = [pts[all[k]], pts[all[k + 1]], pts[all[k + 2]]];
    if (inside(dense, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)) tris.push(all[k], all[k + 1], all[k + 2]);
  }
  const ys = pts.map((p) => height(p));
  // smooth normals from the faces around each point
  const nor = pts.map(() => [0, 0, 0]);
  const faces = [];
  for (let k = 0; k < tris.length; k += 3) {
    let [a, b, c] = [tris[k], tris[k + 1], tris[k + 2]];
    const P = (i) => [pts[i][0], ys[i], pts[i][1]];
    let n = cross3(sub3(P(b), P(a)), sub3(P(c), P(a)));
    if (n[1] < 0) { [b, c] = [c, b]; n = n.map((v) => -v); }
    faces.push([a, b, c]);
    for (const i of [a, b, c]) for (let d = 0; d < 3; d++) nor[i][d] += n[d];
  }
  const ids = pts.map((p, i) => part.vertex([p[0], ys[i], p[1]], norm3(nor[i]) ?? [0, 1, 0], [p[0] / uvScale, p[1] / uvScale]));
  for (const [a, b, c] of faces) part.idx.push(ids[a], ids[b], ids[c]);
  return dense;
}

/** Rings of a circle (`n` points) around c at radius r and height y. */
const circle = (c, r, y, n = 32) => Array.from({ length: n }, (_, k) => [c[0] + r * Math.cos((2 * Math.PI * k) / n), y, c[1] + r * Math.sin((2 * Math.PI * k) / n)]);
const at = (ring2d, y) => ring2d.map(([x, z]) => [x, y, z]);
const disc = (c, r, n = 32) => circle(c, r, 0, n).map(([x, , z]) => [x, z]);
/** A w x d rectangle centred on c, its w side along the unit vector t. */
const box = (c, t, w, d) => {
  const m = [-t[1], t[0]];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(c, add(mul(t, (a * w) / 2), mul(m, (b * d) / 2))));
};
/** The ring moved d metres inwards with its points in order (mitred, clamped), or null if a point leaves it. */
function inset(ring, d) {
  const n = ring.length;
  const lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n], l = len(sub(b, a)) || 1, t = mul(sub(b, a), 1 / l);
    let m = [-t[1], t[0]];
    const mid = lerp(a, b, 0.5);
    if (!inRing(ring, mid[0] + m[0] * 0.05, mid[1] + m[1] * 0.05)) m = mul(m, -1);
    return { p: add(a, mul(m, d)), t };
  });
  const out = ring.map((v, i) => {
    const A = lines[(i + n - 1) % n], B = lines[i];
    const det = A.t[0] * B.t[1] - A.t[1] * B.t[0];
    let p = B.p;
    if (Math.abs(det) > 1e-6) {
      const s = ((B.p[0] - A.p[0]) * B.t[1] - (B.p[1] - A.p[1]) * B.t[0]) / det;
      p = add(A.p, mul(A.t, s));
    }
    const k = len(sub(p, v));
    return k > 3 * d ? add(v, mul(sub(p, v), (3 * d) / k)) : p;
  });
  return out.every(([x, z]) => inRing(ring, x, z)) ? out : null;
}
/** A sloping surface from a ring at y0 back to the same ring moved in (`top`) at y1, textured by storey. */
function slope(part, ring, top, y0, y1, uScale, vScale) {
  let run = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], A = top[i], B = top[(i + 1) % ring.length], l = len(sub(b, a));
    if (l < 0.05) return;
    let n = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    if (inRing(ring, (a[0] + b[0]) / 2 + n[0] * 0.05, (a[1] + b[1]) / 2 + n[1] * 0.05)) n = mul(n, -1);
    const rise = y1 - y0, back = len(sub(A, a)), k = Math.hypot(rise, back) || 1;
    const N = [(n[0] * rise) / k, back / k, (n[1] * rise) / k];
    const ids = [
      part.vertex([a[0], y0, a[1]], N, [run / uScale, y0 / vScale]), part.vertex([b[0], y0, b[1]], N, [(run + l) / uScale, y0 / vScale]),
      part.vertex([B[0], y1, B[1]], N, [(run + l) / uScale, y1 / vScale]), part.vertex([A[0], y1, A[1]], N, [run / uScale, y1 / vScale]),
    ];
    run += l;
    part.tri(ids[0], ids[1], ids[2], N);
    part.tri(ids[0], ids[2], ids[3], N);
  });
}
/** A surface between two rings with matching points (a at height ya, b at yb), facing up. */
function band(part, a, ya, b, yb) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    const P = [[a[i][0], ya, a[i][1]], [a[j][0], ya, a[j][1]], [b[j][0], yb, b[j][1]], [b[i][0], yb, b[i][1]]];
    let N = norm3(cross3(sub3(P[1], P[0]), sub3(P[3], P[0]))) ?? [0, 1, 0];
    if (N[1] < 0) N = N.map((v) => -v);
    const ids = P.map((p) => part.vertex(p, N, [p[0] / 6, p[2] / 6]));
    part.tri(ids[0], ids[1], ids[2], N);
    part.tri(ids[0], ids[2], ids[3], N);
  }
}
/** The point of a ring furthest in a compass direction ("south", "southeast", ...), moved `d` metres back inside. */
function corner(ring, direction, d) {
  const dirs = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0], northeast: [0.71, -0.71], northwest: [-0.71, -0.71], southeast: [0.71, 0.71], southwest: [-0.71, 0.71] };
  const dir = dirs[direction];
  const v = ring.reduce((b, p) => (dot(p, dir) > dot(b, dir) ? p : b));
  const c = centroid(ring);
  return add(v, mul(sub(c, v), d / (len(sub(c, v)) || 1)));
}
/** A dome of radius r on the circle around c at height y, with a small lantern on top. */
function dome(part, c, r, y) {
  const rings = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2);
    rings.push(circle(c, Math.max(r * Math.cos(a), r * 0.16), y + r * Math.sin(a) * 1.1, 32));
  }
  loft(part, rings, 2, 2);
  loft(part, [circle(c, r * 0.16, y + r * 1.1, 12), circle(c, r * 0.16, y + r * 1.45, 12), circle(c, 0.05, y + r * 1.7, 12)], 1, 1);
  return y + r * 1.7;
}

// ---------------------------------------------------------------------------------------------------- textures
const rgb = (c) => `rgb(${c.map(Math.round).join(",")})`;
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, v * k)));
/** Texture tiles as SVG, `w` x `h` metres in 256 px. */
const TEXTURES = {
  // Flame Towers: deep blue glass, a light line along every floor (their LED skin), thin mullions
  flame: { w: 3, h: 4.6, svg: (px) => {
    const g = [38, 70, 98];
    return `<rect width="256" height="256" fill="${rgb(g)}"/><rect y="${px.y(1.2)}" width="256" height="${px.y(3.4)}" fill="${rgb(shade(g, 1.25))}"/>
      <rect y="0" width="256" height="${px.y(0.35)}" fill="${rgb([150, 176, 196])}"/><rect x="0" width="${px.x(0.05)}" height="256" fill="${rgb([120, 146, 168])}"/>
      <rect x="${px.x(1.5)}" width="${px.x(0.05)}" height="256" fill="${rgb([96, 124, 146])}"/>`;
  } },
  // a blue glass curtain wall with floor lines
  glass: { w: 3, h: 4, svg: (px) => {
    const g = [96, 134, 162];
    return `<rect width="256" height="256" fill="${rgb(g)}"/><rect y="${px.y(1.8)}" width="256" height="${px.y(2.2)}" fill="${rgb(shade(g, 0.88))}"/>
      <rect y="0" width="256" height="${px.y(0.5)}" fill="${rgb(shade(g, 0.7))}"/><rect x="0" width="${px.x(0.06)}" height="256" fill="${rgb([196, 210, 220])}"/>
      <rect x="${px.x(1.5)}" width="${px.x(0.04)}" height="256" fill="${rgb([170, 188, 200])}"/>`;
  } },
  // Absheron limestone in courses
  stone: { w: 2.4, h: 2.4, svg: (px) => {
    const s = [206, 186, 150];
    let out = `<rect width="256" height="256" fill="${rgb(s)}"/>`;
    for (let k = 0; k < 6; k++) {
      const y = px.y(k * 0.4);
      out += `<rect y="${y}" width="256" height="2" fill="${rgb(shade(s, 0.82))}"/>`;
      for (let j = 0; j < 4; j++) out += `<rect x="${(px.x(j * 0.6 + (k % 2) * 0.3)) % 256}" y="${y}" width="2" height="${px.y(0.4)}" fill="${rgb(shade(s, 0.86))}"/>`;
      out += `<rect x="0" y="${y + 2}" width="256" height="${px.y(0.4) - 2}" fill="${rgb(shade(s, 0.97 + 0.05 * ((k * 7) % 3)))}" fill-opacity="0.5"/>`;
    }
    return out;
  } },
  // carpet: a red field with a navy and gold border and medallions
  carpet: { w: 8, h: 8, svg: () => {
    const red = [150, 38, 42], navy = [30, 42, 86], gold = [214, 160, 64], cream = [236, 224, 196];
    const diamond = (cx, cy, r, c) => `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${rgb(c)}"/>`;
    return `<rect width="256" height="256" fill="${rgb(red)}"/><rect width="256" height="22" fill="${rgb(navy)}"/><rect y="22" width="256" height="6" fill="${rgb(gold)}"/>
      <rect y="228" width="256" height="6" fill="${rgb(gold)}"/><rect y="234" width="256" height="22" fill="${rgb(navy)}"/>
      ${diamond(128, 128, 70, navy)}${diamond(128, 128, 54, gold)}${diamond(128, 128, 38, red)}${diamond(128, 128, 18, cream)}
      ${diamond(0, 128, 34, gold)}${diamond(256, 128, 34, gold)}${diamond(0, 128, 18, navy)}${diamond(256, 128, 18, navy)}
      ${[40, 88, 168, 216].map((x) => diamond(x, 11, 7, cream)).join("")}${[40, 88, 168, 216].map((x) => diamond(x, 245, 7, cream)).join("")}`;
  } },
  // Crystal Hall: a membrane of triangular facets
  crystal: { w: 6, h: 6, svg: () => {
    const c = [232, 236, 241];
    const t = (pts, k) => `<polygon points="${pts}" fill="${rgb(shade(c, k))}"/>`;
    return `<rect width="256" height="256" fill="${rgb(c)}"/>${t("0,0 128,0 0,128", 0.94)}${t("128,0 256,0 256,128", 0.9)}${t("128,128 256,256 0,256", 0.96)}
      ${t("0,128 128,128 0,256", 0.88)}${t("256,128 256,256 128,128", 0.92)}
      <path d="M0 0 L256 256 M256 0 L0 256 M128 0 L128 256 M0 128 L256 128" stroke="${rgb([176, 186, 198])}" stroke-width="3"/>`;
  } },
  // fair-faced concrete in pour bands
  concrete: { w: 4, h: 4, svg: (px) => {
    const c = [224, 221, 214];
    return `<rect width="256" height="256" fill="${rgb(c)}"/><rect y="${px.y(1.9)}" width="256" height="3" fill="${rgb(shade(c, 0.88))}"/>
      <rect y="${px.y(3.9)}" width="256" height="3" fill="${rgb(shade(c, 0.9))}"/>`;
  } },
  // Stalinist limestone: tall windows, a string course at every floor, pilaster strips
  stalin: { w: 3.6, h: 3.8, svg: (px) => {
    const s = [222, 204, 172];
    return `<rect width="256" height="256" fill="${rgb(s)}"/><rect x="0" width="${px.x(0.32)}" height="256" fill="${rgb(shade(s, 1.05))}"/>
      <rect x="${px.x(1.1)}" y="${px.y(0.9)}" width="${px.x(1.4)}" height="${px.y(2.3)}" fill="${rgb([86, 90, 94])}"/>
      <rect x="${px.x(1.02)}" y="${px.y(3.2)}" width="${px.x(1.56)}" height="${px.y(0.14)}" fill="${rgb(shade(s, 0.84))}"/>
      <rect y="${px.y(3.62)}" width="256" height="${px.y(0.18)}" fill="${rgb(shade(s, 0.9))}"/>`;
  } },
  // cream stone with round-arched windows and a cornice line (image rows run upwards from the floor)
  classic: { w: 3.6, h: 4.6, svg: (px) => {
    const s = [234, 220, 188], win = [86, 92, 98];
    const x0 = px.x(1.15), x1 = px.x(2.45), r = (x1 - x0) / 2;
    return `<rect width="256" height="256" fill="${rgb(s)}"/><rect x="0" width="${px.x(0.35)}" height="256" fill="${rgb(shade(s, 1.05))}"/>
      <rect x="${x0}" y="${px.y(0.9)}" width="${x1 - x0}" height="${px.y(2.3)}" fill="${rgb(win)}"/>
      <ellipse cx="${(x0 + x1) / 2}" cy="${px.y(3.2)}" rx="${r}" ry="${r}" fill="${rgb(win)}"/>
      <rect y="${px.y(4.3)}" width="256" height="${px.y(0.3)}" fill="${rgb(shade(s, 0.86))}"/>`;
  } },
  // Venetian Gothic: pointed-arch windows in pale stone
  gothic: { w: 3, h: 4.6, svg: (px) => {
    const s = [218, 202, 170], win = [80, 84, 90];
    const x0 = px.x(0.95), x1 = px.x(2.05), m = (x0 + x1) / 2;
    return `<rect width="256" height="256" fill="${rgb(s)}"/>
      <rect x="${x0}" y="${px.y(0.9)}" width="${x1 - x0}" height="${px.y(2.0)}" fill="${rgb(win)}"/>
      <polygon points="${x0},${px.y(2.9)} ${x1},${px.y(2.9)} ${m},${px.y(3.75)}" fill="${rgb(win)}"/>
      <rect x="${px.x(1.47)}" y="${px.y(0.9)}" width="${px.x(0.06)}" height="${px.y(2.4)}" fill="${rgb(s)}"/>
      <rect y="${px.y(4.35)}" width="256" height="${px.y(0.25)}" fill="${rgb(shade(s, 0.85))}"/>`;
  } },
  // white columns before dark glass, under an entablature
  colonnade: { w: 3, h: 4, svg: (px) => {
    const w = [238, 236, 230];
    return `<rect width="256" height="256" fill="${rgb([60, 70, 80])}"/><rect x="0" width="${px.x(0.8)}" height="256" fill="${rgb(w)}"/>
      <rect x="${px.x(0.8)}" width="${px.x(0.12)}" height="256" fill="${rgb(shade(w, 0.8))}"/>
      <rect y="${px.y(3.3)}" width="256" height="${px.y(0.7)}" fill="${rgb(w)}"/>`;
  } },
  // zinc with a dormer window (a mansard storey)
  mansard: { w: 3, h: 3.6, svg: (px) => {
    const z = [122, 130, 138], s = [234, 220, 188];
    return `<rect width="256" height="256" fill="${rgb(z)}"/><rect y="${px.y(3.3)}" width="256" height="${px.y(0.3)}" fill="${rgb(shade(z, 0.85))}"/>
      <rect x="${px.x(1.0)}" y="${px.y(0.5)}" width="${px.x(1.0)}" height="${px.y(2.0)}" fill="${rgb(s)}"/>
      <rect x="${px.x(1.12)}" y="${px.y(0.65)}" width="${px.x(0.76)}" height="${px.y(1.7)}" fill="${rgb([80, 88, 96])}"/>`;
  } },
  // the flag of Azerbaijan, 2:1 (crescent and star drawn half as wide, as the tile is stretched)
  flag: { w: 2, h: 1, svg: () => {
    const star = Array.from({ length: 16 }, (_, k) => {
      const a = (k * Math.PI) / 8 - Math.PI / 2, r = k % 2 ? 9 : 20;
      return `${148 + (r * Math.cos(a)) / 2},${128 + r * Math.sin(a)}`;
    }).join(" ");
    return `<rect width="256" height="86" fill="rgb(0,181,226)"/><rect y="85" width="256" height="86" fill="rgb(239,51,64)"/>
      <rect y="170" width="256" height="86" fill="rgb(80,158,47)"/><ellipse cx="124" cy="128" rx="18" ry="36" fill="#fff"/>
      <ellipse cx="131" cy="128" rx="15" ry="30" fill="rgb(239,51,64)"/><polygon points="${star}" fill="#fff"/>`;
  } },
  // a band of restaurant glazing
  band: { w: 3, h: 3, svg: (px) => {
    const g = [70, 96, 118];
    return `<rect width="256" height="256" fill="${rgb(g)}"/><rect y="${px.y(1.6)}" width="256" height="${px.y(1.4)}" fill="${rgb(shade(g, 1.2))}"/>
      <rect x="0" width="${px.x(0.08)}" height="256" fill="${rgb([200, 208, 214])}"/><rect y="0" width="256" height="${px.y(0.3)}" fill="${rgb([214, 214, 210])}"/>`;
  } },
};
async function texture(kind) {
  const { w, h, svg } = TEXTURES[kind];
  const px = { x: (m) => Math.round((m / w) * 256), y: (m) => Math.round((m / h) * 256) };
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${svg(px)}</svg>`)).png().toBuffer();
}
// untextured materials
const PLAIN = {
  white: [246, 246, 243], // Heydar Aliyev Center's shell
  pearl: [234, 238, 241], // Deniz Mall's petals
  darkglass: [58, 72, 84],
  roof: [214, 210, 202],
  mast: [236, 236, 232],
  dome: [118, 134, 128], // weathered copper
  stonedome: [206, 186, 150], // domes of Absheron limestone
  teal: [72, 146, 140], // glazed domes
  seats: [118, 128, 142],
  pitch: [86, 140, 82],
};

// ---------------------------------------------------------------------------------------------------- the forms
const KINDS = {
  flame({ part, outer, l, local, skirt }) {
    const ring = resample(chaikin(outer, 2), 72);
    const c = centroid(ring);
    // the tip leans to the corner nearest the trio's centre, so the three tips meet like one flame
    const G = local(l.group);
    const near = ring.reduce((b, p) => (len(sub(p, G)) < len(sub(b, G)) ? p : b));
    const tip = lerp(c, near, 0.6);
    const H = l.height, rings = [at(ring, -skirt)];
    for (let i = 0, n = 44; i <= n; i++) {
      const t = i / n;
      const s = t < 0.42 ? 1 - 0.1 * t : 0.958 * Math.pow(Math.max(0, 1 - ((t - 0.42) / 0.58) ** 2), 0.62);
      rings.push(ring.map((p) => { const q = add(tip, mul(sub(p, tip), s)); return [q[0], t * H, q[1]]; }));
    }
    loft(part("flame"), rings, TEXTURES.flame.w, H / l.floors);
    return H;
  },
  sail({ part, outer, l, skirt }) {
    const ring = resample(chaikin(outer, 3), 64);
    const { c, major, minor } = axes(ring);
    const H = l.height, rings = [at(ring, -skirt)];
    for (let i = 0, n = 48; i <= n; i++) {
      const t = i / n;
      // narrowing along its length faster than across, turning by 22 degrees, and closing into a crest at the top
      const crest = t > 0.88 ? Math.pow((1 - t) / 0.12, 0.7) : 1;
      const a = (1 - 0.52 * t ** 1.4) * crest, b = (1 - 0.28 * t) * Math.max(crest, 0.12);
      const turn = (22 * Math.PI) / 180 * t, cos = Math.cos(turn), sin = Math.sin(turn);
      const shift = mul(major, -0.18 * len(sub(ring[0], c)) * t * t);
      rings.push(ring.map((p) => {
        const d = sub(p, c), u = dot(d, major) * a, v = dot(d, minor) * b;
        const q = add(mul(major, u), mul(minor, v));
        const r = add(add(c, shift), [q[0] * cos - q[1] * sin, q[0] * sin + q[1] * cos]);
        return [r[0], t * H, r[1]];
      }));
    }
    loft(part("glass"), rings, TEXTURES.glass.w, H / l.floors);
    return H;
  },
  shell({ part, rings, l, skirt }) {
    const { c, major } = axes(rings[0]);
    const us = rings[0].map((p) => dot(sub(p, c), major));
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const H = l.height;
    const g = (u, m, w) => Math.exp(-(((u - m) / w) ** 2));
    // the auditorium, the museum and the library rise as three crests along the building
    const crest = (p) => {
      const u = (dot(sub(p, c), major) - u0) / (u1 - u0);
      // a soft maximum, so the crests flow into each other instead of meeting in creases
      return H * Math.pow(g(u, 0.2, 0.26) ** 4 + (0.78 * g(u, 0.52, 0.26)) ** 4 + (0.62 * g(u, 0.85, 0.22)) ** 4 + 0.3 ** 4, 1 / 4);
    };
    // it sweeps down to the ground on the plaza side (south), elsewhere it ends over glass walls
    const height = (p) => {
      const e = nearestEdge(rings, p);
      const edge = e.n[1] > 0.35 ? 0 : 0.34;
      return crest(p) * (edge + (1 - edge) * smooth(e.d / 32));
    };
    const dense = surface(part("white"), rings, 3, height, 12);
    walls(part("darkglass"), dense, -skirt, (p) => Math.max(0, height(p) - 0.2));
    return H;
  },
  stone({ part, outer, l, skirt }) {
    const ring = chaikin(outer, l.smooth ?? 1);
    walls(part("stone"), [ring], -skirt, () => l.height, TEXTURES.stone.w, TEXTURES.stone.h);
    cap(part("stone"), [ring], l.height, true, TEXTURES.stone.w);
    return l.height;
  },
  carpet({ part, rings, l, skirt }) {
    const { major } = axes(rings[0]);
    const long = (t) => Math.abs(dot(t, major)) > 0.75;
    // round in section: rising from its long sides like a roll, its ends cut as walls
    const height = (p) => {
      const d = nearestEdge(rings, p, long).d;
      const k = Math.min(d / 15, 1);
      return 5 + (l.height - 5) * Math.sqrt(1 - (1 - k) ** 2);
    };
    const dense = surface(part("carpet"), rings, 2.5, height, TEXTURES.carpet.w);
    walls(part("carpet"), dense, -skirt, height, TEXTURES.carpet.w, TEXTURES.carpet.h);
    return l.height;
  },
  lotus({ part, rings, l, skirt }) {
    // the petals of the star-shaped footprint rise along their ridges to the centre
    const height = (p) => {
      const d = nearestEdge(rings, p).d;
      return 8 + (l.height - 8) * (1 - (1 - Math.min(d / 52, 1)) ** 2);
    };
    const dense = surface(part("pearl"), rings, 3, height, 10);
    walls(part("darkglass"), dense, -skirt, (p) => height(p) - 0.2);
    return l.height;
  },
  crystal({ part, rings, l, skirt }) {
    const eaves = l.height - 6;
    walls(part("crystal"), rings, -skirt, () => eaves, TEXTURES.crystal.w, TEXTURES.crystal.h);
    surface(part("crystal"), rings, 4, (p) => eaves + 6 * smooth(nearestEdge(rings, p).d / 48), TEXTURES.crystal.w);
    return l.height;
  },
  tvtower({ part, outer, l, skirt }) {
    const c = centroid(outer);
    const r0 = Math.max(4, Math.sqrt(Math.abs(signedArea(outer)) / Math.PI));
    const conc = part("concrete");
    // the shaft, narrowing to the mast
    loft(conc, [circle(c, r0 * 1.15, -skirt), circle(c, r0 * 1.1, 0), circle(c, r0 * 0.9, 100), circle(c, r0 * 0.72, 160), circle(c, r0 * 0.62, 205)], 4, 4);
    cap(conc, [circle(c, r0 * 0.62, 205).map(([x, , z]) => [x, z])], 205);
    // a technical ring and the restaurant pod at 175 m
    loft(conc, [circle(c, r0 * 0.8, 136), circle(c, r0 + 4, 139), circle(c, r0 + 4, 145), circle(c, r0 * 0.75, 148)], 4, 4);
    const R = r0 + 9;
    loft(conc, [circle(c, r0 * 0.7, 158), circle(c, R - 1, 166)], 4, 4);
    loft(part("band"), [circle(c, R - 1, 166), circle(c, R, 169), circle(c, R, 182)], 3, 3);
    loft(conc, [circle(c, R, 182), circle(c, R - 2, 186)], 4, 4);
    cap(conc, [circle(c, R - 2, 186).map(([x, , z]) => [x, z])], 186);
    // the mast to 310 m
    loft(part("mast"), [circle(c, 1.9, 204, 12), circle(c, 1.2, 260, 12), circle(c, 0.4, l.height, 12)], 2, 6);
    return l.height;
  },
  glasstower({ part, outer, l, skirt }) {
    const ring = resample(chaikin(outer, 1), 64);
    const H = l.height, storey = H / l.floors, crown = H - 2 * storey;
    const c = centroid(ring);
    const top = ring.map((p) => add(c, mul(sub(p, c), 0.9)));
    loft(part("glass"), [at(ring, -skirt), at(ring, crown)], TEXTURES.glass.w, storey);
    cap(part("roof"), [ring], crown);
    loft(part("glass"), [at(top, crown), at(top, H)], TEXTURES.glass.w, storey);
    cap(part("roof"), [top], H);
    return H;
  },
  stalinist({ part, rings, l, local, skirt }) {
    const H = l.height, T = TEXTURES.stalin;
    walls(part("stalin"), rings, -skirt, () => H, T.w, T.h);
    cap(part("roof"), rings, H);
    // the central tower over the middle of the main block, stepping back in tiers to a spire
    const c = local(l.tower.at), t = nearestEdge(rings, c).t;
    let y = H - 1, top = H;
    for (const [to, inset] of l.tower.tiers) {
      const r = box(c, t, l.tower.w - 2 * inset, l.tower.d - 2 * inset);
      walls(part("stalin"), [r], y, () => to, T.w, T.h);
      cap(part("roof"), [r], to);
      y = to;
      top = to;
    }
    const base = box(c, t, 4, 4);
    loft(part("dome"), [at(base, top), at(base, top + 3), at(box(c, t, 0.2, 0.2), top + l.tower.spire)], 2, 2);
    return top + l.tower.spire;
  },
  classic({ part, rings, l, local, skirt }) {
    const mat = l.texture ?? "classic", T = TEXTURES[mat];
    walls(part(mat), rings, -skirt, () => l.height, T.w, T.h);
    cap(part("roof"), rings, l.height);
    let top = l.height;
    for (const tw of l.towers ?? []) {
      const c = tw.corner ? corner(rings[0], tw.corner, tw.r * 1.4) : local(tw.at);
      const body = tw.square ? box(c, nearestEdge(rings, c).t, 2 * tw.r, 2 * tw.r) : disc(c, tw.r);
      walls(part(mat), [body], l.height - 1, () => tw.top, T.w, T.h);
      cap(part("roof"), [body], tw.top);
      if (tw.spire) {
        // a pointed slate spire
        loft(part("dome"), [at(body, tw.top), at(body.map((p) => lerp(p, c, 0.97)), tw.top + tw.spire)], 2, 2);
        top = Math.max(top, tw.top + tw.spire);
      } else top = Math.max(top, tw.dome ? dome(part("dome"), c, tw.r * (tw.square ? 0.95 : 0.92), tw.top) : tw.top);
    }
    return top;
  },
  colonnade({ part, rings, l, skirt }) {
    walls(part("colonnade"), rings, -skirt, () => l.height, TEXTURES.colonnade.w, TEXTURES.colonnade.h);
    cap(part("roof"), rings, l.height);
    return l.height;
  },
  mosque({ part, rings, l, local, skirt }) {
    const H = l.height, T = TEXTURES.stone;
    walls(part("stone"), rings, -skirt, () => H, T.w, T.h);
    cap(part("stone"), rings, H, true, T.w);
    // the footprint's box along its main axes
    const { c: c0, major, minor } = axes(rings[0]);
    const us = rings[0].map((p) => dot(sub(p, c0), major)), vs = rings[0].map((p) => dot(sub(p, c0), minor));
    const [ua, ub, va, vb] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const c = l.domeAt ? local(l.domeAt) : add(c0, add(mul(major, (ua + ub) / 2), mul(minor, (va + vb) / 2)));
    const a = (ub - ua) / 2, b = (vb - va) / 2;
    // the dome on a low drum over the middle
    const r = Math.min(l.dome ?? Math.min(0.72 * Math.min(a, b), 11), Math.min(a, b) * 0.95);
    const drum = H + r * 0.3;
    walls(part("stone"), [disc(c, r * 1.04)], H - 0.5, () => drum, T.w, T.h);
    let top = dome(part(l.domeColor ?? "dome"), c, r, drum);
    // minarets on the side away from the qibla (Mecca lies at a bearing of about 205 degrees from Baku)
    const qibla = [Math.sin((205 * Math.PI) / 180), -Math.cos((205 * Math.PI) / 180)];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([i, j]) => add(c, add(mul(major, i * (a - 2.2)), mul(minor, j * (b - 2.2)))))
      .sort((p, q) => dot(sub(p, c), qibla) - dot(sub(q, c), qibla))
      .slice(0, l.minarets ?? 0);
    // where OpenStreetMap maps the minarets, they stand there
    for (const m of l.minaretsAt ? l.minaretsAt.map(local) : corners) {
      const M = l.minaretHeight, sh = part("stone");
      loft(sh, [circle(m, 1.7, -skirt, 12), circle(m, 1.6, M * 0.72, 12)], T.w, T.h);
      // the muezzin's balcony, the upper shaft and a pointed cap
      loft(sh, [circle(m, 1.6, M * 0.72, 12), circle(m, 2.5, M * 0.74, 12), circle(m, 2.5, M * 0.77, 12), circle(m, 1.25, M * 0.79, 12), circle(m, 1.2, M * 0.9, 12)], T.w, T.h);
      loft(part(l.domeColor ?? "dome"), [circle(m, 1.5, M * 0.9, 12), circle(m, 0.05, M, 12)], 1, 1);
      top = Math.max(top, M);
    }
    return top;
  },
  hamam({ part, rings, l, skirt }) {
    const H = l.height, T = TEXTURES.stone;
    walls(part("stone"), rings, -skirt, () => H, T.w, T.h);
    cap(part("stone"), rings, H, true, T.w);
    // small stone domes over the halls, in a two-by-two grid
    const { c, major, minor } = axes(rings[0]);
    const us = rings[0].map((p) => dot(sub(p, c), major)), vs = rings[0].map((p) => dot(sub(p, c), minor));
    const a = (Math.max(...us) - Math.min(...us)) / 4, b = (Math.max(...vs) - Math.min(...vs)) / 4;
    const mid = add(c, add(mul(major, (Math.max(...us) + Math.min(...us)) / 2), mul(minor, (Math.max(...vs) + Math.min(...vs)) / 2)));
    const r = Math.min(a, b, 3.5) * 0.85;
    let top = H;
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = add(mid, add(mul(major, i * a), mul(minor, j * b)));
      if (inside(rings, p[0], p[1])) top = Math.max(top, dome(part("stonedome"), p, r, H));
    }
    return top;
  },
  beauxarts({ part, rings, l, skirt }) {
    const T = TEXTURES.classic, storey = l.height / l.floors, cornice = l.height - storey;
    const top = inset(rings[0], 1.8);
    walls(part("classic"), rings, -skirt, () => (top ? cornice : l.height), T.w, T.h);
    let peak = l.height;
    if (top) {
      slope(part("mansard"), rings[0], top, cornice, l.height, TEXTURES.mansard.w, TEXTURES.mansard.h);
      cap(part("roof"), [top], l.height);
    } else cap(part("roof"), rings, l.height);
    // cupolas on the corners towards the sea
    for (const dir of l.cupolas ?? []) {
      const c = corner(rings[0], dir, 5);
      const body = disc(c, 3.6, 20);
      walls(part("classic"), [body], cornice - 1, () => l.height + 2, T.w, T.h);
      peak = Math.max(peak, dome(part("dome"), c, 3.4, l.height + 2));
    }
    return peak;
  },
  stonetower({ part, rings, l, skirt }) {
    const T = TEXTURES.stalin, storey = l.height / l.floors;
    // the top storeys step back twice into a crown
    const t1 = inset(rings[0], 2.5), t2 = t1 && inset(rings[0], 5.5);
    const y1 = l.height - (t1 ? 4 * storey : 0), y2 = l.height - (t2 ? 2 * storey : 0);
    walls(part("stalin"), rings, -skirt, () => y1, T.w, T.h);
    cap(part("roof"), rings, y1);
    if (t1) { walls(part("stalin"), [t1], y1 - 0.5, () => y2, T.w, T.h); cap(part("roof"), [t1], y2); }
    if (t2) { walls(part("stalin"), [t2], y2 - 0.5, () => l.height, T.w, T.h); cap(part("roof"), [t2], l.height); }
    return l.height;
  },
  stadium({ part, rings, l, skirt }) {
    const ring = resample(chaikin(rings[0], 2), 96), H = l.height;
    walls(part("crystal"), [ring], -skirt, () => H, TEXTURES.crystal.w, TEXTURES.crystal.h);
    const roofIn = inset(ring, 42), field = roofIn && inset(ring, 62);
    if (!roofIn || !field) { cap(part("white"), [ring], H); return H; }
    // a white roof sloping in over the stands, the stands down to the pitch
    band(part("white"), ring, H, roofIn, H - 6);
    band(part("seats"), roofIn, H - 16, field, 1.5);
    cap(part("pitch"), [field], 1.2);
    return H;
  },
  flagpole({ part, l }) {
    const H = l.height, [w, h] = l.flag;
    loft(part("mast"), [circle([0, 0], 1.6, -2, 16), circle([0, 0], 0.55, H, 16)], 2, 6);
    // the flag flying east from the top of the pole
    const p = part("flag"), y0 = H - h - 1;
    const ids = [[0.6, y0, 0, 0, 1], [0.6 + w, y0, 0, 1, 1], [0.6 + w, y0 + h, 0, 1, 0], [0.6, y0 + h, 0, 0, 0]]
      .map(([x, y, z, u, v]) => p.vertex([x, y, z], [0, 0, 1], [u, v]));
    p.tri(ids[0], ids[1], ids[2], [0, 0, 1]);
    p.tri(ids[0], ids[2], ids[3], [0, 0, 1]);
    return H;
  },
  aquatics({ part, rings, l, skirt }) {
    const { c, major } = axes(rings[0]);
    const us = rings[0].map((p) => dot(sub(p, c), major));
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const eaves = l.eaves;
    // round in section and rising along the building, like a wave
    const height = (p) => {
      const u = (dot(sub(p, c), major) - u0) / (u1 - u0);
      const k = Math.min(nearestEdge(rings, p).d / 34, 1);
      return eaves + (l.height - eaves) * Math.sqrt(1 - (1 - k) ** 2) * (0.62 + 0.38 * u);
    };
    const dense = surface(part("white"), rings, 3, height, 12);
    walls(part("glass"), dense, -skirt, (p) => height(p) - 0.2, TEXTURES.glass.w, TEXTURES.glass.h);
    return l.height;
  },
};

// ---------------------------------------------------------------------------------------------------- build
const landmarks = JSON.parse(readFileSync(path.join(root, "data/landmarks.json"), "utf8"));
const only = new Set(process.argv.slice(2));
const wanted = new Set(landmarks.flatMap((l) => l.replaces));
const footprints = new Map();
for (const file of readdirSync(path.join(root, "data/city")).filter((f) => f.endsWith(".geojson.gz"))) {
  const fc = JSON.parse(gunzipSync(readFileSync(path.join(root, "data/city", file))).toString("utf8"));
  for (const f of fc.features) if (wanted.has(f.properties.id)) footprints.set(f.properties.id, f);
}
// landmarks outside the city layer
const extra = new Set();
try {
  for (const f of JSON.parse(readFileSync(path.join(root, "data/landmarks.extra.geojson"), "utf8")).features)
    if (wanted.has(f.properties.id)) { footprints.set(f.properties.id, f); extra.add(f.properties.id); }
} catch {
  // no extra footprints yet
}
/** A small square around a point, for a landmark with no footprint of its own. */
const pointFootprint = ([lng, lat], m) => {
  const dx = m / (111320 * Math.cos((lat * Math.PI) / 180)), dy = m / 110540;
  return { geometry: { type: "Polygon", coordinates: [[[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]] }, properties: { g: 0, l: 0 } };
};
await MeshoptEncoder.ready;
const generatedFile = path.join(root, "data/landmarks.generated.json");
const previous = (() => { try { return JSON.parse(readFileSync(generatedFile, "utf8")); } catch { return []; } })();
const generated = [];
for (const l of landmarks) {
  if (only.size && !only.has(l.id)) {
    const keep = previous.find((p) => p.id === l.id);
    if (keep) generated.push(keep);
    continue;
  }
  const feats = l.replaces.length
    ? l.replaces.map((id) => footprints.get(id) ?? (() => { throw new Error(`${l.id}: footprint ${id} not found`); })())
    : [pointFootprint(l.at, 3)];
  const main = feats[0];
  const polys = main.geometry.type === "Polygon" ? [main.geometry.coordinates] : main.geometry.coordinates;
  // the model's origin: the centre of its footprint
  const ll = open(polys[0][0]);
  const lng0 = ll.reduce((s, p) => s + p[0], 0) / ll.length, lat0 = ll.reduce((s, p) => s + p[1], 0) / ll.length;
  const k = EARTH * Math.cos((lat0 * Math.PI) / 180);
  const local = ([lng, lat]) => [(mercX(lng) - mercX(lng0)) * k, (mercY(lat) - mercY(lat0)) * k];
  const unlocal = ([x, z]) => {
    const lng = lng0 + (x / k) * 360;
    const y = mercY(lat0) + z / k;
    return [lng, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI];
  };
  // rings in metres, outer ring counter-clockwise in this frame, holes after it
  const rings = polys[0].map((r, i) => {
    const m = open(r).map(local);
    return (signedArea(m) > 0) === (i === 0) ? m : m.reverse();
  });
  const [cx, cz] = centroid(rings[0]);
  const origin = unlocal([cx, cz]);
  const shift = (r) => r.map(([x, z]) => [x - cx, z - cz]);
  const centred = rings.map(shift);
  const localC = (p) => sub(local(p), [cx, cz]);
  const skirt = (main.properties.g - main.properties.l) * EX + 2;
  const parts = {};
  const part = (mat) => (parts[mat] ??= new Part());
  const height = KINDS[l.kind]({ part, outer: centred[0], rings: centred, l, local: localC, skirt });

  const doc = new Document();
  doc.createBuffer();
  const buffer = doc.getRoot().listBuffers()[0];
  const lin = (c) => c.map((v) => (v / 255) ** 2.2);
  const mesh = doc.createMesh(l.id);
  for (const [mat, p] of Object.entries(parts)) {
    if (!p.idx.length) continue;
    let material;
    if (TEXTURES[mat]) {
      const tex = doc.createTexture(mat).setImage(await texture(mat)).setMimeType("image/png");
      material = doc.createMaterial(mat).setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([GLOW, GLOW, GLOW]);
    } else {
      const c = lin(PLAIN[mat]);
      material = doc.createMaterial(mat).setBaseColorFactor([...c, 1]).setEmissiveFactor(c.map((v) => v * GLOW));
    }
    material.setRoughnessFactor(["flame", "glass", "band", "darkglass", "dome"].includes(mat) ? 0.3 : 0.8).setMetallicFactor(0).setDoubleSided(true);
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(p.pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(p.nor)).setBuffer(buffer))
      .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(p.uv)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(p.idx)).setBuffer(buffer))
      .setMaterial(material);
    mesh.addPrimitive(prim);
  }
  doc.createScene(l.id).addChild(doc.createNode(l.id).setMesh(mesh));
  await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const glb = await new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ "meshopt.encoder": MeshoptEncoder }).writeBinary(doc);
  writeFileSync(path.join(root, "public/models", `landmark-${l.id}.glb`), glb);

  const all = feats.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates));
  const pts = all.flat(2);
  const pad = 0.002;
  generated.push({
    id: l.id,
    origin: origin.map((v) => Math.round(v * 1e7) / 1e7),
    bounds: [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad]
      .map((v) => Math.round(v * 1e6) / 1e6),
    footprint: { type: "MultiPolygon", coordinates: all },
    height: Math.round(height * 10) / 10,
    // outside the city layer the map's own blocks must be hidden under it
    ...(l.replaces.some((id) => extra.has(id)) ? { hideBase: true } : {}),
  });
  const tris = Object.values(parts).reduce((n, p) => n + p.idx.length / 3, 0);
  console.log(`public/models/landmark-${l.id}.glb: ${(glb.length / 1024).toFixed(0)} KB, ${tris} triangles, ${Math.round(height)} m`);
}
writeFileSync(generatedFile, JSON.stringify(generated));
