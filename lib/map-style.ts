import type { StyleSpecification } from "maplibre-gl";
import type { Locale } from "@/lib/i18n";

/**
 * Map style for the projects map: an architectural-model look — warm paper land, pale water, white extruded
 * buildings — on OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data, no API key) and AWS
 * open terrain tiles (Terrarium encoding) for relief and the 3D terrain.
 */
const OFM = "https://tiles.openfreemap.org";
const TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const MAP_COLORS = {
  land: "#ece6db",
  water: "#c6d2d5",
  waterLine: "#b3c3c7",
  green: "#dde2cc",
  sand: "#efe5cf",
  residential: "#e5ded1",
  road: "#fbf9f5",
  roadCasing: "#d5cbbb",
  rail: "#b8ab97",
  boundary: "#9c8a72",
  building: "#f6f2ea",
  label: "#4b443b",
  labelHalo: "#f3efe8",
  waterLabel: "#5f7479",
  villa: "#8a5d31",
  interior: "#3f6339",
  project: "#35607e",
};

const C = MAP_COLORS;

/** Place name in the page language, falling back to the Latin and then the local name. */
const nameIn = (lang: Locale) => ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]];

const roadWidth = (base: number, z18: number) => ["interpolate", ["exponential", 1.6], ["zoom"], 8, base, 18, z18];

export function mapStyle(lang: Locale): StyleSpecification {
  const roads = (id: string, classes: string[], minzoom: number, casing: number, fill: number) => [
    {
      id: `${id}-casing`,
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "class"], ["literal", classes]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": C.roadCasing, "line-width": roadWidth(casing * 0.08, casing) },
    },
    {
      id,
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "class"], ["literal", classes]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": C.road, "line-width": roadWidth(fill * 0.06, fill) },
    },
  ];

  return {
    version: 8,
    name: "havs-maquette",
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      ofm: { type: "vector", url: `${OFM}/planet` },
      dem: { type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium", tileSize: 256, maxzoom: 14 },
      shade: { type: "raster-dem", tiles: [TERRAIN], encoding: "terrarium", tileSize: 256, maxzoom: 14 },
    },
    terrain: { source: "dem", exaggeration: 1.35 },
    sky: {
      "sky-color": "#e3ddd2",
      "horizon-color": "#f3efe8",
      "fog-color": "#f3efe8",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.35,
      "atmosphere-blend": 0,
    },
    light: { anchor: "viewport", color: "#ffffff", intensity: 0.32, position: [1.2, 205, 35] },
    layers: [
      { id: "land", type: "background", paint: { "background-color": C.land } },
      {
        id: "landcover-green",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "farmland", "wetland"]]],
        paint: { "fill-color": C.green, "fill-opacity": 0.55 },
      },
      {
        id: "landcover-sand",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["sand", "rock"]]],
        paint: { "fill-color": C.sand, "fill-opacity": 0.7 },
      },
      {
        id: "landuse-residential",
        type: "fill",
        source: "ofm",
        "source-layer": "landuse",
        minzoom: 9,
        filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
        paint: { "fill-color": C.residential, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 15, 0.25] },
      },
      { id: "park", type: "fill", source: "ofm", "source-layer": "park", paint: { "fill-color": C.green, "fill-opacity": 0.7 } },
      {
        id: "hillshade",
        type: "hillshade",
        source: "shade",
        paint: {
          "hillshade-exaggeration": 0.38,
          "hillshade-shadow-color": "#8c7a63",
          "hillshade-highlight-color": "#fffaf2",
          "hillshade-accent-color": "#b9a78d",
        },
      },
      {
        id: "waterway",
        type: "line",
        source: "ofm",
        "source-layer": "waterway",
        minzoom: 8,
        paint: { "line-color": C.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 3] },
      },
      { id: "water", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": C.water } },
      {
        id: "boundary-country",
        type: "line",
        source: "ofm",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": C.boundary, "line-width": 1.2, "line-dasharray": [3, 2], "line-opacity": 0.7 },
      },
      {
        id: "rail",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        minzoom: 10,
        filter: ["==", ["get", "class"], "rail"],
        paint: { "line-color": C.rail, "line-width": 1, "line-dasharray": [2, 2] },
      },
      ...roads("road-minor", ["minor", "service", "track"], 13, 9, 7),
      ...roads("road-mid", ["secondary", "tertiary"], 9, 16, 13),
      ...roads("road-major", ["primary", "trunk", "motorway"], 6, 22, 18),
      {
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "ofm",
        "source-layer": "building",
        minzoom: 12.5,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6],
            0, "#efe9df", 25, C.building, 80, "#ffffff",
          ],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.4, ["coalesce", ["get", "render_height"], 6]],
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.4, ["coalesce", ["get", "render_min_height"], 0]],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "water-name",
        type: "symbol",
        source: "ofm",
        "source-layer": "water_name",
        layout: {
          "text-field": nameIn(lang),
          "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 10, 16],
          "text-letter-spacing": 0.2,
          "text-max-width": 8,
        },
        paint: { "text-color": C.waterLabel, "text-halo-color": C.water, "text-halo-width": 1 },
      },
      {
        id: "place-minor",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        minzoom: 10,
        filter: ["in", ["get", "class"], ["literal", ["village", "suburb", "quarter", "neighbourhood", "hamlet"]]],
        layout: {
          "text-field": nameIn(lang),
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 13],
          "text-max-width": 8,
        },
        paint: { "text-color": C.label, "text-halo-color": C.labelHalo, "text-halo-width": 1.4, "text-opacity": 0.85 },
      },
      {
        id: "place-town",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        minzoom: 6,
        filter: ["==", ["get", "class"], "town"],
        layout: {
          "text-field": nameIn(lang),
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 12, 15],
          "text-max-width": 8,
        },
        paint: { "text-color": C.label, "text-halo-color": C.labelHalo, "text-halo-width": 1.5 },
      },
      {
        id: "place-city",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-field": nameIn(lang),
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 18],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.18,
          "text-max-width": 8,
        },
        paint: { "text-color": "#2c2822", "text-halo-color": C.labelHalo, "text-halo-width": 1.6 },
      },
    ],
  } as StyleSpecification;
}
