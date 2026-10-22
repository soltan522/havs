import SEABREEZE from "@/data/districts/seabreeze.json";
import WHITECITY from "@/data/districts/whitecity.json";

/**
 * A whole district drawn on the projects map as one 3D model (public/models/district-<id>.glb, built from
 * data/districts/<id>.json by scripts/build-district-models.mjs). Its `zone` is where the model replaces the map's
 * plain blocks; `origin` is the model's origin and `bounds` the area it covers, [west, south, east, north].
 */
export type DistrictModel = {
  id: string;
  src: string;
  origin: [number, number];
  bounds: [number, number, number, number];
  zone: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

export const DISTRICTS: DistrictModel[] = [SEABREEZE, WHITECITY].map((d) => ({
  id: d.id,
  src: `/models/district-${d.id}.glb`,
  origin: [d.origin[0], d.origin[1]],
  bounds: [d.bounds[0], d.bounds[1], d.bounds[2], d.bounds[3]],
  zone: d.zone as DistrictModel["zone"],
}));
