import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** A detailed building model (glTF) standing on the map in place of its plain OpenStreetMap block. */
export type BuildingModel = {
  id: string;
  src: string;
  /** Model origin: the centre of the building's footprint at ground level. */
  lngLat: [number, number];
  /** Compass bearing the model's front (+Z) faces, in degrees. */
  bearing: number;
};

type MapLibre = typeof import("maplibre-gl");

/** Hides the OpenStreetMap buildings under each model: any building containing a point of its long axis. */
export function hideBlocksUnder(map: MlMap, layerId: string, models: BuildingModel[]) {
  const points = models.flatMap(({ lngLat: [lng, lat], bearing }) => {
    const b = (bearing * Math.PI) / 180;
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    return [-7, 0, 7].map((k) => [lng + (k * Math.sin(b)) / kx, lat + (k * Math.cos(b)) / 110540]);
  });
  const current = map.getFilter(layerId);
  const away = [">", ["distance", { type: "MultiPoint", coordinates: points }], 1];
  map.setFilter(layerId, (current ? ["all", current, away] : away) as never);
}

/** One custom three.js layer drawing every model, lit like the map's architectural-model style. */
export function buildingModelsLayer(maplibregl: MapLibre, map: MlMap, models: BuildingModel[]): CustomLayerInterface {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x8a7f70, 1.6));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  sun.position.set(-0.4, 1, 0.7);
  scene.add(sun);
  const placed = models.map((m) => ({ ...m, object: null as THREE.Object3D | null }));
  let renderer: THREE.WebGLRenderer | null = null;

  return {
    id: "building-models",
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      const loader = new GLTFLoader();
      for (const p of placed) {
        loader.load(p.src, (gltf) => {
          p.object = gltf.scene;
          map.triggerRepaint();
        });
      }
    },
    render(_gl, args: CustomRenderMethodInput) {
      if (!renderer) return;
      const view = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
      for (const p of placed) {
        if (!p.object) continue;
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
