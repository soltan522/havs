// Concept drawing generator for the sample villas.
// Produces presentation-grade sheets (site plan, floor plans, rendered elevation, axonometric) from
// one building model, so every sheet of a plan is geometrically consistent with the others.
// Units in the model are metres; each renderer maps them to pixels.

export const SHEET_W = 1600;
export const SHEET_H = 1067;
export const COVER_W = 1500;
export const COVER_H = 1000;

const PAPER = "#f5f2ec";
const INK = "#1b1a17";
const MID = "#6e685f";
const LIGHT = "#b9b1a4";
const ACCENT = "#9a6b3c";
const FONT = "Inter, 'DejaVu Sans', sans-serif";

const EXT = 0.3; // exterior wall thickness (m)
const INT = 0.12; // interior wall thickness (m)
const STOREY = 3.3; // floor-to-floor height (m)

const r1 = (n) => Math.round(n * 10) / 10;
const f1 = (n) => +n.toFixed(1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// deterministic pseudo-random numbers, so sheets are identical between builds
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) => [...str].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

// ------------------------------------------------------------------ materials + styles

const MAT = {
  render: { fill: "#f1ede5", label: "White mineral render, smooth" },
  stucco: { fill: "#f3eee2", label: "Lime stucco, warm white" },
  travertine: { fill: "#e3d7c1", pattern: "travertine", label: "Honed travertine cladding" },
  ashlar: { fill: "#d9c09a", pattern: "ashlar", label: "Honey limestone, coursed ashlar" },
  rubble: { fill: "#d2b892", pattern: "rubble", label: "Rough-cut natural stone" },
  stoneGrey: { fill: "#aca69c", pattern: "rubble", label: "Grey natural stone, split face" },
  stoneDark: { fill: "#6b665f", pattern: "slate", label: "Dark grey stone cladding" },
  timber: { fill: "#6f523b", pattern: "boards", label: "Vertical timber cladding, dark oil" },
  teak: { fill: "#b08255", pattern: "louvre", label: "Teak timber louvres" },
  terracotta: { fill: "#bb6c4b", pattern: "tiles", label: "Terracotta clay roof tiles" },
  seam: { fill: "#404346", pattern: "seam", label: "Standing-seam metal roof, graphite" },
  bronze: { fill: "#4d4034", label: "Bronze anodised aluminium frames" },
  wood: { fill: "#8a6446", label: "Oiled oak frames and doors" },
  glass: { fill: "#7f949f", label: "Low-E double glazing" },
  balustrade: { fill: "#cfe0e6", label: "Frameless glass balustrade" },
  iron: { fill: "#2e2c29", label: "Wrought-iron balconies" },
  shutterGreen: { fill: "#6b7552", label: "Timber shutters, sage green" },
  shutterWood: { fill: "#80694d", label: "Timber shutters, natural oak" },
  pergola: { fill: "#8a6446", label: "Oak pergola with climbing vines" },
  steel: { fill: "#3a3b3c", label: "Slender steel columns, graphite" },
};

// Per-style design language. walls[i] = cladding of storey i (last entry repeats).
const SPEC = {
  modern: { walls: ["render"], fin: "travertine", frame: "bronze", glassy: true, slab: 1.5, terrace: true, garageDoor: "wood", tree: "olive" },
  tuscan: { walls: ["ashlar"], roof: "terracotta", frame: "wood", shutters: "shutterGreen", loggia: true, chimney: true, garageDoor: "wood", tree: "cypress" },
  minimal: { walls: ["render"], frame: "bronze", glassy: true, slab: 0.2, roofTerrace: true, lap: true, tree: "olive" },
  coastal: { walls: ["render"], frame: "bronze", glassy: true, slab: 2.2, terrace: true, louvres: true, garageDoor: "teak", tree: "palm" },
  chalet: { walls: ["stoneGrey", "timber"], roof: "seam", frame: "bronze", glassy: true, balcony: true, tree: "pine" },
  farmhouse: { walls: ["rubble"], roof: "terracotta", frame: "wood", shutters: "shutterWood", pergola: true, chimney: true, garageDoor: "wood", tree: "cypress" },
  luxury: { walls: ["stoneDark", "render"], frame: "bronze", glassy: true, slab: 1.8, terrace: true, garageDoor: "bronze", tree: "olive" },
  pavilion: { walls: ["travertine"], frame: "steel", glassy: true, canopy: 2.8, lap: true, tree: "olive" },
  mediterranean: { walls: ["stucco"], roof: "terracotta", frame: "wood", arches: true, ironBalcony: true, garageDoor: "wood", tree: "palm" },
  duplex: { walls: ["render"], frame: "bronze", glassy: true, slab: 0.6, timberEntry: true, tree: "round" },
};

const STYLE_EN = {
  modern: "MODERN", tuscan: "TUSCAN", minimal: "MINIMALIST", coastal: "COASTAL", chalet: "CHALET",
  farmhouse: "FARMHOUSE", luxury: "CONTEMPORARY", pavilion: "PAVILION", mediterranean: "MEDITERRANEAN", duplex: "TWIN VILLA",
};

const wallMat = (spec, li) => spec.walls[Math.min(li, spec.walls.length - 1)];

/** Roof forms and storey counts each style's drawings are designed for (checked by scripts/validate-plans.mjs). */
export const STYLE_RULES = {
  modern: { roofs: ["flat"], floors: [1, 2] },
  tuscan: { roofs: ["hip", "gable"], floors: [1, 2] },
  minimal: { roofs: ["flat"], floors: [1, 2] },
  coastal: { roofs: ["flat"], floors: [1, 2] },
  chalet: { roofs: ["frontgable"], floors: [2] },
  farmhouse: { roofs: ["gable", "hip"], floors: [1] },
  luxury: { roofs: ["flat"], floors: [2, 3] },
  pavilion: { roofs: ["flat"], floors: [1] },
  mediterranean: { roofs: ["hip", "gable"], floors: [1, 2] },
  duplex: { roofs: ["flat"], floors: [2] },
};

/** Planting symbols the elevation and site plan can draw (optional plan.tree). */
export const TREES = ["olive", "cypress", "palm", "pine", "round"];

/** Bathrooms, shower rooms and WCs in the generated plans — must equal plan.bathrooms. */
export const wetRooms = (model) => model.levels.reduce((n, lv) => n + lv.spaces.filter((s) => ["bath", "shower", "wc"].includes(s.kind)).length, 0);

/** SVG pattern + gradient library at scale `s` (px per metre). */
function materialDefs(s, seed = 7) {
  const m = (v) => +(v * s).toFixed(2);
  const dark = `stroke="#3b2f22" stroke-opacity=".28" stroke-width="0.8" fill="none"`;
  const light = `stroke="#ffffff" stroke-opacity=".22" stroke-width="0.8" fill="none"`;
  const pat = (id, w, h, body) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${m(w)}" height="${m(h)}">${body}</pattern>`;
  // irregular stones for rubble walls
  const rand = rng(seed);
  let stones = "";
  const rows = [[0.02, 0.44], [0.5, 0.97]];
  rows.forEach(([y0, y1], ri) => {
    let x = ri ? -0.25 : 0.02;
    while (x < 2.0) {
      const w = 0.38 + rand() * 0.34;
      const x1 = Math.min(x + w, 2.0 - 0.02);
      const j = () => (rand() - 0.5) * 0.06;
      const pts = [[x + j(), y0 + j()], [(x + x1) / 2 + j(), y0 + j()], [x1 + j(), y0 + j()], [x1 + j(), (y0 + y1) / 2 + j()], [x1 + j(), y1 + j()], [x + j(), y1 + j()], [x + j(), (y0 + y1) / 2]];
      stones += `<polygon points="${pts.map(([a, b]) => `${m(Math.max(a, -0.3))},${m(b)}`).join(" ")}" ${dark}/>`;
      x = x1 + 0.04;
    }
  });
  return `<defs>
    <linearGradient id="glass" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#b9c8cf"/><stop offset=".5" stop-color="#7d919b"/><stop offset="1" stop-color="#3f4c54"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4e7e8"/><stop offset="1" stop-color="#9cc4c9"/></linearGradient>
    <linearGradient id="shadeDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".26"/><stop offset="1" stop-color="${INK}" stop-opacity=".08"/></linearGradient>
    <linearGradient id="loggiaShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2620" stop-opacity=".78"/><stop offset="1" stop-color="#2c2620" stop-opacity=".45"/></linearGradient>
    ${pat("p-ashlar", 1.2, 0.6, `<path d="M0 ${m(0.3)}H${m(1.2)}M0 ${m(0.6) - 0.5}H${m(1.2)}M${m(0.6)} 0V${m(0.3)}M${m(0.3)} ${m(0.3)}V${m(0.6)}M${m(0.9)} ${m(0.3)}V${m(0.6)}M0.4 0V${m(0.3)}" ${dark}/>`)}
    ${pat("p-rubble", 2.0, 1.0, stones)}
    ${pat("p-slate", 1.8, 0.6, `<path d="M0 ${m(0.3)}H${m(1.8)}M0 ${m(0.6) - 0.5}H${m(1.8)}M0.4 0V${m(0.3)}M${m(0.9)} ${m(0.3)}V${m(0.6)}" ${light}/>`)}
    ${pat("p-travertine", 1.2, 0.6, `<path d="M0.4 0V${m(0.6)}M0 0.4H${m(1.2)}" stroke="#3b2f22" stroke-opacity=".2" stroke-width="0.8" fill="none"/><path d="M${m(0.1)} ${m(0.22)}C${m(0.4)} ${m(0.18)} ${m(0.7)} ${m(0.27)} ${m(1.1)} ${m(0.21)}M${m(0.2)} ${m(0.44)}C${m(0.5)} ${m(0.41)} ${m(0.8)} ${m(0.47)} ${m(1.0)} ${m(0.43)}" stroke="#9c8a6c" stroke-opacity=".18" stroke-width="0.6" fill="none"/>`)}
    ${pat("p-boards", 0.16, 1, `<path d="M0.4 0V${m(1)}" stroke="#ffffff" stroke-opacity=".3" stroke-width="0.8" fill="none"/>`)}
    ${pat("p-louvre", 0.22, 1, `<rect x="0" y="0" width="${m(0.09)}" height="${m(1)}" fill="#6e4d30" fill-opacity=".55"/>`)}
    ${pat("p-tiles", 0.3, 0.64, `<path d="M0 ${m(0.32)}H${m(0.3)}M0 ${m(0.64) - 0.5}H${m(0.3)}M0.4 0V${m(0.32)}M${m(0.15)} ${m(0.32)}V${m(0.64)}" stroke="#5a2a17" stroke-opacity=".38" stroke-width="0.8" fill="none"/>`)}
    ${pat("p-seam", 0.5, 1, `<path d="M0.5 0V${m(1)}" stroke="#a9aeb3" stroke-opacity=".45" stroke-width="0.9"/>`)}
    ${pat("p-earth", 0.3, 0.3, `<path d="M0 ${m(0.3)}L${m(0.3)} 0" stroke="${INK}" stroke-opacity=".35" stroke-width="0.7"/>`)}
    ${pat("p-paving", 1.2, 0.6, `<path d="M0.4 0V${m(0.6)}M0 0.4H${m(1.2)}" stroke="#8f8370" stroke-opacity=".38" stroke-width="0.6" fill="none"/>`)}
    ${pat("p-setts", 0.5, 0.5, `<path d="M0.4 0V${m(0.5)}M0 0.4H${m(0.5)}" stroke="#7d7365" stroke-opacity=".35" stroke-width="0.5" fill="none"/>`)}
    ${pat("p-grass", 1.1, 1.1, `<g fill="#7f8a62" fill-opacity=".38"><circle cx="${m(0.2)}" cy="${m(0.3)}" r="0.9"/><circle cx="${m(0.75)}" cy="${m(0.15)}" r="0.7"/><circle cx="${m(0.55)}" cy="${m(0.7)}" r="0.9"/><circle cx="${m(0.95)}" cy="${m(0.9)}" r="0.6"/><circle cx="${m(0.12)}" cy="${m(0.88)}" r="0.7"/></g>`)}
    ${pat("p-roofh", 1, 0.35, `<path d="M0 ${m(0.35) - 0.5}H${m(1)}" stroke="#5a2a17" stroke-opacity=".3" stroke-width="0.6"/>`)}
    ${pat("p-roofv", 0.35, 1, `<path d="M${m(0.35) - 0.5} 0V${m(1)}" stroke="#5a2a17" stroke-opacity=".3" stroke-width="0.6"/>`)}
  </defs>`;
}

// ------------------------------------------------------------------ model

/** Builds footprint, levels (spaces, doors, windows), roof and site layout for a plan. */
export function buildModel(plan) {
  if (!SPEC[plan.style]) throw new Error(`no drawing spec for style "${plan.style}"`);
  // a plan may pick the planting that fits its setting (e.g. pines for a forest site)
  const spec = plan.tree ? { ...SPEC[plan.style], tree: plan.tree } : SPEC[plan.style];
  const above = plan.style === "luxury" ? plan.floors - 1 : plan.floors;
  const footprintArea = plan.areaM2 / plan.floors;
  // footprint proportion (width / depth); a plan may override it to vary the massing
  const ratio = plan.ratio ?? (plan.style === "duplex" ? 2.0 : above === 1 ? 1.7 : plan.roof === "frontgable" ? 1.15 : 1.4);
  const W = r1(Math.sqrt(footprintArea * ratio));
  const D = r1(footprintArea / W);

  let levels;
  if (plan.style === "duplex") levels = duplexLevels(spec);
  else if (above === 1) levels = [singleStorey(plan, W, D, spec)];
  else levels = twoStorey(plan, W, D, spec);

  // mirrored variant: the same rooms, flipped left-to-right (garage stays on the right)
  if (plan.mirror) {
    const flip = (side) => (side === "left" ? "right" : side === "right" ? "left" : side);
    for (const lv of levels) {
      for (const s of lv.spaces) s.x = 1 - s.x - s.w;
      for (const o of [...lv.doors, ...lv.windows]) {
        if (o.side === "top" || o.side === "bottom") o.at = 1 - o.at;
        o.side = flip(o.side);
      }
      if (lv.terrace) [lv.terrace.x0, lv.terrace.x1] = [1 - lv.terrace.x1, 1 - lv.terrace.x0];
    }
  }

  // fractions -> metres
  for (const lv of levels) {
    for (const s of lv.spaces) {
      s.x *= W; s.y *= D; s.w *= W; s.h *= D;
    }
    if (lv.terrace) {
      lv.terrace.x0 *= W;
      lv.terrace.x1 *= W;
    }
  }

  const garage = plan.garage ? { w: plan.areaM2 >= 370 ? 6.6 : 3.9, d: 6.4 } : null;
  const model = { plan, spec, W, D, above, levels, garage, basement: plan.style === "luxury" };
  model.wallTop = above * STOREY;
  Object.assign(model, roofGeometry(model));
  model.site = siteLayout(model);
  return model;
}

function roofGeometry({ plan, W, D, wallTop }) {
  switch (plan.roof) {
    case "hip": {
      const ov = 0.65, rise = (D / 2 + ov) * 0.45;
      return { roofOv: ov, rise, H: wallTop + rise - ov * 0.45 };
    }
    case "gable": {
      const ov = 0.6, rise = (D / 2 + ov) * 0.5;
      return { roofOv: ov, rise, H: wallTop + rise - ov * 0.5 };
    }
    case "frontgable": {
      const ov = 0.8, rise = (W / 2 + ov) * 0.84;
      return { roofOv: ov, rise, H: wallTop + rise - ov * 0.84 };
    }
    default:
      return { roofOv: 0.3, rise: 0, H: wallTop + 0.45 };
  }
}

/** Terraces, pool and approach in front of the house (plan y > D). */
function siteLayout(model) {
  const { W, D, spec, levels } = model;
  const g0 = levels[0];
  const entry = g0.doors.find((d) => d.entry);
  const esp = g0.spaces.find((s) => s.id === entry.space);
  const entryX = esp.x + entry.at * esp.w;
  const T = spec.pergola || spec.canopy ? 2.8 : model.plan.pool ? 2.4 : 0;
  let pool = null;
  let deck = null;
  if (model.plan.pool) {
    // pool deck on the wider side of the entrance path
    const leftRoom = entryX - 1.8;
    const rightRoom = W - entryX - 1.8;
    const onLeft = leftRoom >= rightRoom;
    const pw = r1(Math.max(6, Math.min(spec.lap ? 14 : 12, Math.max(leftRoom, rightRoom) - 1.6)));
    const pd = spec.lap ? 3.0 : 4.2;
    const dx = onLeft ? 0 : r1(W - pw - 1.6);
    deck = { x: dx, y: D + T, w: pw + 1.6, h: pd + 1.6 };
    pool = { x: dx + 0.8, y: D + T + 0.8, w: pw, d: pd };
  }
  return { T, pool, deck, entryX };
}

// Each template uses fractions of the footprint. y = 0 is the back facade, y = 1 the front (entrance).

/** Kitchen + dining at the back and a living room across the front, or one open space when small. */
function livingZone(level, x0, x1, W, D, spec) {
  const glassy = !!spec.glassy;
  const front = glassy ? [{ at: 0.5, w: 99 }] : [{ at: 0.27, w: 2.2 }, { at: 0.73, w: 2.2 }];
  if ((x1 - x0) * W < 8 || D < 9.5) {
    level.spaces.push({ id: "open", label: "LIVING / DINING / KITCHEN", kind: "open", x: x0, y: 0, w: x1 - x0, h: 1 });
    front.forEach((f) => level.windows.push({ space: "open", side: "bottom", ...f }));
    level.windows.push({ space: "open", side: "top", at: 0.3, w: 2.0 }, { space: "open", side: "top", at: 0.75, w: 1.6 });
    if (x0 === 0) level.windows.push({ space: "open", side: "left", at: 0.55, w: glassy ? 3.0 : 2.0 });
    return;
  }
  const split = x0 + (x1 - x0) * 0.5;
  const ky = 0.38;
  level.spaces.push(
    { id: "kitchen", label: "KITCHEN", kind: "kitchen", x: x0, y: 0, w: split - x0, h: ky },
    { id: "dining", label: "DINING", kind: "dining", x: split, y: 0, w: x1 - split, h: ky },
    { id: "living", label: "LIVING ROOM", kind: "living", x: x0, y: ky, w: x1 - x0, h: 1 - ky },
  );
  level.doors.push(
    { space: "kitchen", side: "right", at: 0.5, w: 99, open: true },
    { space: "kitchen", side: "bottom", at: 0.5, w: 99, open: true },
    { space: "dining", side: "bottom", at: 0.5, w: 99, open: true },
  );
  front.forEach((f) => level.windows.push({ space: "living", side: "bottom", ...f }));
  level.windows.push({ space: "kitchen", side: "top", at: 0.5, w: 2.0 }, { space: "dining", side: "top", at: 0.5, w: glassy ? 3.2 : 2.0 });
  if (x0 === 0) {
    level.windows.push({ space: "kitchen", side: "left", at: 0.55, w: 1.2 }, { space: "living", side: "left", at: 0.5, w: glassy ? 3.2 : 1.8 });
  }
}

function twoStorey(plan, W, D, spec) {
  const glassy = !!spec.glassy;
  const guestDown = plan.bedrooms >= 4;
  const up = plan.bedrooms - (guestDown ? 1 : 0);
  const ground = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [], veranda: spec.pergola, canopy: spec.canopy };
  livingZone(ground, 0, 0.6, W, D, spec);
  ground.spaces.push(
    { id: "back", label: guestDown ? "GUEST BEDROOM" : "STUDY", kind: guestDown ? "bedroom" : "study", x: 0.6, y: 0, w: 0.4, h: 0.4 },
    { id: "hall", label: "ENTRANCE HALL", kind: "hall", x: 0.6, y: 0.4, w: 0.2, h: 0.6 },
    { id: "stair", label: "STAIR", kind: "stair", x: 0.8, y: 0.4, w: 0.2, h: 0.24 },
    { id: "wc", label: guestDown ? "SHOWER" : "WC", kind: guestDown ? "shower" : "wc", x: 0.8, y: 0.64, w: 0.2, h: 0.36 },
  );
  ground.doors.push(
    { space: "hall", side: "bottom", at: 0.5, w: 1.2, entry: true },
    { space: "hall", side: "left", at: 0.45, w: 1.8, open: true },
    { space: "back", side: "bottom", at: 0.25, w: 0.9 },
    { space: "wc", side: "left", at: 0.3, w: 0.8 },
    { space: "stair", side: "left", at: 0.5, w: 1.0, open: true },
  );
  ground.windows.push(
    { space: "back", side: "top", at: 0.5, w: 1.6 },
    { space: "back", side: "right", at: 0.5, w: 1.2 },
    { space: "wc", side: "bottom", at: 0.5, w: 0.6 },
  );

  const first = {
    name: "FIRST FLOOR PLAN",
    spaces: [
      { id: "master", label: "MASTER BEDROOM", kind: "master", x: 0, y: 0.58, w: 0.48, h: 0.42 },
      { id: "bed2", label: "BEDROOM", kind: "bedroom", x: 0.48, y: 0.58, w: 0.32, h: 0.42 },
      { id: "bath2", label: "BATH", kind: "bath", x: 0.8, y: 0.64, w: 0.2, h: 0.36 },
      { id: "ensuite", label: "EN-SUITE", kind: "bath", x: 0, y: 0.4, w: 0.22, h: 0.18 },
      { id: "corr", label: "LANDING", kind: "hall", x: 0.22, y: 0.4, w: 0.58, h: 0.18 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.8, y: 0.4, w: 0.2, h: 0.24 },
    ],
    doors: [
      { space: "master", side: "top", at: 0.7, w: 0.9 },
      { space: "bed2", side: "top", at: 0.5, w: 0.9 },
      { space: "bath2", side: "left", at: 0.25, w: 0.8 },
      { space: "ensuite", side: "bottom", at: 0.5, w: 0.8 },
      { space: "stair", side: "left", at: 0.5, w: 1.0, open: true },
    ],
    windows: [
      { space: "master", side: "bottom", at: 0.5, w: glassy ? 99 : 2.0 },
      { space: "master", side: "left", at: 0.5, w: 1.4 },
      { space: "bed2", side: "bottom", at: 0.5, w: glassy ? 99 : 1.6 },
      { space: "bath2", side: "bottom", at: 0.5, w: 0.6 },
      { space: "ensuite", side: "left", at: 0.5, w: 0.6 },
    ],
  };
  if (spec.terrace) first.terrace = { x0: 0, x1: 0.8, depth: 1.8, label: "TERRACE" };
  if (spec.balcony) first.terrace = { x0: 0.08, x1: 0.92, depth: 1.4, label: "BALCONY" };

  // back row: remaining bedrooms (each with an en-suite) + a study / family room when space is left over
  const backRooms = Math.max(0, up - 2);
  const names = [];
  for (let i = 0; i < backRooms; i++) names.push(["BEDROOM", "bedroom"]);
  if (backRooms === 0) names.push(["FAMILY ROOM", "study"]);
  if (backRooms === 1) names.push(["STUDY", "study"]);
  const cells = names.length;
  names.forEach(([label, kind], i) => {
    const id = `b${i}`;
    let x0 = i / cells;
    let x1 = (i + 1) / cells;
    if (kind === "bedroom") {
      const ew = Math.min(0.32 * (x1 - x0), 2.6 / W);
      const leftSide = i === 0;
      const ex = leftSide ? x0 : x1 - ew;
      first.spaces.push({ id: `e${i}`, label: "EN-SUITE", kind: "bath", x: ex, y: 0, w: ew, h: 0.4 });
      first.doors.push({ space: `e${i}`, side: leftSide ? "right" : "left", at: 0.7, w: 0.8 });
      first.windows.push({ space: `e${i}`, side: "top", at: 0.5, w: 0.6 });
      if (leftSide) x0 += ew;
      else x1 -= ew;
    }
    first.spaces.push({ id, label, kind, x: x0, y: 0, w: x1 - x0, h: 0.4 });
    first.doors.push({ space: id, side: "bottom", at: i === 0 ? 0.8 : i === cells - 1 ? 0.25 : 0.5, w: 0.9 });
    first.windows.push({ space: id, side: "top", at: 0.5, w: Math.min(2.2, 1.4 + 0.2 * cells) });
  });
  return [ground, first];
}

function singleStorey(plan, W, D, spec) {
  const glassy = !!spec.glassy;
  if (plan.bedrooms >= 3) {
    // Corridor plan: living wing on the left, bedroom wing on the right served by one corridor.
    const level = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [], veranda: spec.pergola, canopy: spec.canopy };
    livingZone(level, 0, 0.45, W, D, spec);
    level.spaces.push(
      { id: "hall", label: "ENTRANCE HALL", kind: "hall", x: 0.45, y: 0.43, w: 0.13, h: 0.57 },
      { id: "corr", label: "CORRIDOR", kind: "hall", x: 0.58, y: 0.43, w: 0.42, h: 0.12 },
      { id: "master", label: "MASTER BEDROOM", kind: "master", x: 0.58, y: 0.55, w: 0.27, h: 0.45 },
      { id: "ensuite", label: "EN-SUITE", kind: "bath", x: 0.85, y: 0.55, w: 0.15, h: 0.45 },
      { id: "bedB", label: "BEDROOM", kind: "bedroom", x: 0.45, y: 0, w: 0.25, h: 0.43 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.7, y: 0, w: 0.13, h: 0.43 },
      { id: "bedC", label: "BEDROOM", kind: "bedroom", x: 0.83, y: 0, w: 0.17, h: 0.43 },
    );
    level.doors.push(
      { space: "hall", side: "bottom", at: 0.5, w: 1.2, entry: true },
      { space: "hall", side: "left", at: 0.5, w: 1.8, open: true },
      { space: "corr", side: "left", at: 0.5, w: 1.2, open: true },
      { space: "master", side: "top", at: 0.15, w: 0.9 },
      { space: "ensuite", side: "left", at: 0.3, w: 0.8 },
      { space: "bedB", side: "bottom", at: 0.8, w: 0.9 },
      { space: "bath", side: "bottom", at: 0.5, w: 0.8 },
      { space: "bedC", side: "bottom", at: 0.3, w: 0.9 },
    );
    level.windows.push(
      { space: "master", side: "bottom", at: 0.5, w: glassy ? 99 : 2.2 },
      { space: "ensuite", side: "right", at: 0.5, w: 0.8 },
      { space: "bedB", side: "top", at: 0.5, w: 1.6 },
      { space: "bath", side: "top", at: 0.5, w: 0.6 },
      { space: "bedC", side: "top", at: 0.5, w: 1.4 },
      { space: "bedC", side: "right", at: 0.5, w: 1.2 },
    );
    return level;
  }
  // Compact two-bedroom plan: one hall serves both bedrooms and the bathroom.
  return {
    name: "GROUND FLOOR PLAN",
    veranda: spec.pergola,
    canopy: spec.canopy,
    spaces: [
      { id: "open", label: "LIVING / DINING / KITCHEN", kind: "open", x: 0, y: 0, w: 0.42, h: 1 },
      { id: "store", label: "LAUNDRY", kind: "store", x: 0.42, y: 0, w: 0.14, h: 0.2 },
      { id: "hall", label: "HALL", kind: "hall", x: 0.42, y: 0.2, w: 0.14, h: 0.8 },
      { id: "bedB", label: "BEDROOM", kind: "bedroom", x: 0.56, y: 0, w: 0.44, h: 0.4 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.56, y: 0.4, w: 0.44, h: 0.2 },
      { id: "bedA", label: "BEDROOM", kind: "bedroom", x: 0.56, y: 0.6, w: 0.44, h: 0.4 },
    ],
    doors: [
      { space: "hall", side: "bottom", at: 0.5, w: 1.0, entry: true },
      { space: "hall", side: "left", at: 0.5, w: 1.6, open: true },
      { space: "store", side: "bottom", at: 0.5, w: 0.7 },
      { space: "bedB", side: "left", at: 0.75, w: 0.9 },
      { space: "bath", side: "left", at: 0.5, w: 0.8 },
      { space: "bedA", side: "left", at: 0.25, w: 0.9 },
    ],
    windows: [
      { space: "open", side: "bottom", at: 0.5, w: glassy ? 99 : 2.6 },
      { space: "open", side: "left", at: 0.5, w: 1.6 },
      { space: "open", side: "top", at: 0.5, w: 1.4 },
      { space: "bedB", side: "top", at: 0.5, w: 1.6 },
      { space: "bath", side: "right", at: 0.5, w: 0.6 },
      { space: "bedA", side: "bottom", at: 0.5, w: 1.8 },
    ],
  };
}

function duplexLevels(spec) {
  // Two mirrored units. Templates are written in unit fractions (0..1) and mapped onto each half.
  const glassy = !!spec.glassy;
  const ground = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [] };
  const first = { name: "FIRST FLOOR PLAN", spaces: [], doors: [], windows: [] };
  const G = {
    spaces: [
      { id: "open", label: "LIVING / KITCHEN", kind: "open", x: 0, y: 0, w: 0.62, h: 1 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.62, y: 0, w: 0.38, h: 0.3 },
      { id: "hall", label: "HALL", kind: "hall", x: 0.62, y: 0.3, w: 0.18, h: 0.7 },
      { id: "wc", label: "WC", kind: "wc", x: 0.8, y: 0.3, w: 0.2, h: 0.22 },
      { id: "store", label: "STORE", kind: "store", x: 0.8, y: 0.52, w: 0.2, h: 0.48 },
    ],
    doors: [
      { space: "hall", side: "bottom", at: 0.5, w: 1.0, entry: true },
      { space: "hall", side: "left", at: 0.5, w: 1.4, open: true },
      { space: "stair", side: "bottom", at: 0.22, w: 1.0, open: true },
      { space: "wc", side: "left", at: 0.5, w: 0.7 },
      { space: "store", side: "left", at: 0.3, w: 0.8 },
    ],
    windows: [
      { space: "open", side: "bottom", at: 0.5, w: glassy ? 99 : 2.4 },
      { space: "open", side: "top", at: 0.5, w: 2.4 },
    ],
  };
  const F = {
    spaces: [
      { id: "c", label: "BEDROOM", kind: "bedroom", x: 0, y: 0, w: 0.62, h: 0.3 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.62, y: 0, w: 0.38, h: 0.3 },
      { id: "land", label: "LANDING", kind: "hall", x: 0, y: 0.3, w: 1, h: 0.16 },
      { id: "m", label: "MASTER BEDROOM", kind: "master", x: 0, y: 0.46, w: 0.48, h: 0.54 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.48, y: 0.46, w: 0.2, h: 0.54 },
      { id: "b", label: "BEDROOM", kind: "bedroom", x: 0.68, y: 0.46, w: 0.32, h: 0.54 },
    ],
    doors: [
      { space: "c", side: "bottom", at: 0.7, w: 0.9 },
      { space: "stair", side: "bottom", at: 0.5, w: 1.0, open: true },
      { space: "m", side: "top", at: 0.8, w: 0.9 },
      { space: "bath", side: "top", at: 0.5, w: 0.8 },
      { space: "b", side: "top", at: 0.3, w: 0.9 },
    ],
    windows: [
      { space: "c", side: "top", at: 0.5, w: 1.8 },
      { space: "m", side: "bottom", at: 0.5, w: glassy ? 3.0 : 2.0 },
      { space: "b", side: "bottom", at: 0.5, w: 1.6 },
    ],
  };
  const place = (tpl, target, offset, mirror, tag) => {
    const flip = (side) => (mirror && side === "left" ? "right" : mirror && side === "right" ? "left" : side);
    for (const sp of tpl.spaces) {
      const x = mirror ? 1 - sp.x - sp.w : sp.x;
      target.spaces.push({ ...sp, id: sp.id + tag, x: offset + x * 0.5, w: sp.w * 0.5 });
    }
    for (const d of tpl.doors) {
      const horiz = d.side === "top" || d.side === "bottom";
      target.doors.push({ ...d, space: d.space + tag, side: flip(d.side), at: mirror && horiz ? 1 - d.at : d.at });
    }
    for (const w of tpl.windows) {
      const horiz = w.side === "top" || w.side === "bottom";
      target.windows.push({ ...w, space: w.space + tag, side: flip(w.side), at: mirror && horiz ? 1 - w.at : w.at });
    }
  };
  place(G, ground, 0, false, "L");
  place(G, ground, 0.5, true, "R");
  place(F, first, 0, false, "L");
  place(F, first, 0.5, true, "R");
  // end-wall windows on the outer walls
  ground.windows.push({ space: "openL", side: "left", at: 0.5, w: 2.4 }, { space: "openR", side: "right", at: 0.5, w: 2.4 });
  first.windows.push({ space: "mL", side: "left", at: 0.5, w: 1.4 }, { space: "mR", side: "right", at: 0.5, w: 1.4 });
  return [ground, first];
}

// ------------------------------------------------------------------ geometry helpers

function sideSegment(s, side) {
  switch (side) {
    case "top": return { x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y, horizontal: true };
    case "bottom": return { x1: s.x, y1: s.y + s.h, x2: s.x + s.w, y2: s.y + s.h, horizontal: true };
    case "left": return { x1: s.x, y1: s.y, x2: s.x, y2: s.y + s.h, horizontal: false };
    default: return { x1: s.x + s.w, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, horizontal: false };
  }
}

function isExterior(model, s, side) {
  const e = 0.01;
  if (side === "top") return s.y < e;
  if (side === "bottom") return Math.abs(s.y + s.h - model.D) < e;
  if (side === "left") return s.x < e;
  return Math.abs(s.x + s.w - model.W) < e;
}

/** Inner (clear) rectangle of a space after subtracting wall thickness. */
function inner(model, s) {
  const t = (side) => (isExterior(model, s, side) ? EXT : INT / 2);
  return { x: s.x + t("left"), y: s.y + t("top"), w: s.w - t("left") - t("right"), h: s.h - t("top") - t("bottom") };
}

/** Window openings on the front facade (plan bottom edge) of a level, in metres along x. */
function frontWindows(model, level) {
  return level.windows
    .filter((w) => w.side === "bottom")
    .map((w) => {
      const sp = level.spaces.find((x) => x.id === w.space);
      if (!sp || Math.abs(sp.y + sp.h - model.D) > 0.01) return null;
      const ww = Math.min(w.w, sp.w - 0.6);
      return { x: sp.x + w.at * sp.w - ww / 2, w: ww, kind: sp.kind, space: sp };
    })
    .filter(Boolean);
}

function entryDoors(level) {
  return level.doors
    .filter((d) => d.entry)
    .map((d) => {
      const sp = level.spaces.find((x) => x.id === d.space);
      const w = Math.min(d.w, sp.w - 0.4);
      return { x: sp.x + d.at * sp.w - w / 2, w };
    });
}

/** Drawing only, on a plain paper background (used for catalogue cards). */
function bareSvg(body, defs = "") {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
    ${defs}<rect width="100%" height="100%" fill="${PAPER}"/>${body}</svg>`);
}

// ------------------------------------------------------------------ sheet frame + title block

function sheet({ plan, drawing, sheetNo, scaleNote, body, defs = "", north, legend }) {
  const tbX = SHEET_W - 330;
  const rows = [
    ["PROJECT", plan.title.en.toUpperCase()],
    ["DRAWING", drawing],
    ["SCALE", scaleNote],
    ["SHEET / REV", `${sheetNo} / A`],
    ["GROSS AREA", `${plan.areaM2} m²`],
  ];
  let tb = `<g font-family="${FONT}">
    <line x1="${tbX}" y1="36" x2="${tbX}" y2="${SHEET_H - 36}" stroke="${INK}" stroke-width="1.2"/>
    <g transform="translate(${tbX + 28} 74)">
      <rect x="0" y="-14" width="14" height="14" fill="none" stroke="${ACCENT}" stroke-width="1.6" transform="rotate(45 7 -7)"/>
      <text x="28" y="0" font-size="20" font-weight="600" fill="${INK}" letter-spacing="1">havs.dev</text>
      <text x="0" y="26" font-size="10.5" fill="${MID}" letter-spacing="2">ARCHITECTURE · VILLA DESIGN</text>
    </g>`;
  rows.forEach(([k, v], i) => {
    const y = 156 + i * 66;
    tb += `<line x1="${tbX}" y1="${y - 24}" x2="${SHEET_W - 36}" y2="${y - 24}" stroke="${LIGHT}"/>
      <text x="${tbX + 28}" y="${y}" font-size="10" fill="${MID}" letter-spacing="2">${k}</text>
      <text x="${tbX + 28}" y="${y + 25}" font-size="${i === 0 ? 19 : 15}" font-weight="${i === 0 ? 600 : 500}" fill="${i === 4 ? ACCENT : INK}" letter-spacing="0.5">${esc(v)}</text>`;
  });
  const legendTop = 156 + rows.length * 66 - 24;
  tb += `<line x1="${tbX}" y1="${legendTop}" x2="${SHEET_W - 36}" y2="${legendTop}" stroke="${LIGHT}"/>`;
  if (legend?.length) {
    tb += `<text x="${tbX + 28}" y="${legendTop + 30}" font-size="10" fill="${MID}" letter-spacing="2">${legend.title}</text>`;
    legend.forEach((item, i) => {
      const y = legendTop + 56 + i * 31;
      tb += `<g transform="translate(${tbX + 28} ${y})">
        <circle cx="9" cy="-4" r="9" fill="none" stroke="${INK}" stroke-width="0.9"/>
        <text x="9" y="-0.5" text-anchor="middle" font-size="9" font-weight="600" fill="${INK}">${i + 1}</text>
        <rect x="26" y="-13" width="18" height="18" fill="${item.fill}" stroke="${INK}" stroke-width="0.6"/>
        ${item.pattern ? `<rect x="26" y="-13" width="18" height="18" fill="url(#${item.pattern})"/>` : ""}
        <text x="54" y="0" font-size="11.5" fill="${INK}">${esc(item.label)}</text>
      </g>`;
    });
  }
  if (north) {
    tb += `<g transform="translate(${tbX + 165} ${SHEET_H - 232})"><circle r="30" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <path d="M0 -24 L9 14 L0 6 L-9 14 Z" fill="${INK}"/><text y="-38" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}">N</text></g>`;
  }
  tb += `<line x1="${tbX}" y1="${SHEET_H - 150}" x2="${SHEET_W - 36}" y2="${SHEET_H - 150}" stroke="${INK}" stroke-width="1.2"/>
    <text x="${tbX + 28}" y="${SHEET_H - 118}" font-size="10" fill="${MID}" letter-spacing="1.6">STAGE · CONCEPT DESIGN</text>
    <text x="${tbX + 28}" y="${SHEET_H - 100}" font-size="10" fill="${MID}" letter-spacing="1.6">NOT FOR CONSTRUCTION</text>
    <text x="${tbX + 28}" y="${SHEET_H - 66}" font-size="10" fill="${MID}" letter-spacing="1.6">© havs.dev 2026</text>
  </g>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">
    ${defs}
    <rect width="100%" height="100%" fill="${PAPER}"/>
    <rect x="24" y="24" width="${SHEET_W - 48}" height="${SHEET_H - 48}" fill="none" stroke="${INK}" stroke-width="0.8"/>
    <rect x="36" y="36" width="${SHEET_W - 72}" height="${SHEET_H - 72}" fill="none" stroke="${INK}" stroke-width="1.6"/>
    ${body}${tb}
  </svg>`);
}

function sheetTitle(title, sub) {
  return `<text x="${36 + 60}" y="${SHEET_H - 70}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${INK}">${title}</text>
    <text x="${36 + 60}" y="${SHEET_H - 48}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${sub}</text>`;
}

function scaleBar(x, y, s) {
  const seg = [0, 1, 2, 5];
  let g = `<g font-family="${FONT}" font-size="10" fill="${INK}">`;
  for (let i = 0; i < seg.length - 1; i++) {
    g += `<rect x="${x + seg[i] * s}" y="${y}" width="${(seg[i + 1] - seg[i]) * s}" height="6" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  seg.forEach((m) => (g += `<text x="${x + m * s}" y="${y + 20}" text-anchor="middle">${m}</text>`));
  g += `<text x="${x + 5 * s + 12}" y="${y + 7}" >m</text></g>`;
  return g;
}

function dimChain(points, at, s, ox, oy, horizontal, labelSide = 1) {
  // points in metres along the axis; `at` = fixed coordinate (metres) of the dimension line
  let g = `<g stroke="${INK}" stroke-width="0.7" font-family="${FONT}" font-size="11" fill="${INK}">`;
  const P = (a) => (horizontal ? [ox + a * s, oy + at * s] : [ox + at * s, oy + a * s]);
  const [sx, sy] = P(points[0]);
  const [ex, ey] = P(points[points.length - 1]);
  g += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"/>`;
  points.forEach((p) => {
    const [x, y] = P(p);
    g += `<line x1="${x - 5}" y1="${y + 5}" x2="${x + 5}" y2="${y - 5}" stroke-width="1.4"/>`;
    g += horizontal ? `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}"/>` : `<line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}"/>`;
  });
  for (let i = 0; i < points.length - 1; i++) {
    const len = points[i + 1] - points[i];
    if (len * s < 34) continue;
    const [x, y] = P((points[i] + points[i + 1]) / 2);
    const label = len.toFixed(2);
    g += horizontal
      ? `<text x="${x}" y="${y - 6 * labelSide}" text-anchor="middle" stroke="none" ${labelSide < 0 ? 'dominant-baseline="hanging"' : ""}>${label}</text>`
      : `<text x="${x - 6}" y="${y}" text-anchor="middle" stroke="none" transform="rotate(-90 ${x - 6} ${y})">${label}</text>`;
  }
  return g + "</g>";
}

// ------------------------------------------------------------------ plan-view symbols

/** Presentation tree symbol in plan view (centre cx, cy in px, radius r in px). */
function planTree(kind, cx, cy, r, seed) {
  const rand = rng(seed);
  if (kind === "palm") {
    let o = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#a9b38d" fill-opacity=".35"/>`;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
      const tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r;
      const mx = cx + Math.cos(a + 0.25) * r * 0.55, my = cy + Math.sin(a + 0.25) * r * 0.55;
      o += `<path d="M${cx} ${cy} Q${f1(mx)} ${f1(my)} ${f1(tx)} ${f1(ty)}" fill="none" stroke="#5b6845" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    return o + `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>`;
  }
  const n = kind === "cypress" ? 7 : 11;
  const fill = kind === "pine" || kind === "cypress" ? "#7d8a63" : "#a6b08a";
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.9 + rand() * 0.1);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) d += `M${f1(x)} ${f1(y)}`;
    else {
      const am = a - Math.PI / n;
      d += ` Q${f1(cx + Math.cos(am) * r * 1.16)} ${f1(cy + Math.sin(am) * r * 1.16)} ${f1(x)} ${f1(y)}`;
    }
  }
  return `<path d="${d} Z" fill="${fill}" fill-opacity=".55" stroke="#56623f" stroke-width="0.9"/>
    <path d="M${cx - r * 0.35} ${cy}H${cx + r * 0.35}M${cx} ${cy - r * 0.35}V${cy + r * 0.35}" stroke="#56623f" stroke-width="0.7"/>`;
}

/** Pool with coping, steps and water. All arguments in px. */
function planPool(x, y, w, h, label) {
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#water)" stroke="${INK}" stroke-width="1.4"/>`;
  o += `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" stroke="#6f9aa1" stroke-width="0.6"/>`;
  for (let i = 1; i <= 3; i++) o += `<line x1="${x + w - i * 9}" y1="${y}" x2="${x + w - i * 9}" y2="${y + h * 0.42}" stroke="${INK}" stroke-width="0.6"/>`;
  for (let i = 0; i < 3; i++) {
    const yy = y + h * (0.3 + i * 0.22);
    o += `<path d="M${x + w * 0.12} ${yy} q${w * 0.05} -4 ${w * 0.1} 0 t${w * 0.1} 0" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="1"/>`;
  }
  if (label) o += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${INK}">${label}</text>`;
  return o;
}

// ------------------------------------------------------------------ furniture blocks
// Furniture is drawn through a "pen" in plan metres, so the same blocks go to the SVG sheets
// (svgPen) and to the CAD export (cadPen).

function svgPen(s, px) {
  const X = (m) => f1(px.X(m));
  const Y = (m) => f1(px.Y(m));
  const dash = (o) => (o.dash ? ` stroke-dasharray="${o.dash}"${o.faint ? ' stroke-opacity=".7"' : ""}` : "");
  return {
    rect: (x, y, w, h, o = {}) => `<rect x="${X(x)}" y="${Y(y)}" width="${f1(w * s)}" height="${f1(h * s)}"${o.round ? ` rx="${o.round}"` : ""} fill="none" stroke="${MID}" stroke-width="0.9"${dash(o)}/>`,
    circle: (cx, cy, r) => `<circle cx="${X(cx)}" cy="${Y(cy)}" r="${f1(r * s)}" fill="none" stroke="${MID}" stroke-width="0.9"/>`,
    ellipse: (cx, cy, rx, ry) => `<ellipse cx="${X(cx)}" cy="${Y(cy)}" rx="${f1(rx * s)}" ry="${f1(ry * s)}" fill="none" stroke="${MID}" stroke-width="0.8"/>`,
    line: (x1, y1, x2, y2, o = {}) => `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${MID}" stroke-width="0.8"${dash(o)}/>`,
    poly: (pts, o = {}) => `<polyline points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="none" stroke="${o.ink ? INK : MID}" stroke-width="${o.ink ? 1 : 0.8}"/>`,
  };
}

/** Collects the same strokes as plain geometry (metres, plan coordinates: y grows toward the front). */
function cadPen(out, layer) {
  const push = (e) => (out.push({ layer, ...e }), "");
  return {
    rect: (x, y, w, h, o = {}) => push({ t: "rect", x, y, w, h, dashed: !!o.dash }),
    circle: (cx, cy, r) => push({ t: "circle", cx, cy, r }),
    ellipse: (cx, cy, rx, ry) => push({ t: "ellipse", cx, cy, rx, ry }),
    line: (x1, y1, x2, y2, o = {}) => push({ t: "line", x1, y1, x2, y2, dashed: !!o.dash }),
    poly: (pts) => push({ t: "poly", pts }),
  };
}

function furniture(d, kind, inn) {
  const { x, y, w, h } = inn;
  let g = "";
  const bed = (bw) => {
    const bl = 2.05;
    if (w < bw + 0.4 || h < bl + 0.6) return "";
    const bx = x + (w - bw) / 2;
    const by = y + 0.05;
    let b = d.rect(bx, by, bw, bl) + d.rect(bx + 0.12, by + 0.12, bw / 2 - 0.18, 0.42, { round: 3 }) + d.rect(bx + bw / 2 + 0.06, by + 0.12, bw / 2 - 0.18, 0.42, { round: 3 });
    b += d.line(bx, by + 0.7, bx + bw, by + 0.7);
    if (w > bw + 1.4) b += d.rect(bx - 0.55, by + 0.05, 0.45, 0.4) + d.rect(bx + bw + 0.1, by + 0.05, 0.45, 0.4);
    if (h > bl + 1.8) {
      // wardrobe along the opposite wall
      const ww = Math.min(w - 0.4, 2.4);
      const wy = y + h - 0.62;
      b += d.rect(x + 0.2, wy, ww, 0.6);
      for (let i = 1; i < 4; i++) b += d.line(x + 0.2 + (ww * i) / 4, wy, x + 0.2 + (ww * i) / 4, wy + 0.6);
    }
    return b;
  };
  const table = (cx, cy, tw, seats) => {
    let t = d.rect(cx - tw / 2, cy - 0.5, tw, 1.0, { round: 2 });
    for (let i = 0; i < seats; i++) {
      const sx = cx - tw / 2 + (tw / seats) * (i + 0.5) - 0.22;
      t += d.rect(sx, cy - 1.0, 0.44, 0.42, { round: 3 }) + d.rect(sx, cy + 0.58, 0.44, 0.42, { round: 3 });
    }
    return t;
  };
  const sofa = (cx, cy, sw) => {
    let o = d.rect(cx - sw / 2, cy, sw, 0.95, { round: 4 }) + d.rect(cx - sw / 2 + 0.12, cy + 0.12, sw - 0.24, 0.62, { round: 3 });
    o += d.rect(cx - sw / 2, cy - 1.9, 0.95, 1.9, { round: 4 });
    o += d.rect(cx - 0.6, cy - 1.45, 1.2, 0.7, { round: 2 });
    o += d.rect(cx + sw / 2 - 0.9, cy - 1.75, 0.85, 0.85, { round: 5 });
    o += d.rect(cx - sw / 2 - 0.2, cy - 2.4, sw + 0.6, 3.6, { dash: "5 4", faint: true });
    return o;
  };
  const wc = () => d.rect(x + w - 0.5, y + h - 0.72, 0.42, 0.18) + d.ellipse(x + w - 0.29, y + h - 0.36, 0.18, 0.24) + d.ellipse(x + 0.35, y + h - 0.25, 0.22, 0.16);
  const shower = () => d.rect(x + 0.05, y + 0.05, 0.9, 0.9) + d.line(x + 0.05, y + 0.05, x + 0.95, y + 0.95) + d.line(x + 0.95, y + 0.05, x + 0.05, y + 0.95);
  switch (kind) {
    case "master": g += bed(1.8); break;
    case "bedroom": g += bed(w < 2.6 ? 0.9 : 1.6); break;
    case "kitchen": {
      // L-shaped run along the back and left walls, island in the middle
      g += d.rect(x + 0.05, y + 0.05, w - 0.1, 0.62) + d.rect(x + 0.05, y + 0.67, 0.62, Math.min(h * 0.55, h - 1.0));
      g += d.circle(x + w * 0.55, y + 0.25, 0.1) + d.circle(x + w * 0.55 + 0.32, y + 0.25, 0.1) + d.circle(x + w * 0.55, y + 0.48, 0.1) + d.circle(x + w * 0.55 + 0.32, y + 0.48, 0.1);
      g += d.rect(x + w * 0.25, y + 0.14, 0.7, 0.42, { round: 4 });
      if (w > 3.6 && h > 3.4) {
        const iw = Math.min(2.6, w - 2.0);
        g += d.rect(x + (w - iw) / 2 + 0.3, y + h * 0.5, iw, 0.95);
        for (let i = 0; i < 3; i++) g += d.circle(x + (w - iw) / 2 + 0.3 + iw * (0.2 + i * 0.3), y + h * 0.5 + 1.3, 0.2);
      }
      break;
    }
    case "dining": {
      const tw = Math.min(3.0, w - 1.6);
      if (tw > 1.4 && h > 3) g += table(x + w / 2, y + h / 2, tw, tw >= 2.6 ? 4 : 3);
      break;
    }
    case "living": {
      const sw = Math.min(3.4, w - 2.2);
      if (sw > 2) g += sofa(x + w * 0.45, y + h * 0.42, sw);
      g += d.rect(x + w - 0.5, y + h * 0.15, 0.4, Math.min(2.4, h * 0.4));
      break;
    }
    case "open": {
      // kitchen run along the back wall, dining in the middle, sofa group toward the front windows
      const kl = Math.min(w - 0.4, 4.2);
      g += d.rect(x + 0.1, y + 0.05, kl, 0.62);
      g += d.circle(x + 0.1 + kl * 0.72, y + 0.24, 0.09) + d.circle(x + 0.1 + kl * 0.72 + 0.28, y + 0.24, 0.09) + d.circle(x + 0.1 + kl * 0.72, y + 0.48, 0.09) + d.circle(x + 0.1 + kl * 0.72 + 0.28, y + 0.48, 0.09);
      g += d.rect(x + 0.1 + kl * 0.25, y + 0.14, 0.7, 0.42, { round: 4 });
      if (h > 5.5 && w > 2.6) g += d.rect(x + 0.1 + (kl - 2.2) / 2, y + 1.55, 2.2, 0.9);
      if (h > 6) g += table(x + w / 2, y + h * 0.45 + 0.5, Math.min(2.0, w - 1.6), 3);
      const sw = Math.min(2.8, w - 1);
      const sy = y + h - 2.6;
      g += d.rect(x + (w - sw) / 2, sy, sw, 0.95, { round: 4 }) + d.rect(x + (w - sw) / 2 + 0.1, sy + 0.12, sw - 0.2, 0.7, { round: 3 });
      g += d.rect(x + (w - 1.2) / 2, sy + 1.35, 1.2, 0.6, { round: 2 });
      break;
    }
    case "bath": {
      if (w > 1.9 && h > 2.2) g += d.rect(x + 0.05, y + 0.05, 1.7, 0.75, { round: 8 }) + d.ellipse(x + 0.9, y + 0.42, 0.7, 0.26);
      else g += shower();
      g += d.rect(x + w - 0.55, y + h - 0.75, 0.45, 0.2) + d.ellipse(x + w - 0.33, y + h - 0.38, 0.19, 0.26) + d.ellipse(x + 0.45, y + h - 0.3, 0.28, 0.2);
      break;
    }
    case "shower":
      g += shower() + wc();
      break;
    case "wc":
      g += wc();
      break;
    case "study":
      if (w > 2 && h > 2) g += d.rect(x + 0.1, y + 0.1, Math.min(1.8, w - 0.4), 0.7) + d.rect(x + 0.6, y + 0.95, 0.5, 0.5, { round: 3 }) + d.rect(x + w - 0.5, y + 0.1, 0.4, Math.min(2.4, h - 0.6));
      break;
    case "stair": {
      const vertical = h > w;
      const n = 12;
      for (let i = 1; i < n; i++) g += vertical ? d.line(x, y + (h * i) / n, x + w, y + (h * i) / n) : d.line(x + (w * i) / n, y, x + (w * i) / n, y + h);
      // direction of travel (up)
      g += vertical
        ? d.poly([[x + w / 2, y + h - 0.2], [x + w / 2, y + 0.3]], { ink: true }) + d.poly([[x + w / 2 - 0.12, y + 0.47], [x + w / 2, y + 0.3], [x + w / 2 + 0.12, y + 0.47]], { ink: true })
        : d.poly([[x + 0.2, y + h / 2], [x + w - 0.3, y + h / 2]], { ink: true }) + d.poly([[x + w - 0.47, y + h / 2 - 0.12], [x + w - 0.3, y + h / 2], [x + w - 0.47, y + h / 2 + 0.12]], { ink: true });
      g += d.line(x, y + h, x + w, y, { dash: "6 4" });
      break;
    }
    case "store":
      g += d.rect(x + 0.1, y + 0.1, Math.min(1.2, w - 0.2), 0.6);
      break;
  }
  return g;
}

// ------------------------------------------------------------------ floor plan sheet

export function floorPlanSheet(model, levelIndex, sheetNo) {
  const { W, D, plan, spec } = model;
  const level = model.levels[levelIndex];
  const isGround = levelIndex === 0;
  const garage = isGround ? model.garage : null;
  const site = model.site;
  const extraW = garage ? garage.w + 0.5 : 0;
  const frontExtent = isGround ? Math.max(site.T, site.deck ? site.T + site.deck.h : 0, garage ? 3 : 0) : level.terrace ? level.terrace.depth : 0;
  const extraD = frontExtent + 1.4;
  const margin = 3.0; // axes, bubbles and dimension chains (m)
  const areaW = SHEET_W - 330 - 36 - 90;
  const areaH = SHEET_H - 72 - 180;
  const s = Math.min(areaW / (W + extraW + margin), areaH / (D + extraD + margin), 58);
  const ox = 36 + 45 + (areaW - (W + extraW + margin) * s) / 2 + margin * s;
  const oy = 36 + 40 + (areaH - (D + extraD + margin) * s) / 2 + margin * s;
  const px = { X: (m) => ox + m * s, Y: (m) => oy + m * s };
  const rect = (x, y, w, h, extra) => `<rect x="${f1(px.X(x))}" y="${f1(px.Y(y))}" width="${f1(w * s)}" height="${f1(h * s)}" ${extra}/>`;
  const text = (x, y, str, size = 11, extra = "") => `<text x="${f1(px.X(x))}" y="${f1(px.Y(y))}" text-anchor="middle" font-family="${FONT}" font-size="${size}" letter-spacing="2" fill="${MID}" ${extra}>${str}</text>`;

  let g = "";
  // structural grid from unique wall lines
  const dedupe = (vals) => vals.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.6);
  const xs = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.x), r1(sp.x + sp.w)]))]);
  const ys = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.y), r1(sp.y + sp.h)]))]);
  const letters = "ABCDEFGHJK";
  xs.forEach((x, i) => {
    g += `<line x1="${f1(px.X(x))}" y1="${f1(px.Y(-2.3))}" x2="${f1(px.X(x))}" y2="${f1(px.Y(D + 0.4))}" stroke="${LIGHT}" stroke-width="0.7" stroke-dasharray="14 4 2 4"/>`;
    g += `<circle cx="${f1(px.X(x))}" cy="${f1(px.Y(-2.3) - 12)}" r="12" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><text x="${f1(px.X(x))}" y="${f1(px.Y(-2.3) - 8)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}">${i + 1}</text>`;
  });
  ys.forEach((y, i) => {
    g += `<line x1="${f1(px.X(-2.3))}" y1="${f1(px.Y(y))}" x2="${f1(px.X(W + 0.4))}" y2="${f1(px.Y(y))}" stroke="${LIGHT}" stroke-width="0.7" stroke-dasharray="14 4 2 4"/>`;
    g += `<circle cx="${f1(px.X(-2.3) - 12)}" cy="${f1(px.Y(y))}" r="12" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><text x="${f1(px.X(-2.3) - 12)}" y="${f1(px.Y(y) + 4)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}">${letters[i] ?? ""}</text>`;
  });

  // ---- outdoor areas (drawn under the walls)
  if (isGround) {
    if (site.T > 0) {
      g += rect(0, D, W, site.T, `fill="#ebe4d6"`) + rect(0, D, W, site.T, `fill="url(#p-paving)" stroke="${MID}" stroke-width="0.8"`);
      const label = level.veranda ? "PERGOLA TERRACE" : level.canopy ? "COVERED TERRACE" : "TERRACE";
      g += text(W * 0.5 + (site.deck ? site.deck.w / 2 : 0) / 2, D + site.T / 2 + 0.15, label);
    }
    if (site.deck) {
      const { deck, pool } = site;
      g += rect(deck.x, deck.y, deck.w, deck.h, `fill="#ebe4d6"`) + rect(deck.x, deck.y, deck.w, deck.h, `fill="url(#p-paving)" stroke="${MID}" stroke-width="0.8"`);
      g += planPool(px.X(pool.x), px.Y(pool.y), pool.w * s, pool.d * s, `POOL ${pool.w.toFixed(1)} × ${pool.d.toFixed(1)}`);
      // planting bed between the deck and the entrance path
      const [b0, b1] = deck.x < site.entryX ? [deck.x + deck.w + 0.4, site.entryX - 1.0] : [site.entryX + 1.0, deck.x - 0.4];
      if (b1 - b0 >= 2) {
        const bw = Math.min(4, b1 - b0);
        const bx = deck.x < site.entryX ? b0 : b1 - bw;
        g += rect(bx, deck.y + 0.6, bw, deck.h - 1.2, `fill="#dfe2cf" stroke="#7f8a62" stroke-width="0.7" rx="6"`);
        g += planTree(spec.tree, f1(px.X(bx + bw / 2)), f1(px.Y(deck.y + deck.h / 2)), 0.9 * s, hash(plan.slug));
      }
    }
    if (level.veranda) {
      // pergola: posts, beams and rafters over the terrace
      const n = Math.max(3, Math.round(W / 3.2));
      for (let i = 0; i <= n; i++) g += rect((W * i) / n - 0.1, D + site.T - 0.3, 0.2, 0.2, `fill="${INK}"`);
      g += `<line x1="${f1(px.X(0))}" y1="${f1(px.Y(D + site.T - 0.2))}" x2="${f1(px.X(W))}" y2="${f1(px.Y(D + site.T - 0.2))}" stroke="${INK}" stroke-width="1.2"/>`;
      for (let x = 0.4; x < W; x += 0.8) g += `<line x1="${f1(px.X(x))}" y1="${f1(px.Y(D))}" x2="${f1(px.X(x))}" y2="${f1(px.Y(D + site.T - 0.05))}" stroke="${MID}" stroke-width="0.6" stroke-dasharray="4 3"/>`;
    }
    if (level.canopy) {
      // roof edge of the cantilevered canopy and its columns
      g += rect(-1.6, D, W + 3.2, site.T, `fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="12 4 3 4"`);
      const n = Math.max(3, Math.round((W + 2.4) / 3.6));
      for (let i = 0; i <= n; i++) g += `<circle cx="${f1(px.X(-1.2 + ((W + 2.4) * i) / n))}" cy="${f1(px.Y(D + site.T - 0.35))}" r="${f1(0.09 * s + 1)}" fill="${INK}"/>`;
      g += text(W / 2, D + site.T + 0.75, "LINE OF ROOF OVER", 9);
    }
    if (garage) {
      g += rect(W + 0.2, D, garage.w - 0.4, 3, `fill="#e6e0d4"`) + rect(W + 0.2, D, garage.w - 0.4, 3, `fill="url(#p-setts)" stroke="${MID}" stroke-width="0.7"`);
      g += text(W + garage.w / 2, D + 1.9, "DRIVEWAY", 9);
    }
    // upper terrace / balcony line
    const upper = model.levels[1]?.terrace;
    if (upper) {
      g += `<path d="M${f1(px.X(upper.x0))} ${f1(px.Y(D))} V${f1(px.Y(D + upper.depth))} H${f1(px.X(upper.x1))} V${f1(px.Y(D))}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-dasharray="10 5"/>`;
      g += `<text x="${f1(px.X(upper.x0) + 6)}" y="${f1(px.Y(D + upper.depth) - 5)}" font-family="${FONT}" font-size="9" letter-spacing="1.5" fill="${MID}">${upper.label} ABOVE</text>`;
    }
  } else if (level.terrace) {
    const t = level.terrace;
    g += rect(t.x0, D, t.x1 - t.x0, t.depth, `fill="#ebe4d6"`) + rect(t.x0, D, t.x1 - t.x0, t.depth, `fill="url(#p-paving)" stroke="${MID}" stroke-width="0.8"`);
    // frameless glass balustrade
    g += `<path d="M${f1(px.X(t.x0))} ${f1(px.Y(D))} V${f1(px.Y(D + t.depth))} H${f1(px.X(t.x1))} V${f1(px.Y(D))}" fill="none" stroke="#7fa3ad" stroke-width="3.2"/>`;
    g += `<path d="M${f1(px.X(t.x0))} ${f1(px.Y(D))} V${f1(px.Y(D + t.depth))} H${f1(px.X(t.x1))} V${f1(px.Y(D))}" fill="none" stroke="${INK}" stroke-width="0.6"/>`;
    g += text((t.x0 + t.x1) / 2, D + t.depth / 2 + 0.15, t.label);
    g += `<text x="${f1(px.X(t.x1) + 6)}" y="${f1(px.Y(D + t.depth) + 12)}" font-family="${FONT}" font-size="9" letter-spacing="1.5" fill="${MID}">GLASS BALUSTRADE h=1.10</text>`;
  }

  // ---- walls: poché footprint, then cut out clear room areas
  g += rect(0, 0, W, D, `fill="${INK}"`);
  for (const sp of level.spaces) {
    const inn = inner(model, sp);
    g += rect(inn.x, inn.y, inn.w, inn.h, `fill="${PAPER}"`);
  }
  // garage (attached on the right)
  if (garage) {
    const gx = W;
    const gy = D - garage.d;
    g += rect(gx, gy, garage.w, garage.d, `fill="${INK}"`);
    g += rect(gx + INT / 2, gy + EXT, garage.w - EXT - INT / 2, garage.d - EXT, `fill="${PAPER}"`);
    g += rect(gx + 0.4, D - EXT - 0.02, garage.w - 0.8, EXT + 0.04, `fill="${PAPER}"`);
    g += `<line x1="${f1(px.X(gx + 0.4))}" y1="${f1(px.Y(D - EXT / 2))}" x2="${f1(px.X(gx + garage.w - 0.4))}" y2="${f1(px.Y(D - EXT / 2))}" stroke="${INK}" stroke-width="0.8" stroke-dasharray="6 3"/>`;
    const cars = garage.w > 5 ? 2 : 1;
    for (let i = 0; i < cars; i++) {
      const cx = gx + (garage.w - cars * 1.9 - (cars - 1) * 0.9) / 2 + i * 2.8;
      g += rect(cx, gy + 0.9, 1.9, 4.7, `rx="${f1(0.4 * s)}" fill="none" stroke="${MID}" stroke-width="0.9" stroke-dasharray="5 3"`);
    }
    g += `<text x="${f1(px.X(gx + garage.w / 2))}" y="${f1(px.Y(gy + 0.62))}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="1.6" fill="${INK}">GARAGE</text>`;
    g += `<text x="${f1(px.X(gx + garage.w / 2))}" y="${f1(px.Y(gy + 0.62) + 13)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${MID}">${((garage.w - EXT) * (garage.d - EXT)).toFixed(1)} m²</text>`;
  }

  // ---- openings
  const spaceById = Object.fromEntries(level.spaces.map((sp) => [sp.id, sp]));
  for (const win of level.windows) {
    const sp = spaceById[win.space];
    if (!sp || !isExterior(model, sp, win.side)) continue;
    const seg = sideSegment(sp, win.side);
    const len = seg.horizontal ? sp.w : sp.h;
    const w = Math.min(win.w, len - 0.6);
    const c = win.at * len;
    if (seg.horizontal) {
      const x0 = sp.x + c - w / 2;
      const yOuter = win.side === "top" ? 0 : D - EXT;
      g += `<rect x="${f1(px.X(x0))}" y="${f1(px.Y(yOuter) - 0.5)}" width="${f1(w * s)}" height="${f1(EXT * s + 1)}" fill="${PAPER}"/>`;
      g += rect(x0, yOuter, w, EXT, `fill="none" stroke="${INK}" stroke-width="0.9"`);
      g += `<line x1="${f1(px.X(x0))}" y1="${f1(px.Y(yOuter + EXT / 2))}" x2="${f1(px.X(x0 + w))}" y2="${f1(px.Y(yOuter + EXT / 2))}" stroke="${INK}" stroke-width="1.3"/>`;
      if (win.w > 50) {
        // sliding glass wall: mullions every ~2.4 m
        const n = Math.max(2, Math.round(w / 2.4));
        for (let i = 1; i < n; i++) g += `<line x1="${f1(px.X(x0 + (w * i) / n))}" y1="${f1(px.Y(yOuter))}" x2="${f1(px.X(x0 + (w * i) / n))}" y2="${f1(px.Y(yOuter + EXT))}" stroke="${INK}" stroke-width="1.2"/>`;
      }
    } else {
      const y0 = sp.y + c - w / 2;
      const xOuter = win.side === "left" ? 0 : W - EXT;
      g += `<rect x="${f1(px.X(xOuter) - 0.5)}" y="${f1(px.Y(y0))}" width="${f1(EXT * s + 1)}" height="${f1(w * s)}" fill="${PAPER}"/>`;
      g += rect(xOuter, y0, EXT, w, `fill="none" stroke="${INK}" stroke-width="0.9"`);
      g += `<line x1="${f1(px.X(xOuter + EXT / 2))}" y1="${f1(px.Y(y0))}" x2="${f1(px.X(xOuter + EXT / 2))}" y2="${f1(px.Y(y0 + w))}" stroke="${INK}" stroke-width="1.3"/>`;
    }
  }
  for (const d of level.doors) {
    const sp = spaceById[d.space];
    if (!sp) continue;
    const ext = isExterior(model, sp, d.side);
    const t = ext ? EXT : INT;
    const seg = sideSegment(sp, d.side);
    const len = seg.horizontal ? sp.w : sp.h;
    const w = d.w > 50 ? len - 0.9 : Math.min(d.w, len - 0.3);
    const c = Math.min(Math.max(d.at * len, w / 2 + 0.15), len - w / 2 - 0.15);
    if (seg.horizontal) {
      const x0 = sp.x + c - w / 2;
      const wy = ext ? (d.side === "top" ? 0 : D - EXT) : seg.y1 - INT / 2;
      g += `<rect x="${f1(px.X(x0))}" y="${f1(px.Y(wy) - 1)}" width="${f1(w * s)}" height="${f1(t * s + 2)}" fill="${PAPER}"/>`;
      if (!d.open) {
        const into = d.side === "top" ? 1 : -1; // swing into the space
        const hy = d.side === "top" ? wy + t : wy;
        g += `<line x1="${f1(px.X(x0))}" y1="${f1(px.Y(hy))}" x2="${f1(px.X(x0))}" y2="${f1(px.Y(hy + into * w))}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${f1(px.X(x0))} ${f1(px.Y(hy + into * w))} A${f1(w * s)} ${f1(w * s)} 0 0 ${into > 0 ? 0 : 1} ${f1(px.X(x0 + w))} ${f1(px.Y(hy))}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
      if (d.entry) {
        const ay = D + (site.T > 0 ? site.T : 0) + 1.1;
        g += `<path d="M${f1(px.X(x0 + w / 2))} ${f1(px.Y(ay))} v${f1(-0.8 * s)} m-6 8 l6 -8 l6 8" fill="none" stroke="${ACCENT}" stroke-width="1.4"/><text x="${f1(px.X(x0 + w / 2))}" y="${f1(px.Y(ay + 0.45))}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${ACCENT}">ENTRANCE</text>`;
      }
    } else {
      const y0 = sp.y + c - w / 2;
      const wx = ext ? (d.side === "left" ? 0 : W - EXT) : seg.x1 - INT / 2;
      g += `<rect x="${f1(px.X(wx) - 1)}" y="${f1(px.Y(y0))}" width="${f1(t * s + 2)}" height="${f1(w * s)}" fill="${PAPER}"/>`;
      if (!d.open) {
        const into = d.side === "left" ? 1 : -1;
        const hx = d.side === "left" ? wx + t : wx;
        g += `<line x1="${f1(px.X(hx))}" y1="${f1(px.Y(y0))}" x2="${f1(px.X(hx + into * w))}" y2="${f1(px.Y(y0))}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${f1(px.X(hx + into * w))} ${f1(px.Y(y0))} A${f1(w * s)} ${f1(w * s)} 0 0 ${into > 0 ? 1 : 0} ${f1(px.X(hx))} ${f1(px.Y(y0 + w))}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
    }
  }

  // ---- furniture + room tags (numbers match the room schedule, sheet A-401)
  const pen = svgPen(s, px);
  for (const sp of level.spaces) g += furniture(pen, sp.kind, inner(model, sp));
  const roomNo = Object.fromEntries(schedules(model).rooms.filter((r) => r.level === levelIndex).map((r) => [r.id, r.no]));
  for (const sp of level.spaces) {
    if (sp.kind === "stair") continue;
    const inn = inner(model, sp);
    const area = (inn.w * inn.h).toFixed(1);
    const cx = px.X(inn.x + inn.w / 2);
    let cy = px.Y(inn.y + inn.h / 2);
    if (sp.kind === "master" || sp.kind === "bedroom") cy = px.Y(inn.y + Math.min(inn.h - 0.5, 2.6 + (inn.h - 2.6) / 2));
    if (sp.kind === "open") cy = px.Y(inn.y + inn.h * 0.3);
    if (sp.kind === "living") cy = px.Y(inn.y + inn.h * 0.8);
    if (sp.kind === "kitchen") cy = px.Y(inn.y + inn.h * 0.36);
    if (sp.kind === "dining") cy = px.Y(inn.y + 0.75);
    const fs = inn.w * s < 90 ? 9 : 11;
    const label = inn.w * s < 70 && sp.label.length > 8 ? sp.label.split(/[ -]/)[0] : sp.label;
    const tw = label.length * fs * 0.68 + 16;
    g += `<rect x="${f1(cx - tw / 2)}" y="${f1(cy - fs - 4)}" width="${f1(tw)}" height="${fs * 2 + 14}" fill="${PAPER}" fill-opacity=".92"/>`;
    g += `<text x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="600" letter-spacing="1.2" fill="${INK}">${label}</text>`;
    g += `<text x="${f1(cx)}" y="${f1(cy + fs + 5)}" text-anchor="middle" font-family="${FONT}" font-size="${fs - 1}" fill="${MID}">${roomNo[sp.id]} · ${area} m²</text>`;
  }
  // finished floor level tag
  const ffl = levelIndex === 0 ? "±0.000" : `+${(levelIndex * STOREY).toFixed(3)}`;
  const hall = level.spaces.find((sp) => sp.kind === "hall") ?? level.spaces[0];
  const hin = inner(model, hall);
  g += `<g transform="translate(${f1(px.X(hin.x + hin.w / 2))} ${f1(px.Y(hin.y + hin.h * 0.82))})" font-family="${FONT}" font-size="9" fill="${INK}">
    <circle r="6" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/><path d="M-6 0H6M0 -6V6" stroke="${INK}" stroke-width="0.8"/>
    <path d="M0 -6A6 6 0 0 1 6 0H0Z M0 6A6 6 0 0 1 -6 0H0Z" fill="${INK}"/>
    <text x="10" y="3">FFL ${ffl}</text></g>`;

  // ---- dimension chains: detailed at 0.9 m, overall at 1.6 m
  const back = level.spaces.filter((sp) => sp.y < 0.01).flatMap((sp) => [sp.x, sp.x + sp.w]);
  g += dimChain([...new Set([0, W, ...back].map(r1))].sort((a, b) => a - b), -0.9, s, ox, oy, true, 1);
  g += dimChain([0, W, ...(garage ? [W + garage.w] : [])], -1.6, s, ox, oy, true, 1);
  const left = level.spaces.filter((sp) => sp.x < 0.01).flatMap((sp) => [sp.y, sp.y + sp.h]);
  g += dimChain([...new Set([0, D, ...left].map(r1))].sort((a, b) => a - b), -0.9, s, ox, oy, false);
  g += dimChain([0, D], -1.6, s, ox, oy, false);

  const gia = level.spaces.reduce((sum, sp) => sum + (sp.kind === "void" ? 0 : inner(model, sp).w * inner(model, sp).h), 0);
  g += sheetTitle(level.name, `${plan.title.en.toUpperCase()} · NET INTERNAL AREA ${gia.toFixed(1)} m² · DIMENSIONS IN METRES`);
  g += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
  return sheet({ plan, drawing: level.name, sheetNo, scaleNote: "GRAPHIC SCALE", body: g, defs: materialDefs(s, hash(plan.slug)), north: true });
}

// ------------------------------------------------------------------ site plan sheet

export function sitePlanSheet(model, sheetNo) {
  const { W, D, plan, spec, site } = model;
  const gW = model.garage?.w ?? 0;
  const gD = model.garage?.d ?? 0;
  const frontDepth = D + Math.max(site.T, site.deck ? site.T + site.deck.h : 0);
  const plot = { x0: -6, y0: -8, x1: Math.ceil(W + gW + 6), y1: Math.ceil(frontDepth + 7) };
  const road = 7;
  const PW = plot.x1 - plot.x0;
  const PD = plot.y1 - plot.y0;
  const areaW = SHEET_W - 330 - 36 - 120;
  const areaH = SHEET_H - 72 - 170;
  const s = Math.min(areaW / (PW + 4), areaH / (PD + road + 3), 34);
  const ox = 36 + 60 + (areaW - (PW + 4) * s) / 2 + 3 * s - plot.x0 * s;
  const oy = 36 + 30 + (areaH - (PD + road + 3) * s) / 2 + 2.4 * s - plot.y0 * s;
  const X = (m) => f1(ox + m * s);
  const Y = (m) => f1(oy + m * s);
  const rect = (x, y, w, h, extra) => `<rect x="${X(x)}" y="${Y(y)}" width="${f1(w * s)}" height="${f1(h * s)}" ${extra}/>`;
  const label = (x, y, str, size = 10, fill = MID) => `<text x="${X(x)}" y="${Y(y)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" letter-spacing="2" fill="${fill}">${str}</text>`;
  const seed = hash(plan.slug);
  const rand = rng(seed);
  let g = "";

  // road + pavement
  g += rect(plot.x0 - 3, plot.y1 + 1.6, PW + 6, road - 1.6, `fill="#d9d5cd"`);
  g += rect(plot.x0 - 3, plot.y1, PW + 6, 1.6, `fill="#e7e2d8" stroke="${MID}" stroke-width="0.6"`);
  g += `<line x1="${X(plot.x0 - 3)}" y1="${Y(plot.y1 + 1.6 + (road - 1.6) / 2)}" x2="${X(plot.x1 + 3)}" y2="${Y(plot.y1 + 1.6 + (road - 1.6) / 2)}" stroke="#ffffff" stroke-width="2" stroke-dasharray="18 12"/>`;
  g += label((plot.x0 + plot.x1) / 2, plot.y1 + road - 0.9, "ACCESS ROAD", 11, INK);

  // lawn + boundary hedge
  g += rect(plot.x0, plot.y0, PW, PD, `fill="#e3e5d4"`) + rect(plot.x0, plot.y0, PW, PD, `fill="url(#p-grass)"`);
  g += `<path d="M${X(plot.x0 + 0.4)} ${Y(plot.y1 - 0.2)} V${Y(plot.y0 + 0.4)} H${X(plot.x1 - 0.4)} V${Y(plot.y1 - 0.2)}" fill="none" stroke="#9aa57f" stroke-width="${f1(0.8 * s)}" stroke-linejoin="round" stroke-opacity=".75"/>`;

  // shadow cast by the house (sun from the south-west)
  const sh = model.H * 0.28;
  const shadow = (x0, y0, w, h) => `<polygon points="${X(x0)},${Y(y0 + h)} ${X(x0)},${Y(y0)} ${X(x0 + sh * 0.8)},${Y(y0 - sh)} ${X(x0 + w + sh * 0.8)},${Y(y0 - sh)} ${X(x0 + w + sh * 0.8)},${Y(y0 + h - sh)} ${X(x0 + w)},${Y(y0 + h)}" fill="${INK}" fill-opacity=".13"/>`;
  g += shadow(0, 0, W, D);
  if (model.garage) g += shadow(W, D - gD, gW, gD);

  // hard landscaping: terrace, deck + pool, driveway, entrance path
  if (site.T > 0) g += rect(0, D, W, site.T, `fill="#ebe4d6"`) + rect(0, D, W, site.T, `fill="url(#p-paving)" stroke="${MID}" stroke-width="0.6"`);
  if (site.deck) {
    const { deck, pool } = site;
    g += rect(deck.x, deck.y, deck.w, deck.h, `fill="#ebe4d6"`) + rect(deck.x, deck.y, deck.w, deck.h, `fill="url(#p-paving)" stroke="${MID}" stroke-width="0.6"`);
    g += planPool(X(pool.x), Y(pool.y), pool.w * s, pool.d * s, "POOL");
  }
  const pathW = 1.6;
  const pathTop = D + site.T;
  g += rect(site.entryX - pathW / 2, pathTop, pathW, plot.y1 - pathTop, `fill="#ebe4d6" stroke="${MID}" stroke-width="0.6"`) + rect(site.entryX - pathW / 2, pathTop, pathW, plot.y1 - pathTop, `fill="url(#p-paving)"`);
  if (model.garage) {
    g += rect(W + 0.2, D, gW - 0.4, plot.y1 + 1.6 - D, `fill="#e1dbcf" stroke="${MID}" stroke-width="0.6"`) + rect(W + 0.2, D, gW - 0.4, plot.y1 + 1.6 - D, `fill="url(#p-setts)"`);
    g += label(W + gW / 2, (D + plot.y1) / 2 + 1, "DRIVEWAY", 9);
  }

  // ---- roof plan
  const roofCol = spec.roof === "terracotta" ? "#d9a283" : spec.roof === "seam" ? "#8d9195" : "#ebe6dc";
  const ov = model.roofOv;
  if (plan.roof === "flat") {
    const fo = spec.canopy ?? spec.slab ?? 0.2;
    const sideOv = spec.canopy ? 1.6 : 0.3;
    g += rect(-sideOv, -0.3, W + 2 * sideOv, D + 0.3 + fo, `fill="${roofCol}" stroke="${INK}" stroke-width="1.6"`);
    g += rect(-sideOv + 0.35, 0.05, W + 2 * sideOv - 0.7, D - 0.1 + fo - 0.3, `fill="none" stroke="${MID}" stroke-width="0.7"`);
    for (const [dx, dy] of [[0.25, 0.3], [0.75, 0.3], [0.25, 0.75], [0.75, 0.75]]) g += `<circle cx="${X(W * dx)}" cy="${Y(D * dy)}" r="3" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
    if (spec.roofTerrace) g += rect(W * 0.12, D * 0.15, W * 0.55, D * 0.6, `fill="#e6dfd2" stroke="#7fa3ad" stroke-width="2.2"`) + rect(W * 0.12, D * 0.15, W * 0.55, D * 0.6, `fill="url(#p-paving)"`) + label(W * 0.395, D * 0.47, "ROOF TERRACE", 9, INK);
    g += label(W / 2, D * (spec.roofTerrace ? 0.88 : 0.52), `FLAT ROOF  +${(model.wallTop + 0.45).toFixed(2)}`, 10, INK);
  } else {
    const x0 = -ov, x1 = W + ov, y0 = -ov, y1 = D + ov;
    const poly = (pts, fill, pat) => `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="${fill}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` + (pat ? `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="url(#${pat})"/>` : "");
    if (plan.roof === "hip") {
      const a = Math.min(D / 2, W / 2);
      const r0 = [a, D / 2], r1p = [W - a, D / 2];
      g += poly([[x0, y0], [x1, y0], r1p, r0], shade(roofCol, -0.12), "p-roofh");
      g += poly([[x1, y0], [x1, y1], r1p], shade(roofCol, -0.05), "p-roofv");
      g += poly([[x0, y1], [x1, y1], r1p, r0], roofCol, "p-roofh");
      g += poly([[x0, y0], r0, [x0, y1]], shade(roofCol, -0.18), "p-roofv");
    } else if (plan.roof === "gable") {
      g += poly([[x0, y0], [x1, y0], [x1, D / 2], [x0, D / 2]], shade(roofCol, -0.12), "p-roofh");
      g += poly([[x0, D / 2], [x1, D / 2], [x1, y1], [x0, y1]], roofCol, "p-roofh");
    } else if (plan.roof === "frontgable") {
      g += poly([[x0, y0], [W / 2, y0], [W / 2, y1], [x0, y1]], shade(roofCol, -0.15), "p-roofv");
      g += poly([[W / 2, y0], [x1, y0], [x1, y1], [W / 2, y1]], roofCol, "p-roofv");
    }
    if (spec.chimney) g += rect(W * 0.7, D * 0.42, 0.9, 0.9, `fill="#c9b08b" stroke="${INK}" stroke-width="1"`);
    if (level0(model).veranda) g += rect(-0.2, D, W + 0.4, site.T, `fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="6 3"`);
    g += `<rect x="${X(W / 2) - 52}" y="${Y(D * 0.5) - 9}" width="104" height="18" fill="${PAPER}" fill-opacity=".85"/><text x="${X(W / 2)}" y="${Y(D * 0.5) + 4}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${INK}">RIDGE +${model.H.toFixed(2)}</text>`;
  }
  if (model.garage) {
    const gy = D - gD;
    if (spec.roof === "terracotta") {
      g += `<polygon points="${X(W)},${Y(gy - 0.4)} ${X(W + gW + 0.4)},${Y(gy - 0.4)} ${X(W + gW + 0.4)},${Y(D + 0.4)} ${X(W)},${Y(D + 0.4)}" fill="${shade(roofCol, -0.06)}" stroke="${INK}" stroke-width="1.2"/>`;
      g += rect(W, gy - 0.4, gW + 0.4, gD + 0.8, `fill="url(#p-roofh)"`);
    } else {
      g += rect(W, gy, gW, gD, `fill="${roofCol}" stroke="${INK}" stroke-width="1.4"`);
    }
    g += label(W + gW / 2, gy + gD / 2 + 0.2, "GARAGE", 9, INK);
  }

  // ---- soft landscaping: trees
  const trees = [];
  const add = (x, y, r) => {
    if (x < plot.x0 + r * 0.6 || x > plot.x1 - r * 0.6 || y < plot.y0 + r * 0.6 || y > plot.y1 - r * 0.6) return;
    const clash = (ax, ay, aw, ah) => x + r > ax && x - r < ax + aw && y + r > ay && y - r < ay + ah;
    if (clash(-1, -1, W + gW + 2, D + 1.4)) return;
    if (site.deck && clash(site.deck.x - 0.3, site.deck.y - 0.3, site.deck.w + 0.6, site.deck.h + 0.6)) return;
    if (site.T && clash(0, D, W, site.T)) return;
    if (clash(site.entryX - 1.3, D, 2.6, plot.y1 - D)) return;
    if (model.garage && clash(W, D - 1, gW + 0.4, plot.y1 - D + 1)) return;
    if (trees.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < (tr + r) * 0.8)) return;
    trees.push([x, y, r]);
  };
  if (spec.tree === "cypress") {
    for (let x = plot.x0 + 1.4; x < plot.x1 - 1; x += 2.2) add(x, plot.y0 + 1.5, 0.75);
    for (let y = plot.y0 + 4; y < plot.y1 - 2; y += 2.2) add(plot.x0 + 1.5, y, 0.75);
  }
  const big = spec.tree === "palm" ? 1.7 : spec.tree === "cypress" ? 2.0 : 2.3;
  for (let i = 0; i < 60 && trees.length < 18; i++) {
    const edge = rand();
    const x = edge < 0.5 ? plot.x0 + 1.5 + rand() * 4 : edge < 0.75 ? plot.x1 - 1.5 - rand() * 4 : plot.x0 + rand() * PW;
    const y = edge < 0.75 ? plot.y0 + rand() * PD : plot.y0 + 1.5 + rand() * 4;
    add(x, y, big * (0.8 + rand() * 0.4));
  }
  trees.forEach(([x, y, r], i) => (g += planTree(spec.tree === "cypress" && r < 1 ? "cypress" : spec.tree === "cypress" ? "olive" : spec.tree, X(x), Y(y), r * s, seed + i)));

  // ---- plot boundary, setbacks and dimensions
  g += rect(plot.x0, plot.y0, PW, PD, `fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="22 5 4 5"`);
  for (const [x, y] of [[plot.x0, plot.y0], [plot.x1, plot.y0], [plot.x1, plot.y1], [plot.x0, plot.y1]]) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`;
  g += dimChain([plot.x0, 0, W + gW, plot.x1], plot.y0 - 1.4, s, ox, oy, true, 1);
  g += dimChain([plot.y0, 0, D, plot.y1], plot.x0 - 1.4, s, ox, oy, false);
  g += label(site.entryX, plot.y1 + 1.15, "ENTRY", 9, ACCENT);
  g += `<path d="M${X(site.entryX)} ${Y(plot.y1 + 0.8)} V${Y(plot.y1 - 0.4)} m-5 7 l5 -7 l5 7" fill="none" stroke="${ACCENT}" stroke-width="1.3"/>`;

  // site schedule
  const footprint = W * D + gW * gD;
  const plotArea = PW * PD;
  const rows = [["PLOT (INDICATIVE)", `${PW.toFixed(0)} × ${PD.toFixed(0)} m · ${plotArea.toFixed(0)} m²`], ["BUILT FOOTPRINT", `${footprint.toFixed(0)} m²`], ["SITE COVERAGE", `${((footprint / plotArea) * 100).toFixed(0)} %`], ["GROSS FLOOR AREA", `${plan.areaM2} m²`]];
  g += sheetTitle("SITE PLAN", `${plan.title.en.toUpperCase()} · ${rows.map(([k, v]) => `${k} ${v}`).slice(1, 3).join(" · ")}`);
  g += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
  const schedule = `<text x="${SHEET_W - 330 + 28}" y="${492}" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${MID}">SITE SCHEDULE</text>` + rows.map(([k, v], i) => `<text x="${SHEET_W - 330 + 28}" y="${530 + i * 44}" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${MID}">${k}</text><text x="${SHEET_W - 330 + 28}" y="${548 + i * 44}" font-family="${FONT}" font-size="14" font-weight="500" fill="${INK}">${esc(v)}</text>`).join("");
  return sheet({ plan, drawing: "SITE PLAN", sheetNo, scaleNote: "GRAPHIC SCALE", body: g + schedule, defs: materialDefs(s, seed), north: true });
}

const level0 = (model) => model.levels[0];

// ------------------------------------------------------------------ elevation (rendered)

function elevTree(kind, x, X, Y, s, seed, scale = 1) {
  const rand = rng(seed);
  const stroke = `stroke="${INK}" stroke-opacity=".45" stroke-width="0.8"`;
  const blob = (cx, cz, rx, rz, n, fill, op = 0.88) => {
    let d = "";
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.88 + rand() * 0.12;
      const px = X(cx + Math.cos(a) * rx * k), py = Y(cz + Math.sin(a) * rz * k);
      if (i === 0) d += `M${f1(px)} ${f1(py)}`;
      else {
        const am = a - Math.PI / n;
        d += ` Q${f1(X(cx + Math.cos(am) * rx * 1.14))} ${f1(Y(cz + Math.sin(am) * rz * 1.14))} ${f1(px)} ${f1(py)}`;
      }
    }
    return `<path d="${d} Z" fill="${fill}" fill-opacity="${op}" ${stroke}/>`;
  };
  switch (kind) {
    case "cypress": {
      const h = (7.5 + rand() * 2) * scale, w = 0.65 * scale;
      let o = `<rect x="${f1(X(x - 0.08))}" y="${f1(Y(0.6))}" width="${f1(0.16 * s)}" height="${f1(0.6 * s)}" fill="#4a3b2c"/>`;
      o += `<path d="M${f1(X(x))} ${f1(Y(h))} C${f1(X(x + w * 0.9))} ${f1(Y(h * 0.75))} ${f1(X(x + w * 1.1))} ${f1(Y(h * 0.3))} ${f1(X(x + w * 0.45))} ${f1(Y(0.45))} L${f1(X(x - w * 0.45))} ${f1(Y(0.45))} C${f1(X(x - w * 1.1))} ${f1(Y(h * 0.3))} ${f1(X(x - w * 0.9))} ${f1(Y(h * 0.75))} ${f1(X(x))} ${f1(Y(h))} Z" fill="#56633f" fill-opacity=".92" ${stroke}/>`;
      for (let i = 0; i < 7; i++) {
        const z = 1 + rand() * (h - 2.4);
        const dx = (rand() - 0.5) * w;
        o += `<path d="M${f1(X(x + dx - 0.15))} ${f1(Y(z))} q${f1(0.15 * s)} ${f1(-0.35 * s)} ${f1(0.3 * s)} 0" fill="none" stroke="#3c4630" stroke-width="0.8"/>`;
      }
      return o;
    }
    case "pine": {
      const h = (9 + rand() * 2) * scale;
      let o = `<rect x="${f1(X(x - 0.12))}" y="${f1(Y(1.2))}" width="${f1(0.24 * s)}" height="${f1(1.2 * s)}" fill="#4a3b2c"/>`;
      for (let i = 0; i < 5; i++) {
        const z0 = 0.9 + (i * (h - 1.2)) / 5.4;
        const half = (1.9 - i * 0.32) * scale;
        o += `<path d="M${f1(X(x - half))} ${f1(Y(z0))} L${f1(X(x))} ${f1(Y(z0 + (h - 1.2) / 2.6))} L${f1(X(x + half))} ${f1(Y(z0))} Z" fill="#46553a" fill-opacity=".94" ${stroke}/>`;
      }
      return o;
    }
    case "palm": {
      const h = (7 + rand() * 1.8) * scale, lean = (rand() - 0.5) * 0.9;
      const tx = x + lean, tz = h;
      let o = `<path d="M${f1(X(x - 0.18))} ${f1(Y(0))} Q${f1(X(x + lean * 0.2))} ${f1(Y(h * 0.5))} ${f1(X(tx - 0.12))} ${f1(Y(tz))} L${f1(X(tx + 0.12))} ${f1(Y(tz))} Q${f1(X(x + lean * 0.2 + 0.3))} ${f1(Y(h * 0.5))} ${f1(X(x + 0.18))} ${f1(Y(0))} Z" fill="#8a7458" ${stroke}/>`;
      for (let z = 0.6; z < h - 0.3; z += 0.45) o += `<line x1="${f1(X(x - 0.15 + (lean * z) / h))}" y1="${f1(Y(z))}" x2="${f1(X(x + 0.15 + (lean * z) / h))}" y2="${f1(Y(z))}" stroke="#5e4c37" stroke-width="0.7"/>`;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + (i / 8) * 0.9);
        const len = (2.4 + rand() * 0.6) * scale;
        const ex = tx + Math.cos(a) * len * (i % 2 ? 1 : 0.9), ez = tz + Math.sin(a) * len * 0.45 - (Math.abs(Math.cos(a)) > 0.6 ? 0.9 : 0);
        const cx = tx + Math.cos(a) * len * 0.5, cz = tz + Math.sin(a) * len * 0.75;
        o += `<path d="M${f1(X(tx))} ${f1(Y(tz))} Q${f1(X(cx))} ${f1(Y(cz + 0.35))} ${f1(X(ex))} ${f1(Y(ez))} Q${f1(X(cx))} ${f1(Y(cz - 0.15))} ${f1(X(tx))} ${f1(Y(tz))} Z" fill="#5f6d45" fill-opacity=".92" ${stroke}/>`;
      }
      return o;
    }
    case "round": {
      const h = 2.4 * scale;
      return `<rect x="${f1(X(x - 0.1))}" y="${f1(Y(h + 0.5))}" width="${f1(0.2 * s)}" height="${f1((h + 0.5) * s)}" fill="#4a3b2c"/>` + blob(x, h + 1.8 * scale, 1.9 * scale, 1.9 * scale, 12, "#7f8d5f");
    }
    default: {
      // olive: twisted trunk + broad, airy crown
      const h = 2.2 * scale;
      let o = `<path d="M${f1(X(x - 0.25))} ${f1(Y(0))} C${f1(X(x - 0.1))} ${f1(Y(h * 0.5))} ${f1(X(x + 0.35))} ${f1(Y(h * 0.6))} ${f1(X(x + 0.2))} ${f1(Y(h + 0.2))} L${f1(X(x + 0.45))} ${f1(Y(h + 0.2))} C${f1(X(x + 0.6))} ${f1(Y(h * 0.5))} ${f1(X(x + 0.15))} ${f1(Y(h * 0.4))} ${f1(X(x + 0.25))} ${f1(Y(0))} Z" fill="#6b5a46" ${stroke}/>`;
      o += blob(x + 0.3, h + 1.4 * scale, 2.6 * scale, 1.45 * scale, 14, "#93a079", 0.85);
      o += blob(x - 0.6 * scale, h + 1.0 * scale, 1.2 * scale, 0.8 * scale, 9, "#7f8d66", 0.7);
      o += blob(x + 1.3 * scale, h + 1.9 * scale, 1.1 * scale, 0.75 * scale, 9, "#a3ae8a", 0.7);
      return o;
    }
  }
}

function shrubs(X, Y, s, x0, x1, seed) {
  const rand = rng(seed);
  let o = "";
  for (let x = x0; x < x1; x += 0.9 + rand() * 0.5) {
    const rx = 0.45 + rand() * 0.3, rz = 0.35 + rand() * 0.3;
    o += `<ellipse cx="${f1(X(x))}" cy="${f1(Y(rz * 0.8))}" rx="${f1(rx * s)}" ry="${f1(rz * s)}" fill="${rand() > 0.5 ? "#8e9b72" : "#a1ab84"}" fill-opacity=".9" stroke="${INK}" stroke-opacity=".35" stroke-width="0.7"/>`;
  }
  return o;
}

export function elevationSheet(model, sheetNo, bare = false) {
  const { W, plan, above, spec, wallTop, H } = model;
  const garage = model.garage;
  const gW = garage ? garage.w : 0;
  const totalW = W + gW;
  const below = model.basement ? 4.6 : 2.4;
  const topRoom = bare ? 1.0 : 3.4;
  const leftPad = 4.8, rightPad = bare ? 5.2 : 6.6;
  const areaW = bare ? COVER_W - 120 : SHEET_W - 330 - 36 - 60;
  const areaH = bare ? COVER_H - 150 : SHEET_H - 72 - 170;
  const spanW = totalW + leftPad + rightPad;
  const spanH = H + topRoom + below;
  const s = Math.min(areaW / spanW, areaH / spanH, bare ? 80 : 60);
  const ox = (bare ? 60 : 36 + 40) + (areaW - spanW * s) / 2 + leftPad * s;
  const gy = (bare ? 75 : 36 + 50) + (areaH - spanH * s) / 2 + (H + topRoom) * s;
  const X = (m) => +(ox + m * s).toFixed(1);
  const Y = (m) => +(gy - m * s).toFixed(1);
  const seed = hash(plan.slug);
  const marks = new Map(); // material key -> sample point [x, z] for callouts
  const mark = (key, x, z) => { if (!marks.has(key)) marks.set(key, [x, z]); };

  const box = (x, z, w, h, fill, extra = "") => `<rect x="${X(x)}" y="${Y(z + h)}" width="${f1(w * s)}" height="${f1(h * s)}" fill="${fill}" ${extra}/>`;
  const mat = (key, x, z, w, h, extra = `stroke="${INK}" stroke-width="1.2"`) => {
    const m = MAT[key];
    return box(x, z, w, h, m.fill, extra) + (m.pattern ? box(x, z, w, h, `url(#p-${m.pattern})`) : "");
  };
  const matPoly = (key, pts, extra = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) => {
    const m = MAT[key];
    const p = pts.map(([x, z]) => `${X(x)},${Y(z)}`).join(" ");
    return `<polygon points="${p}" fill="${m.fill}" ${extra}/>` + (m.pattern ? `<polygon points="${p}" fill="url(#p-${m.pattern})"/>` : "");
  };
  const frame = MAT[spec.frame].fill;

  /** A glazed opening; arch = semicircular head. */
  const glazing = (x, w, z, h, { arch = false, shutters = null, bars = false, recess = true } = {}) => {
    let o = "";
    const outline = arch
      ? `M${X(x)} ${Y(z)} V${Y(z + h - w / 2)} A${f1((w / 2) * s)} ${f1((w / 2) * s)} 0 0 1 ${X(x + w)} ${Y(z + h - w / 2)} V${Y(z)} Z`
      : `M${X(x)} ${Y(z)} V${Y(z + h)} H${X(x + w)} V${Y(z)} Z`;
    o += `<path d="${outline}" fill="url(#glass)"/>`;
    // reflections
    o += `<path d="M${X(x + w * 0.12)} ${Y(z + h * 0.1)} L${X(x + w * 0.42)} ${Y(z + h * (arch ? 0.6 : 0.9))} M${X(x + w * 0.3)} ${Y(z + h * 0.08)} L${X(x + w * 0.5)} ${Y(z + h * 0.55)}" stroke="#ffffff" stroke-opacity=".22" stroke-width="${f1(Math.max(1.2, 0.08 * s))}"/>`;
    if (recess && !arch) o += box(x, z + h - 0.16, w, 0.16, INK, `fill-opacity=".28"`) + box(x, z, 0.1, h - 0.16, INK, `fill-opacity=".16"`);
    // mullions / glazing bars
    const pane = spec.glassy ? 1.6 : 0.85;
    const n = Math.max(1, Math.round(w / pane));
    const top = arch ? z + h - w / 2 : z + h;
    for (let i = 1; i < n; i++) o += box(x + (w * i) / n - 0.03, z, 0.06, top - z, frame);
    if (bars) for (let zz = z + 0.55; zz < top - 0.2; zz += 0.55) o += box(x, zz, w, 0.03, frame);
    if (!spec.glassy && !arch && h > 1.6) o += box(x, z + h * 0.72, w, 0.05, frame);
    o += `<path d="${outline}" fill="none" stroke="${frame}" stroke-width="${f1(Math.max(1.4, 0.07 * s))}"/>`;
    if (!spec.glassy) o += box(x - 0.08, z - 0.07, w + 0.16, 0.07, "#e8e0d1", `stroke="${INK}" stroke-width="0.8"`);
    if (shutters) {
      const sw = Math.min(w / 2, 0.75);
      for (const sx of [x - sw - 0.04, x + w + 0.04]) {
        o += box(sx, z, sw, h - (arch ? w / 4 : 0), MAT[shutters].fill, `stroke="${INK}" stroke-width="0.9"`);
        for (let zz = z + 0.12; zz < z + h - (arch ? w / 4 : 0) - 0.08; zz += 0.12) o += `<line x1="${X(sx + 0.06)}" y1="${Y(zz)}" x2="${X(sx + sw - 0.06)}" y2="${Y(zz)}" stroke="${INK}" stroke-opacity=".35" stroke-width="0.6"/>`;
      }
      mark(shutters, x + w + 0.04 + sw / 2, z + h / 2);
    }
    mark(spec.frame, x + 0.02, z + h * 0.35);
    mark("glass", x + w * 0.62, z + h * 0.45);
    return o;
  };

  let back = "";
  let g = "";
  let front = "";

  // ---- ground: earth + basement
  g += box(-leftPad + 0.3, -below + 1.5, totalW + leftPad + rightPad - 0.6, below - 1.5, "url(#p-earth)");
  g += `<line x1="${X(-leftPad + 0.3)}" y1="${Y(0)}" x2="${X(totalW + rightPad - 0.3)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2.4"/>`;
  if (model.basement) {
    g += box(0, -3.2, W, 3.2, PAPER, `stroke="${INK}" stroke-width="1.2" stroke-dasharray="10 6"`);
    g += `<text x="${X(W / 2)}" y="${Y(-1.75)}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${MID}">LOWER LEVEL −3.30 · SPA · CINEMA · OPENS TO REAR GARDEN</text>`;
  }

  // ---- background trees (behind the house)
  if (!["cypress"].includes(spec.tree)) back += elevTree(spec.tree, W * 0.78, X, Y, s, seed + 3, 1.15);
  else back += elevTree("cypress", W * 0.82, X, Y, s, seed + 3, 1.25) + elevTree("cypress", W * 0.9, X, Y, s, seed + 4, 1.1);

  // ---- garage
  if (garage) {
    const gh = 3.1;
    const gm = wallMat(spec, 0);
    g += mat(gm, W, 0, gW, gh, `stroke="${INK}" stroke-width="1.6"`);
    const dw = gW - 0.9, dh = 2.4;
    if (spec.garageDoor === "wood" || spec.garageDoor === "teak") {
      g += box(W + 0.45, 0, dw, dh, spec.garageDoor === "teak" ? "#a77a4f" : "#94693f", `stroke="${INK}" stroke-width="1.2"`);
      for (let z = 0.16; z < dh; z += 0.16) g += `<line x1="${X(W + 0.45)}" y1="${Y(z)}" x2="${X(W + 0.45 + dw)}" y2="${Y(z)}" stroke="#4e3420" stroke-opacity=".45" stroke-width="0.7"/>`;
      mark(spec.garageDoor === "teak" ? "teak" : "wood", W + 0.45 + dw * 0.7, dh * 0.5);
    } else {
      g += box(W + 0.45, 0, dw, dh, "#55483b", `stroke="${INK}" stroke-width="1.2"`);
      for (let z = 0.6; z < dh; z += 0.6) g += `<line x1="${X(W + 0.45)}" y1="${Y(z)}" x2="${X(W + 0.45 + dw)}" y2="${Y(z)}" stroke="#2a221b" stroke-width="0.8"/>`;
    }
    g += box(W + 0.45, dh - 0.2, dw, 0.2, INK, `fill-opacity=".25"`);
    if (spec.roof === "terracotta") {
      g += matPoly("terracotta", [[W - 0.2, gh], [W + gW + 0.5, gh], [W + gW - 1.2, gh + 1.0], [W, gh + 1.0]]);
      g += box(W, gh - 0.4, gW, 0.4, INK, `fill-opacity=".16"`);
    } else {
      g += box(W - 0.1, gh, gW + 0.5, 0.35, MAT.render.fill, `stroke="${INK}" stroke-width="1.4"`);
      g += box(W, gh - 0.45, gW, 0.45, "url(#shadeDown)");
    }
  }

  // ---- walls per storey
  for (let li = 0; li < above; li++) {
    const key = wallMat(spec, li);
    g += mat(key, 0, li * STOREY, W, STOREY, `stroke="${INK}" stroke-width="1.6"`);
  }
  // modern: travertine-clad fin around the entrance hall
  if (spec.fin) {
    const hall = model.levels[0].spaces.find((sp) => sp.id === "hall");
    const fx = hall ? hall.x + hall.w - 1.0 : W * 0.7;
    g += mat(spec.fin, fx, 0, 1.3, wallTop + 0.9, `stroke="${INK}" stroke-width="1.4"`);
    g += box(fx + 1.3, 0, 0.12, wallTop + 0.9, INK, `fill-opacity=".2"`);
    mark(spec.fin, fx + 0.65, wallTop * 0.62);
  }
  // timber cladding around the duplex entrances
  if (spec.timberEntry) {
    for (const d of entryDoors(model.levels[0])) {
      g += mat("timber", d.x - 0.7, 0, d.w + 1.4, STOREY - 0.2, `stroke="${INK}" stroke-width="1.2"`);
      mark("timber", d.x - 0.35, 1.6);
    }
  }

  // ---- openings, per storey (front facade = plan bottom edge)
  const openings = [];
  model.levels.forEach((lv, li) => {
    if (li >= above) return;
    const z0 = li * STOREY;
    for (const w of frontWindows(model, lv)) {
      const living = ["open", "living", "kitchen", "dining"].includes(w.kind);
      if (spec.loggia && li === 0 && living) continue; // arcade drawn separately
      const glassy = spec.glassy;
      const sill = glassy ? 0.05 : living && li === 0 ? 0.05 : li > 0 && spec.ironBalcony ? 0.05 : 0.9;
      const head = glassy ? STOREY - 0.42 : spec.arches ? 2.75 : 2.45;
      g += glazing(w.x, w.w, z0 + sill, head - sill, { arch: spec.arches && w.w <= 2.6, shutters: spec.shutters && w.w <= 2.4 ? spec.shutters : null, bars: !glassy });
      openings.push({ x: w.x, w: w.w, z: z0 + sill, h: head - sill, li });
      if (spec.ironBalcony && li > 0) {
        // French balcony in wrought iron
        const bx = w.x - 0.25, bw = w.w + 0.5;
        g += box(bx - 0.05, z0 - 0.05, bw + 0.1, 0.14, "#e7dfd0", `stroke="${INK}" stroke-width="0.9"`);
        g += box(bx, z0 + 0.95, bw, 0.05, MAT.iron.fill);
        for (let x = bx + 0.06; x < bx + bw; x += 0.12) g += `<line x1="${X(x)}" y1="${Y(z0 + 0.09)}" x2="${X(x)}" y2="${Y(z0 + 0.95)}" stroke="${MAT.iron.fill}" stroke-width="0.9"/>`;
        mark("iron", bx + bw * 0.8, z0 + 0.6);
      }
    }
    if (li === 0) {
      for (const d of entryDoors(lv)) {
        const dh = spec.glassy ? STOREY - 0.42 : 2.6;
        g += box(d.x - 0.08, 0, d.w + 0.16, dh + 0.08, frame);
        g += box(d.x, 0, d.w, dh, spec.frame === "wood" || spec.timberEntry ? "#7c5a3e" : "#5a4c3f", `stroke="${INK}" stroke-width="1"`);
        for (let z = 0.25; z < dh; z += 0.25) g += `<line x1="${X(d.x + 0.06)}" y1="${Y(z)}" x2="${X(d.x + d.w - 0.06)}" y2="${Y(z)}" stroke="#3a2a1c" stroke-opacity=".35" stroke-width="0.6"/>`;
        g += box(d.x + d.w * 0.82, 0.95, 0.04, 0.7, "#d7c6a3");
        if (spec.glassy) g += box(d.x - 0.6, 0, 0.45, dh, "url(#glass)", `stroke="${frame}" stroke-width="1.2"`);
        if (!spec.slab && !spec.canopy && !spec.loggia && !spec.pergola && plan.roof !== "frontgable") {
          g += box(d.x - 0.5, dh + 0.12, d.w + 1.0, 0.16, frame);
          g += box(d.x - 0.5, dh - 0.3, d.w + 1.0, 0.42, INK, `fill-opacity=".14"`);
        }
      }
    }
  });

  // ---- Tuscan loggia: arcade across the living rooms
  if (spec.loggia) {
    const liv = model.levels[0].spaces.filter((sp) => ["living", "open"].includes(sp.kind) && Math.abs(sp.y + sp.h - model.D) < 0.01);
    for (const sp of liv) {
      const n = Math.max(2, Math.round(sp.w / 2.9));
      const bay = sp.w / n;
      for (let i = 0; i < n; i++) {
        const ax = sp.x + i * bay + 0.38, aw = bay - 0.76, ah = 3.0;
        const p = `M${X(ax)} ${Y(0)} V${Y(ah - aw / 2)} A${f1((aw / 2) * s)} ${f1((aw / 2) * s)} 0 0 1 ${X(ax + aw)} ${Y(ah - aw / 2)} V${Y(0)} Z`;
        g += `<path d="${p}" fill="url(#loggiaShade)" stroke="${INK}" stroke-width="1.4"/>`;
        // French doors seen through the arch
        g += box(ax + aw * 0.2, 0, aw * 0.6, 2.3, "url(#glass)", `stroke="${frame}" stroke-width="1.2" opacity=".75"`);
        g += box(ax + aw * 0.5 - 0.02, 0, 0.04, 2.3, frame);
        // voussoirs
        for (let k = 0; k <= 8; k++) {
          const a = Math.PI - (k / 8) * Math.PI;
          const cx = ax + aw / 2, cz = ah - aw / 2;
          g += `<line x1="${X(cx + Math.cos(a) * aw / 2)}" y1="${Y(cz + Math.sin(a) * aw / 2)}" x2="${X(cx + Math.cos(a) * (aw / 2 + 0.32))}" y2="${Y(cz + Math.sin(a) * (aw / 2 + 0.32))}" stroke="${INK}" stroke-opacity=".45" stroke-width="0.8"/>`;
        }
      }
      g += box(sp.x, 3.32, sp.w, 0.18, "#e8dcc6", `stroke="${INK}" stroke-width="0.9"`);
    }
  }

  // ---- storey bands, terraces and balconies
  for (let f = 1; f < above; f++) {
    if (spec.glassy) g += box(-0.05, f * STOREY - 0.35, W + 0.1, 0.35, MAT.render.fill, `stroke="${INK}" stroke-width="1.1"`);
    else g += box(-0.08, f * STOREY - 0.12, W + 0.16, 0.18, "#e9dfcc", `stroke="${INK}" stroke-width="0.9"`);
  }
  const terrace = model.levels[1]?.terrace;
  if (terrace) {
    const { x0, x1 } = terrace;
    const z = STOREY;
    g += box(x0 - 0.1, z - 0.4, x1 - x0 + 0.2, 0.4, spec.balcony ? "#6c5240" : MAT.render.fill, `stroke="${INK}" stroke-width="1.3"`);
    g += box(x0, z - 0.4 - Math.min(1.1, terrace.depth * 0.55), x1 - x0, Math.min(1.1, terrace.depth * 0.55), "url(#shadeDown)");
    front += box(x0, z, x1 - x0, 1.1, MAT.balustrade.fill, `fill-opacity=".38" stroke="#7fa3ad" stroke-width="1"`);
    front += box(x0, z + 1.06, x1 - x0, 0.05, "#9fb9c0");
    front += `<line x1="${X(x0 + 0.4)}" y1="${Y(z + 0.15)}" x2="${X(x0 + 1.0)}" y2="${Y(z + 1.0)}" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>`;
    mark("balustrade", x1 - 0.8, z + 0.7);
  }

  // ---- coastal: teak louvre screens on the upper floor
  if (spec.louvres && above > 1) {
    const x0 = W * 0.5, x1 = W * 0.78;
    front += mat("teak", x0, STOREY, x1 - x0, STOREY - 0.42, `stroke="${INK}" stroke-width="1.2"`);
    mark("teak", x0 + 0.5, STOREY + 1.8);
  }

  // ---- roofs
  if (plan.roof === "flat") {
    const fo = spec.canopy ? 1.6 : spec.slab ? Math.min(0.9, spec.slab * 0.4) : 0.15;
    const th = spec.canopy ? 0.5 : 0.4;
    // shadow cast by the slab on the facade below it
    const shadowH = Math.min(1.5, (spec.canopy ?? spec.slab ?? 0.2) * 0.65);
    g += box(0, wallTop - shadowH, W, shadowH, "url(#shadeDown)");
    g += box(-fo, wallTop, W + 2 * fo, th, MAT.render.fill, `stroke="${INK}" stroke-width="1.8"`);
    g += box(-fo, wallTop + th - 0.06, W + 2 * fo, 0.06, INK, `fill-opacity=".35"`);
    mark("render", -fo + 0.8, wallTop + th / 2);
    if (spec.roofTerrace) {
      g += box(W * 0.12, wallTop + th, W * 0.55, 1.05, MAT.balustrade.fill, `fill-opacity=".38" stroke="#7fa3ad" stroke-width="1"`);
      g += box(W * 0.72, wallTop + th, 2.6, 2.5, MAT.render.fill, `stroke="${INK}" stroke-width="1.4"`);
      mark("balustrade", W * 0.6, wallTop + th + 0.6);
    }
  } else if (plan.roof === "hip") {
    const ov = model.roofOv, a = Math.min(model.D / 2, W / 2);
    const ez = wallTop - ov * 0.45;
    if (spec.chimney) back += mat("ashlar", W * 0.7, wallTop, 0.9, H - wallTop + 0.9) + box(W * 0.7 - 0.12, H + 0.9, 1.14, 0.18, "#cdb894", `stroke="${INK}" stroke-width="1"`);
    g += box(0, wallTop - 0.55, W, 0.55, "url(#shadeDown)");
    g += matPoly("terracotta", [[-ov, ez], [W + ov, ez], [W - a, H], [a, H]]);
    g += box(-ov - 0.05, ez - 0.14, W + 2 * ov + 0.1, 0.16, "#e8dfcf", `stroke="${INK}" stroke-width="1.1"`);
    mark("terracotta", W * 0.4, (ez + H) / 2);
  } else if (plan.roof === "gable") {
    const ov = model.roofOv;
    const ez = wallTop - ov * 0.5;
    if (spec.chimney) back += mat("rubble", W * 0.25, wallTop, 0.9, H - wallTop + 1.0) + box(W * 0.25 - 0.12, H + 1.0, 1.14, 0.18, "#cdb894", `stroke="${INK}" stroke-width="1"`);
    g += box(0, wallTop - 0.55, W, 0.55, "url(#shadeDown)");
    g += matPoly("terracotta", [[-ov, ez], [W + ov, ez], [W + ov, H], [-ov, H]]);
    g += box(-ov - 0.05, H - 0.02, W + 2 * ov + 0.1, 0.14, "#9a5a3c", `stroke="${INK}" stroke-width="1"`);
    g += box(-ov - 0.05, ez - 0.14, W + 2 * ov + 0.1, 0.16, "#e8dfcf", `stroke="${INK}" stroke-width="1.1"`);
    mark("terracotta", W * 0.55, (ez + H) / 2);
  } else if (plan.roof === "frontgable") {
    const ov = model.roofOv, k = 0.84;
    const ez = wallTop - ov * k;
    // gable wall (timber) with a fully glazed triangle
    g += matPoly(wallMat(spec, above - 1), [[0, wallTop], [W, wallTop], [W / 2, wallTop + (W / 2) * k]]);
    const inset = 0.9;
    const gz = wallTop + 0.1, top = wallTop + (W / 2 - inset) * k;
    g += `<polygon points="${X(inset)},${Y(gz)} ${X(W - inset)},${Y(gz)} ${X(W / 2)},${Y(top)}" fill="url(#glass)" stroke="${frame}" stroke-width="2"/>`;
    for (let i = 1; i < 5; i++) {
      const x = inset + ((W - 2 * inset) * i) / 5;
      const zt = gz + (W / 2 - inset - Math.abs(x - W / 2)) * k;
      g += `<line x1="${X(x)}" y1="${Y(gz)}" x2="${X(x)}" y2="${Y(zt)}" stroke="${frame}" stroke-width="1.6"/>`;
    }
    // roof: rake fascias with standing-seam edge
    const t = 0.42;
    g += matPoly("seam", [[-ov, ez], [W / 2, H], [W + ov, ez], [W + ov, ez + t], [W / 2, H + t], [-ov, ez + t]]);
    g += `<polygon points="${X(-ov)},${Y(ez)} ${X(W / 2)},${Y(H)} ${X(W + ov)},${Y(ez)} ${X(W + ov - 0.5)},${Y(ez - 0.25)} ${X(W / 2)},${Y(H - 0.65)} ${X(-ov + 0.5)},${Y(ez - 0.25)}" fill="${INK}" fill-opacity=".2"/>`;
    mark("seam", W * 0.22, ez + (W / 2 * 0.44) * k + t / 2);
  }

  // ---- pavilion: slender steel columns under the canopy
  if (spec.canopy) {
    const n = Math.max(3, Math.round((W + 2.4) / 3.6));
    for (let i = 0; i <= n; i++) {
      const cx = -1.2 + ((W + 2.4) * i) / n;
      front += box(cx - 0.07, 0, 0.14, wallTop, MAT.steel.fill);
    }
    mark("steel", -1.2 + (W + 2.4) / n, wallTop * 0.4);
  }
  // ---- farmhouse: oak pergola with vines
  if (spec.pergola) {
    const n = Math.max(3, Math.round(W / 3.2));
    const pz = 2.85;
    for (let i = 0; i <= n; i++) front += box((W * i) / n - 0.11, 0, 0.22, pz, MAT.pergola.fill, `stroke="${INK}" stroke-width="0.9"`);
    front += box(-0.4, pz, W + 0.8, 0.26, MAT.pergola.fill, `stroke="${INK}" stroke-width="1"`);
    for (let x = -0.3; x < W + 0.4; x += 0.6) front += box(x, pz + 0.26, 0.1, 0.16, "#6e4f36");
    const rand = rng(seed + 11);
    for (let x = 0; x < W; x += 0.35) {
      if (rand() < 0.35) continue;
      front += `<ellipse cx="${X(x)}" cy="${Y(pz + 0.25 - rand() * 0.5)}" rx="${f1((0.25 + rand() * 0.25) * s)}" ry="${f1((0.18 + rand() * 0.15) * s)}" fill="${rand() > 0.5 ? "#7d8b5c" : "#97a275"}" fill-opacity=".9" stroke="${INK}" stroke-opacity=".3" stroke-width="0.6"/>`;
    }
    mark("pergola", W * 0.5 / n, 1.4);
  }

  // ---- terrace plinth / steps
  if (model.site.T > 0 || model.site.deck) {
    front += box(-0.3, 0, W + 0.6, 0.18, "#e7dccb", `stroke="${INK}" stroke-width="1"`);
  }

  // ---- wall material sample points (on solid wall, clear of openings)
  for (let li = 0; li < above; li++) {
    const key = wallMat(spec, li);
    const z = li * STOREY + 1.6;
    const ops = openings.filter((o) => o.li === li);
    const candidates = [0.6, W - 0.6, W * 0.5, W * 0.3, W * 0.85];
    const x = candidates.find((cx) => !ops.some((o) => cx > o.x - 0.3 && cx < o.x + o.w + 0.3)) ?? 0.6;
    mark(key, x, z);
  }

  // ---- foreground trees and planting
  const t = spec.tree;
  front += elevTree(t, -2.6, X, Y, s, seed + 1, t === "cypress" ? 1.05 : 1);
  if (t === "cypress") front += elevTree("olive", -4.2, X, Y, s, seed + 2, 0.85);
  front += elevTree(t, totalW + 2.4, X, Y, s, seed + 5, t === "cypress" ? 0.95 : 0.92);
  if (t === "cypress" || t === "palm") front += elevTree(t, totalW + 3.8, X, Y, s, seed + 6, 0.8);
  front += shrubs(X, Y, s, -1.4, 0.4, seed + 7) + shrubs(X, Y, s, totalW - 0.2, totalW + 1.6, seed + 8);

  let out = back + g + front;

  if (!bare) {
    // level markers
    const lx = X(totalW + rightPad - 1.9);
    const levelsZ = [...(model.basement ? [-3.3] : []), 0, ...Array.from({ length: above - 1 }, (_, i) => (i + 1) * STOREY), plan.roof === "flat" ? wallTop + 0.45 : H];
    levelsZ.forEach((z) => {
      out += `<g font-family="${FONT}" font-size="11" fill="${INK}"><line x1="${lx - 30}" y1="${Y(z)}" x2="${lx + 70}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.7" stroke-dasharray="${z === 0 ? "none" : "6 3"}"/>
        <path d="M${lx} ${Y(z)} l-7 -10 h14 z" fill="${z === 0 ? INK : "none"}" stroke="${INK}" stroke-width="0.9"/>
        <text x="${lx + 12}" y="${Y(z) - 5}">${z === 0 ? "±0.00" : `${z > 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}`}</text></g>`;
    });
    // overall dimension
    out += dimChain([0, W, ...(garage ? [W + garage.w] : [])], below - 0.7, s, ox, gy, true, -1);
    // material callouts: numbered tags above the building, leaders to sample points
    const keys = [...marks.keys()].filter((k) => MAT[k]);
    const pts = keys.map((k) => ({ k, p: marks.get(k) })).sort((a, b) => a.p[0] - b.p[0]);
    const tagZ = H + topRoom - 1.0;
    const span = totalW + 2;
    pts.forEach((it, i) => {
      const tx = -1 + (span * (i + 0.5)) / pts.length;
      const n = keys.indexOf(it.k) + 1;
      out += `<line x1="${X(it.p[0])}" y1="${Y(it.p[1])}" x2="${X(tx)}" y2="${Y(tagZ) + 11}" stroke="${INK}" stroke-width="0.7"/>`;
      out += `<circle cx="${X(it.p[0])}" cy="${Y(it.p[1])}" r="2.6" fill="${INK}"/>`;
      out += `<circle cx="${X(tx)}" cy="${Y(tagZ)}" r="11" fill="${PAPER}" stroke="${INK}" stroke-width="1"/><text x="${X(tx)}" y="${Y(tagZ) + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="${INK}">${n}</text>`;
    });
    const defs = materialDefs(s, seed);
    out += sheetTitle("SOUTH ELEVATION", `${plan.title.en.toUpperCase()} · ${STYLE_EN[plan.style]} · LEVELS IN METRES ABOVE FINISHED GROUND FLOOR`);
    out += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
    const legend = keys.map((k) => ({ fill: MAT[k].fill === "#7f949f" ? "url(#glass)" : MAT[k].fill, pattern: MAT[k].pattern ? `p-${MAT[k].pattern}` : null, label: MAT[k].label }));
    legend.title = "MATERIALS";
    return sheet({ plan, drawing: "SOUTH ELEVATION", sheetNo, scaleNote: "GRAPHIC SCALE", body: out, defs, north: false, legend });
  }
  return bareSvg(out, materialDefs(s, seed));
}

// ------------------------------------------------------------------ axonometric (coloured massing)

export function axonometricSheet(model, sheetNo) {
  const { W, D, plan, above, spec, wallTop, H, site } = model;
  // isometric; b = depth measured from the front facade toward the back
  const c30 = Math.cos(Math.PI / 6);
  const proj = (x, b, z) => [x * c30 - b * c30, -(x * 0.5) - b * 0.5 - z];

  const gW = model.garage ? model.garage.w : 0;
  const frontB = -(Math.max(site.T, site.deck ? site.T + site.deck.h : 0) + 0.6);
  const pts = [];
  for (const [x, b, z] of [[-2.5, frontB - 1, 0], [W + gW + 2.5, frontB - 1, 0], [-2.5, D + 2.5, 0], [W + gW + 2.5, D + 2.5, 0], [-1.6, 0, H + 1], [W + gW, D, H + 1], [-1.6, D, H + 1], [W + gW, 0, H + 1]]) pts.push(proj(x, b, z));
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const areaW = SHEET_W - 330 - 36 - 140;
  const areaH = SHEET_H - 72 - 190;
  const s = Math.min(areaW / (maxX - minX), areaH / (maxY - minY));
  const ox = 36 + 70 + (areaW - (maxX - minX) * s) / 2 - minX * s;
  const oy = 36 + 70 + (areaH - (maxY - minY) * s) / 2 - minY * s;
  const P = (x, b, z) => {
    const [u, v] = proj(x, b, z);
    return `${(ox + u * s).toFixed(1)},${(oy + v * s).toFixed(1)}`;
  };
  const poly = (points, fill, extra = "") =>
    `<polygon points="${points.join(" ")}" fill="${fill}" ${extra.includes('stroke="') ? "" : `stroke="${INK}"`} ${extra.includes("stroke-width") ? "" : 'stroke-width="1.1"'} stroke-linejoin="round" ${extra}/>`;
  const GLASS = "#4a5961";
  const colours = (key) => {
    const base = MAT[key].fill;
    return { front: base, side: shade(base, -0.16), top: shade(base, 0.25) };
  };

  let g = "";
  // ground plate
  g += `<polygon points="${[P(-2.5, frontB - 1, 0), P(W + gW + 2.5, frontB - 1, 0), P(W + gW + 2.5, D + 2.5, 0), P(-2.5, D + 2.5, 0)].join(" ")}" fill="#e6e7d8" fill-opacity=".8"/>`;
  for (let x = -2; x <= W + gW + 2; x += 1) g += `<polyline points="${P(x, frontB - 1, 0)} ${P(x, D + 2.5, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.4" stroke-opacity=".6"/>`;
  for (let b = Math.ceil(frontB - 1); b <= D + 2; b += 1) g += `<polyline points="${P(-2.5, b, 0)} ${P(W + gW + 2.5, b, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.4" stroke-opacity=".6"/>`;
  // soft shadow toward the north-east
  g += `<polygon points="${[P(0, 0, 0), P(W + gW + 2.6, 2.2, 0), P(W + gW + 2.6, D + 2.2, 0), P(0, D, 0)].join(" ")}" fill="${INK}" fill-opacity=".1"/>`;

  // deck + pool (plan y -> b = D - y)
  const B = (y) => D - y;
  if (site.T > 0) g += poly([P(0, 0, 0), P(W, 0, 0), P(W, B(D + site.T), 0), P(0, B(D + site.T), 0)], "#e8dfcf", 'stroke-width="0.6"');
  if (site.deck) {
    const { deck, pool } = site;
    g += poly([P(deck.x, B(deck.y), 0), P(deck.x + deck.w, B(deck.y), 0), P(deck.x + deck.w, B(deck.y + deck.h), 0), P(deck.x, B(deck.y + deck.h), 0)], "#e8dfcf", 'stroke-width="0.6"');
    g += poly([P(pool.x, B(pool.y), 0), P(pool.x + pool.w, B(pool.y), 0), P(pool.x + pool.w, B(pool.y + pool.d), 0), P(pool.x, B(pool.y + pool.d), 0)], "#8fbcc2", 'stroke-width="0.9"');
  }

  const box = (x0, x1, b0, b1, z0, z1, c, top = true) => {
    let o = poly([P(x0, b0, z0), P(x1, b0, z0), P(x1, b0, z1), P(x0, b0, z1)], c.front);
    o += poly([P(x0, b0, z0), P(x0, b1, z0), P(x0, b1, z1), P(x0, b0, z1)], c.side);
    if (top) o += poly([P(x0, b0, z1), P(x1, b0, z1), P(x1, b1, z1), P(x0, b1, z1)], c.top);
    return o;
  };
  const frontWin = (x, w, z, h) => poly([P(x, 0, z), P(x + w, 0, z), P(x + w, 0, z + h), P(x, 0, z + h)], GLASS, 'stroke-width="0.7"') + `<polyline points="${P(x + w * 0.15, 0, z + h * 0.2)} ${P(x + w * 0.45, 0, z + h * 0.85)}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>`;
  const sideWin = (b, w, z, h) => poly([P(0, b, z), P(0, b + w, z), P(0, b + w, z + h), P(0, b, z + h)], shade(GLASS, -0.2), 'stroke-width="0.7"');

  // garage first (it sits to the right, behind the house's silhouette)
  if (model.garage) {
    const c = colours(wallMat(spec, 0));
    g += box(W, W + gW, 0, model.garage.d, 0, 3.1, c);
    g += poly([P(W + 0.45, 0, 0), P(W + gW - 0.45, 0, 0), P(W + gW - 0.45, 0, 2.4), P(W + 0.45, 0, 2.4)], spec.garageDoor === "bronze" ? "#55483b" : "#94693f", 'stroke-width="0.7"');
    if (spec.roof === "terracotta") g += poly([P(W, -0.4, 3.1), P(W + gW + 0.4, -0.4, 3.1), P(W + gW - 0.8, model.garage.d / 2, 4.0), P(W + 0.6, model.garage.d / 2, 4.0)], MAT.terracotta.fill);
    else g += box(W - 0.1, W + gW + 0.3, -0.3, model.garage.d + 0.2, 3.1, 3.45, colours("render"));
  }
  // storeys
  for (let li = 0; li < above; li++) {
    const c = colours(wallMat(spec, li));
    g += box(0, W, 0, D, li * STOREY, (li + 1) * STOREY, c, li === above - 1 && plan.roof === "flat");
  }
  // gable wall of the front-gable chalet
  if (plan.roof === "frontgable") g += poly([P(0, 0, wallTop), P(W, 0, wallTop), P(W / 2, 0, wallTop + (W / 2) * 0.84)], colours(wallMat(spec, above - 1)).front);
  // fin, windows, doors
  if (spec.fin) {
    const hall = model.levels[0].spaces.find((sp) => sp.id === "hall");
    const fx = hall ? hall.x + hall.w - 1.0 : W * 0.7;
    g += box(fx, fx + 1.3, -0.25, 1.2, 0, wallTop + 0.9, colours(spec.fin));
  }
  model.levels.forEach((lv, li) => {
    if (li >= above) return;
    for (const w of lv.windows) {
      const sp = lv.spaces.find((x) => x.id === w.space);
      if (!sp) continue;
      const living = ["open", "living", "kitchen", "dining"].includes(sp.kind);
      const sill = spec.glassy || (living && li === 0) ? 0.05 : 0.9;
      const head = spec.glassy ? STOREY - 0.42 : 2.5;
      if (w.side === "bottom" && Math.abs(sp.y + sp.h - D) < 0.01) {
        const ww = Math.min(w.w, sp.w - 0.6);
        g += frontWin(sp.x + w.at * sp.w - ww / 2, ww, li * STOREY + sill, head - sill);
      }
      if (w.side === "left" && sp.x < 0.01) {
        const ww = Math.min(w.w, sp.h - 0.6);
        const bFromFront = D - (sp.y + w.at * sp.h) - ww / 2;
        g += sideWin(bFromFront, ww, li * STOREY + sill, head - sill);
      }
    }
    if (li === 0) for (const d of entryDoors(lv)) g += poly([P(d.x, 0, 0), P(d.x + d.w, 0, 0), P(d.x + d.w, 0, 2.6), P(d.x, 0, 2.6)], "#7c5a3e", 'stroke-width="0.8"');
  });
  if (plan.roof === "frontgable") {
    const inset = 0.9;
    g += poly([P(inset, 0, wallTop + 0.1), P(W - inset, 0, wallTop + 0.1), P(W / 2, 0, wallTop + (W / 2 - inset) * 0.84)], GLASS, 'stroke-width="0.8"');
  }
  if (spec.louvres && above > 1) {
    for (let x = W * 0.5; x < W * 0.78; x += 0.22) g += `<polyline points="${P(x, -0.08, STOREY)} ${P(x, -0.08, wallTop - 0.42)}" fill="none" stroke="${MAT.teak.fill}" stroke-width="2"/>`;
  }
  // upper terrace slab + glass balustrade
  const terrace = model.levels[1]?.terrace;
  if (terrace) {
    const { x0, x1, depth } = terrace;
    g += box(x0, x1, -depth, 0, STOREY - 0.4, STOREY, colours(spec.balcony ? "timber" : "render"));
    g += poly([P(x0, -depth, STOREY), P(x1, -depth, STOREY), P(x1, -depth, STOREY + 1.1), P(x0, -depth, STOREY + 1.1)], "#cfe0e6", 'fill-opacity=".45" stroke="#7fa3ad" stroke-width="0.9"');
    g += poly([P(x0, -depth, STOREY), P(x0, 0, STOREY), P(x0, 0, STOREY + 1.1), P(x0, -depth, STOREY + 1.1)], "#cfe0e6", 'fill-opacity=".35" stroke="#7fa3ad" stroke-width="0.9"');
  }
  // pergola / canopy columns (in front of the facade)
  if (spec.pergola) {
    const n = Math.max(3, Math.round(W / 3.2));
    const pb = -site.T + 0.2;
    for (let i = 0; i <= n; i++) g += `<polyline points="${P((W * i) / n, pb, 0)} ${P((W * i) / n, pb, 2.85)}" fill="none" stroke="${MAT.pergola.fill}" stroke-width="3"/>`;
    g += `<polyline points="${P(-0.3, pb, 2.95)} ${P(W + 0.3, pb, 2.95)}" fill="none" stroke="${MAT.pergola.fill}" stroke-width="3.4"/>`;
    for (let x = 0; x <= W; x += 0.8) g += `<polyline points="${P(x, pb - 0.2, 3.05)} ${P(x, 0, 3.05)}" fill="none" stroke="#6e4f36" stroke-width="1.6"/>`;
  }
  if (spec.canopy) {
    const n = Math.max(3, Math.round((W + 2.4) / 3.6));
    for (let i = 0; i <= n; i++) {
      const cx = -1.2 + ((W + 2.4) * i) / n;
      g += `<polyline points="${P(cx, -site.T + 0.35, 0)} ${P(cx, -site.T + 0.35, wallTop)}" fill="none" stroke="${MAT.steel.fill}" stroke-width="2.2"/>`;
    }
  }

  // roofs
  if (plan.roof === "flat") {
    const fo = spec.canopy ?? spec.slab ?? 0.2;
    const sideOv = spec.canopy ? 1.6 : 0.3;
    g += box(-sideOv, W + sideOv, -fo, D + 0.3, wallTop, wallTop + (spec.canopy ? 0.5 : 0.4), colours("render"));
    if (spec.roofTerrace) {
      const tb0 = D * 0.25, tb1 = D * 0.85;
      g += poly([P(W * 0.12, tb0, wallTop + 0.4), P(W * 0.67, tb0, wallTop + 0.4), P(W * 0.67, tb0, wallTop + 1.45), P(W * 0.12, tb0, wallTop + 1.45)], "#cfe0e6", 'fill-opacity=".4" stroke="#7fa3ad" stroke-width="0.9"');
      g += box(W * 0.72, W * 0.72 + 2.6, D * 0.3, D * 0.3 + 2.4, wallTop + 0.4, wallTop + 2.9, colours("render"));
      void tb1;
    }
  } else if (plan.roof === "hip") {
    const ov = model.roofOv, a = Math.min(D / 2, W / 2), b2 = W - a, ez = wallTop - ov * 0.45;
    const R = MAT.terracotta.fill;
    g += poly([P(-ov, D + ov, ez), P(W + ov, D + ov, ez), P(b2, D / 2, H), P(a, D / 2, H)], shade(R, 0.1));
    g += poly([P(W + ov, -ov, ez), P(W + ov, D + ov, ez), P(b2, D / 2, H)], shade(R, 0.05));
    g += poly([P(-ov, -ov, ez), P(W + ov, -ov, ez), P(b2, D / 2, H), P(a, D / 2, H)], R);
    g += poly([P(-ov, -ov, ez), P(a, D / 2, H), P(-ov, D + ov, ez)], shade(R, -0.15));
    if (spec.chimney) {
      const cx = W * 0.7, cb = D * 0.42;
      const zr = wallTop + model.rise * Math.min(cb, D - cb, cx, W - cx) / (D / 2);
      g += box(cx, cx + 0.9, cb, cb + 0.9, zr - 0.2, H + 0.9, colours("ashlar"));
    }
  } else if (plan.roof === "gable") {
    const ov = model.roofOv, ez = wallTop - ov * 0.5;
    const R = MAT.terracotta.fill;
    g += poly([P(-ov, D + ov, ez), P(W + ov, D + ov, ez), P(W + ov, D / 2, H), P(-ov, D / 2, H)], shade(R, 0.1));
    g += poly([P(0, 0, wallTop), P(0, D, wallTop), P(0, D / 2, H)], colours(wallMat(spec, 0)).side);
    g += poly([P(-ov, -ov, ez), P(W + ov, -ov, ez), P(W + ov, D / 2, H), P(-ov, D / 2, H)], R);
    if (spec.chimney) g += box(W * 0.25, W * 0.25 + 0.9, D * 0.3, D * 0.3 + 0.9, wallTop + model.rise * 0.55, H + 1.0, colours("rubble"));
  } else if (plan.roof === "frontgable") {
    const ov = model.roofOv, k = 0.84, ez = wallTop - ov * k;
    const R = MAT.seam.fill;
    g += poly([P(W / 2, -ov, H), P(W + ov, -ov, ez), P(W + ov, D + ov, ez), P(W / 2, D + ov, H)], shade(R, 0.18));
    g += poly([P(-ov, -ov, ez), P(W / 2, -ov, H), P(W / 2, D + ov, H), P(-ov, D + ov, ez)], R);
  }
  if (plan.style === "duplex") g += `<polyline points="${P(W / 2, 0, 0)} ${P(W / 2, 0, wallTop + 0.4)}" fill="none" stroke="${INK}" stroke-width="2"/>`;

  g += sheetTitle("AXONOMETRIC VIEW", `${plan.title.en.toUpperCase()} · ${STYLE_EN[plan.style]} · VIEW FROM SOUTH-WEST`);
  return sheet({ plan, drawing: "AXONOMETRIC VIEW", sheetNo, scaleNote: "NTS", body: g, north: false });
}

// ------------------------------------------------------------------ schedules + cover sheet

const FACADE = { top: "N", bottom: "S", left: "W", right: "E" };

function finishFor(style, kind) {
  const stone = ["modern", "minimal", "coastal", "luxury", "pavilion"].includes(style);
  const terracotta = ["tuscan", "farmhouse", "mediterranean"].includes(style);
  switch (kind) {
    case "bath":
    case "shower":
    case "wc":
      return "Porcelain tiles, walls tiled 2.40";
    case "kitchen":
      return stone ? "Honed travertine 60×120" : "Porcelain stoneware 60×60";
    case "stair":
      return "Oak treads, glass balustrade";
    case "store":
      return "Sealed screed";
    case "hall":
      return terracotta ? "Handmade terracotta tiles" : stone ? "Honed travertine 60×120" : "Engineered oak";
    case "living":
    case "dining":
    case "open":
      return stone ? "Honed travertine 60×120" : terracotta ? "Handmade terracotta tiles" : "Engineered oak";
    default:
      return "Engineered oak, underfloor heating";
  }
}

/** Numbered rooms, doors and windows with sizes and finishes — one source for the plans, schedules and CAD. */
export function schedules(model) {
  const { plan, spec, W, D } = model;
  const rooms = [];
  const doors = [];
  const windows = [];
  model.levels.forEach((lv, li) => {
    const byId = Object.fromEntries(lv.spaces.map((sp) => [sp.id, sp]));
    let k = 0;
    for (const sp of lv.spaces) {
      if (sp.kind === "stair") continue;
      const inn = inner(model, sp);
      rooms.push({ no: `${li}.${String(++k).padStart(2, "0")}`, id: sp.id, level: li, name: sp.label, area: inn.w * inn.h, finish: finishFor(plan.style, sp.kind) });
    }
    for (const d of lv.doors) {
      const sp = byId[d.space];
      if (!sp || d.open) continue;
      const len = d.side === "top" || d.side === "bottom" ? sp.w : sp.h;
      const w = Math.min(d.w, len - 0.3);
      doors.push({
        level: li,
        room: sp.label,
        w,
        h: d.entry ? (spec.glassy ? 2.88 : 2.6) : 2.1,
        type: d.entry ? "Entrance door, insulated oak" : sp.kind === "bath" || sp.kind === "wc" || sp.kind === "shower" ? "Internal, single leaf, privacy lock" : "Internal, single leaf, flush oak",
      });
    }
    for (const win of lv.windows) {
      const sp = byId[win.space];
      if (!sp || !isExterior(model, sp, win.side)) continue;
      const len = win.side === "top" || win.side === "bottom" ? sp.w : sp.h;
      const w = Math.min(win.w, len - 0.6);
      const living = ["open", "living", "kitchen", "dining"].includes(sp.kind);
      const sill = spec.glassy || (living && li === 0) ? 0.05 : 0.9;
      const head = spec.glassy ? STOREY - 0.42 : spec.arches ? 2.75 : 2.45;
      const type = win.w > 50 ? "Lift-and-slide glazing, aluminium" : spec.glassy ? "Tilt-and-turn, aluminium, low-E" : spec.arches && w <= 2.6 ? "Arched casement, oak, low-E" : "Casement, oak, low-E";
      windows.push({ level: li, room: sp.label, facade: FACADE[win.side], w, h: head - sill, sill, type });
    }
  });
  if (model.garage) doors.push({ level: 0, room: "GARAGE", w: model.garage.w - 0.9, h: 2.4, type: "Sectional garage door, motorised" });
  doors.forEach((d, i) => (d.no = `D${String(i + 1).padStart(2, "0")}`));
  windows.forEach((w, i) => (w.no = `W${String(i + 1).padStart(2, "0")}`));
  const gea = W * D;
  const areas = model.levels.map((lv, li) => ({
    level: lv.name.replace(" PLAN", ""),
    nia: rooms.filter((r) => r.level === li).reduce((n, r) => n + r.area, 0),
    gea,
  }));
  return { rooms, doors, windows, areas, garageArea: model.garage ? model.garage.w * model.garage.d : 0 };
}

function table(x, y, cols, rows, { title, size = 10.5, rowH = 17 } = {}) {
  let g = "";
  let yy = y;
  if (title) {
    g += `<text x="${x}" y="${yy}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="2" fill="${INK}">${title}</text>`;
    yy += 12;
  }
  const width = cols.reduce((n, c) => n + c.w, 0);
  g += `<line x1="${x}" y1="${yy}" x2="${x + width}" y2="${yy}" stroke="${INK}" stroke-width="1"/>`;
  yy += rowH - 4;
  let cx = x;
  for (const c of cols) {
    g += `<text x="${c.right ? cx + c.w - 4 : cx + 2}" y="${yy}" ${c.right ? 'text-anchor="end"' : ""} font-family="${FONT}" font-size="9" letter-spacing="1.4" fill="${MID}">${c.label}</text>`;
    cx += c.w;
  }
  yy += 6;
  g += `<line x1="${x}" y1="${yy}" x2="${x + width}" y2="${yy}" stroke="${LIGHT}"/>`;
  for (const row of rows) {
    yy += rowH;
    cx = x;
    row.forEach((cell, i) => {
      const c = cols[i];
      const bold = row.bold;
      g += `<text x="${c.right ? cx + c.w - 4 : cx + 2}" y="${yy - 5}" ${c.right ? 'text-anchor="end"' : ""} font-family="${FONT}" font-size="${size}" ${bold ? 'font-weight="600"' : ""} fill="${INK}">${esc(cell)}</text>`;
      cx += c.w;
    });
    g += `<line x1="${x}" y1="${yy}" x2="${x + width}" y2="${yy}" stroke="${LIGHT}" stroke-width="0.6"/>`;
  }
  return { svg: g, bottom: yy };
}

/** A-401: area, room, door and window schedules. */
export function scheduleSheet(model, sheetNo) {
  const { plan } = model;
  const sc = schedules(model);
  let g = "";
  const L = 70;
  const totalNia = sc.areas.reduce((n, a) => n + a.nia, 0);
  const totalGea = sc.areas.reduce((n, a) => n + a.gea, 0);
  const areaRows = sc.areas.map((a) => [a.level, a.nia.toFixed(1), a.gea.toFixed(1)]);
  if (sc.garageArea) areaRows.push(["GARAGE", "—", sc.garageArea.toFixed(1)]);
  const totalRow = ["TOTAL", totalNia.toFixed(1), (totalGea + sc.garageArea).toFixed(1)];
  totalRow.bold = true;
  areaRows.push(totalRow);
  const area = table(L, 84, [{ label: "LEVEL", w: 210 }, { label: "NET INTERNAL m²", w: 130, right: true }, { label: "GROSS EXTERNAL m²", w: 150, right: true }], areaRows, { title: "AREA SCHEDULE" });
  g += area.svg;
  const many = sc.rooms.length > 22;
  const rooms = table(L, area.bottom + 40, [{ label: "NO.", w: 50 }, { label: "ROOM", w: 170 }, { label: "AREA m²", w: 72, right: true }, { label: "FLOOR FINISH", w: 198 }], sc.rooms.map((r) => [r.no, r.name, r.area.toFixed(1), r.finish]), { title: "ROOM SCHEDULE", size: many ? 9.5 : 10.5, rowH: many ? 15 : 17 });
  g += rooms.svg;
  const R = 620;
  const dense = sc.doors.length + sc.windows.length > 34;
  const rowH = dense ? 14.5 : 17;
  const size = dense ? 9.2 : 10.5;
  const doors = table(R, 84, [{ label: "NO.", w: 44 }, { label: "LOCATION", w: 150 }, { label: "W × H", w: 86, right: true }, { label: "TYPE", w: 300 }], sc.doors.map((d) => [d.no, `${d.level ? `${d.level}F` : "GF"} · ${d.room}`, `${(d.w * 1000).toFixed(0)}×${(d.h * 1000).toFixed(0)}`, d.type]), { title: "DOOR SCHEDULE", size, rowH });
  g += doors.svg;
  const wins = table(R, doors.bottom + 36, [{ label: "NO.", w: 44 }, { label: "ROOM", w: 128 }, { label: "FAC.", w: 34 }, { label: "W × H", w: 86, right: true }, { label: "SILL", w: 50, right: true }, { label: "TYPE", w: 238 }], sc.windows.map((w) => [w.no, `${w.level ? `${w.level}F` : "GF"} · ${w.room}`, w.facade, `${(w.w * 1000).toFixed(0)}×${(w.h * 1000).toFixed(0)}`, (w.sill * 1000).toFixed(0), w.type]), { title: "WINDOW SCHEDULE", size, rowH });
  g += wins.svg;
  g += `<text x="${L}" y="${SHEET_H - 112}" font-family="${FONT}" font-size="10" fill="${MID}">Door and window sizes are structural openings in millimetres (width × height). Sill heights above finished floor level.</text>`;
  g += sheetTitle("SCHEDULES", `${plan.title.en.toUpperCase()} · ${sc.rooms.length} ROOMS · ${sc.doors.length} DOORS · ${sc.windows.length} WINDOWS`);
  return sheet({ plan, drawing: "SCHEDULES", sheetNo, scaleNote: "NTS", body: g, north: false });
}

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line += " " + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** A-000: cover sheet with the concept render, project data and the drawing list. */
export function coverSheet(model, renderDataUri, sheetList) {
  const { plan, W, D } = model;
  let g = "";
  const ix = 70, iy = 70, iw = 760, ih = 507;
  if (renderDataUri) {
    g += `<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice" href="${renderDataUri}"/>`;
    g += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="${INK}" stroke-width="0.8"/>`;
    g += `<text x="${ix}" y="${iy + ih + 18}" font-family="${FONT}" font-size="9.5" letter-spacing="1.4" fill="${MID}">CONCEPT VISUALISATION — ILLUSTRATES THE DESIGN INTENT; THE DRAWINGS GOVERN.</text>`;
  }
  const rx = 870;
  g += `<text x="${rx}" y="${iy + 10}" font-family="${FONT}" font-size="10" letter-spacing="2.4" fill="${ACCENT}">CONCEPT DESIGN PACKAGE</text>`;
  g += `<text x="${rx}" y="${iy + 52}" font-family="${FONT}" font-size="34" font-weight="600" letter-spacing="1" fill="${INK}">${esc(plan.title.en.toUpperCase())}</text>`;
  g += `<text x="${rx}" y="${iy + 76}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${STYLE_EN[plan.style]} VILLA</text>`;
  wrap(plan.summary.en, 58).forEach((line, i) => (g += `<text x="${rx}" y="${iy + 110 + i * 17}" font-family="${FONT}" font-size="11.5" fill="${INK}">${esc(line)}</text>`));
  const sc = schedules(model);
  const data = [
    ["Gross floor area", `${plan.areaM2} m²`],
    ["Net internal area", `${sc.rooms.reduce((n, r) => n + r.area, 0).toFixed(0)} m²`],
    ["Footprint", `${W.toFixed(2)} × ${D.toFixed(2)} m`],
    ["Levels", `${plan.floors}${model.basement ? " (incl. lower level)" : ""}`],
    ["Bedrooms / bathrooms", `${plan.bedrooms} / ${plan.bathrooms}`],
    ["Garage", model.garage ? `${model.garage.w > 5 ? "Double" : "Single"}, ${(model.garage.w * model.garage.d).toFixed(0)} m²` : "—"],
    ["Pool", model.site.pool ? `${model.site.pool.w.toFixed(1)} × ${model.site.pool.d.toFixed(1)} m` : "—"],
  ];
  g += table(rx, iy + 230, [{ label: "PROJECT DATA", w: 190 }, { label: "", w: 180, right: true }], data, { size: 11 }).svg;
  const list = table(ix, iy + ih + 70, [{ label: "SHEET", w: 90 }, { label: "TITLE", w: 330 }, { label: "SCALE", w: 120 }], sheetList.map((s) => [s.no, s.title, s.scale]), { title: "DRAWING LIST", size: 11 });
  g += list.svg;
  const notes = [
    "1. Concept-stage design for illustration and planning discussion — not for construction.",
    "2. All dimensions to be verified on site by the contractor before work starts.",
    "3. Structure, services and local-authority approval by a licensed engineer / architect.",
    "4. PDF dimensions in metres; DWG / DXF model in metres, dimensions shown in millimetres.",
  ];
  g += `<text x="${rx}" y="${iy + ih + 82}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="2" fill="${INK}">NOTES</text>`;
  notes.forEach((n, i) => wrap(n, 62).forEach((line, j) => (g += `<text x="${rx}" y="${iy + ih + 106 + i * 36 + j * 15}" font-family="${FONT}" font-size="10.5" fill="${INK}">${esc(line)}</text>`)));
  g += sheetTitle("COVER SHEET", `${plan.title.en.toUpperCase()} · ${plan.areaM2} m² · ${sheetList.length} SHEETS`);
  return sheet({ plan, drawing: "COVER SHEET", sheetNo: "A-000", scaleNote: "NTS", body: g, north: false });
}

// ------------------------------------------------------------------ CAD export (geometry for DXF / DWG)

/**
 * Plan geometry of one level for the CAD export: walls (solid regions + outlines), windows, doors with
 * swings, furniture, room tags, structural grid, dimension chains and outdoor areas.
 * Metres, plan coordinates (x to the right, y toward the front/south); the DXF writer flips y.
 */
export function cadLevel(model, levelIndex) {
  const { W, D, site } = model;
  const level = model.levels[levelIndex];
  const isGround = levelIndex === 0;
  const garage = isGround ? model.garage : null;
  const ents = [];
  const add = (layer, e) => ents.push({ layer, ...e });
  const rectOutline = (layer, x, y, w, h, extra = {}) => add(layer, { t: "rect", x, y, w, h, ...extra });
  const spaceById = Object.fromEntries(level.spaces.map((sp) => [sp.id, sp]));
  const holes = level.spaces.map((sp) => inner(model, sp));
  const solids = [{ x: 0, y: 0, w: W, h: D }];

  // windows
  for (const win of level.windows) {
    const sp = spaceById[win.space];
    if (!sp || !isExterior(model, sp, win.side)) continue;
    const seg = sideSegment(sp, win.side);
    const len = seg.horizontal ? sp.w : sp.h;
    const w = Math.min(win.w, len - 0.6);
    const c = win.at * len;
    if (seg.horizontal) {
      const x0 = sp.x + c - w / 2;
      const yo = win.side === "top" ? 0 : D - EXT;
      holes.push({ x: x0, y: yo, w, h: EXT });
      rectOutline("A-GLAZ", x0, yo, w, EXT);
      add("A-GLAZ", { t: "line", x1: x0, y1: yo + EXT / 2, x2: x0 + w, y2: yo + EXT / 2 });
      if (win.w > 50) {
        const n = Math.max(2, Math.round(w / 2.4));
        for (let i = 1; i < n; i++) add("A-GLAZ", { t: "line", x1: x0 + (w * i) / n, y1: yo, x2: x0 + (w * i) / n, y2: yo + EXT });
      }
    } else {
      const y0 = sp.y + c - w / 2;
      const xo = win.side === "left" ? 0 : W - EXT;
      holes.push({ x: xo, y: y0, w: EXT, h: w });
      rectOutline("A-GLAZ", xo, y0, EXT, w);
      add("A-GLAZ", { t: "line", x1: xo + EXT / 2, y1: y0, x2: xo + EXT / 2, y2: y0 + w });
    }
  }
  // doors: opening, leaf and swing
  for (const d of level.doors) {
    const sp = spaceById[d.space];
    if (!sp) continue;
    const ext = isExterior(model, sp, d.side);
    const t = ext ? EXT : INT;
    const seg = sideSegment(sp, d.side);
    const len = seg.horizontal ? sp.w : sp.h;
    const w = d.w > 50 ? len - 0.9 : Math.min(d.w, len - 0.3);
    const c = Math.min(Math.max(d.at * len, w / 2 + 0.15), len - w / 2 - 0.15);
    if (seg.horizontal) {
      const x0 = sp.x + c - w / 2;
      const wy = ext ? (d.side === "top" ? 0 : D - EXT) : seg.y1 - INT / 2;
      holes.push({ x: x0, y: wy - 0.005, w, h: t + 0.01 });
      if (!d.open) {
        const into = d.side === "top" ? 1 : -1;
        const hy = d.side === "top" ? wy + t : wy;
        add("A-DOOR", { t: "line", x1: x0, y1: hy, x2: x0, y2: hy + into * w });
        add("A-DOOR", { t: "arc", cx: x0, cy: hy, r: w, x1: x0, y1: hy + into * w, x2: x0 + w, y2: hy });
      }
    } else {
      const y0 = sp.y + c - w / 2;
      const wx = ext ? (d.side === "left" ? 0 : W - EXT) : seg.x1 - INT / 2;
      holes.push({ x: wx - 0.005, y: y0, w: t + 0.01, h: w });
      if (!d.open) {
        const into = d.side === "left" ? 1 : -1;
        const hx = d.side === "left" ? wx + t : wx;
        add("A-DOOR", { t: "line", x1: hx, y1: y0, x2: hx + into * w, y2: y0 });
        add("A-DOOR", { t: "arc", cx: hx, cy: y0, r: w, x1: hx + into * w, y1: y0, x2: hx, y2: y0 + w });
      }
    }
  }
  // garage
  if (garage) {
    const gx = W, gy = D - garage.d;
    solids.push({ x: gx, y: gy, w: garage.w, h: garage.d });
    holes.push({ x: gx + INT / 2, y: gy + EXT, w: garage.w - EXT - INT / 2, h: garage.d - EXT });
    holes.push({ x: gx + 0.4, y: D - EXT - 0.02, w: garage.w - 0.8, h: EXT + 0.04 });
    add("A-DOOR", { t: "line", x1: gx + 0.4, y1: D - EXT / 2, x2: gx + garage.w - 0.4, y2: D - EXT / 2, dashed: true });
    const cars = garage.w > 5 ? 2 : 1;
    for (let i = 0; i < cars; i++) rectOutline("A-FURN", gx + (garage.w - cars * 1.9 - (cars - 1) * 0.9) / 2 + i * 2.8, gy + 0.9, 1.9, 4.7, { dashed: true });
    add("A-AREA-IDEN", { t: "text", x: gx + garage.w / 2, y: gy + 0.8, h: 0.22, text: "GARAGE" });
    add("A-AREA-IDEN", { t: "text", x: gx + garage.w / 2, y: gy + 1.15, h: 0.16, text: `${((garage.w - EXT) * (garage.d - EXT)).toFixed(1)} m²` });
  }

  // walls: grid cells inside the footprint and outside every room and opening
  const inside = (r, x, y) => x > r.x + 1e-6 && x < r.x + r.w - 1e-6 && y > r.y + 1e-6 && y < r.y + r.h - 1e-6;
  const edges = (axis) => [...new Set([...solids, ...holes].flatMap((r) => (axis === "x" ? [r.x, r.x + r.w] : [r.y, r.y + r.h])).map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const xs = edges("x"), ys = edges("y");
  const wall = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return solids.some((r) => inside(r, cx, cy)) && !holes.some((r) => inside(r, cx, cy));
  };
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      if (!wall(i, j)) continue;
      let k = i;
      while (wall(k + 1, j)) k++;
      add("A-WALL-PATT", { t: "solid", x: xs[i], y: ys[j], w: xs[k + 1] - xs[i], h: ys[j + 1] - ys[j] });
      i = k;
    }
  }
  // wall outlines: cell edges where wall meets non-wall, merged into runs
  const runs = [];
  for (let i = 0; i < xs.length; i++) {
    let start = null;
    for (let j = 0; j <= ys.length - 1; j++) {
      const edge = j < ys.length - 1 && wall(i - 1, j) !== wall(i, j);
      if (edge && start === null) start = ys[j];
      if (!edge && start !== null) {
        runs.push({ x1: xs[i], y1: start, x2: xs[i], y2: ys[j] });
        start = null;
      }
    }
  }
  for (let j = 0; j < ys.length; j++) {
    let start = null;
    for (let i = 0; i <= xs.length - 1; i++) {
      const edge = i < xs.length - 1 && wall(i, j - 1) !== wall(i, j);
      if (edge && start === null) start = xs[i];
      if (!edge && start !== null) {
        runs.push({ x1: start, y1: ys[j], x2: xs[i], y2: ys[j] });
        start = null;
      }
    }
  }
  for (const r of runs) add("A-WALL", { t: "line", ...r });

  // furniture and stairs
  const pen = cadPen(ents, "A-FURN");
  for (const sp of level.spaces) furniture(pen, sp.kind, inner(model, sp));

  // room tags
  for (const sp of level.spaces) {
    if (sp.kind === "stair") continue;
    const inn = inner(model, sp);
    let cy = inn.y + inn.h / 2;
    if (sp.kind === "master" || sp.kind === "bedroom") cy = inn.y + Math.min(inn.h - 0.5, 2.6 + (inn.h - 2.6) / 2);
    if (sp.kind === "open") cy = inn.y + inn.h * 0.3;
    if (sp.kind === "living") cy = inn.y + inn.h * 0.8;
    if (sp.kind === "kitchen") cy = inn.y + inn.h * 0.36;
    if (sp.kind === "dining") cy = inn.y + 0.75;
    const small = inn.w < 2.2;
    add("A-AREA-IDEN", { t: "text", x: inn.x + inn.w / 2, y: cy, h: small ? 0.17 : 0.25, text: small && sp.label.length > 8 ? sp.label.split(/[ -]/)[0] : sp.label });
    add("A-AREA-IDEN", { t: "text", x: inn.x + inn.w / 2, y: cy + (small ? 0.28 : 0.38), h: small ? 0.14 : 0.19, text: `${(inn.w * inn.h).toFixed(1)} m²` });
  }

  // structural grid
  const dedupe = (vals) => vals.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.6);
  const gx = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.x), r1(sp.x + sp.w)]))]);
  const gy = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.y), r1(sp.y + sp.h)]))]);
  gx.forEach((x, i) => {
    add("A-GRID", { t: "line", x1: x, y1: -2.3, x2: x, y2: D + 0.4, dashed: true });
    add("A-GRID-IDEN", { t: "circle", cx: x, cy: -2.62, r: 0.32 });
    add("A-GRID-IDEN", { t: "text", x, y: -2.62, h: 0.26, text: String(i + 1), middle: true });
  });
  gy.forEach((y, i) => {
    add("A-GRID", { t: "line", x1: -2.3, y1: y, x2: W + 0.4, y2: y, dashed: true });
    add("A-GRID-IDEN", { t: "circle", cx: -2.62, cy: y, r: 0.32 });
    add("A-GRID-IDEN", { t: "text", x: -2.62, y, h: 0.26, text: "ABCDEFGHJK"[i] ?? "", middle: true });
  });

  // dimension chains (detailed at 0.9 m, overall at 1.6 m)
  const back = [...new Set([0, W, ...level.spaces.filter((sp) => sp.y < 0.01).flatMap((sp) => [sp.x, sp.x + sp.w])].map(r1))].sort((a, b) => a - b);
  const left = [...new Set([0, D, ...level.spaces.filter((sp) => sp.x < 0.01).flatMap((sp) => [sp.y, sp.y + sp.h])].map(r1))].sort((a, b) => a - b);
  add("A-ANNO-DIMS", { t: "dim", axis: "x", at: -0.9, points: back });
  add("A-ANNO-DIMS", { t: "dim", axis: "x", at: -1.6, points: [0, W, ...(garage ? [W + garage.w] : [])] });
  add("A-ANNO-DIMS", { t: "dim", axis: "y", at: -0.9, points: left });
  add("A-ANNO-DIMS", { t: "dim", axis: "y", at: -1.6, points: [0, D] });

  // outdoor areas
  if (isGround) {
    if (site.T > 0) rectOutline("L-PAVE", 0, D, W, site.T);
    if (site.deck) {
      const { deck, pool } = site;
      rectOutline("L-PAVE", deck.x, deck.y, deck.w, deck.h);
      rectOutline("L-POOL", pool.x, pool.y, pool.w, pool.d);
      rectOutline("L-POOL", pool.x + 0.15, pool.y + 0.15, pool.w - 0.3, pool.d - 0.3);
      for (let i = 1; i <= 3; i++) add("L-POOL", { t: "line", x1: pool.x + pool.w - i * 0.3, y1: pool.y, x2: pool.x + pool.w - i * 0.3, y2: pool.y + pool.d * 0.42 });
      add("L-POOL", { t: "text", x: pool.x + pool.w / 2, y: pool.y + pool.d / 2, h: 0.22, text: `POOL ${pool.w.toFixed(1)} × ${pool.d.toFixed(1)}`, middle: true });
    }
    if (level.veranda) {
      const n = Math.max(3, Math.round(W / 3.2));
      for (let i = 0; i <= n; i++) add("A-COLS", { t: "solid", x: (W * i) / n - 0.1, y: D + site.T - 0.3, w: 0.2, h: 0.2 });
      add("A-ROOF-OTLN", { t: "line", x1: 0, y1: D + site.T - 0.2, x2: W, y2: D + site.T - 0.2 });
    }
    if (level.canopy) {
      rectOutline("A-ROOF-OTLN", -1.6, D, W + 3.2, site.T, { dashed: true });
      const n = Math.max(3, Math.round((W + 2.4) / 3.6));
      for (let i = 0; i <= n; i++) add("A-COLS", { t: "circle", cx: -1.2 + ((W + 2.4) * i) / n, cy: D + site.T - 0.35, r: 0.09, filled: true });
    }
    if (garage) rectOutline("L-PAVE", W + 0.2, D, garage.w - 0.4, 3);
    const upper = model.levels[1]?.terrace;
    if (upper) add("A-ROOF-OTLN", { t: "poly", pts: [[upper.x0, D], [upper.x0, D + upper.depth], [upper.x1, D + upper.depth], [upper.x1, D]], dashed: true });
    const e = level.doors.find((d) => d.entry);
    if (e) add("A-ANNO-TEXT", { t: "text", x: site.entryX, y: D + site.T + 1.3, h: 0.2, text: "ENTRANCE" });
  } else if (level.terrace) {
    const t = level.terrace;
    rectOutline("L-PAVE", t.x0, D, t.x1 - t.x0, t.depth);
    add("A-GLAZ", { t: "poly", pts: [[t.x0, D], [t.x0, D + t.depth], [t.x1, D + t.depth], [t.x1, D]] });
    add("A-ANNO-TEXT", { t: "text", x: (t.x0 + t.x1) / 2, y: D + t.depth / 2, h: 0.2, text: `${t.label} · GLASS BALUSTRADE h=1.10`, middle: true });
  }

  const extW = W + (garage ? garage.w : 0);
  const front = isGround ? Math.max(site.T, site.deck ? site.T + site.deck.h : 0, garage ? 3 : 0) : level.terrace?.depth ?? 0;
  return {
    name: level.name,
    ffl: levelIndex * STOREY,
    extents: { x0: -3.2, y0: -3.2, x1: Math.max(extW, W + (level.canopy ? 1.6 : 0)) + 1, y1: D + front + 2 },
    entities: ents,
  };
}

/** Everything the DXF writer needs for one plan. */
export function cadModel(model) {
  const { plan } = model;
  return {
    slug: plan.slug,
    title: plan.title.en,
    style: STYLE_EN[plan.style],
    areaM2: plan.areaM2,
    levels: model.levels.map((_, i) => cadLevel(model, i)),
  };
}
