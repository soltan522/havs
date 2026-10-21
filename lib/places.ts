import PLACES_JSON from "@/data/places.json";

/**
 * Map position of the place each catalogue entry is named after: data/places.json maps the slug without its
 * number to [longitude, latitude] — the centre of the town, village or district (Overture Maps divisions), not a
 * plot, since the projects are concepts, not built houses — or to null for names that are not places and for the
 * owner's surveyed buildings, which stay off the map. A plan's own "location" in data/plans.json takes precedence.
 */
export const PLACES: Record<string, number[] | null> = PLACES_JSON;

/** Longitude/latitude of a plan on the projects map, if it has one. */
export function placeOf(slug: string, location?: number[]): [number, number] | undefined {
  const p = location ?? PLACES[slug.replace(/-\d+$/, "")];
  return p ? [p[0], p[1]] : undefined;
}
