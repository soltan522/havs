"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import type { Locale } from "@/lib/i18n";
import { MAP_COLORS, mapStyle } from "@/lib/map-style";

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
};

type View = { center: [number, number]; zoom: number; pitch: number; bearing: number };

const VIEWS: Record<keyof MapText["views"], View> = {
  baku: { center: [49.855, 40.377], zoom: 13.1, pitch: 62, bearing: -28 },
  absheron: { center: [49.99, 40.455], zoom: 9.9, pitch: 54, bearing: -14 },
  country: { center: [47.65, 40.35], zoom: 6.75, pitch: 40, bearing: 0 },
};

const KIND_COLOR: Record<MapKind, string> = { villa: MAP_COLORS.villa, interior: MAP_COLORS.interior, project: MAP_COLORS.project };

/** Interactive 3D map (MapLibre) with the catalogue projects placed on the towns and districts they are named after. */
export default function ProjectsMap({ items, text }: { items: MapItem[]; text: MapText & { lang: Locale } }) {
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
          attributionControl: { compact: true, customAttribution: 'Relief: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a>' },
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
          map.easeTo({ center: (f.geometry as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.3, duration: 900 });
        });
        for (const layer of ["item-dot", "cluster"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }

        // detailed building models replace their plain blocks (three.js is loaded only when there are any)
        const models = items.filter((i) => i.model).map((i) => ({ id: i.slug, src: i.model!.src, bearing: i.model!.bearing, lngLat: i.model!.origin }));
        if (models.length) {
          import("./mapModels").then(({ buildingModelsLayer, hideBlocksUnder, modelAt }) => {
            if (disposed) return;
            hideBlocksUnder(map, "buildings-3d", models);
            map.addLayer(buildingModelsLayer(maplibregl, map, models), "item-halo");
            map.on("click", (e) => {
              const hit = modelAt(models, e.lngLat);
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
