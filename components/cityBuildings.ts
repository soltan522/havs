import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from "maplibre-gl";
import { VectorTile, type VectorTileFeature } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import * as THREE from "three";

/**
 * Baku's buildings in 3D from the static tiles in public/tiles/buildings (scripts/city/build-tiles.mjs): each tile's
 * buildings are extruded in the browser from their footprints to their floor count, with a facade of window rows for
 * their type, standing on their own ground height. Tiles load as the map shows them and are dropped when far away.
 */

/** Properties of a building in the tiles: id, floors, estimated (1), facade type, ground and lowest ground (raw metres), name, complex. */
export type CityBuilding = { id: string; f: number; e?: number; t: number; g: number; l: number; n?: string; c?: string };

type Facade = { floor: number; bay: number; wall: string; glass: string; frame: string; window: [number, number, number, number] };

// facade types: 0 house, 1 old stone (historic centre), 2 Soviet slab, 3 tower, 4 mid-rise; window as [x0, y0, x1, y1] in metres
export const FACADES: Facade[] = [
  { floor: 3.0, bay: 3.2, wall: "#efe6d6", glass: "#7d8f96", frame: "#e2d8c6", window: [1.0, 0.95, 2.2, 2.25] },
  { floor: 3.8, bay: 2.8, wall: "#e6d6b6", glass: "#6f7f86", frame: "#d4c19c", window: [0.75, 1.0, 2.05, 3.2] },
  { floor: 2.8, bay: 3.0, wall: "#e2dfd8", glass: "#7a8a92", frame: "#cfcbc2", window: [0.8, 0.85, 2.2, 2.25] },
  { floor: 3.2, bay: 3.0, wall: "#ece9e2", glass: "#8ea4ae", frame: "#d9d5cc", window: [0.25, 0.55, 2.75, 3.05] },
  { floor: 3.1, bay: 3.0, wall: "#f1ece2", glass: "#7f9199", frame: "#ddd5c6", window: [0.7, 0.9, 2.3, 2.7] },
];
const PARAPET = 0.9;
const SKIRT = 1.5;
const DRAW_ZOOM = 13.5;
const MAX_TILES = 36;
const EARTH = 40075016.686;

/** Height of a building above its ground, as the pick layer extrudes it too. */
export const buildingHeight = (p: { f: number; t: number }) => p.f * FACADES[p.t]?.floor + (p.f >= 2 ? PARAPET : 0.3);

function facadeTexture(fc: Facade) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const x = (m: number) => (m / fc.bay) * S;
  const y = (m: number) => (m / fc.floor) * S; // rows run from floor level (top) up, as the walls' v does
  g.fillStyle = fc.wall;
  g.fillRect(0, 0, S, S);
  const [x0, y0, x1, y1] = fc.window;
  g.fillStyle = fc.frame;
  g.fillRect(x(x0) - 3, y(y0) - 3, x(x1) - x(x0) + 6, y(y1) - y(y0) + 6);
  g.fillStyle = fc.glass;
  g.fillRect(x(x0), y(y0), x(x1) - x(x0), y(y1) - y(y0));
  g.fillStyle = fc.frame;
  g.fillRect((x(x0) + x(x1)) / 2 - 1.5, y(y0), 3, y(y1) - y(y0));
  g.fillRect(0, 0, S, 3); // floor line
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

type Tile = { key: string; x: number; y: number; group: THREE.Group | null; buildings: Map<string, { props: CityBuilding; rings: [number, number][][] }>; used: number };

export function cityBuildingsLayer(maplibregl: typeof import("maplibre-gl"), map: MlMap, opts: { base: string; exaggeration: number; skip?: string[] }): CustomLayerInterface & {
  highlight(id: string | null): void;
} {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x8a7f70, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.0);
  sun.position.set(-0.4, 1, 0.7);
  scene.add(sun);
  let renderer: THREE.WebGLRenderer | null = null;
  let index: { zoom: number; extent: number; tiles: Set<string> } | null = null;
  const tiles = new Map<string, Tile>();
  const glow = 0.3;
  const walls = FACADES.map((fc) => {
    const tex = facadeTexture(fc);
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(glow, glow, glow), roughness: 0.88, side: THREE.DoubleSide, vertexColors: true });
  });
  const roof = new THREE.MeshStandardMaterial({ color: "#d9d5cd", emissive: new THREE.Color("#d9d5cd").multiplyScalar(glow), roughness: 0.95 });
  const accent = new THREE.MeshBasicMaterial({ color: "#c49a6c", transparent: true, opacity: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  let highlighted: { id: string; mesh: THREE.Mesh; tile: Tile } | null = null;
  // buildings drawn by their own detailed models
  const skip = new Set(opts.skip ?? []);

  /** Tile pixels to metres around the tile's centre (+x east, +z south), as the layer places each tile. */
  const toLocal = (tx: number, ty: number, extent: number) => {
    const z = index!.zoom;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 0.5)) / 2 ** z))) * 180) / Math.PI;
    const k = (EARTH * Math.cos((lat * Math.PI) / 180)) / 2 ** z / extent;
    return (px: number, py: number): [number, number] => [(px - extent / 2) * k, (py - extent / 2) * k];
  };

  /** Walls with window rows and a roof slab for some buildings, as one geometry per facade type. */
  function extrude(list: { props: CityBuilding; rings: [number, number][][] }[], local: (x: number, y: number) => [number, number], ex: number) {
    const parts = FACADES.map(() => ({ pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[] }));
    const top = { pos: [] as number[] };
    for (const { props: p, rings } of list) {
      const fc = FACADES[p.t] ?? FACADES[4];
      const ground = p.g * ex;
      const height = buildingHeight(p);
      const y1 = ground + height;
      const y0 = Math.min(p.l * ex, ground) - SKIRT;
      const shade = 0.93 + hash(p.id) * 0.07;
      const w = parts[p.t] ?? parts[4];
      const pts = rings.map((r) => r.map(([x, y]) => local(x, y)));
      // vector tile winding: outer rings have a positive area in tile pixels, holes a negative one
      const outers: number[] = [];
      rings.forEach((r, i) => {
        let a = 0;
        for (let k = 0; k < r.length - 1; k++) a += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
        if (a > 0) outers.push(i);
      });
      for (const ring of pts) {
        let run = 0;
        for (let k = 0; k < ring.length - 1; k++) {
          const a = ring[k], b = ring[k + 1];
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const len = Math.hypot(dx, dz);
          if (len < 0.05) continue;
          // with vector tile winding the building is on the left of travel along outer rings and holes alike
          // (+x east, +z south), so the outward normal is to the right; triangles face it
          const n = [dz / len, 0, -dx / len];
          const u0 = run / fc.bay, u1 = (run + len) / fc.bay;
          run += len;
          const v = (yy: number) => (yy - ground) / fc.floor;
          const quad = [[a, y0, u0], [b, y1, u1], [b, y0, u1], [a, y0, u0], [a, y1, u0], [b, y1, u1]] as const;
          for (const [pt, yy, u] of quad) {
            w.pos.push(pt[0], yy, pt[1]);
            w.nor.push(n[0], n[1], n[2]);
            w.uv.push(u, v(yy));
            w.col.push(shade, shade, shade);
          }
        }
      }
      // roof: each outer ring with the holes that follow it
      const yr = p.f >= 2 ? y1 - PARAPET : y1;
      outers.forEach((oi, j) => {
        const end = outers[j + 1] ?? pts.length;
        const contour = pts[oi].slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z));
        const holes = pts.slice(oi + 1, end).map((h) => h.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)));
        const flat = [...contour, ...holes.flat()];
        for (const [i, j2, k] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
          const A = flat[i], B = flat[j2], C = flat[k];
          // facing up (+y) where +z is south
          const up = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y) > 0;
          for (const v of up ? [A, B, C] : [A, C, B]) top.pos.push(v.x, yr, v.y);
        }
      });
    }
    const group = new THREE.Group();
    parts.forEach((pt, i) => {
      if (!pt.pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pt.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(pt.nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(pt.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(pt.col, 3));
      group.add(new THREE.Mesh(g, walls[i]));
    });
    if (top.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(top.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(top.pos.length / 3).fill([0, 1, 0]).flat(), 3));
      group.add(new THREE.Mesh(g, roof));
    }
    return group;
  }

  async function loadTile(key: string) {
    const [x, y] = key.split("/").map(Number);
    const tile: Tile = { key, x, y, group: null, buildings: new Map(), used: performance.now() };
    tiles.set(key, tile);
    try {
      const res = await fetch(`${opts.base}/${index!.zoom}/${key}.pbf`);
      if (!res.ok) return;
      const layer = new VectorTile(new Protobuf(await res.arrayBuffer())).layers.buildings;
      if (!layer) return;
      const list = [];
      for (let i = 0; i < layer.length; i++) {
        const f: VectorTileFeature = layer.feature(i);
        const rings = f.loadGeometry().map((r) => r.map((pt) => [pt.x, pt.y] as [number, number]));
        const item = { props: f.properties as unknown as CityBuilding, rings };
        if (skip.has(item.props.id)) continue;
        tile.buildings.set(item.props.id, item);
        list.push(item);
      }
      tile.group = extrude(list, toLocal(x, y, layer.extent), opts.exaggeration);
      map.triggerRepaint();
    } catch {
      // a tile that fails stays empty; the map's own blocks are hidden there either way
    }
  }

  function update() {
    if (!index || map.getZoom() < DRAW_ZOOM - 0.5) return;
    const z = index.zoom;
    const c = map.getCenter();
    const cx = ((c.lng + 180) / 360) * 2 ** z;
    const cy = ((1 - Math.log(Math.tan(Math.PI / 4 + (c.lat * Math.PI) / 360)) / Math.PI) / 2) * 2 ** z;
    const b = map.getBounds();
    const x0 = Math.floor(((b.getWest() + 180) / 360) * 2 ** z), x1 = Math.floor(((b.getEast() + 180) / 360) * 2 ** z);
    const ty = (lat: number) => Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 2 ** z);
    const y0 = ty(b.getNorth()), y1 = ty(b.getSouth());
    const wanted: { key: string; d: number }[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x}/${y}`;
      if (index.tiles.has(key)) wanted.push({ key, d: Math.hypot(x + 0.5 - cx, y + 0.5 - cy) });
    }
    // nearest first, and only a few rings of tiles around the centre: the far horizon of a tilted view stays light
    wanted.sort((a, b2) => a.d - b2.d);
    const now = performance.now();
    for (const { key } of wanted.slice(0, 16)) {
      const t = tiles.get(key);
      if (t) t.used = now;
      else void loadTile(key);
    }
    if (tiles.size > MAX_TILES) {
      for (const t of [...tiles.values()].sort((a, b2) => a.used - b2.used).slice(0, tiles.size - MAX_TILES)) {
        t.group?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        tiles.delete(t.key);
        if (highlighted?.tile === t) highlighted = null;
      }
    }
  }

  return {
    id: "city-buildings",
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      fetch(`${opts.base}/index.json`)
        .then((r) => r.json())
        .then((j) => {
          index = { zoom: j.zoom, extent: j.extent, tiles: new Set(j.tiles) };
          update();
        })
        .catch(() => {});
      map.on("moveend", update);
    },
    onRemove() {
      map.off("moveend", update);
    },
    render(_gl, args: CustomRenderMethodInput) {
      if (!renderer || !index || map.getZoom() < DRAW_ZOOM) return;
      const view = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
      const z = index.zoom;
      for (const t of tiles.values()) {
        if (!t.group) continue;
        // tile centre at sea level: the buildings carry their own (absolute) ground heights
        const lng = ((t.x + 0.5) / 2 ** z) * 360 - 180;
        const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + 0.5)) / 2 ** z))) * 180) / Math.PI;
        const merc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
        const s = merc.meterInMercatorCoordinateUnits();
        const local = new THREE.Matrix4()
          .makeTranslation(merc.x, merc.y, merc.z)
          .scale(new THREE.Vector3(s, -s, s))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix = view.clone().multiply(local);
        scene.add(t.group);
        if (highlighted?.tile === t) scene.add(highlighted.mesh);
        renderer.resetState();
        renderer.render(scene, camera);
        scene.remove(t.group);
        if (highlighted?.tile === t) scene.remove(highlighted.mesh);
      }
    },
    highlight(id) {
      if (highlighted) {
        highlighted.mesh.geometry.dispose();
        highlighted = null;
      }
      if (id) {
        for (const t of tiles.values()) {
          const item = t.buildings.get(id);
          if (!item || !index) continue;
          const g = extrude([item], toLocal(t.x, t.y, index.extent), opts.exaggeration);
          const merged = g.children.map((m) => (m as THREE.Mesh).geometry);
          // one tinted shell over the walls and roof of the chosen building
          const mesh = new THREE.Mesh(merged[0], accent);
          for (const extra of merged.slice(1)) mesh.add(new THREE.Mesh(extra, accent));
          highlighted = { id, mesh, tile: t };
          break;
        }
      }
      map.triggerRepaint();
    },
  };
}
