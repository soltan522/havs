"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import type { DistrictModel } from "@/lib/districts";
import type { Landmark } from "@/lib/landmarks";
import type { Locale } from "@/lib/i18n";
import { MAP_COLORS, mapStyle, TERRAIN_EXAGGERATION } from "@/lib/map-style";

export type MapKind = "villa" | "interior" | "project";
export type MapArea = "baku" | "absheron" | "regions";

export type MapItem = {
  slug: string;
  kind: MapKind;
  area: MapArea;
  title: string;
  label: string;
  specs: string;
  price: string;
  cover: string;
  href: string;
  lngLat: [number, number];
  /** A detailed 3D model of the building, shown in place of its plain map block; `origin` is the centre of its footprint. */
  model?: { src: string; bearing: number; origin: [number, number] };
};

export type MapText = {
  mapLabel: string;
  views: Record<"baku" | "absheron" | "country", string>;
  kinds: Record<MapKind, string>;
  areas: Record<MapArea, string>;
  view: string;
  showOnMap: string;
  rotate: string;
  loading: string;
  noMap: string;
  note: string;
  /** Card of a building in a 3D district; `{n}` is the floor count. */
  building: { city: string; home: string; floors: string; estimated: string; construction: string; soon: string; send: string };
};

type View = { center: [number, number]; zoom: number; pitch: number; bearing: number };

const VIEWS: Record<keyof MapText["views"], View> = {
  baku: { center: [49.855, 40.377], zoom: 13.1, pitch: 62, bearing: -28 },
  absheron: { center: [49.99, 40.455], zoom: 9.9, pitch: 54, bearing: -14 },
  country: { center: [47.65, 40.35], zoom: 6.75, pitch: 40, bearing: 0 },
};

const KIND_COLOR: Record<MapKind, string> = { villa: MAP_COLORS.villa, interior: MAP_COLORS.interior, project: MAP_COLORS.project };

/**
 * Interactive 3D map (MapLibre) with the catalogue projects placed on the towns and districts they are named after,
 * and whole districts drawn as 3D models.
 */
export default function ProjectsMap({ items, districts = [], landmarks = [], city, text }: {
  items: MapItem[];
  districts?: DistrictModel[];
  landmarks?: Landmark[];
  /** Baku's buildings in 3D: the static tiles (scripts/city/build-tiles.mjs) and the areas they cover. */
  city?: { base: string; zoom: number; areas: { name: string; bounds: [number, number, number, number] }[] };
  text: MapText & { lang: Locale };
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const openRef = useRef<(slug: string, fly: boolean) => void>(() => {});
  const [kinds, setKinds] = useState<Record<MapKind, boolean>>({ villa: true, interior: true, project: true });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rotating, setRotating] = useState(true);
  const [flat, setFlat] = useState(false);
  const rotatingRef = useRef(rotating);
  rotatingRef.current = rotating;

  const counts = useMemo(() => {
    const c: Record<MapKind, number> = { villa: 0, interior: 0, project: 0 };
    for (const i of items) c[i.kind]++;
    return c;
  }, [items]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: items
        .filter((i) => kinds[i.kind])
        .map((i) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: i.lngLat }, properties: { slug: i.slug, kind: i.kind, title: i.title } })),
    }),
    [items, kinds],
  );
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (disposed || !box.current) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) setRotating(false);
      let map: MlMap;
      try {
        map = new maplibregl.Map({
          container: box.current,
          style: mapStyle(text.lang),
          ...VIEWS.country,
          maxPitch: 78,
          attributionControl: { compact: true, customAttribution: [
              'Relief: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a>',
              ...(districts.length ? ['3D districts: <a href="https://overturemaps.org" target="_blank" rel="noopener">Overture Maps</a> (OpenStreetMap, Microsoft)'] : []),
            ] },
          cooperativeGestures: false,
        });
      } catch {
        setFailed(true);
        return;
      }
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(new maplibregl.FullscreenControl(), "bottom-right");

      const bySlug = new Map(items.map((i) => [i.slug, i]));
      const card = (item: MapItem) => {
        const root = document.createElement("a");
        root.className = "map-card";
        root.href = item.href;
        const img = document.createElement("img");
        img.src = item.cover;
        img.alt = item.title;
        img.loading = "lazy";
        const body = document.createElement("span");
        body.className = "map-card-body";
        const add = (tag: string, cls: string, value: string) => {
          const el = document.createElement(tag);
          el.className = cls;
          el.textContent = value;
          body.appendChild(el);
        };
        add("span", "map-card-label", item.label);
        add("strong", "map-card-title", item.title);
        add("span", "map-card-specs", item.specs);
        add("span", "map-card-row", `${item.price}`);
        add("span", "map-card-link", `${text.view} →`);
        root.append(img, body);
        return root;
      };
      // a building of a 3D district: what it is and, until its apartment plans are in, an invitation to send one
      const buildingCard = (place: string, p: { id?: unknown; name?: unknown; complex?: unknown; floors?: unknown; estimated?: unknown; status?: unknown; about?: unknown; homes?: unknown }) => {
        const root = document.createElement("div");
        root.className = "map-card map-card-building";
        const body = document.createElement("span");
        body.className = "map-card-body";
        const add = (tag: string, cls: string, value: string) => {
          const el = document.createElement(tag);
          el.className = cls;
          el.textContent = value;
          body.appendChild(el);
          return el;
        };
        add("span", "map-card-label", [place, p.complex].filter(Boolean).join(" · "));
        add("strong", "map-card-title", String(p.name ?? p.complex ?? text.building.home));
        const floors = p.floors ? (p.estimated ? text.building.estimated : text.building.floors).replace("{n}", String(p.floors)) : null;
        add("span", "map-card-specs", [floors, p.status === "construction" ? text.building.construction : null, p.about].filter(Boolean).join(" · "));
        // a landmark without homes has no apartment plans to send
        if (p.about === undefined || p.homes) {
          add("span", "map-card-note", text.building.soon);
          const link = add("a", "map-card-link", `${text.building.send} →`) as HTMLAnchorElement;
          const label = [p.name ?? p.complex, place].filter(Boolean).join(", ");
          link.href = `/${text.lang}/plan?${new URLSearchParams({ ...(p.id ? { b: String(p.id) } : {}), l: label })}`;
        }
        root.append(body);
        return root;
      };
      // A flight keeps the camera at the ground height MapLibre guessed when it began, from coarse terrain tiles
      // (near sea level along the Baku shore). Once the target's own tiles are in, lift the camera to the real
      // ground height there, so the point ends where the flight aimed it — unless the visitor has moved on.
      const settle = (lngLat: [number, number]) => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        map.once("idle", () => {
          const ground = map.queryTerrainElevation(lngLat);
          const from = map.getCenterElevation();
          const here = map.getCenter();
          if (ground === null || Math.abs(ground - from) < 1 || map.getZoom() !== zoom || here.lng !== center.lng || here.lat !== center.lat) return;
          const start = performance.now();
          const lift = (now: number) => {
            if (map.isMoving()) return;
            const k = Math.min(1, (now - start) / (reduce ? 1 : 800));
            map.jumpTo({ elevation: from + (ground - from) * (1 - (1 - k) ** 3) });
            if (k < 1) requestAnimationFrame(lift);
          };
          requestAnimationFrame(lift);
        });
      };
      const open = (slug: string, fly: boolean) => {
        const item = bySlug.get(slug);
        if (!item) return;
        popupRef.current?.remove();
        // a building with a 3D model keeps the card clear of it: beside it, or below it on a narrow screen
        const wide = window.innerWidth > 760;
        const side = !!item.model && wide;
        const below = !!item.model && !wide;
        popupRef.current = new maplibregl.Popup({ offset: side ? [140, -70] : below ? 36 : 16, anchor: side ? "left" : below ? "top" : undefined, maxWidth: "300px", className: "map-popup" })
          .setLngLat(side ? item.model!.origin : item.lngLat)
          .setDOMContent(card(item))
          .addTo(map);
        if (fly) {
          setRotating(false);
          const center = item.model?.origin ?? item.lngLat;
          if (item.model) {
            // close up on the street front and the corner beside it: the building in the middle, or above its card
            map.flyTo({ center, offset: [0, wide ? 90 : -80], zoom: wide ? 18.9 : 18.3, pitch: 64, bearing: (item.model.bearing + 150) % 360, duration: 3400, essential: true });
          } else {
            // the point sits below the centre so the card opens above it, clear of the panels on a narrow screen
            map.flyTo({ center: item.lngLat, offset: [0, wide ? 110 : 150], zoom: item.area === "baku" ? 14.6 : 13.2, pitch: 60, bearing: map.getBearing(), duration: 2600, essential: true });
          }
          // listening only now skips the moveend of a flight this one interrupted
          if (map.isMoving()) map.once("moveend", () => settle(center));
          else settle(center);
        }
      };
      openRef.current = open;

      map.on("load", () => {
        if (disposed) return;
        map.addSource("items", { type: "geojson", data: geojsonRef.current, cluster: true, clusterRadius: 42, clusterMaxZoom: 11 });
        map.addLayer({
          id: "item-halo",
          type: "circle",
          source: "items",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 15, "circle-color": ["match", ["get", "kind"], "interior", KIND_COLOR.interior, "project", KIND_COLOR.project, KIND_COLOR.villa], "circle-opacity": 0.18, "circle-pitch-alignment": "viewport" },
        });
        map.addLayer({
          id: "item-dot",
          type: "circle",
          source: "items",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 7,
            "circle-color": ["match", ["get", "kind"], "interior", KIND_COLOR.interior, "project", KIND_COLOR.project, KIND_COLOR.villa],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
            "circle-pitch-alignment": "viewport",
          },
        });
        map.addLayer({
          id: "cluster",
          type: "circle",
          source: "items",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#141311",
            "circle-opacity": 0.88,
            "circle-radius": ["step", ["get", "point_count"], 15, 5, 19, 12, 24],
            "circle-stroke-color": "#c49a6c",
            "circle-stroke-width": 2,
            "circle-pitch-alignment": "viewport",
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "items",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true },
          paint: { "text-color": "#efe9df" },
        });
        map.addLayer({
          id: "item-label",
          type: "symbol",
          source: "items",
          minzoom: 11.5,
          filter: ["!", ["has", "point_count"]],
          layout: { "text-field": ["get", "title"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.5], "text-anchor": "top", "text-optional": true },
          paint: { "text-color": "#2c2822", "text-halo-color": "#fbf9f5", "text-halo-width": 1.6 },
        });

        map.on("click", "item-dot", (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (f) open(String(f.properties.slug), false);
        });
        map.on("click", "cluster", async (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f) return;
          const zoom = await (map.getSource("items") as GeoJSONSource).getClusterExpansionZoom(Number(f.properties.cluster_id));
          map.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.3, duration: 900 });
        });
        for (const layer of ["item-dot", "cluster"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }

        // detailed building and district models replace their plain blocks (three.js is loaded only when there are any)
        const buildings = items.filter((i) => i.model).map((i) => ({ id: i.slug, src: i.model!.src, bearing: i.model!.bearing, lngLat: i.model!.origin }));
        const wholeDistricts = districts.map((d) => ({ id: d.id, src: d.src, bearing: 180, lngLat: d.origin, bounds: d.bounds }));
        const landmarkModels = landmarks.map((l) => ({ id: l.id, src: l.src, bearing: 180, lngLat: l.origin, bounds: l.bounds }));
        if (buildings.length || wholeDistricts.length || landmarkModels.length || city) {
          Promise.all([import("./mapModels"), city ? import("./cityBuildings") : null]).then(([{ axisOf, buildingModelsLayer, hideBlocks, modelAt }, cityModule]) => {
            if (disposed) return;
            const box = ([w, s, e, n]: [number, number, number, number]) => ({ type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
            hideBlocks(map, "buildings-3d", [
              ...buildings.map((m) => ({ geometry: axisOf(m), metres: 1 })),
              ...districts.map((d) => ({ geometry: d.zone, metres: 0 })),
              ...(city?.areas ?? []).map((a) => ({ geometry: box(a.bounds), metres: 0 })),
            ]);
            if (city && cityModule) {
              // every building of the covered areas, drawn in 3D and tappable through invisible extrusions of the same tiles
              const replaced = landmarks.flatMap((l) => l.replaces);
              const layer = cityModule.cityBuildingsLayer(maplibregl, map, { base: city.base, exaggeration: TERRAIN_EXAGGERATION, skip: replaced });
              map.addLayer(layer, "item-halo");
              const ws = city.areas.map((a) => a.bounds);
              map.addSource("city", {
                type: "vector",
                tiles: [`${window.location.origin}${city.base}/{z}/{x}/{y}.pbf`],
                minzoom: city.zoom,
                maxzoom: city.zoom,
                bounds: [Math.min(...ws.map((b) => b[0])), Math.min(...ws.map((b) => b[1])), Math.max(...ws.map((b) => b[2])), Math.max(...ws.map((b) => b[3]))],
              });
              const floorHeight = ["match", ["get", "t"], ...cityModule.FACADES.flatMap((f, i) => [i, f.floor]).slice(0, -2), cityModule.FACADES[4].floor];
              map.addLayer(
                {
                  id: "city-pick",
                  type: "fill-extrusion",
                  source: "city",
                  "source-layer": "buildings",
                  minzoom: city.zoom,
                  filter: ["!", ["in", ["get", "id"], ["literal", replaced]]],
                  paint: {
                    "fill-extrusion-color": "#000",
                    "fill-extrusion-opacity": 0,
                    "fill-extrusion-height": ["+", ["*", ["get", "f"], floorHeight], ["case", [">=", ["get", "f"], 2], 0.9, 0.3]] as never,
                  },
                },
                "item-halo",
              );
              map.on("click", "city-pick", (e) => {
                const f = e.features?.[0];
                if (!f || map.queryRenderedFeatures(e.point, { layers: ["item-dot", "cluster"] }).length || modelAt(buildings, e.lngLat)) return;
                const p = f.properties as { id: string; n?: string; c?: string; f: number; e?: number };
                const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] };
                const ring = (g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0]) as number[][];
                const at: [number, number] = [ring.reduce((a, c) => a + c[0], 0) / ring.length, ring.reduce((a, c) => a + c[1], 0) / ring.length];
                popupRef.current?.remove();
                layer.highlight(p.id);
                popupRef.current = new maplibregl.Popup({ offset: 12, maxWidth: "300px", className: "map-popup" })
                  .setLngLat(at)
                  .setDOMContent(buildingCard(text.building.city, { id: p.id, name: p.n, complex: p.c, floors: p.f, estimated: p.e === 1 }))
                  .addTo(map);
                popupRef.current.on("close", () => layer.highlight(null));
              });
              map.on("mouseenter", "city-pick", () => (map.getCanvas().style.cursor = "pointer"));
              map.on("mouseleave", "city-pick", () => (map.getCanvas().style.cursor = ""));
            }
            map.addLayer(buildingModelsLayer(maplibregl, map, [...buildings, ...wholeDistricts, ...landmarkModels]), "item-halo");
            // landmarks can be tapped too: invisible extrusions of their footprints
            if (landmarks.length) {
              map.addSource("landmarks", {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: landmarks.map((l) => ({
                    type: "Feature",
                    geometry: l.footprint,
                    properties: { id: l.id, name: l.name, about: l.about, homes: l.homes, height: l.height, ...(l.floors ? { floors: l.floors } : {}) },
                  })),
                },
              });
              map.addLayer(
                { id: "landmarks", type: "fill-extrusion", source: "landmarks", minzoom: 13, paint: { "fill-extrusion-color": "#000", "fill-extrusion-opacity": 0, "fill-extrusion-height": ["get", "height"] } },
                "item-halo",
              );
              map.on("click", "landmarks", (e) => {
                const f = e.features?.[0];
                if (!f || map.queryRenderedFeatures(e.point, { layers: ["item-dot", "cluster"] }).length) return;
                const l = landmarks.find((x) => x.id === f.properties.id);
                if (!l) return;
                popupRef.current?.remove();
                popupRef.current = new maplibregl.Popup({ offset: 12, maxWidth: "300px", className: "map-popup" })
                  .setLngLat(l.origin)
                  .setDOMContent(buildingCard(text.building.city, { id: l.id, name: l.name, floors: l.floors, about: l.about, homes: l.homes }))
                  .addTo(map);
              });
              map.on("mouseenter", "landmarks", () => (map.getCanvas().style.cursor = "pointer"));
              map.on("mouseleave", "landmarks", () => (map.getCanvas().style.cursor = ""));
            }
            // the districts' buildings can be tapped: invisible extrusions of their footprints, loaded with the district
            const added = new Set<string>();
            const addFootprints = () => {
              if (map.getZoom() < 12) return;
              const v = map.getBounds();
              for (const d of districts) {
                const [w, s, e, n] = d.bounds;
                if (added.has(d.id) || !(w < v.getEast() && e > v.getWest() && s < v.getNorth() && n > v.getSouth())) continue;
                added.add(d.id);
                const layer = `district-${d.id}`;
                map.addSource(layer, { type: "geojson", data: d.footprints });
                map.addLayer(
                  { id: layer, type: "fill-extrusion", source: layer, minzoom: 13, paint: { "fill-extrusion-color": "#000", "fill-extrusion-opacity": 0, "fill-extrusion-height": ["get", "height"] } },
                  "item-halo",
                );
                map.on("click", layer, (e) => {
                  const f = e.features?.[0];
                  if (!f || map.queryRenderedFeatures(e.point, { layers: ["item-dot", "cluster"] }).length || modelAt(buildings, e.lngLat)) return;
                  // the card opens over the building's footprint, not on the ground behind it
                  const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] };
                  const ring = (g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0]) as number[][];
                  const at: [number, number] = [ring.reduce((a, c) => a + c[0], 0) / ring.length, ring.reduce((a, c) => a + c[1], 0) / ring.length];
                  popupRef.current?.remove();
                  popupRef.current = new maplibregl.Popup({ offset: 12, maxWidth: "300px", className: "map-popup" })
                    .setLngLat(at)
                    .setDOMContent(buildingCard(d.name, f.properties))
                    .addTo(map);
                });
                map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
                map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
              }
            };
            addFootprints();
            map.on("moveend", addFootprints);
            map.on("click", (e) => {
              const hit = modelAt(buildings, e.lngLat);
              if (hit && !map.queryRenderedFeatures(e.point, { layers: ["item-dot", "cluster"] }).length) open(hit.id, false);
            });
          });
        }

        setReady(true);
        const focus = new URLSearchParams(window.location.search).get("p");
        if (focus && bySlug.has(focus)) {
          setRotating(false);
          open(focus, true);
        } else {
          map.flyTo({ ...VIEWS.baku, duration: reduce ? 0 : 5200, curve: 1.6, essential: true });
        }
      });
      map.on("error", (e) => {
        // a missing tile or glyph is not fatal; only a lost WebGL context is
        if (String(e.error?.message ?? "").toLowerCase().includes("webgl")) setFailed(true);
      });

      // slow orbit until the visitor takes over
      const stop = () => setRotating(false);
      map.on("dragstart", stop);
      map.on("rotatestart", stop);
      map.on("pitchstart", (e) => e.originalEvent && stop());
      map.on("wheel", stop);
      const spin = () => {
        if (rotatingRef.current && !map.isMoving()) map.setBearing(map.getBearing() - 0.05);
        raf = requestAnimationFrame(spin);
      };
      raf = requestAnimationFrame(spin);
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // the map is created once; items and text are static for the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const src = mapRef.current?.getSource("items") as GeoJSONSource | undefined;
    if (ready && src) src.setData(geojson);
  }, [geojson, ready]);

  const go = (v: keyof MapText["views"]) => {
    setRotating(false);
    const view = flat ? { ...VIEWS[v], pitch: 0 } : VIEWS[v];
    mapRef.current?.flyTo({ ...view, duration: 2800, essential: true });
  };
  const toggleFlat = () => {
    const next = !flat;
    setFlat(next);
    mapRef.current?.easeTo({ pitch: next ? 0 : 60, duration: 1200 });
  };
  const show = (slug: string) => {
    // instant: the page's inertia scrolling (Lenis) would cut a smooth scroll short
    box.current?.scrollIntoView({ block: "center" });
    openRef.current(slug, true);
  };

  const groups = (["baku", "absheron", "regions"] as MapArea[]).map((area) => ({ area, list: items.filter((i) => i.area === area && kinds[i.kind]) }));

  return (
    <>
      <div className="map-shell" data-lenis-prevent>
        <div ref={box} className="map-canvas" aria-label={text.mapLabel} />
        {!ready && !failed && <div className="map-status">{text.loading}</div>}
        {failed && <div className="map-status">{text.noMap}</div>}
        <div className="map-panel map-views" role="group">
          {(Object.keys(VIEWS) as (keyof MapText["views"])[]).map((v) => (
            <button key={v} type="button" onClick={() => go(v)}>{text.views[v]}</button>
          ))}
          <button type="button" className={flat ? "" : "on"} onClick={toggleFlat} aria-pressed={!flat}>{flat ? "2D" : "3D"}</button>
          <button type="button" className={rotating ? "on" : ""} onClick={() => setRotating((r) => !r)} aria-pressed={rotating}>{text.rotate}</button>
        </div>
        <div className="map-panel map-filters" role="group">
          {(Object.keys(KIND_COLOR) as MapKind[]).filter((k) => counts[k] > 0).map((k) => (
            <button key={k} type="button" className={kinds[k] ? "on" : ""} aria-pressed={kinds[k]} onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
              <i style={{ background: KIND_COLOR[k] }} /> {text.kinds[k]} <small>{counts[k]}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="map-note muted small">{text.note}</p>

      <div className="map-places">
        {groups.filter((g) => g.list.length).map((g) => (
          <section key={g.area}>
            <h2>{text.areas[g.area]} <small>{g.list.length}</small></h2>
            <ul>
              {g.list.map((i) => (
                <li key={i.slug}>
                  <i style={{ background: KIND_COLOR[i.kind] }} aria-hidden="true" />
                  <a href={i.href}>{i.title}</a>
                  <span className="muted">{i.label}</span>
                  <button type="button" onClick={() => show(i.slug)}>{text.showOnMap}</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
