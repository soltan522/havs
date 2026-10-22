import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** A detailed 3D model (glTF) standing on the map in place of the plain OpenStreetMap blocks under it. */
export type BuildingModel = {
  id: string;
  src: string;
  /** Model origin: a point on the ground, at the terrain height there. */
  lngLat: [number, number];
  /** Compass bearing the model's front (+Z) faces, in degrees. */
  bearing: number;
  /** Area the model covers, [west, south, east, north]: it is only loaded once the map shows it. */
  bounds?: [number, number, number, number];
};

type MapLibre = typeof import("maplibre-gl");
type Geometry = { type: "MultiPoint" | "Polygon" | "MultiPolygon"; coordinates: unknown };

// like the map's own 3D buildings, models show from street level zooms; they load a little before that
const DRAW_ZOOM = 13;
const LOAD_ZOOM = 12;

/** The long axis of a single building's model: any map building containing one of these points is the one it replaces. */
export function axisOf({ lngLat: [lng, lat], bearing }: BuildingModel): Geometry {
  const b = (bearing * Math.PI) / 180;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  return { type: "MultiPoint", coordinates: [-7, 0, 7].map((k) => [lng + (k * Math.sin(b)) / kx, lat + (k * Math.cos(b)) / 110540]) };
}

/** Hides the OpenStreetMap buildings within `metres` of any of the given areas (0: touching or inside them). */
export function hideBlocks(map: MlMap, layerId: string, areas: { geometry: Geometry; metres: number }[]) {
  const current = map.getFilter(layerId);
  const away = areas.map(({ geometry, metres }) => [">", ["distance", geometry], metres]);
  map.setFilter(layerId, ["all", ...(current ? [current] : []), ...away] as never);
}

/** One custom three.js layer drawing every model, lit like the map's architectural-model style. */
export function buildingModelsLayer(maplibregl: MapLibre, map: MlMap, models: BuildingModel[]): CustomLayerInterface {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x8a7f70, 1.6));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  sun.position.set(-0.4, 1, 0.7);
  scene.add(sun);
  const placed = models.map((m) => ({ ...m, object: null as THREE.Object3D | null, requested: false }));
  let renderer: THREE.WebGLRenderer | null = null;
  const loader = new GLTFLoader();

  const inView = (p: (typeof placed)[number], zoom: number) => {
    if (map.getZoom() < zoom) return false;
    if (!p.bounds) return true;
    const v = map.getBounds();
    const [w, s, e, n] = p.bounds;
    return w < v.getEast() && e > v.getWest() && s < v.getNorth() && n > v.getSouth();
  };
  const loadInView = () => {
    for (const p of placed) {
      if (p.requested || !inView(p, LOAD_ZOOM)) continue;
      p.requested = true;
      loader.load(p.src, (gltf) => {
        p.object = gltf.scene;
        map.triggerRepaint();
      });
    }
  };

  return {
    id: "building-models",
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      loadInView();
      map.on("moveend", loadInView);
    },
    onRemove() {
      map.off("moveend", loadInView);
    },
    render(_gl, args: CustomRenderMethodInput) {
      if (!renderer) return;
      const view = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
      for (const p of placed) {
        if (!p.object || !inView(p, DRAW_ZOOM)) continue;
        // ground level here: the terrain is raised, so the model must stand on it too
        const altitude = map.queryTerrainElevation(p.lngLat) ?? 0;
        const merc = maplibregl.MercatorCoordinate.fromLngLat(p.lngLat, altitude);
        const s = merc.meterInMercatorCoordinateUnits();
        // three.js is Y-up with the front on +Z; the map is Z-up with Y pointing south
        const local = new THREE.Matrix4()
          .makeTranslation(merc.x, merc.y, merc.z)
          .scale(new THREE.Vector3(s, -s, s))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
          .multiply(new THREE.Matrix4().makeRotationY(((180 - p.bearing) * Math.PI) / 180));
        camera.projectionMatrix = view.clone().multiply(local);
        scene.add(p.object);
        renderer.resetState();
        renderer.render(scene, camera);
        scene.remove(p.object);
      }
    },
  };
}

/** True when a click lands on (or right next to) a model. */
export function modelAt(models: BuildingModel[], lngLat: { lng: number; lat: number }, metres = 14) {
  return models.find(({ lngLat: [lng, lat] }) => {
    const dx = (lngLat.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
    const dy = (lngLat.lat - lat) * 110540;
    return Math.hypot(dx, dy) < metres;
  });
}
