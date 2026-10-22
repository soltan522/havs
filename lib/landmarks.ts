import LANDMARKS from "@/data/landmarks.json";
import GENERATED from "@/data/landmarks.generated.json";
import type { Locale } from "@/lib/i18n";

/**
 * A landmark drawn on the projects map as its own detailed 3D model (public/models/landmark-<id>.glb, built from
 * data/landmarks.json by scripts/build-landmarks.mjs) in place of the city blocks it `replaces`. `origin` is the model's
 * origin, `bounds` the area it covers, [west, south, east, north], `footprint` its outline for picking it.
 */
export type Landmark = {
  id: string;
  name: string;
  about: string;
  src: string;
  origin: [number, number];
  bounds: [number, number, number, number];
  footprint: { type: "MultiPolygon"; coordinates: number[][][][] };
  height: number;
  floors?: number;
  homes: boolean;
  replaces: string[];
  /** Outside the city layer: the map's own blocks under it are hidden. */
  hideBase: boolean;
};

export function landmarksIn(lang: Locale): Landmark[] {
  return LANDMARKS.flatMap((l) => {
    const g = GENERATED.find((x) => x.id === l.id);
    if (!g) return [];
    return [{
      id: l.id,
      name: l.name[lang],
      about: l.about[lang],
      src: `/models/landmark-${l.id}.glb`,
      origin: [g.origin[0], g.origin[1]],
      bounds: [g.bounds[0], g.bounds[1], g.bounds[2], g.bounds[3]],
      footprint: g.footprint as Landmark["footprint"],
      height: g.height,
      ...("floors" in l ? { floors: l.floors } : {}),
      homes: "homes" in l && l.homes === true,
      replaces: l.replaces,
      hideBase: "hideBase" in g && g.hideBase === true,
    }];
  });
}
