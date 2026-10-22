import SEABREEZE from "@/data/districts/seabreeze.json";
import WHITECITY from "@/data/districts/whitecity.json";
import type { Locale } from "@/lib/i18n";

/**
 * A whole district drawn on the projects map as one 3D model (public/models/district-<id>.glb, built from
 * data/districts/<id>.json by scripts/build-district-models.mjs), with its buildings' footprints for picking them
 * (district-<id>.geojson). Its `zone` is where the model replaces the map's plain blocks; `origin` is the model's
 * origin and `bounds` the area it covers, [west, south, east, north].
 */
export type DistrictModel = {
  id: string;
  name: string;
  src: string;
  footprints: string;
  origin: [number, number];
  bounds: [number, number, number, number];
  zone: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

const NAMES: Record<string, Record<Locale, string>> = {
  seabreeze: { az: "Sea Breeze", en: "Sea Breeze", ru: "Sea Breeze" },
  whitecity: { az: "Ağ Şəhər", en: "White City", ru: "Белый город" },
};

export function districtsIn(lang: Locale): DistrictModel[] {
  return [SEABREEZE, WHITECITY].map((d) => ({
    id: d.id,
    name: NAMES[d.id][lang],
    src: `/models/district-${d.id}.glb`,
    footprints: `/models/district-${d.id}.geojson`,
    origin: [d.origin[0], d.origin[1]],
    bounds: [d.bounds[0], d.bounds[1], d.bounds[2], d.bounds[3]],
    zone: d.zone as DistrictModel["zone"],
  }));
}
