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
  limestone: { fill: "#dccfb4", pattern: "limestone", label: "Absheron limestone, sawn blocks" },
  charcoal: { fill: "#4e5053", label: "Charcoal mineral render" },
  bronzeFin: { fill: "#7b6349", pattern: "fins", label: "Bronze aluminium vertical fins" },
  clapboard: { fill: "#eee7db", pattern: "clapboard", label: "Painted timber weatherboarding" },
  slate: { fill: "#5e636a", pattern: "slatetiles", label: "Natural slate roof" },
  brick: { fill: "#a8664c", pattern: "brick", label: "Hand-made clinker brick, warm red" },
  panel: { fill: "#55595d", pattern: "panel", label: "Anthracite composite façade panels" },
  fascia: { fill: "#e6e3dc", label: "Light composite fascia (signage zone)" },
  alu: { fill: "#3b3e41", label: "Graphite aluminium shopfront system" },
  coping: { fill: "#d9dbdc", label: "Aluminium parapet coping, light grey" },
  acp: { fill: "#d2b27a", pattern: "acp", label: "Champagne aluminium panels" },
  silver: { fill: "#cdd0d3", label: "Silver aluminium floor bands" },
  canopyGlass: { fill: "#bcd3da", label: "Glass canopy, steel tie rods" },
  blackalu: { fill: "#25272a", label: "Black anodised aluminium frames" },
  pilaster: { fill: "#efe8dc", label: "Rendered pilasters, warm white" },
  signGreen: { fill: "#1f4d3a", label: "Sign band, deep green, gilded letters" },
  terracottaPanel: { fill: "#c07a57", pattern: "fins", label: "Terracotta rainscreen baguettes" },
  stoneFin: { fill: "#d8c9ac", pattern: "limestone", label: "Limestone piers, sawn finish" },
  corten: { fill: "#8b4f30", label: "Weathering steel fascia" },
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
  // Absheron coast: sawn local limestone with white-render volumes, deep slabs, sea-view terraces
  absheron: { walls: ["limestone"], fin: "render", frame: "bronze", glassy: true, slab: 1.6, terrace: true, garageDoor: "wood", tree: "olive" },
  // dark contemporary: charcoal render, bronze fins, crisp slabs
  noir: { walls: ["charcoal"], fin: "bronzeFin", slabMat: "charcoal", frame: "bronze", glassy: true, slab: 1.3, terrace: true, garageDoor: "bronze", tree: "round" },
  // Bosphorus yalı: painted timber weatherboarding, slate hip roof, tall timber windows
  yali: { walls: ["clapboard"], roof: "slate", frame: "wood", shutters: "shutterWood", chimney: true, garageDoor: "wood", tree: "round" },
  // terraced house (one unit of a row): clinker brick, white slab bands, timber around the entrance
  townhouse: { walls: ["brick"], frame: "bronze", glassy: true, slab: 0.5, timberEntry: true, tree: "round" },
  // neighbourhood supermarket: one tall storey, shopfront glazing under a fascia, timber entrance canopy
  // office building with a ground-floor showroom: champagne panels, silver floor bands, round stair tower, glass canopy
  office: { walls: ["render"], frame: "blackalu", glassy: true, slab: 0.6, storey: 3.5, survey: true, piers: true, tower: true, entryCanopy: true, canopyGlass: true, slidingEntry: true, roofTerrace: true, signTwoLines: true, tree: "round" },
  market: { walls: ["panel"], frame: "alu", glassy: true, slab: 0.5, slabMat: "coping", storey: 6.0, head: 4.2, fascia: true, entryCanopy: true, slidingEntry: true, rooflights: true, tree: "round" },
  // roadside door and window showroom: a double-height hall behind two tiers of steel-framed glazing between
  // rendered pilasters, a mezzanine at the back, the owner's sign band along the top
  // interior design project: the shell only; the design language comes from plan.interior.palette
  interior: { walls: ["render"], frame: "bronze", slab: 0.2, storey: 3.0, tree: "round" },
  showroom: { walls: ["render"], frame: "blackalu", glassy: true, slab: 0.3, slabMat: "coping", storey: 4.6, piers: true, pierMat: "pilaster", pierW: 0.8, pane: 0.95, transom: 1.25, signBand: true, entryCanopy: true, canopyGlass: true, slidingEntry: true, projectLabel: "DOOR AND WINDOW SHOWROOM", tree: "round" },
  // commercial buildings drawn from plan.layout; plan.facade picks the cladding from FACADES below
  bizcenter: { walls: ["render"], frame: "blackalu", glassy: true, slab: 0.4, slabMat: "coping", storey: 3.8, pane: 1.5, entryCanopy: true, canopyGlass: true, slidingEntry: true, tree: "round" },
  hotel: { walls: ["limestone"], frame: "bronze", glassy: true, slab: 0.5, storey: 3.3, entryCanopy: true, canopyGlass: true, slidingEntry: true, tree: "round" },
  restaurant: { walls: ["limestone"], frame: "bronze", glassy: true, slab: 1.2, storey: 4.2, head: 3.6, entryCanopy: true, tree: "olive" },
  banquet: { walls: ["travertine"], frame: "bronze", glassy: true, slab: 0.8, storey: 6.0, head: 5.2, pane: 1.2, transom: 1.8, entryCanopy: true, canopyGlass: true, slidingEntry: true, projectLabel: "WEDDING AND BANQUET HALL", tree: "cypress" },
  apartments: { walls: ["render"], frame: "bronze", slab: 0.3, storey: 3.1, tree: "round" },
};

/** Cladding options of the commercial styles (plan.facade); the first is the default. */
const FACADES = {
  bizcenter: {
    glass: { walls: ["render"], transom: 1.7, windows: "full" },
    stone: { walls: ["limestone"], piers: true, pierMat: "stoneFin", pierW: 0.9, windows: "ribbon" },
    terracotta: { walls: ["terracottaPanel"], frame: "bronze", windows: "ribbon" },
  },
  hotel: {
    stone: { walls: ["limestone", "render"], windows: "punched" },
    render: { walls: ["render"], windows: "punched" },
  },
  restaurant: {
    stone: { walls: ["stoneGrey"], slabMat: "corten" },
    glass: { walls: ["travertine"], canopy: 2.6, entryCanopy: false },
    brick: { walls: ["brick"], roofTerrace: true },
    lodge: { walls: ["stoneGrey", "timber"], roof: "seam", chimney: true, glassy: false, head: 2.9 },
    timber: { walls: ["timber"], pergola: true, entryCanopy: false },
  },
  banquet: {
    travertine: { walls: ["travertine"] },
    stone: { walls: ["limestone"], piers: true, pierMat: "pilaster", pierW: 1.1 },
  },
  apartments: {
    render: { walls: ["render"], windows: "punched" },
    brick: { walls: ["brick"], windows: "punched" },
  },
};

const STYLE_EN = {
  modern: "MODERN", tuscan: "TUSCAN", minimal: "MINIMALIST", coastal: "COASTAL", chalet: "CHALET",
  farmhouse: "FARMHOUSE", luxury: "CONTEMPORARY", pavilion: "PAVILION", mediterranean: "MEDITERRANEAN", duplex: "TWIN VILLA",
  absheron: "ABSHERON CONTEMPORARY", noir: "NOIR CONTEMPORARY", yali: "BOSPHORUS YALI", townhouse: "TOWNHOUSE", market: "SUPERMARKET", office: "OFFICE AND SHOWROOM", showroom: "SHOWROOM", interior: "INTERIOR DESIGN",
  bizcenter: "BUSINESS CENTRE", hotel: "HOTEL", restaurant: "RESTAURANT", banquet: "WEDDING HALL", apartments: "APARTMENT BUILDING",
};

/** Upper floors by number, for plan titles. */
const FLOOR_NAMES = ["GROUND", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH"];

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
  absheron: { roofs: ["flat"], floors: [1, 2] },
  noir: { roofs: ["flat"], floors: [2] },
  yali: { roofs: ["hip"], floors: [2] },
  townhouse: { roofs: ["flat"], floors: [2], projectOnly: true },
  market: { roofs: ["flat"], floors: [1], projectOnly: true, commercial: true, floorArea: [1200, 3500] },
  office: { roofs: ["flat"], floors: [6], projectOnly: true, commercial: true, floorArea: [200, 600] },
  showroom: { roofs: ["flat"], floors: [2], projectOnly: true, commercial: true, floorArea: [150, 600] },
  interior: { roofs: ["flat"], floors: [1, 2], interior: true, floorArea: [40, 320] },
  // layouts: plan.layout -> the storeys it is drawn for; facades: plan.facade (FACADES); metric: what the listing counts
  bizcenter: { roofs: ["flat"], floors: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], projectOnly: true, commercial: true, floorArea: [450, 1500], layouts: { a: null, b: null, c: null } },
  hotel: { roofs: ["flat"], floors: [3, 4, 5, 6, 7, 8, 9, 10], projectOnly: true, commercial: true, floorArea: [400, 1500], layouts: { a: null, b: null }, metric: "rooms" },
  restaurant: { roofs: ["flat", "gable"], floors: [1, 2], projectOnly: true, commercial: true, floorArea: [180, 900], layouts: { a: [1], b: [2], c: [1], d: [2] }, metric: "seats" },
  banquet: { roofs: ["flat"], floors: [1], projectOnly: true, commercial: true, floorArea: [800, 2600], layouts: { a: null }, metric: "seats" },
  apartments: { roofs: ["flat"], floors: [5, 6, 7, 8, 9, 10, 11, 12], projectOnly: true, residential: true, floorArea: [380, 900], layouts: { a: null }, metric: "flats" },
};

/** Multi-unit projects (plan.project.kind): how many houses each layout is drawn for. */
export const PROJECT_RULES = {
  row: { units: [4, 5, 6, 7, 8], styles: ["townhouse"], label: "TERRACE OF TOWNHOUSES" },
  farm: { units: [3, 4, 5, 6], styles: ["farmhouse", "tuscan", "mediterranean"], label: "FARM ESTATE" },
  cluster: { units: [4, 5, 6], styles: ["chalet", "modern", "absheron", "minimal", "coastal"], label: "VILLAGE CLUSTER" },
  retail: { units: [1], styles: ["market"], label: "NEIGHBOURHOOD SUPERMARKET" },
  urban: { units: [1], styles: ["office", "showroom"], label: "SHOWROOM AND OFFICE BUILDING" },
  business: { units: [1], styles: ["bizcenter"], label: "BUSINESS CENTRE" },
  hotel: { units: [1], styles: ["hotel"], label: "HOTEL" },
  dining: { units: [1], styles: ["restaurant"], label: "RESTAURANT" },
  events: { units: [1], styles: ["banquet"], label: "WEDDING AND BANQUET HALL" },
  residential: { units: [1], styles: ["apartments"], label: "APARTMENT BUILDING" },
};

/** Cladding and layout a commercial plan is drawn with (plan.facade / plan.layout, else the first option). */
export const FACADE_OPTIONS = Object.fromEntries(Object.entries(FACADES).map(([style, f]) => [style, Object.keys(f)]));
const facadeOf = (plan) => (FACADES[plan.style] ? (plan.facade ?? Object.keys(FACADES[plan.style])[0]) : null);
const layoutOf = (plan) => plan.layout ?? "a";

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
    ${pat("p-limestone", 1.2, 0.6, `<path d="M0 ${m(0.3)}H${m(1.2)}M0 ${m(0.6) - 0.5}H${m(1.2)}M0.4 0V${m(0.3)}M${m(0.6)} ${m(0.3)}V${m(0.6)}" stroke="#6b5a3f" stroke-opacity=".2" stroke-width="0.7" fill="none"/>`)}
    ${pat("p-fins", 0.25, 1, `<rect x="0" y="0" width="${m(0.06)}" height="${m(1)}" fill="#c9b08c" fill-opacity=".55"/>`)}
    ${pat("p-brick", 0.6, 0.3, `<path d="M0 ${m(0.15)}H${m(0.6)}M0 ${m(0.3) - 0.5}H${m(0.6)}M0.4 0V${m(0.15)}M${m(0.3)} ${m(0.15)}V${m(0.3)}" stroke="#f1e6da" stroke-opacity=".5" stroke-width="0.7" fill="none"/>`)}
    ${pat("p-panel", 3, 1, `<path d="M0 ${m(1) - 0.5}H${m(3)}M0.4 0V${m(1)}" stroke="#d9dde0" stroke-opacity=".28" stroke-width="0.7" fill="none"/>`)}
    ${pat("p-acp", 1.5, 1.2, `<path d="M0 ${m(1.2) - 0.5}H${m(1.5)}M0.4 0V${m(1.2)}" stroke="#7d6640" stroke-opacity=".3" stroke-width="0.7" fill="none"/>`)}
    ${pat("p-clapboard", 1, 0.18, `<path d="M0 ${m(0.18) - 0.5}H${m(1)}" stroke="#5b5146" stroke-opacity=".32" stroke-width="0.7"/>`)}
    ${pat("p-slatetiles", 0.3, 0.5, `<path d="M0 ${m(0.25)}H${m(0.3)}M0 ${m(0.5) - 0.5}H${m(0.3)}M0.4 0V${m(0.25)}M${m(0.15)} ${m(0.25)}V${m(0.5)}" stroke="#d6dade" stroke-opacity=".35" stroke-width="0.7" fill="none"/>`)}
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
  let spec = plan.tree ? { ...SPEC[plan.style], tree: plan.tree } : SPEC[plan.style];
  if (FACADES[plan.style]) {
    const f = FACADES[plan.style][facadeOf(plan)];
    if (!f) throw new Error(`${plan.style}: unknown facade "${plan.facade}" (${Object.keys(FACADES[plan.style]).join(", ")})`);
    spec = { ...spec, ...f, ...(plan.tree ? { tree: plan.tree } : {}) };
  }
  const itype = plan.style === "interior" ? INTERIOR_TYPES[plan.interior?.type] : null;
  if (plan.style === "interior") {
    if (!itype || !PALETTES[plan.interior.palette]) throw new Error(`interior: unknown type "${plan.interior?.type}" or palette "${plan.interior?.palette}"`);
    spec = { ...spec, glassy: !!itype.glassy };
  }
  const above = plan.style === "luxury" ? plan.floors - 1 : plan.floors;
  const footprintArea = plan.areaM2 / plan.floors;
  // footprint proportion (width / depth); a plan may override it to vary the massing
  // (a terraced house is deeper than it is wide)
  const commercialRatio = { bizcenter: 2.0, hotel: layoutOf(plan) === "b" ? 3.6 : 2.2, restaurant: 1.6, banquet: 1.55, apartments: 2.2 }[plan.style];
  const ratio = plan.style === "townhouse" ? 0.67 : plan.ratio ?? (itype ? itype.ratio : null) ?? commercialRatio ?? ({ duplex: 2.0, market: 1.4, office: 1.45 }[plan.style] ?? (above === 1 ? 1.7 : plan.roof === "frontgable" ? 1.15 : 1.4));
  // a surveyed building keeps its measured footprint
  const W = plan.footprint ? plan.footprint[0] : r1(Math.sqrt(footprintArea * ratio));
  const D = plan.footprint ? plan.footprint[1] : r1(footprintArea / W);

  let levels;
  if (plan.style === "duplex") levels = duplexLevels(spec);
  else if (plan.style === "townhouse") levels = townhouseLevels(spec);
  else if (plan.style === "market") levels = [marketLevel(spec)];
  else if (plan.style === "office") levels = officeLevels(spec);
  else if (plan.style === "showroom") levels = showroomLevels(spec);
  else if (COMMERCIAL_LEVELS[plan.style]) levels = COMMERCIAL_LEVELS[plan.style](plan, W, D, spec);
  else if (itype) levels = interiorLevels(plan, W, D, spec);
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
  const model = { plan, spec, W, D, above, levels, garage, basement: plan.style === "luxury", storey: spec.storey ?? STOREY };
  model.wallTop = above * model.storey;
  if (itype) model.interior = { type: plan.interior.type, palette: PALETTES[plan.interior.palette], ch: itype.ch };
  if (spec.survey) {
    // structural grid, chamfered street corner and the round stair tower of the surveyed building
    const xs = [0.25, ...OFFICE.back.map((f) => Math.round(f * W * 100) / 100), W - 0.25];
    model.columns = xs.flatMap((x) => [0.25, D - 5.85, D - 0.25].map((y) => [x, y])).filter(([x, y]) => !(x < 1 && y > D - 1));
    model.chamfer = { a: 1.8, b: 1.9 };
    const st = levels[0].spaces.find((sp) => sp.kind === "stair");
    model.towerArc = { cx: st.x + st.w / 2, r: st.w / 2 + 0.1 };
  }
  if (plan.style === "showroom") {
    // rendered pilasters between the four glazed bays, front and back
    const xs = SHOWROOM.bays.map((f, i, a) => (i === 0 ? 0.4 : i === a.length - 1 ? W - 0.4 : Math.round(f * W * 100) / 100));
    model.columns = xs.flatMap((x) => [[x, 0.4], [x, D - 0.4]]);
  }
  if (COMMERCIAL_LEVELS[plan.style] && spec.piers) {
    // stone piers on the facade grid, front and back
    const n = Math.max(3, Math.round(W / (plan.style === "banquet" ? 6.0 : 4.2)));
    model.columns = Array.from({ length: n + 1 }, (_, i) => r1(0.45 + ((W - 0.9) * i) / n)).flatMap((x) => [[x, 0.4], [x, D - 0.4]]);
  }
  if (COMMERCIAL_LEVELS[plan.style]) model.metrics = commercialMetrics(model);
  Object.assign(model, roofGeometry(model));
  model.site = siteLayout(model);
  if (plan.project) {
    const units = plan.project.units;
    model.project = { kind: plan.project.kind, units, totalArea: units * plan.areaM2 };
    // a terrace alternates the plan so front doors pair up; the other layouts repeat one orientation
    if (plan.project.kind === "row") model.project.mirrored = buildModel({ ...plan, project: undefined, mirror: !plan.mirror });
    model.project.layout = projectLayout(model);
  }
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

/** One three-bedroom unit over two floors (fractions of the unit): living across the plot, stair + services on the right. */
function attachedUnit(spec) {
  const glassy = !!spec.glassy;
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
  return { G, F };
}

/** Places a unit template into a level: offset and width as fractions of the footprint. */
function placeUnit(tpl, target, offset, width, mirror, tag) {
  const flip = (side) => (mirror && side === "left" ? "right" : mirror && side === "right" ? "left" : side);
  for (const sp of tpl.spaces) {
    const x = mirror ? 1 - sp.x - sp.w : sp.x;
    target.spaces.push({ ...sp, id: sp.id + tag, x: offset + x * width, w: sp.w * width });
  }
  for (const d of tpl.doors) {
    const horiz = d.side === "top" || d.side === "bottom";
    target.doors.push({ ...d, space: d.space + tag, side: flip(d.side), at: mirror && horiz ? 1 - d.at : d.at });
  }
  for (const w of tpl.windows) {
    const horiz = w.side === "top" || w.side === "bottom";
    target.windows.push({ ...w, space: w.space + tag, side: flip(w.side), at: mirror && horiz ? 1 - w.at : w.at });
  }
}

/** Mid-terrace townhouse: party walls left and right, so every window faces the street or the garden. */
function townhouseLevels(spec) {
  const { G, F } = attachedUnit(spec);
  G.spaces.find((sp) => sp.id === "store").label = "UTILITY";
  G.windows.push({ space: "store", side: "bottom", at: 0.5, w: 0.6 });
  G.windows.find((w) => w.space === "open" && w.side === "top").w = 3.2;
  F.windows.push({ space: "bath", side: "bottom", at: 0.5, w: 0.6 });
  const ground = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [] };
  const first = { name: "FIRST FLOOR PLAN", spaces: [], doors: [], windows: [] };
  placeUnit(G, ground, 0, 1, false, "");
  placeUnit(F, first, 0, 1, false, "");
  return [ground, first];
}

function duplexLevels(spec) {
  // Two mirrored units. Templates are written in unit fractions (0..1) and mapped onto each half.
  const { G, F } = attachedUnit(spec);
  const ground = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [] };
  const first = { name: "FIRST FLOOR PLAN", spaces: [], doors: [], windows: [] };
  const place = (tpl, target, offset, mirror, tag) => placeUnit(tpl, target, offset, 0.5, mirror, tag);
  place(G, ground, 0, false, "L");
  place(G, ground, 0.5, true, "R");
  place(F, first, 0, false, "L");
  place(F, first, 0.5, true, "R");
  // end-wall windows on the outer walls
  ground.windows.push({ space: "openL", side: "left", at: 0.5, w: 2.4 }, { space: "openR", side: "right", at: 0.5, w: 2.4 });
  first.windows.push({ space: "mL", side: "left", at: 0.5, w: 1.4 }, { space: "mR", side: "right", at: 0.5, w: 1.4 });
  return [ground, first];
}

/**
 * Neighbourhood supermarket on one tall storey (fractions of the footprint; y = 0 is the service side at the back).
 * Back of house along the back wall (staff, bakery prep, stock, goods-in with the loading dock, cold rooms), the sales
 * floor with fresh counters, and along the shopfront the entrance lobby, checkouts, a bakery café and a kiosk unit.
 */
function marketLevel(spec) {
  const glassy = !!spec.glassy;
  return {
    name: "GROUND FLOOR PLAN",
    spaces: [
      { id: "staff", label: "STAFF ROOM", kind: "staff", x: 0, y: 0, w: 0.12, h: 0.13 },
      { id: "swc", label: "STAFF WC", kind: "wc", x: 0, y: 0.13, w: 0.06, h: 0.11 },
      { id: "office", label: "OFFICE", kind: "office", x: 0.06, y: 0.13, w: 0.06, h: 0.11 },
      { id: "prep", label: "BAKERY PREP", kind: "prep", x: 0.12, y: 0, w: 0.14, h: 0.24 },
      { id: "stock", label: "STOCK ROOM", kind: "racks", x: 0.26, y: 0, w: 0.34, h: 0.24 },
      { id: "dock", label: "GOODS IN", kind: "dock", x: 0.6, y: 0, w: 0.2, h: 0.24 },
      { id: "cold", label: "COLD ROOM", kind: "cold", x: 0.8, y: 0, w: 0.1, h: 0.24 },
      { id: "frz", label: "FREEZER", kind: "cold", x: 0.9, y: 0, w: 0.1, h: 0.24 },
      { id: "sales", label: "SALES FLOOR", kind: "sales", x: 0, y: 0.24, w: 0.8, h: 0.48 },
      { id: "deli", label: "FRESH COUNTERS", kind: "deli", x: 0.8, y: 0.24, w: 0.2, h: 0.48 },
      { id: "gate", label: "ENTRY / TROLLEYS", kind: "gate", x: 0, y: 0.72, w: 0.14, h: 0.14 },
      { id: "tills", label: "CHECKOUTS", kind: "checkout", x: 0.14, y: 0.72, w: 0.48, h: 0.14 },
      { id: "lobby", label: "ENTRANCE LOBBY", kind: "lobby", x: 0, y: 0.86, w: 0.62, h: 0.14 },
      { id: "cafe", label: "BAKERY / CAFE", kind: "cafe", x: 0.62, y: 0.72, w: 0.22, h: 0.28 },
      { id: "cwc", label: "CUSTOMER WC", kind: "wc", x: 0.84, y: 0.72, w: 0.16, h: 0.14 },
      { id: "kiosk", label: "PHARMACY KIOSK", kind: "kiosk", x: 0.84, y: 0.86, w: 0.16, h: 0.14 },
    ],
    doors: [
      { space: "lobby", side: "bottom", at: 0.22, w: 2.6, entry: true, open: true, sliding: true },
      { space: "lobby", side: "bottom", at: 0.74, w: 2.6, open: true, sliding: true },
      { space: "kiosk", side: "bottom", at: 0.78, w: 1.2, entry: true },
      { space: "gate", side: "top", at: 0.5, w: 99, open: true },
      { space: "gate", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "tills", side: "top", at: 0.5, w: 99, open: true },
      { space: "tills", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "cafe", side: "left", at: 0.75, w: 3.0, open: true },
      { space: "cwc", side: "left", at: 0.5, w: 1.0 },
      { space: "deli", side: "left", at: 0.5, w: 99, open: true },
      { space: "stock", side: "bottom", at: 0.5, w: 1.8 },
      { space: "prep", side: "bottom", at: 0.5, w: 1.2 },
      { space: "staff", side: "right", at: 0.5, w: 0.9 },
      { space: "staff", side: "top", at: 0.3, w: 1.0 },
      { space: "office", side: "top", at: 0.5, w: 0.9 },
      { space: "swc", side: "right", at: 0.5, w: 0.8 },
      { space: "dock", side: "left", at: 0.5, w: 2.6, open: true },
      { space: "dock", side: "top", at: 0.5, w: 3.6, open: true },
      { space: "cold", side: "left", at: 0.75, w: 1.2 },
      { space: "frz", side: "left", at: 0.75, w: 1.0 },
      { space: "sales", side: "left", at: 0.5, w: 1.2 },
      { space: "deli", side: "right", at: 0.5, w: 1.2 },
    ],
    windows: [
      { space: "lobby", side: "bottom", at: 0.5, w: glassy ? 99 : 6 },
      { space: "cafe", side: "bottom", at: 0.5, w: 99 },
      { space: "kiosk", side: "bottom", at: 0.32, w: 3.0 },
      { space: "staff", side: "top", at: 0.7, w: 1.5 },
      { space: "prep", side: "top", at: 0.5, w: 2.0 },
      { space: "sales", side: "left", at: 0.22, w: 5.0 },
      { space: "sales", side: "left", at: 0.78, w: 5.0 },
    ],
  };
}

/**
 * Six-storey showroom and office building, drawn from the owner's surveyed third-floor plan (22.99 × 11.64 m):
 * street front at y = 1 with the chamfered corner on the left and the round stair tower on the right; offices along
 * the street, a 1.2 m corridor, offices and the kitchen at the back; WCs and the store beside the stair.
 * Fractions of the footprint (the survey's x and y rotated half a turn: street facade in front).
 */
const OFFICE = {
  // partitions on the survey's column lines (5.63, 10.01, 14.39 and 19.40 m from the chamfered corner), front and back:
  // manager | office 5 | office 6 | hall and stair | WC column — office 4 | 3 | 2 | 1 | kitchen
  A: 0.2449, B: 0.4354, C: 0.6259, E: 0.8438,
  back: [0.2449, 0.4354, 0.6259, 0.8438],
  corr: [0.3806, 0.494], // corridor: 1.2 m clear between the 4.3 m back rooms and the 5.8 m street rooms
  // street windows on upper floors (centre, width in m) and the door to the street balcony
  frontWin: [[0.1153, 1.6], [0.1936, 1.6], [0.2827, 0.9], [0.3784, 0.9], [0.5328, 1.8]],
  balconyDoor: 0.332,
  street: { side: "bottom", a0: 0.2345, a1: 0.4115, depth: 1.1 }, // eyvan in front of office 5 (floors 2–4)
  rear: { side: "top", a0: 0.6425, a1: 0.833, depth: 1.2 }, // eyvan behind office 1
  rearDoor: 0.7512,
  sides: [{ side: "right", a0: 0.041, a1: 0.337, depth: 1.2, round: true }, { side: "right", a0: 0.643, a1: 0.908, depth: 1.2, round: true }],
  bay: { side: "top", a0: 0.2318, a1: 0.4485, depth: 1.4 }, // bay window of office 3
};

function officeLevels(spec) {
  const { A, B, C, E, back, corr, frontWin, balconyDoor } = OFFICE;
  const bayAt = (OFFICE.bay.a0 + OFFICE.bay.a1) / 2;
  const [c0, c1] = corr;
  const NAMES = ["GROUND", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"];
  const core = (level, li) => {
    level.spaces.push(
      { id: "holl", label: "HALL", kind: "hall", x: C, y: c1, w: E - C, h: 0.764 - c1 },
      { id: "stair", label: "STAIR / LIFT", kind: "stair", x: C, y: 0.764, w: E - C, h: 1 - 0.764 },
      { id: "ambar", label: "STORE", kind: "store", x: E, y: c1, w: 1 - E, h: 0.776 - c1 },
      { id: "wc2", label: "WC", kind: "wc", x: E, y: 0.776, w: 1 - E, h: 0.112 },
      { id: "wc1", label: "WC", kind: "wc", x: E, y: 0.888, w: 1 - E, h: 0.112 },
    );
    level.doors.push(
      { space: "holl", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "ambar", side: "left", at: 0.5, w: 0.9 },
      { space: "wc2", side: "left", at: 0.5, w: 0.7 },
      { space: "wc1", side: "left", at: 0.5, w: 0.7 },
    );
    level.windows.push({ space: "stair", side: "bottom", at: 0.5, w: 0.9 }, { space: "wc1", side: "bottom", at: 0.5, w: 0.6 }, { space: "wc1", side: "right", at: 0.5, w: 0.6 });
    if (li > 0) level.doors.push({ space: "holl", side: "top", at: 0.5, w: 1.6 });
    if (li > 1) level.doors.push({ space: "ambar", side: "right", at: 0.63, w: 0.8 }); // side balcony from the store
  };
  // a street-front room gets the street windows that fall inside it
  const streetWindows = (level, id, x0, x1, withDoor) => {
    for (const [fx, w] of frontWin) if (fx > x0 + 0.01 && fx < x1 - 0.01) level.windows.push({ space: id, side: "bottom", at: (fx - x0) / (x1 - x0), w });
    if (withDoor) level.doors.push({ space: id, side: "bottom", at: (balconyDoor - x0) / (x1 - x0), w: 0.9 });
  };
  const officeFloor = (li, front, rear) => {
    const level = { name: `${NAMES[li]} FLOOR PLAN`, spaces: [], doors: [], windows: [], balconies: [], bays: [], sill: 0.75, head: 2.82 };
    level.spaces.push({ id: "corr", label: "CORRIDOR", kind: "hall", x: 0, y: c0, w: 1, h: c1 - c0 });
    level.windows.push({ space: "corr", side: "left", at: 0.5, w: 1.0 });
    for (const [id, label, kind, x0, x1] of front) {
      level.spaces.push({ id, label, kind, x: x0, y: c1, w: x1 - x0, h: 1 - c1 });
      level.doors.push({ space: id, side: "top", at: 0.85, w: 0.9 });
      streetWindows(level, id, x0, x1, li >= 2 && li <= 4 && x0 <= balconyDoor && x1 >= balconyDoor);
      if (x0 === 0) level.windows.push({ space: id, side: "left", at: 0.5, w: 1.6 });
    }
    for (const [id, label, kind, x0, x1] of rear) {
      level.spaces.push({ id, label, kind, x: x0, y: 0, w: x1 - x0, h: c0 });
      level.doors.push({ space: id, side: "bottom", at: 0.85, w: 0.9 });
      const bay = x0 <= bayAt && x1 >= bayAt; // the room with the rear bay window
      level.windows.push({ space: id, side: "top", at: bay ? (bayAt - x0) / (x1 - x0) : 0.45, w: bay ? 3.0 : 1.8 });
      if (x0 === 0) level.windows.push({ space: id, side: "left", at: 0.5, w: 1.6 });
      if (x0 <= OFFICE.rearDoor && x1 >= OFFICE.rearDoor && x1 < 1) level.doors.push({ space: id, side: "top", at: (OFFICE.rearDoor - x0) / (x1 - x0), w: 0.9 }); // rear balcony
      if (x1 === 1) level.doors.push({ space: id, side: "right", at: 0.33, w: 0.9 }); // side balcony from the kitchen
    }
    core(level, li);
    // balconies (eyvan) from the survey: three on the street front (upper floors), one at the back, two on the side
    if (li >= 2 && li <= 4) level.balconies.push({ ...OFFICE.street });
    level.balconies.push({ ...OFFICE.rear }, ...OFFICE.sides.map((b) => ({ ...b })));
    level.bays.push({ ...OFFICE.bay });
    return level;
  };
  const OFFICES = [["mgr", "MANAGER", "office", 0, A], ["o5", "OFFICE 5", "office", A, B], ["o6", "OFFICE 6", "office", B, C]];
  const REAR = [["o4", "OFFICE 4", "office", 0, back[0]], ["o3", "OFFICE 3", "office", back[0], back[1]], ["o2", "OFFICE 2", "office", back[1], back[2]], ["o1", "OFFICE 1", "office", back[2], back[3]], ["kit", "KITCHEN", "kitchenette", back[3], 1]];

  // ground floor: door showroom across the street front, dispatch behind the core
  const g = { name: "GROUND FLOOR PLAN", spaces: [], doors: [], windows: [], balconies: [], bays: [], sill: 0.05, head: 3.1 };
  g.spaces.push({ id: "show", label: "DOOR SHOWROOM", kind: "showroom", x: 0, y: 0, w: C, h: 1, labelY: 0.66 }, { id: "disp", label: "DISPATCH", kind: "store", x: C, y: 0, w: 1 - C, h: c1 });
  g.doors.push(
    { space: "show", side: "bottom", at: 0.26, w: 2.2, entry: true, open: true, sliding: true },
    { space: "show", side: "right", at: 0.62, w: 1.6, open: true },
    { space: "disp", side: "left", at: 0.5, w: 1.6 },
    { space: "disp", side: "top", at: 0.5, w: 2.6, open: true },
    { space: "holl", side: "top", at: 0.5, w: 1.0 },
  );
  g.windows.push({ space: "show", side: "bottom", at: 0.55, w: 99 }, { space: "show", side: "left", at: 0.3, w: 3.0 }, { space: "show", side: "left", at: 0.68, w: 3.0 }, { space: "show", side: "top", at: 0.3, w: 2.4 }, { space: "show", side: "top", at: 0.72, w: 2.4 });
  core(g, 0);

  // first floor: window and door gallery (the survey's open hall), samples behind the core
  const f = { name: "FIRST FLOOR PLAN", spaces: [], doors: [], windows: [], balconies: [{ ...OFFICE.rear }], bays: [{ ...OFFICE.bay }], sill: 0.75, head: 2.82 };
  f.spaces.push({ id: "gal", label: "WINDOW AND DOOR GALLERY", kind: "showroom", x: 0, y: 0, w: C, h: 1, labelY: 0.66 }, { id: "samp", label: "SAMPLES", kind: "showroom", x: C, y: 0, w: 1 - C, h: c1 });
  f.doors.push({ space: "gal", side: "right", at: 0.62, w: 1.6, open: true }, { space: "samp", side: "left", at: 0.5, w: 99, open: true }, { space: "samp", side: "top", at: (OFFICE.rearDoor - C) / (1 - C), w: 0.9 });
  streetWindows(f, "gal", 0, C, false);
  f.windows.push({ space: "gal", side: "left", at: 0.3, w: 1.6 }, { space: "gal", side: "left", at: 0.72, w: 1.6 }, { space: "gal", side: "top", at: bayAt / C, w: 3.0 }, { space: "gal", side: "top", at: 0.12 / C, w: 1.8 }, { space: "samp", side: "top", at: 0.35, w: 1.8 });
  core(f, 1);

  return [
    g,
    f,
    officeFloor(2, OFFICES, REAR),
    officeFloor(3, OFFICES, REAR),
    officeFloor(4, OFFICES, REAR),
    officeFloor(5, [["dir", "DIRECTOR", "director", 0, A], ["board", "BOARD ROOM", "meeting", A, C]], [["lounge", "LOUNGE", "lounge", 0, back[1]], ["asst", "ASSISTANT", "office", back[1], back[2]], ["arch", "ARCHIVE", "store", back[2], back[3]], ["kit", "KITCHEN", "kitchenette", back[3], 1]]),
  ];
}

/**
 * Roadside door and window showroom on two levels (fractions of the footprint; the street front at y = 1): a
 * double-height showroom behind the three left-hand glazed bays, window samples in the fourth bay, the warehouse,
 * dispatch, staff room and WCs along the back; upstairs a mezzanine gallery over the warehouse, a meeting room and
 * the sales and design office in the fourth bay, the rest open to the showroom below.
 */
const SHOWROOM = { bays: [0, 0.25, 0.5, 0.75, 1], back: 0.36 };

function showroomLevels() {
  const bk = SHOWROOM.back;
  const level = (name, sill, head) => ({ name, spaces: [], doors: [], windows: [], sill, head });
  const g = level("GROUND FLOOR PLAN", 0.4, 4.0);
  g.spaces.push(
    { id: "show", label: "DOOR SHOWROOM", kind: "showroom", x: 0, y: bk, w: 0.75, h: 1 - bk, labelY: 0.62 },
    { id: "samp", label: "WINDOW SAMPLES", kind: "showroom", x: 0.75, y: bk, w: 0.25, h: 1 - bk },
    { id: "stair", label: "STAIR", kind: "stair", x: 0, y: 0, w: 0.14, h: bk },
    { id: "store", label: "WAREHOUSE", kind: "racks", x: 0.14, y: 0, w: 0.36, h: bk },
    { id: "disp", label: "DISPATCH", kind: "dock", x: 0.5, y: 0, w: 0.25, h: bk },
    { id: "wc1", label: "WC", kind: "wc", x: 0.75, y: 0, w: 0.125, h: 0.17 },
    { id: "wc2", label: "WC", kind: "wc", x: 0.875, y: 0, w: 0.125, h: 0.17 },
    { id: "staff", label: "STAFF ROOM", kind: "staff", x: 0.75, y: 0.17, w: 0.25, h: bk - 0.17 },
  );
  g.doors.push(
    { space: "show", side: "bottom", at: 0.1783, w: 2.0, entry: true, open: true, sliding: true },
    { space: "show", side: "right", at: 0.5, w: 99, open: true },
    { space: "stair", side: "bottom", at: 0.5, w: 99, open: true },
    { space: "store", side: "bottom", at: 0.5, w: 1.6 },
    { space: "store", side: "right", at: 0.5, w: 1.6, open: true },
    { space: "disp", side: "top", at: 0.5, w: 3.2, open: true },
    { space: "disp", side: "bottom", at: 0.5, w: 1.6 },
    { space: "staff", side: "bottom", at: 0.5, w: 0.9 },
    { space: "wc1", side: "bottom", at: 0.5, w: 0.8 },
    { space: "wc2", side: "bottom", at: 0.5, w: 0.8 },
  );
  // two glazed bays either side of the entrance, then one per bay
  g.windows.push(
    { space: "show", side: "bottom", at: 0.0826, w: 1.15 },
    { space: "show", side: "bottom", at: 0.2739, w: 1.15 },
    { space: "show", side: "bottom", at: 0.5, w: 4.4 },
    { space: "show", side: "bottom", at: 0.8333, w: 4.4 },
    { space: "samp", side: "bottom", at: 0.4652, w: 4.4 },
    { space: "store", side: "top", at: 0.3, w: 2.0 },
    { space: "staff", side: "top", at: 0.5, w: 1.2 },
  );
  const m = level("MEZZANINE PLAN", 0.3, 3.6);
  m.spaces.push(
    { id: "void", label: "OPEN TO SHOWROOM BELOW", kind: "void", x: 0, y: bk, w: 0.75, h: 1 - bk },
    { id: "stair", label: "STAIR", kind: "stair", x: 0, y: 0, w: 0.14, h: bk },
    { id: "gal", label: "GALLERY", kind: "showroom", x: 0.14, y: 0, w: 0.61, h: bk },
    { id: "meet", label: "MEETING ROOM", kind: "meeting", x: 0.75, y: 0, w: 0.25, h: 0.2 },
    { id: "off", label: "SALES OFFICE", kind: "openoffice", x: 0.75, y: 0.2, w: 0.25, h: 0.8 },
  );
  m.doors.push(
    { space: "gal", side: "bottom", at: 0.5, w: 99, open: true, rail: true },
    { space: "gal", side: "left", at: 0.5, w: 99, open: true },
    { space: "meet", side: "left", at: 0.5, w: 0.9 },
    { space: "off", side: "left", at: 0.1, w: 0.9 },
  );
  m.windows.push(
    { space: "void", side: "bottom", at: 0.1783, w: 4.4 },
    { space: "void", side: "bottom", at: 0.5, w: 4.4 },
    { space: "void", side: "bottom", at: 0.8333, w: 4.4 },
    { space: "off", side: "bottom", at: 0.4652, w: 4.4 },
    { space: "gal", side: "top", at: 0.3, w: 2.0 },
    { space: "gal", side: "top", at: 0.75, w: 2.0 },
    { space: "meet", side: "top", at: 0.5, w: 2.0 },
  );
  return [g, m];
}

// ------------------------------------------------------------------ commercial buildings

// Templates in footprint fractions like the houses above (y = 0 back, y = 1 the street front), built room by room.
const newLevel = (name, extra = {}) => ({ name, spaces: [], doors: [], windows: [], ...extra });
const addRoom = (lv, id, label, kind, x, y, w, h, extra = {}) => lv.spaces.push({ id, label, kind, x, y, w, h, ...extra });
const addDoor = (lv, space, side, at, w, extra = {}) => lv.doors.push({ space, side, at, w, ...extra });
const addWin = (lv, space, side, at, w) => lv.windows.push({ space, side, at, w });
const floorName = (li) => `${FLOOR_NAMES[li] ?? `LEVEL ${li}`} FLOOR PLAN`;

/** Windows along one side of a room: full-height glazing, a ribbon window, or punched openings every ~3.2 m. */
function facadeWindows(lv, id, side, lenM, style, { w = 1.8, every = 3.2 } = {}) {
  if (style === "full" || style === "ribbon") return addWin(lv, id, side, 0.5, 99);
  const n = Math.max(1, Math.round(lenM / every));
  for (let i = 0; i < n; i++) addWin(lv, id, side, (i + 0.5) / n, Math.max(0.9, Math.min(w, lenM / n - 0.7)));
}

/** Upper floors of a commercial building: identical floors share a `typical` key and are drawn once. */
const upperLevel = (li, typical, spec, extra = {}) =>
  newLevel(floorName(li), { typical, ...(spec.windows === "ribbon" ? { sill: 0.9, head: 2.9 } : spec.windows === "punched" ? { sill: 0.8 } : {}), ...extra });

/**
 * Business centre on 4–14 floors, three plans (plan.layout):
 * a — central core (two stairs, lifts and WCs round a lift lobby) between two open-plan office wings;
 * b — core and meeting rooms along the back, a corridor, open office and cellular offices along the front;
 * c — a long slab with a core at each end, two tenancies per floor.
 * The ground floor has the entrance hall with a café or restaurant, a retail unit or fitness club and the service rooms.
 */
function bizcenterLevels(plan, W, D, spec) {
  const lay = layoutOf(plan), style = spec.windows ?? "full";
  const levels = [];
  if (lay === "a") {
    const core = (lv) => {
      addRoom(lv, "stA", "STAIR", "stair", 0.38, 0.3, 0.06, 0.2);
      addRoom(lv, "wcM", "WC", "wc", 0.38, 0.5, 0.06, 0.2);
      addRoom(lv, "lifts", "LIFTS", "lift", 0.44, 0.3, 0.12, 0.12);
      addRoom(lv, "lob", "LIFT LOBBY", "hall", 0.44, 0.42, 0.12, 0.28);
      addRoom(lv, "stB", "STAIR", "stair", 0.56, 0.3, 0.06, 0.2);
      addRoom(lv, "wcF", "WC", "wc", 0.56, 0.5, 0.06, 0.2);
      addDoor(lv, "stA", "right", 0.85, 1.0);
      addDoor(lv, "wcM", "right", 0.5, 0.9);
      addDoor(lv, "stB", "left", 0.85, 1.0);
      addDoor(lv, "wcF", "left", 0.5, 0.9);
      addDoor(lv, "lifts", "bottom", 0.5, 99, { open: true });
      addDoor(lv, "lob", "bottom", 0.5, 99, { open: true });
    };
    const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
    addRoom(g, "cafeK", "CAFE KITCHEN", "prep", 0, 0, 0.2, 0.35);
    addRoom(g, "store", "STORE", "store", 0.2, 0, 0.18, 0.35);
    addRoom(g, "cafe", "CAFE", "cafe", 0, 0.35, 0.38, 0.65);
    addRoom(g, "sec", "SECURITY", "office", 0.38, 0, 0.12, 0.22);
    addRoom(g, "plant", "PLANT ROOM", "store", 0.5, 0, 0.12, 0.22);
    addRoom(g, "svc", "SERVICE CORRIDOR", "hall", 0.38, 0.22, 0.24, 0.08);
    core(g);
    addRoom(g, "hall", "ENTRANCE HALL", "reception", 0.38, 0.7, 0.24, 0.3);
    addRoom(g, "dock", "LOADING BAY", "dock", 0.62, 0, 0.2, 0.35);
    addRoom(g, "refuse", "REFUSE", "store", 0.82, 0, 0.18, 0.35);
    addRoom(g, "shop", "RETAIL UNIT", "boutique", 0.62, 0.35, 0.38, 0.65);
    addDoor(g, "hall", "bottom", 0.5, 2.4, { entry: true, open: true, sliding: true });
    addDoor(g, "hall", "left", 0.5, 1.6);
    addDoor(g, "cafe", "bottom", 0.22, 1.2, { entry: true });
    addDoor(g, "shop", "bottom", 0.7, 1.4, { entry: true });
    addDoor(g, "cafeK", "bottom", 0.5, 1.0);
    addDoor(g, "cafeK", "top", 0.4, 1.0);
    addDoor(g, "store", "right", 0.74, 0.9);
    addDoor(g, "sec", "bottom", 0.5, 0.9);
    addDoor(g, "plant", "bottom", 0.5, 0.9);
    addDoor(g, "stA", "top", 0.5, 1.0);
    addDoor(g, "stB", "top", 0.5, 1.0);
    addDoor(g, "dock", "top", 0.5, 3.0, { open: true });
    addDoor(g, "dock", "left", 0.74, 1.2);
    addDoor(g, "refuse", "top", 0.5, 1.2);
    addWin(g, "hall", "bottom", 0.5, 99);
    addWin(g, "cafe", "bottom", 0.5, 99);
    addWin(g, "shop", "bottom", 0.5, 99);
    facadeWindows(g, "cafe", "left", 0.65 * D, "punched", { w: 2.4 });
    facadeWindows(g, "shop", "right", 0.65 * D, "punched", { w: 2.4 });
    addWin(g, "cafeK", "left", 0.5, 1.2);
    addWin(g, "sec", "top", 0.5, 1.4);
    levels.push(g);
    for (let li = 1; li < plan.floors; li++) {
      const lv = upperLevel(li, "office", spec);
      addRoom(lv, "offL", "OPEN OFFICE", "openoffice", 0, 0, 0.38, 1);
      addRoom(lv, "meet", "MEETING ROOM", "meeting", 0.38, 0, 0.12, 0.3);
      addRoom(lv, "tea", "TEA POINT", "kitchenette", 0.5, 0, 0.12, 0.3);
      core(lv);
      addRoom(lv, "brk", "BREAKOUT", "lounge", 0.38, 0.7, 0.24, 0.3);
      addRoom(lv, "offR", "OPEN OFFICE", "openoffice", 0.62, 0, 0.38, 1);
      addDoor(lv, "brk", "left", 0.5, 99, { open: true });
      addDoor(lv, "brk", "right", 0.5, 99, { open: true });
      addDoor(lv, "meet", "left", 0.5, 0.9);
      addDoor(lv, "tea", "right", 0.5, 0.9);
      for (const [id, f] of [["offL", 0.38], ["brk", 0.24], ["offR", 0.38]]) facadeWindows(lv, id, "bottom", f * W, style);
      for (const [id, f] of [["offL", 0.38], ["meet", 0.12], ["tea", 0.12], ["offR", 0.38]]) facadeWindows(lv, id, "top", f * W, style);
      facadeWindows(lv, "offL", "left", D, style);
      facadeWindows(lv, "offR", "right", D, style);
      levels.push(lv);
    }
    return levels;
  }
  if (lay === "b") {
    const back = 0.28, c1 = 0.36;
    const core = (lv, rooms) => {
      // stair, rooms, stair, lifts and WCs along the back wall, all opening onto the corridor
      const row = [["stA", "STAIR", "stair", 0, 0.08], ...rooms, ["stB", "STAIR", "stair", 0.62, 0.72], ["lifts", "LIFTS", "lift", 0.72, 0.86], ["wcM", "WC", "wc", 0.86, 0.93], ["wcF", "WC", "wc", 0.93, 1]];
      for (const [id, label, kind, x0, x1] of row) {
        addRoom(lv, id, label, kind, x0, 0, x1 - x0, back);
        addDoor(lv, id, "bottom", 0.5, kind === "lift" ? 99 : kind === "stair" ? 1.0 : 0.9, kind === "lift" ? { open: true } : {});
        if (!["lift", "wc", "stair"].includes(kind)) facadeWindows(lv, id, "top", (x1 - x0) * W, style === "full" ? "punched" : style, { w: 2.0 });
      }
      addRoom(lv, "corr", "CORRIDOR", "hall", 0, back, 1, c1 - back);
      addWin(lv, "corr", "left", 0.5, 1.2);
      addWin(lv, "corr", "right", 0.5, 1.2);
    };
    const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
    core(g, [["sec", "SECURITY", "office", 0.08, 0.24], ["mail", "MAIL ROOM", "store", 0.24, 0.38], ["staff", "STAFF ROOM", "staff", 0.38, 0.5], ["plant", "PLANT ROOM", "store", 0.5, 0.62]]);
    addRoom(g, "cafe", "CAFE", "cafe", 0, c1, 0.32, 1 - c1);
    addRoom(g, "hall", "ENTRANCE HALL", "reception", 0.32, c1, 0.3, 1 - c1);
    addRoom(g, "shop", "RETAIL UNIT", "boutique", 0.62, c1, 0.38, 1 - c1);
    addDoor(g, "cafe", "top", 0.5, 1.2);
    addDoor(g, "cafe", "bottom", 0.3, 1.2, { entry: true });
    addDoor(g, "hall", "top", 0.5, 99, { open: true });
    addDoor(g, "hall", "bottom", 0.5, 2.4, { entry: true, open: true, sliding: true });
    addDoor(g, "shop", "top", 0.5, 1.2);
    addDoor(g, "shop", "bottom", 0.7, 1.4, { entry: true });
    for (const id of ["cafe", "hall", "shop"]) addWin(g, id, "bottom", 0.5, 99);
    facadeWindows(g, "cafe", "left", (1 - c1) * D, "punched", { w: 2.4 });
    facadeWindows(g, "shop", "right", (1 - c1) * D, "punched", { w: 2.4 });
    levels.push(g);
    for (let li = 1; li < plan.floors; li++) {
      const lv = upperLevel(li, "office", spec);
      core(lv, [["m1", "MEETING ROOM", "meeting", 0.08, 0.24], ["m2", "MEETING ROOM", "meeting", 0.24, 0.38], ["tea", "TEA POINT", "kitchenette", 0.38, 0.5], ["prn", "PRINT / STORE", "store", 0.5, 0.62]]);
      const front = [["open", "OPEN OFFICE", "openoffice", 0, 0.58], ["dir", "DIRECTOR", "director", 0.58, 0.72], ["o1", "OFFICE", "office", 0.72, 0.86], ["o2", "OFFICE", "office", 0.86, 1]];
      for (const [id, label, kind, x0, x1] of front) {
        addRoom(lv, id, label, kind, x0, c1, x1 - x0, 1 - c1);
        addDoor(lv, id, "top", kind === "openoffice" ? 0.5 : 0.2, kind === "openoffice" ? 99 : 0.9, kind === "openoffice" ? { open: true } : {});
        facadeWindows(lv, id, "bottom", (x1 - x0) * W, style);
      }
      facadeWindows(lv, "open", "left", (1 - c1) * D, style);
      facadeWindows(lv, "o2", "right", (1 - c1) * D, style);
      levels.push(lv);
    }
    return levels;
  }
  // c: a core at each end of a long slab
  const back = 0.3, c1 = 0.38;
  const ends = (lv, middle) => {
    const row = [["stL", "STAIR", "stair", 0, 0.07], ["lfL", "LIFTS", "lift", 0.07, 0.13], ["wM1", "WC", "wc", 0.13, 0.17], ["wF1", "WC", "wc", 0.17, 0.21], ...middle, ["wF2", "WC", "wc", 0.79, 0.83], ["wM2", "WC", "wc", 0.83, 0.87], ["lfR", "LIFTS", "lift", 0.87, 0.93], ["stR", "STAIR", "stair", 0.93, 1]];
    for (const [id, label, kind, x0, x1] of row) {
      addRoom(lv, id, label, kind, x0, 0, x1 - x0, back);
      addDoor(lv, id, "bottom", 0.5, kind === "lift" ? 99 : kind === "stair" ? 1.0 : 0.9, kind === "lift" ? { open: true } : {});
      if (!["lift", "wc", "stair", "cold"].includes(kind)) facadeWindows(lv, id, "top", (x1 - x0) * W, style === "full" ? "punched" : style, { w: 2.0 });
    }
    addRoom(lv, "corr", "CORRIDOR", "hall", 0, back, 1, c1 - back);
    addWin(lv, "corr", "left", 0.5, 1.2);
    addWin(lv, "corr", "right", 0.5, 1.2);
  };
  const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
  ends(g, [["kit", "RESTAURANT KITCHEN", "prep", 0.21, 0.37], ["cold", "COLD ROOM", "cold", 0.37, 0.45], ["sec", "SECURITY", "office", 0.45, 0.63], ["chg", "CHANGING ROOM", "shower", 0.63, 0.79]]);
  const gFront = [["rest", "RESTAURANT", "restaurant", 0, 0.32], ["hall", "ENTRANCE HALL", "reception", 0.32, 0.68], ["gym", "FITNESS CLUB", "gym", 0.68, 1]];
  for (const [id, label, kind, x0, x1] of gFront) {
    addRoom(g, id, label, kind, x0, c1, x1 - x0, 1 - c1);
    addDoor(g, id, "top", 0.5, kind === "reception" ? 99 : 1.4, kind === "reception" ? { open: true } : {});
    addDoor(g, id, "bottom", kind === "reception" ? 0.5 : 0.3, kind === "reception" ? 2.6 : 1.4, { entry: true, ...(kind === "reception" ? { open: true, sliding: true } : {}) });
    addWin(g, id, "bottom", 0.5, 99);
  }
  facadeWindows(g, "rest", "left", (1 - c1) * D, "punched", { w: 2.4 });
  facadeWindows(g, "gym", "right", (1 - c1) * D, "punched", { w: 2.4 });
  levels.push(g);
  for (let li = 1; li < plan.floors; li++) {
    const lv = upperLevel(li, "office", spec);
    ends(lv, [["m1", "MEETING ROOM", "meeting", 0.21, 0.37], ["tea", "TEA POINT", "kitchenette", 0.37, 0.5], ["m2", "MEETING ROOM", "meeting", 0.5, 0.63], ["prn", "PRINT / STORE", "store", 0.63, 0.79]]);
    for (const [id, label, x0, x1] of [["offA", "OPEN OFFICE A", 0, 0.5], ["offB", "OPEN OFFICE B", 0.5, 1]]) {
      addRoom(lv, id, label, "openoffice", x0, c1, x1 - x0, 1 - c1);
      addDoor(lv, id, "top", 0.5, 99, { open: true });
      facadeWindows(lv, id, "bottom", (x1 - x0) * W, style);
    }
    facadeWindows(lv, "offA", "left", (1 - c1) * D, style);
    facadeWindows(lv, "offB", "right", (1 - c1) * D, style);
    levels.push(lv);
  }
  return levels;
}

/** Guest rooms in a row between x0 and x1 (metres): each opens onto the corridor, its en-suite by the door. */
function guestRooms(lv, W, D, x0, x1, y0, y1, corridor, tag, { bay = 3.7, win = 1.8 } = {}) {
  const n = Math.max(1, Math.floor((x1 - x0) / bay));
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const id = `${tag}${i + 1}`;
    addRoom(lv, id, "GUEST ROOM", "guestroom", (x0 + i * w) / W, y0, w / W, y1 - y0, { corridor });
    addDoor(lv, id, corridor, i % 2 ? 0.78 : 0.22, 0.9);
    addWin(lv, id, corridor === "top" ? "bottom" : "top", 0.5, Math.min(win, w - 0.9));
  }
}

/**
 * Hotel on 3–10 floors (plan.layout): a — city hotel, rooms either side of a central corridor, stairs at both ends
 * and lifts at the back; b — resort hotel, one row of rooms facing the front with balconies, the corridor along
 * the back. The ground floor has the lobby, restaurant, lounge bar, kitchen and back of house.
 */
function hotelLevels(plan, W, D, spec) {
  const levels = [];
  const st = 3.2; // stair width (m)
  if (layoutOf(plan) === "a") {
    const cw = 1.9, cy0 = (D - cw) / 2 / D, cy1 = (D + cw) / 2 / D;
    const lift0 = W / 2 - 2.2, lift1 = W / 2 + 2.2;
    const frame = (lv, backEnds) => {
      addRoom(lv, "corr", "CORRIDOR", "hall", 0, cy0, 1, cy1 - cy0);
      addRoom(lv, "stL", "STAIR", "stair", 0, cy1, st / W, 1 - cy1);
      addRoom(lv, "stR", "STAIR", "stair", 1 - st / W, cy1, st / W, 1 - cy1);
      addRoom(lv, "lifts", "LIFTS", "lift", lift0 / W, 0, (lift1 - lift0) / W, cy0);
      addDoor(lv, "stL", "top", 0.5, 1.0);
      addDoor(lv, "stR", "top", 0.5, 1.0);
      addDoor(lv, "lifts", "bottom", 0.5, 99, { open: true });
      addWin(lv, "corr", "left", 0.5, 1.2);
      addWin(lv, "corr", "right", 0.5, 1.2);
      for (const [id, label, kind, x0] of backEnds) {
        addRoom(lv, id, label, kind, x0, 0, st / W, cy0);
        addDoor(lv, id, "bottom", 0.5, 0.9);
      }
    };
    const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
    frame(g, [["office", "OFFICE", "office", 0], ["plant", "PLANT ROOM", "store", 1 - st / W]]);
    const gFront = [["rest", "RESTAURANT", "restaurant", st, 0.42 * W], ["lobby", "LOBBY / RECEPTION", "reception", 0.42 * W, 0.62 * W], ["bar", "LOUNGE BAR", "bar", 0.62 * W, W - st]];
    for (const [id, label, kind, x0, x1] of gFront) {
      addRoom(g, id, label, kind, x0 / W, cy1, (x1 - x0) / W, 1 - cy1);
      addDoor(g, id, "top", 0.5, kind === "reception" ? 99 : 1.6, kind === "reception" ? { open: true } : {});
      addWin(g, id, "bottom", 0.5, 99);
    }
    addDoor(g, "lobby", "bottom", 0.5, 2.6, { entry: true, open: true, sliding: true });
    addDoor(g, "lobby", "left", 0.5, 3.0, { open: true });
    addDoor(g, "lobby", "right", 0.5, 3.0, { open: true });
    const gBack = [["kit", "KITCHEN", "prokitchen", st, lift0 - 3.0], ["cold", "COLD STORE", "cold", lift0 - 3.0, lift0], ["lug", "LUGGAGE", "store", lift1, lift1 + 2.8], ["wcM", "WC", "wc", lift1 + 2.8, lift1 + 5.2], ["wcF", "WC", "wc", lift1 + 5.2, lift1 + 7.6], ["staff", "STAFF ROOM", "staff", lift1 + 7.6, W - st]];
    for (const [id, label, kind, x0, x1] of gBack) {
      addRoom(g, id, label, kind, x0 / W, 0, (x1 - x0) / W, cy0);
      addDoor(g, id, "bottom", 0.5, kind === "prokitchen" ? 1.6 : 0.9);
      if (["prokitchen", "staff"].includes(kind)) facadeWindows(g, id, "top", x1 - x0, "punched", { w: 2.0 });
    }
    addDoor(g, "kit", "top", 0.2, 1.2);
    levels.push(g);
    for (let li = 1; li < plan.floors; li++) {
      const lv = upperLevel(li, "rooms", spec, { sill: 0.6, head: 2.75 });
      frame(lv, [["linen", "LINEN", "store", 0], ["hk", "HOUSEKEEPING", "store", 1 - st / W]]);
      guestRooms(lv, W, D, st, W - st, cy1, 1, "top", "f");
      guestRooms(lv, W, D, st, lift0, 0, cy0, "bottom", "l");
      guestRooms(lv, W, D, lift1, W - st, 0, cy0, "bottom", "r");
      levels.push(lv);
    }
    return levels;
  }
  // b: single-loaded resort slab, lifts a third of the way along
  const cw = 2.0, c1 = cw / D;
  const lift0 = 0.28 * W, lift1 = lift0 + 4.4;
  const frame = (lv) => {
    addRoom(lv, "corr", "CORRIDOR", "hall", 0, 0, 1, c1);
    addRoom(lv, "stL", "STAIR", "stair", 0, c1, st / W, 1 - c1);
    addRoom(lv, "stR", "STAIR", "stair", 1 - st / W, c1, st / W, 1 - c1);
    const ld = 0.42 * (1 - c1); // lifts at the back of the room row, a store in front of them
    addRoom(lv, "lifts", "LIFTS", "lift", lift0 / W, c1, (lift1 - lift0) / W, ld);
    // on the ground floor the luggage room off the lobby, above it the service risers
    addRoom(lv, "linen", lv.typical ? "RISERS / PLANT" : "LUGGAGE", "store", lift0 / W, c1 + ld, (lift1 - lift0) / W, 1 - c1 - ld);
    if (!lv.typical) addDoor(lv, "linen", "right", 0.5, 0.9);
    addDoor(lv, "stL", "top", 0.5, 1.0);
    addDoor(lv, "stR", "top", 0.5, 1.0);
    addDoor(lv, "lifts", "top", 0.5, 99, { open: true });
    facadeWindows(lv, "corr", "top", W, "punched", { w: 1.4, every: 7.5 });
  };
  const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
  frame(g);
  const gRow = [["kit", "KITCHEN", "prokitchen", st, 0.13 * W], ["rest", "RESTAURANT", "restaurant", 0.13 * W, lift0], ["lobby", "LOBBY / RECEPTION", "reception", lift1, 0.55 * W], ["bar", "LOUNGE BAR", "bar", 0.55 * W, 0.7 * W], ["spa", "SPA", "treatment", 0.7 * W, 0.86 * W], ["wcM", "WC", "wc", 0.86 * W, 0.86 * W + (0.14 * W - st) / 2], ["wcF", "WC", "wc", 0.86 * W + (0.14 * W - st) / 2, W - st]];
  for (const [id, label, kind, x0, x1] of gRow) {
    addRoom(g, id, label, kind, x0 / W, c1, (x1 - x0) / W, 1 - c1);
    addDoor(g, id, "top", 0.5, ["reception", "restaurant"].includes(kind) ? 99 : kind === "prokitchen" ? 1.6 : 0.9, ["reception", "restaurant"].includes(kind) ? { open: true } : {});
    if (!["wc", "prokitchen"].includes(kind)) addWin(g, id, "bottom", 0.5, 99);
  }
  addWin(g, "kit", "bottom", 0.5, 2.0);
  addDoor(g, "lobby", "bottom", 0.5, 2.6, { entry: true, open: true, sliding: true });
  addDoor(g, "rest", "bottom", 0.5, 2.4, { open: true, sliding: true });
  addDoor(g, "kit", "right", 0.5, 1.6);
  addDoor(g, "bar", "left", 0.5, 3.0, { open: true });
  levels.push(g);
  for (let li = 1; li < plan.floors; li++) {
    const lv = upperLevel(li, "rooms", spec, { sill: 0.05, head: 2.75 });
    frame(lv);
    guestRooms(lv, W, D, st, lift0, c1, 1, "top", "a", { bay: 3.9, win: 99 });
    guestRooms(lv, W, D, lift1, W - st, c1, 1, "top", "b", { bay: 3.9, win: 99 });
    lv.balconies = [{ side: "bottom", a0: st / W, a1: lift0 / W, depth: 1.8, glass: true }, { side: "bottom", a0: lift1 / W, a1: 1 - st / W, depth: 1.8, glass: true }];
    levels.push(lv);
  }
  return levels;
}

/**
 * Restaurant on one or two floors (plan.layout): a — garden restaurant, dining hall and bar along the front, kitchen
 * and WCs behind; b — city restaurant, the dining hall below and an event hall with private dining rooms upstairs;
 * c — seafront grill, an open grill between the dining room and the bar under a deep canopy; d — mountain lodge,
 * dining hall and tea room below, private rooms off a gallery upstairs under a pitched roof.
 */
function restaurantLevels(plan, W, D) {
  const lay = layoutOf(plan);
  const row = (lv, y0, y1, rooms) => {
    for (const [id, label, kind, x0, x1, extra] of rooms) addRoom(lv, id, label, kind, x0, y0, x1 - x0, y1 - y0, extra ?? {});
  };
  const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
  if (lay === "a" || lay === "c") {
    const b = lay === "a" ? 0.4 : 0.36;
    row(g, 0, b, [["wcM", "WC", "wc", 0, 0.09], ["wcF", "WC", "wc", 0.09, 0.18], ["staff", "STAFF ROOM", "staff", 0.18, 0.3], ["kit", "KITCHEN", "prokitchen", 0.3, lay === "a" ? 0.74 : 0.7], ["cold", "COLD ROOM", "cold", lay === "a" ? 0.74 : 0.7, lay === "a" ? 0.87 : 0.85], ["store", "BAR STORE", "store", lay === "a" ? 0.87 : 0.85, 1]]);
    if (lay === "a") row(g, b, 1, [["dine", "DINING HALL", "restaurant", 0, 0.66], ["bar", "BAR / LOUNGE", "bar", 0.66, 1]]);
    else row(g, b, 1, [["dine", "DINING ROOM", "restaurant", 0, 0.52], ["grill", "OPEN GRILL", "grill", 0.52, 0.76], ["bar", "BAR", "bar", 0.76, 1]]);
    addDoor(g, "dine", "bottom", 0.5, 1.8, { entry: true });
    addDoor(g, "wcM", "bottom", 0.5, 0.9);
    addDoor(g, "wcF", "bottom", 0.5, 0.9);
    addDoor(g, "staff", "right", 0.5, 0.9);
    addDoor(g, "kit", "bottom", lay === "a" ? 0.4 : 0.7, 1.6);
    addDoor(g, "kit", "top", 0.15, 1.2);
    addDoor(g, "cold", "left", 0.5, 1.0);
    addDoor(g, "store", "bottom", 0.5, 0.9);
    addDoor(g, "bar", "left", 0.5, 99, { open: true });
    if (lay === "c") addDoor(g, "grill", "left", 0.5, 99, { open: true });
    addWin(g, "dine", "bottom", 0.5, 99);
    addWin(g, "bar", "bottom", 0.5, 99);
    if (lay === "c") addWin(g, "grill", "bottom", 0.5, 99);
    addWin(g, "dine", "left", 0.5, 99);
    facadeWindows(g, "bar", "right", (1 - b) * D, "punched", { w: 2.4 });
    addWin(g, "kit", "top", 0.6, 2.4);
    addWin(g, "staff", "top", 0.5, 1.2);
    return [g];
  }
  // two floors: b (city) and d (lodge)
  const b = lay === "b" ? 0.38 : 0.36;
  const back = lay === "b"
    ? [["st", "STAIR", "stair", 0, 0.1], ["wcM", "WC", "wc", 0.1, 0.19], ["wcF", "WC", "wc", 0.19, 0.28], ["kit", "KITCHEN", "prokitchen", 0.28, 0.78]]
    : [["st", "STAIR", "stair", 0, 0.1], ["wcM", "WC", "wc", 0.1, 0.19], ["wcF", "WC", "wc", 0.19, 0.28], ["kit", "KITCHEN", "prokitchen", 0.28, 0.72], ["bake", "TANDIR BAKERY", "prep", 0.72, 1]];
  row(g, 0, b, back);
  if (lay === "b") {
    addRoom(g, "cold", "COLD ROOM", "cold", 0.78, 0, 0.22, b / 2);
    addRoom(g, "store", "DRY STORE", "store", 0.78, b / 2, 0.22, b / 2);
    addDoor(g, "cold", "left", 0.5, 1.0);
    addDoor(g, "store", "left", 0.5, 0.9);
    row(g, b, 1, [["dine", "DINING HALL", "restaurant", 0, 0.62], ["bar", "BAR", "bar", 0.62, 1]]);
  } else {
    addDoor(g, "bake", "left", 0.5, 1.2);
    row(g, b, 1, [["dine", "DINING HALL", "restaurant", 0, 0.64], ["bar", "TEA ROOM", "teahall", 0.64, 1]]);
  }
  addDoor(g, "st", "bottom", 0.5, 1.2);
  addDoor(g, "wcM", "bottom", 0.5, 0.9);
  addDoor(g, "wcF", "bottom", 0.5, 0.9);
  addDoor(g, "kit", "bottom", 0.3, 1.6);
  addDoor(g, "kit", "top", 0.2, 1.2);
  addDoor(g, "dine", "bottom", 0.5, 1.8, { entry: true });
  addDoor(g, "bar", "left", 0.5, 99, { open: true });
  addWin(g, "dine", "bottom", 0.5, 99);
  addWin(g, "bar", "bottom", 0.5, 99);
  facadeWindows(g, "dine", "left", (1 - b) * D, "punched", { w: 2.4 });
  facadeWindows(g, "bar", "right", (1 - b) * D, "punched", { w: 2.4 });
  addWin(g, "kit", "top", 0.6, 2.4);
  const f = newLevel("FIRST FLOOR PLAN", lay === "d" ? { sill: 0.6, head: 2.6 } : { sill: 0.05 });
  if (lay === "b") {
    row(f, 0, b, [["st", "STAIR", "stair", 0, 0.1], ["wcM", "WC", "wc", 0.1, 0.19], ["wcF", "WC", "wc", 0.19, 0.28], ["serv", "SERVERY", "prep", 0.28, 0.5], ["pd1", "PRIVATE DINING", "privatedining", 0.5, 0.67], ["pd2", "PRIVATE DINING", "privatedining", 0.67, 0.84], ["pd3", "PRIVATE DINING", "privatedining", 0.84, 1]]);
    addRoom(f, "hall", "EVENT HALL", "restaurant", 0, b, 1, 1 - b);
    for (const id of ["st", "wcM", "wcF", "serv", "pd1", "pd2", "pd3"]) addDoor(f, id, "bottom", 0.5, id === "serv" ? 1.6 : id === "st" ? 1.2 : 0.9);
    addWin(f, "hall", "bottom", 0.5, 99);
    facadeWindows(f, "hall", "left", (1 - b) * D, "punched", { w: 2.4 });
    facadeWindows(f, "hall", "right", (1 - b) * D, "punched", { w: 2.4 });
    for (const id of ["pd1", "pd2", "pd3", "serv"]) addWin(f, id, "top", 0.5, 1.8);
    return [g, f];
  }
  const corr0 = b, corr1 = b + 0.1;
  row(f, 0, corr0, [["st", "STAIR", "stair", 0, 0.1], ["wcM", "WC", "wc", 0.1, 0.19], ["wcF", "WC", "wc", 0.19, 0.28], ["serv", "SERVERY", "prep", 0.28, 0.6], ["store", "LINEN / STORE", "store", 0.6, 1]]);
  addRoom(f, "gal", "GALLERY", "hall", 0, corr0, 1, corr1 - corr0);
  row(f, corr1, 1, [["k1", "PRIVATE ROOM", "privatedining", 0, 0.25], ["k2", "PRIVATE ROOM", "privatedining", 0.25, 0.5], ["k3", "PRIVATE ROOM", "privatedining", 0.5, 0.75], ["k4", "PRIVATE ROOM", "privatedining", 0.75, 1]]);
  for (const id of ["st", "wcM", "wcF", "serv", "store"]) addDoor(f, id, "bottom", 0.5, id === "serv" ? 1.4 : id === "st" ? 1.2 : 0.9);
  for (const id of ["k1", "k2", "k3", "k4"]) {
    addDoor(f, id, "top", 0.5, 1.0);
    addWin(f, id, "bottom", 0.5, 2.0);
  }
  addWin(f, "k1", "left", 0.5, 1.6);
  addWin(f, "k4", "right", 0.5, 1.6);
  addWin(f, "serv", "top", 0.5, 1.6);
  addWin(f, "gal", "left", 0.5, 1.0);
  return [g, f];
}

/**
 * Wedding and banquet hall on one tall floor: a foyer across the front, the banquet hall with its stage and dance
 * floor, the bridal room and a VIP lounge either side of the foyer, WCs off the hall, and the kitchen and back of
 * house along a service corridor at the back.
 */
function banquetLevels() {
  const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05 });
  const back = 0.21, svc = 0.26, foyer = 0.82, wing = 0.12;
  const backRow = [["staff", "STAFF ROOM", "staff", 0, 0.14], ["dry", "DRY STORE", "store", 0.14, 0.3], ["kit", "KITCHEN", "prokitchen", 0.3, 0.7], ["cold", "COLD ROOM", "cold", 0.7, 0.8], ["wash", "DISHWASH", "prep", 0.8, 0.9], ["plant", "PLANT ROOM", "store", 0.9, 1]];
  for (const [id, label, kind, x0, x1] of backRow) {
    addRoom(g, id, label, kind, x0, 0, x1 - x0, back);
    addDoor(g, id, "bottom", 0.5, kind === "prokitchen" ? 2.0 : 0.9);
  }
  addDoor(g, "kit", "top", 0.2, 1.6, { open: true });
  addWin(g, "kit", "top", 0.6, 3.0);
  addWin(g, "staff", "top", 0.5, 1.4);
  addRoom(g, "svc", "SERVICE CORRIDOR", "hall", 0, back, 1, svc - back);
  addDoor(g, "svc", "bottom", 0.5, 2.4);
  addRoom(g, "wcL", "WC", "wc", 0, svc, wing, 0.55 - svc);
  addRoom(g, "bride", "BRIDAL ROOM", "lounge", 0, 0.55, wing, 0.45);
  addRoom(g, "hall", "BANQUET HALL", "banquet", wing, svc, 1 - 2 * wing, foyer - svc);
  addRoom(g, "foyer", "FOYER", "lobby", wing, foyer, 1 - 2 * wing, 1 - foyer);
  addRoom(g, "wcR", "WC", "wc", 1 - wing, svc, wing, 0.55 - svc);
  addRoom(g, "vip", "VIP LOUNGE", "lounge", 1 - wing, 0.55, wing, 0.45);
  addDoor(g, "wcL", "right", 0.5, 1.2);
  addDoor(g, "wcR", "left", 0.5, 1.2);
  addDoor(g, "bride", "right", 0.85, 1.0);
  addDoor(g, "vip", "left", 0.85, 1.0);
  addDoor(g, "foyer", "top", 0.5, 6.0, { open: true });
  addDoor(g, "foyer", "bottom", 0.32, 2.6, { entry: true, open: true, sliding: true });
  addDoor(g, "foyer", "bottom", 0.68, 2.6, { entry: true, open: true, sliding: true });
  addWin(g, "foyer", "bottom", 0.5, 99);
  for (const [id, side] of [["bride", "left"], ["bride", "bottom"], ["vip", "right"], ["vip", "bottom"]]) addWin(g, id, side, 0.5, side === "bottom" ? 99 : 2.4);
  return [g];
}

/**
 * Apartment building on 5–12 floors: flats either side of a central corridor, the stair and lifts at the back in the
 * middle; three flats along the front and two at the back on each upper floor, each with a living room and kitchen,
 * two bedrooms, a bathroom and a glass-balustraded balcony. Shops and the entrance lobby on the ground floor.
 */
function apartmentLevels(plan, W, D, spec) {
  const cw = 1.8, cy0 = (D - cw) / 2 / D, cy1 = (D + cw) / 2 / D;
  const core0 = W / 2 - 3.3, core1 = W / 2 + 3.3;
  // one flat in unit coordinates: u across the flat, v from the corridor (0) to the facade (1)
  const FLAT = [
    ["liv", "LIVING / KITCHEN", "open", 0, 0, 0.47, 1],
    ["hall", "HALL", "hall", 0.47, 0, 0.39, 0.42],
    ["bath", "BATH", "bath", 0.86, 0, 0.14, 0.42],
    ["mbr", "MASTER BEDROOM", "master", 0.47, 0.42, 0.27, 0.58],
    ["br", "BEDROOM", "bedroom", 0.74, 0.42, 0.26, 0.58],
  ];
  const flat = (lv, tag, x0, x1, y0, y1, facade, mirror) => {
    const toX = (u, w) => (mirror ? x1 - (u + w) * (x1 - x0) : x0 + u * (x1 - x0));
    const toY = (v, h) => (facade === "bottom" ? y0 + v * (y1 - y0) : y1 - (v + h) * (y1 - y0));
    for (const [id, label, kind, u, v, w, h] of FLAT) addRoom(lv, id + tag, label, kind, toX(u, w), toY(v, h), w * (x1 - x0), h * (y1 - y0), { flat: tag });
    const corrSide = facade === "bottom" ? "top" : "bottom";
    const inward = (side) => (mirror ? { left: "right", right: "left" }[side] : side);
    addDoor(lv, "hall" + tag, corrSide, 0.5, 1.0);
    addDoor(lv, "hall" + tag, inward("left"), 0.5, 1.2, { open: true });
    addDoor(lv, "hall" + tag, facade, mirror ? 0.85 : 0.15, 0.9);
    addDoor(lv, "hall" + tag, facade, mirror ? 0.15 : 0.85, 0.9);
    addDoor(lv, "bath" + tag, inward("left"), 0.5, 0.8);
    addWin(lv, "liv" + tag, facade, 0.5, 2.6);
    addWin(lv, "mbr" + tag, facade, 0.5, 1.6);
    addWin(lv, "br" + tag, facade, 0.5, 1.4);
  };
  const frame = (lv) => {
    addRoom(lv, "corr", "CORRIDOR", "hall", 0, cy0, 1, cy1 - cy0);
    addRoom(lv, "st", "STAIR", "stair", core0 / W, 0, 3.3 / W, cy0);
    addRoom(lv, "lifts", "LIFTS", "lift", (core0 + 3.3) / W, 0, 3.3 / W, cy0);
    addDoor(lv, "st", "bottom", 0.5, 1.0);
    addDoor(lv, "lifts", "bottom", 0.5, 99, { open: true });
    addWin(lv, "st", "top", 0.5, 1.2);
    addWin(lv, "corr", "left", 0.5, 1.0);
    addWin(lv, "corr", "right", 0.5, 1.0);
    // two flats at the back either side of the core
    flat(lv, "B1", 0, core0 / W, 0, cy0, "top", false);
    flat(lv, "B2", core1 / W, 1, 0, cy0, "top", true);
    addWin(lv, "livB1", "left", 0.5, 1.6);
    addWin(lv, "livB2", "right", 0.5, 1.6);
  };
  const g = newLevel("GROUND FLOOR PLAN", { sill: 0.05, head: 2.7 });
  frame(g);
  const gFront = [["shopL", "RETAIL UNIT", "boutique", 0, 0.4], ["lobby", "ENTRANCE LOBBY", "reception", 0.4, 0.6], ["shopR", "RETAIL UNIT", "boutique", 0.6, 1]];
  for (const [id, label, kind, x0, x1] of gFront) {
    addRoom(g, id, label, kind, x0, cy1, x1 - x0, 1 - cy1);
    addDoor(g, id, "bottom", 0.5, kind === "reception" ? 2.0 : 1.4, { entry: true });
    addWin(g, id, "bottom", 0.5, 99);
  }
  addDoor(g, "lobby", "top", 0.5, 99, { open: true });
  addWin(g, "shopL", "left", 0.5, 2.4);
  addWin(g, "shopR", "right", 0.5, 2.4);
  const levels = [g];
  for (let li = 1; li < plan.floors; li++) {
    const lv = upperLevel(li, "flats", spec);
    frame(lv);
    const third = 1 / 3;
    flat(lv, "F1", 0, third, cy1, 1, "bottom", false);
    flat(lv, "F2", third, 2 * third, cy1, 1, "bottom", true);
    flat(lv, "F3", 2 * third, 1, cy1, 1, "bottom", true);
    addWin(lv, "livF1", "left", 0.5, 1.6);
    lv.balconies = ["F1", "F2", "F3"].map((t) => {
      const sp = lv.spaces.find((s) => s.id === "liv" + t);
      return { side: "bottom", a0: sp.x + 0.03, a1: sp.x + sp.w - 0.03, depth: 1.5, glass: true };
    });
    levels.push(lv);
  }
  return levels;
}

const COMMERCIAL_LEVELS = { bizcenter: bizcenterLevels, hotel: hotelLevels, restaurant: restaurantLevels, banquet: banquetLevels, apartments: apartmentLevels };

/** Floor area per seat by room kind (dining at tables, banquet rounds, bar stools). */
const SEAT_AREA = { restaurant: 1.7, banquet: 1.3, bar: 3.0, privatedining: 2.2, teahall: 2.0, grill: 4.0 };

/** What a commercial listing counts: guest rooms, seats (covers) and flats, from the drawn plans. */
function commercialMetrics(model) {
  let rooms = 0, seats = 0;
  const flats = new Set();
  model.levels.forEach((lv, li) => {
    for (const sp of lv.spaces) {
      if (sp.kind === "guestroom") rooms++;
      if (sp.flat) flats.add(`${li}:${sp.flat}`);
      if (SEAT_AREA[sp.kind]) {
        const r = inner(model, sp);
        seats += Math.floor((r.w * r.h) / SEAT_AREA[sp.kind]);
      }
    }
  });
  return { rooms, seats, flats: flats.size };
}

/** Floor plan sheets of a building: one per level, a run of identical typical floors drawn once. */
export function planSheets(model) {
  const runs = [];
  model.levels.forEach((lv, i) => {
    const last = runs[runs.length - 1];
    if (lv.typical && last && model.levels[last.index].typical === lv.typical) last.last = i;
    else runs.push({ index: i, last: i });
  });
  return runs.map((r) =>
    r.last > r.index
      ? { ...r, kind: "typical", title: `TYPICAL PLAN · FLOORS ${r.index}–${r.last}` }
      : { ...r, kind: `plan-${r.index}`, title: model.levels[r.index].name },
  );
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

/** Diagonal "preview" watermark over the drawing area of a public sheet. */
function previewMark() {
  let o = `<clipPath id="pv-clip"><rect x="40" y="40" width="${SHEET_W - 330 - 44}" height="${SHEET_H - 80}"/></clipPath>
    <g clip-path="url(#pv-clip)" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="6" fill="${INK}" fill-opacity=".055">`;
  for (let y = 120; y < SHEET_H; y += 210) {
    for (let x = -200; x < SHEET_W - 330; x += 520) o += `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})">HAVS.DEV · PREVIEW</text>`;
  }
  return o + "</g>";
}

function sheet({ plan, drawing, sheetNo, scaleNote, body, defs = "", north, legend, preview = false }) {
  const tbX = SHEET_W - 330;
  const rows = [
    ["PROJECT", plan.title.en.toUpperCase()],
    ["DRAWING", drawing],
    ["SCALE", scaleNote],
    ["SHEET / REV", `${sheetNo} / A`],
    ["GROSS AREA", plan.project?.units > 1 ? `${plan.project.units} × ${plan.areaM2} = ${plan.project.units * plan.areaM2} m²` : `${plan.areaM2} m²`],
  ];
  let tb = `<g font-family="${FONT}">
    <line x1="${tbX}" y1="36" x2="${tbX}" y2="${SHEET_H - 36}" stroke="${INK}" stroke-width="1.2"/>
    <g transform="translate(${tbX + 28} 74)">
      <rect x="0" y="-14" width="14" height="14" fill="none" stroke="${ACCENT}" stroke-width="1.6" transform="rotate(45 7 -7)"/>
      <text x="28" y="0" font-size="20" font-weight="600" fill="${INK}" letter-spacing="1">havs.dev</text>
      <text x="0" y="26" font-size="10.5" fill="${MID}" letter-spacing="2">${plan.style === "interior" ? "ARCHITECTURE · INTERIOR DESIGN" : COMMERCIAL_LEVELS[plan.style] ? "ARCHITECTURE · BUILDING DESIGN" : "ARCHITECTURE · VILLA DESIGN"}</text>
    </g>`;
  rows.forEach(([k, v], i) => {
    const y = 156 + i * 66;
    tb += `<line x1="${tbX}" y1="${y - 24}" x2="${SHEET_W - 36}" y2="${y - 24}" stroke="${LIGHT}"/>
      <text x="${tbX + 28}" y="${y}" font-size="10" fill="${MID}" letter-spacing="2">${k}</text>
      <text x="${tbX + 28}" y="${y + 25}" font-size="${i === 0 ? (v.length > 24 ? 13.5 : v.length > 18 ? 16.5 : 19) : 15}" font-weight="${i === 0 ? 600 : 500}" fill="${i === 4 ? ACCENT : INK}" letter-spacing="0.5">${esc(v)}</text>`;
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
        ${item.symbol ? `<g transform="translate(35 -4)">${item.symbol}</g>` : `<rect x="26" y="-13" width="18" height="18" fill="${item.fill}" stroke="${INK}" stroke-width="0.6"/>`}
        ${item.pattern ? `<rect x="26" y="-13" width="18" height="18" fill="url(#${item.pattern})"/>` : ""}
        <text x="54" y="0" font-size="11.5" fill="${INK}">${esc(item.label)}</text>
      </g>`;
    });
  }
  if (north) {
    tb += `<g transform="translate(${tbX + 165} ${SHEET_H - 232})"><circle r="30" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <path d="M0 -24 L9 14 L0 6 L-9 14 Z" fill="${INK}"/><text y="-38" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}">N</text></g>`;
  }
  if (preview) {
    tb += `<rect x="${tbX + 20}" y="${SHEET_H - 205}" width="290" height="40" rx="6" fill="${ACCENT}" fill-opacity=".1" stroke="${ACCENT}" stroke-width="0.8"/>
      <text x="${tbX + 32}" y="${SHEET_H - 189}" font-size="9.5" font-weight="600" letter-spacing="1.6" fill="${ACCENT}">PREVIEW — DIMENSIONS OMITTED</text>
      <text x="${tbX + 32}" y="${SHEET_H - 175}" font-size="9" letter-spacing="1.2" fill="${ACCENT}">FULL SET IN THE PURCHASED PDF / DWG / DXF</text>`;
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
    ${body}${preview ? previewMark() : ""}${tb}
  </svg>`);
}

function sheetTitle(title, sub) {
  return `<text x="${36 + 60}" y="${SHEET_H - 70}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${INK}">${title}</text>
    <text x="${36 + 60}" y="${SHEET_H - 48}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${sub}</text>`;
}

/** Graphic scale 0–1–2–5 m, multiplied by k for large drawings. */
function scaleBar(x, y, s, k = 1) {
  const seg = [0, 1, 2, 5].map((v) => v * k);
  let g = `<g font-family="${FONT}" font-size="10" fill="${INK}">`;
  for (let i = 0; i < seg.length - 1; i++) {
    g += `<rect x="${x + seg[i] * s}" y="${y}" width="${(seg[i + 1] - seg[i]) * s}" height="6" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  seg.forEach((m) => (g += `<text x="${x + m * s}" y="${y + 20}" text-anchor="middle">${m}</text>`));
  g += `<text x="${x + seg[3] * s + 12}" y="${y + 7}" >m</text></g>`;
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

function furniture(d, kind, inn, sp = {}) {
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
  // compact group: sofa, low table and two armchairs facing it, centred in the depth of the room
  const seating = (cx, sw) => {
    const chairs = h > 3.3;
    const gy = y + Math.max(0.25, (h - (chairs ? 3.0 : 1.85)) / 2);
    let o = d.rect(cx - sw / 2, gy, sw, 0.9, { round: 4 }) + d.rect(cx - sw / 2 + 0.12, gy + 0.12, sw - 0.24, 0.56, { round: 3 });
    o += d.rect(cx - 0.55, gy + 1.25, 1.1, 0.6, { round: 2 });
    if (chairs) o += d.rect(cx - 1.25, gy + 2.2, 0.8, 0.8, { round: 5 }) + d.rect(cx + 0.45, gy + 2.2, 0.8, 0.8, { round: 5 });
    return o + d.rect(cx - sw / 2 - 0.15, gy + 0.55, sw + 0.3, chairs ? 2.75 : 1.5, { dash: "5 4", faint: true });
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
      if (sw > 2 && h * 0.42 >= 2.0) g += sofa(x + w * 0.45, y + h * 0.42, sw);
      else if (sw > 2 && h > 2.4) g += seating(x + (w - 0.6) / 2, Math.min(2.6, sw));
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
      if (w > 5 && h > 3.5) {
        const n = Math.floor((w - 2.4) / 1.3);
        for (let i = 0; i < n; i++) g += d.rect(x + i * 1.3, y, 1.3, 1.6) + d.ellipse(x + i * 1.3 + 0.65, y + 0.45, 0.19, 0.26);
        g += d.rect(x + w - 2.3, y, 2.2, 2.2) + d.ellipse(x + w - 1.0, y + 0.5, 0.19, 0.26) + d.rect(x + 0.3, y + h - 0.7, Math.min(3, w - 2.8), 0.55);
      } else g += wc();
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
    // ---- shop and back-of-house fixtures (supermarket)
    case "sales": {
      // chilled wall along the back, gondola runs (1.2 m double-sided, 2.4 m aisles), produce tables by the entry
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 1.0);
      for (let fx = x + 2.1; fx < x + w - 0.5; fx += 2.0) g += d.line(fx, y + 0.1, fx, y + 1.1);
      const prod = Math.min(10, w * 0.22);
      for (let gx = x + prod + 1.2; gx + 1.2 < x + w - 1.2; gx += 3.6) g += d.rect(gx, y + 3.6, 1.2, h - 7.6) + d.line(gx + 0.6, y + 3.6, gx + 0.6, y + h - 4.0);
      for (let px = x + 1.4; px + 2.0 < x + prod; px += 3.2) for (let py = y + 3.8; py + 1.4 < y + h - 3.6; py += 3.4) g += d.rect(px, py, 2.0, 1.4, { round: 2 });
      // structural columns on a ~9 m grid
      for (let cx = x + w / Math.round(w / 9); cx < x + w - 1; cx += w / Math.round(w / 9)) for (let cy = y + h / 2; cy < y + h; cy += h) g += d.rect(cx - 0.2, cy - 0.2, 0.4, 0.4);
      break;
    }
    case "checkout":
      for (let cx = x + 1.2; cx + 0.9 < x + w - 0.6; cx += 2.7) g += d.rect(cx, y + 0.6, 0.9, h - 1.2) + d.rect(cx + 1.0, y + h / 2 - 0.3, 0.55, 0.55, { round: 4 });
      break;
    case "gate":
      // trolley bay along the outer wall and the entry gate line
      for (let i = 0; i < 4; i++) g += d.rect(x + 0.4 + i * 0.75, y + 0.5, 0.6, Math.min(h - 1.0, 4.5), { round: 2 });
      g += d.line(x + w * 0.55, y + 0.4, x + w * 0.55, y + h - 0.4, { dash: "6 4" });
      break;
    case "lobby":
      for (const fx of [0.22, 0.74]) g += d.rect(x + w * fx - 1.6, y + h - 2.2, 3.2, 2.0, { dash: "4 3" });
      g += d.rect(x + w * 0.45, y + 0.6, Math.min(3.0, w * 0.1), 0.6);
      break;
    case "cafe": {
      g += d.rect(x + 0.2, y + 0.2, w - 0.4, 0.8);
      for (let cx = x + 1.6; cx < x + w - 1.2; cx += 2.6) for (let cy = y + 3.2; cy < y + h - 1.4; cy += 2.6) g += d.circle(cx, cy, 0.4) + d.circle(cx - 0.7, cy, 0.22) + d.circle(cx + 0.7, cy, 0.22);
      break;
    }
    case "deli":
      g += d.rect(x + 0.4, y + 1.0, 1.1, h - 2.0) + d.rect(x + w - 1.2, y + 0.6, 0.9, h - 1.2);
      for (let cy = y + 2.5; cy < y + h - 2; cy += 4) g += d.rect(x + w / 2 - 0.6, cy, 1.2, 2.0);
      break;
    case "kiosk":
      g += d.rect(x + 0.4, y + 0.4, w - 0.8, 0.6) + d.rect(x + 0.6, y + h * 0.45, Math.min(3.2, w - 1.6), 0.8);
      break;
    case "dock":
      // pallets and the dock leveller at the loading door
      g += d.rect(x + w / 2 - 1.5, y + 0.1, 3.0, 2.4, { dash: "5 3" });
      for (let px = x + 0.6; px + 1.2 < x + w - 0.4; px += 1.6) for (let py = y + 3.2; py + 1.0 < y + h - 0.4; py += 1.5) g += d.rect(px, py, 1.2, 1.0);
      break;
    case "racks":
      for (let ry = y + 0.4; ry + 1.1 < y + h - 2.6; ry += 3.4) g += d.rect(x + 0.6, ry, w - 1.2, 1.1);
      break;
    case "cold":
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.7) + d.rect(x + 0.1, y + h - 0.8, w - 0.2, 0.7) + d.rect(x + w - 0.8, y + 0.9, 0.7, h - 1.8);
      break;
    case "prep":
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.75) + d.rect(x + 0.1, y + 0.85, 0.75, h - 1.8);
      for (let i = 0; i < 3 && 1.2 + i * 1.5 + 1.2 < w - 0.1; i++) g += d.rect(x + 1.2 + i * 1.5, y + 0.15, 1.2, 0.65, { round: 2 });
      if (w > 4 && h > 5) g += d.rect(x + w / 2 - 0.5, y + h / 2 - 1.2, 1.4, 2.4);
      break;
    case "staff":
      if (w > 3 && h > 3) g += table(x + w / 2, y + h / 2 + 0.3, Math.min(2.4, w - 1.8), 3) + d.rect(x + 0.1, y + 0.1, Math.min(2.6, w - 0.2), 0.6);
      break;
    case "office":
      if (w > 2 && h > 2) g += d.rect(x + 0.1, y + 0.1, Math.min(1.6, w - 0.3), 0.7) + d.rect(x + 0.5, y + 0.95, 0.5, 0.5, { round: 3 });
      if (w > 2.6 && h > 4.5) g += d.rect(x + w - 0.5, y + h * 0.35, 0.4, Math.min(2.4, h * 0.4)) + d.circle(x + w * 0.45, y + h - 1.4, 0.55);
      break;
    // ---- showroom and office fixtures
    case "showroom": {
      // entrance doors on display: free-standing door sets on plinths, sample doors hung along the back wall
      for (let fx = x + 0.4; fx + 1.0 < x + w - 0.3; fx += 1.25) g += d.rect(fx, y + 0.15, 1.0, 0.12) + d.line(fx, y + 0.27, fx + 1.0, y + 1.25, { dash: "3 3" });
      for (let row = y + 3.2; row + 1.2 < y + h - 2.4; row += 3.0) for (let fx = x + 1.6; fx + 1.2 < x + w - 1.2; fx += 2.6) g += d.rect(fx, row, 1.2, 0.45) + d.rect(fx + 0.1, row + 0.12, 1.0, 0.2);
      if (w > 6 && h > 6) g += d.rect(x + w - 3.6, y + h - 2.6, 2.6, 1.2, { round: 3 }) + d.circle(x + w - 2.3, y + h - 0.9, 0.3);
      break;
    }
    case "reception":
      g += d.rect(x + 0.4, y + 0.6, Math.min(2.4, w - 0.8), 0.7, { round: 4 }) + d.rect(x + 0.4, y + h - 2.2, Math.min(2.2, w - 0.8), 0.85, { round: 4 });
      break;
    case "studio":
      for (let cy = y + 0.8; cy + 1.0 < y + h - 0.6; cy += 2.2) g += d.rect(x + 0.4, cy, Math.min(1.8, w - 0.8), 0.9) + d.circle(x + 0.4 + Math.min(1.8, w - 0.8) / 2, cy + 1.25, 0.25);
      break;
    case "openoffice": {
      // clusters of four desks with chairs
      for (let cx = x + 1.2; cx + 3.2 < x + w - 0.6; cx += 4.0) {
        for (let cy = y + 1.2; cy + 1.6 < y + h - 1.0; cy += 3.4) {
          g += d.rect(cx, cy, 3.2, 1.6) + d.line(cx + 1.6, cy, cx + 1.6, cy + 1.6) + d.line(cx, cy + 0.8, cx + 3.2, cy + 0.8);
          for (const [ox, oy] of [[0.8, -0.45], [2.4, -0.45], [0.8, 2.05], [2.4, 2.05]]) g += d.circle(cx + ox, cy + oy, 0.25);
        }
      }
      break;
    }
    case "meeting": {
      const tw = Math.min(w - 2.0, 6.0), th = Math.min(h - 2.0, 1.4);
      if (tw > 1.5 && th > 0.8) {
        const tx = x + (w - tw) / 2, ty = y + (h - th) / 2;
        g += d.rect(tx, ty, tw, th, { round: 6 });
        for (let cx = tx + 0.45; cx < tx + tw - 0.2; cx += 0.9) g += d.circle(cx, ty - 0.35, 0.22) + d.circle(cx, ty + th + 0.35, 0.22);
      }
      g += d.rect(x + 0.1, y + h / 2 - 0.8, 0.12, 1.6);
      break;
    }
    case "kitchenette":
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.62) + d.rect(x + w * 0.4, y + 0.2, 0.5, 0.42, { round: 3 });
      if (h > 3 && w > 2.4) g += table(x + w / 2, y + h * 0.62, Math.min(1.8, w - 1.4), 2);
      break;
    case "lounge": {
      // a wide lounge: the living-room group and a table for two; a smaller one: a sofa, a low table and two armchairs
      // facing it (as in the FF&E schedule), centred and sized to the room
      if (w >= 9 && h > 3) g += sofa(x + w * 0.35, y + h * 0.55, Math.min(3.0, w * 0.3)) + table(x + w * 0.75, y + h / 2, Math.min(2.0, w * 0.2), 2);
      else if (w > 3.2 && h > 2.4) g += seating(x + w / 2, Math.min(2.6, w - 1.2));
      else if (w > 2.5 && h > 2.5) g += d.rect(x + 0.3, y + h - 1.2, w - 0.6, 0.8, { round: 4 });
      break;
    }
    case "director":
      g += d.rect(x + w / 2 - 1.0, y + 1.0, 2.0, 0.9) + d.rect(x + w / 2 - 0.3, y + 0.3, 0.6, 0.55, { round: 4 });
      if (h > 5) g += sofa(x + w / 2, y + h - 1.6, Math.min(2.6, w - 1.6));
      g += d.rect(x + 0.1, y + 0.1, 0.4, Math.min(3, h * 0.4));
      break;
    case "void":
      g += d.line(x, y, x + w, y + h, { dash: "8 5" }) + d.line(x + w, y, x, y + h, { dash: "8 5" });
      break;
    // ---- interior fit-out fixtures
    case "bar": {
      // back bar along the wall, counter facing the room, stools
      const cw = Math.min(w - 0.8, 6.0);
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.45) + d.rect(x + (w - cw) / 2, y + 1.3, cw, 0.6, { round: 2 });
      for (let sx = x + (w - cw) / 2 + 0.4; sx < x + (w + cw) / 2 - 0.2; sx += 0.75) g += d.circle(sx, y + 2.3, 0.2);
      break;
    }
    case "boutique": {
      // wall shelving, display tables, a round plinth and the cash desk by the door
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.45) + d.rect(x + 0.1, y + 0.55, 0.45, h - 2.4);
      for (let cx = x + w * 0.3; cx < x + w * 0.75; cx += w * 0.3) g += d.rect(cx - 0.8, y + h * 0.42, 1.6, 0.9, { round: 3 });
      g += d.rect(x + w - 2.4, y + h - 1.9, 1.8, 0.7, { round: 4 });
      if (h > 5) g += d.circle(x + w * 0.5, y + h * 0.75, 0.7);
      break;
    }
    case "fitting": {
      const n = Math.max(2, Math.floor(h / 1.5));
      for (let i = 0; i < n; i++) g += d.rect(x + w - 1.6, y + 0.1 + (i * (h - 0.2)) / n, 1.5, (h - 0.2) / n);
      g += d.rect(x + 0.4, y + h / 2 - 0.9, 0.5, 1.8, { round: 4 });
      break;
    }
    case "treatment":
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.6);
      g += d.rect(x + w / 2 - 0.4, y + 1.2, 0.8, 1.9, { round: 8 }) + d.circle(x + w / 2 + 0.8, y + 1.7, 0.25) + d.circle(x + w / 2 - 0.8, y + 1.5, 0.22);
      break;
    case "styling":
      for (let cx = x + 0.9; cx + 0.6 < x + w - 0.4; cx += 1.6) g += d.rect(cx - 0.45, y + 0.1, 0.9, 0.45) + d.circle(cx, y + 1.05, 0.3);
      if (h > 3.4) g += d.rect(x + w / 2 - 1.2, y + h - 1.3, 2.4, 0.8, { round: 4 });
      break;
    case "wash":
      for (let cx = x + 0.8; cx + 0.4 < x + w - 0.2; cx += 1.2) g += d.rect(cx - 0.35, y + 0.1, 0.7, 0.5, { round: 3 }) + d.rect(cx - 0.3, y + 0.65, 0.6, 1.3, { round: 6 });
      g += d.rect(x + 0.1, y + h - 0.6, w - 0.2, 0.5);
      break;
    case "teahall":
      g += d.rect(x + 0.1, y + 0.6, 0.6, h - 1.2, { round: 3 });
      for (const [cx, cy] of teaTables(inn)) g += d.circle(cx, cy, 0.38) + d.circle(cx - 0.68, cy, 0.2) + d.circle(cx + 0.68, cy, 0.2);
      break;
    case "nails": {
      const tw = Math.min(w - 1.6, 3.6);
      g += d.rect(x + (w - tw) / 2, y + h * 0.4, tw, 0.7, { round: 3 });
      for (let cx = x + (w - tw) / 2 + 0.4; cx < x + (w + tw) / 2 - 0.2; cx += 0.9) g += d.circle(cx, y + h * 0.4 - 0.35, 0.22) + d.circle(cx, y + h * 0.4 + 1.05, 0.22);
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.35);
      break;
    }
    case "lift":
      g += d.rect(x + w / 2 - 0.8, y + 0.3, 1.6, 1.6) + d.line(x + w / 2 - 0.8, y + 0.3, x + w / 2 + 0.8, y + 1.9) + d.line(x + w / 2 + 0.8, y + 0.3, x + w / 2 - 0.8, y + 1.9);
      break;
    // ---- hotels, restaurants and halls
    case "guestroom": {
      // en-suite shower room beside the corridor door, wardrobe opposite, double bed against the party wall,
      // desk and armchair by the window; drawn from the corridor side (sp.corridor) toward the facade
      const top = sp.corridor !== "bottom";
      const Y = (v, hh) => (top ? y + v : y + h - v - hh);
      const bw = Math.min(2.3, w * 0.58), bd = Math.min(2.4, h * 0.36);
      g += d.rect(x + 0.05, Y(0.05, bd - 0.1), bw - 0.1, bd - 0.1);
      g += d.rect(x + 0.15, Y(0.15, 0.9), 0.9, 0.9) + d.line(x + 0.15, Y(0.15, 0.9), x + 1.05, Y(0.15, 0.9) + 0.9) + d.line(x + 1.05, Y(0.15, 0.9), x + 0.15, Y(0.15, 0.9) + 0.9);
      g += d.ellipse(x + bw - 0.45, Y(bd - 0.6, 0.5) + 0.25, 0.18, 0.24) + d.rect(x + 0.2, Y(bd - 0.65, 0.45), 0.6, 0.45, { round: 4 });
      if (w - bw > 1.2) g += d.rect(x + w - 0.65, Y(0.1, Math.min(1.8, bd)), 0.6, Math.min(1.8, bd));
      const mid = (bd + h) / 2;
      const cy = top ? y + mid : y + h - mid;
      if (h > bd + 2.6) g += d.rect(x + 0.05, cy - 0.8, 2.05, 1.6) + d.rect(x + 0.12, cy - 0.72, 0.42, 0.68, { round: 3 }) + d.rect(x + 0.12, cy + 0.04, 0.42, 0.68, { round: 3 }) + d.line(x + 0.75, cy - 0.8, x + 0.75, cy + 0.8);
      if (w > 3.2 && h > bd + 4) g += d.rect(x + w - 1.5, Y(h - 0.7, 0.55), 1.3, 0.55) + d.circle(x + w - 0.85, Y(h - 1.25, 0.4) + 0.2, 0.22) + d.rect(x + 0.4, Y(h - 1.2, 0.8), 0.8, 0.8, { round: 5 });
      break;
    }
    case "restaurant":
      // tables for four on a 2.4 m grid
      for (let cx = x + 1.5; cx + 1.0 < x + w - 0.4; cx += 2.4) for (let cy = y + 1.5; cy + 1.0 < y + h - 0.6; cy += 2.4) g += d.rect(cx - 0.4, cy - 0.4, 0.8, 0.8) + d.circle(cx - 0.72, cy, 0.2) + d.circle(cx + 0.72, cy, 0.2) + d.circle(cx, cy - 0.72, 0.2) + d.circle(cx, cy + 0.72, 0.2);
      break;
    case "banquet": {
      // stage at the back, the dance floor in front of it, round tables for ten all round
      const sw = Math.min(w * 0.4, 14), sh = Math.min(3.5, h * 0.18);
      g += d.rect(x + (w - sw) / 2, y + 0.2, sw, sh) + d.line(x + (w - sw) / 2, y + sh - 0.2, x + (w + sw) / 2, y + sh - 0.2);
      const fw = Math.min(w * 0.3, 12), fh = Math.min(h * 0.3, 9), fx = x + (w - fw) / 2, fy = y + sh + 1.7;
      g += d.rect(fx, fy, fw, fh, { dash: "6 4" });
      for (let cx = x + 2.0; cx + 1.6 < x + w - 0.4; cx += 3.4) {
        for (let cy = y + sh + 2.2; cy + 1.6 < y + h - 0.6; cy += 3.4) {
          if (cx > fx - 1.7 && cx < fx + fw + 1.7 && cy > fy - 1.7 && cy < fy + fh + 1.7) continue;
          g += d.circle(cx, cy, 0.9);
          for (let k = 0; k < 10; k++) g += d.circle(cx + Math.cos((k / 10) * Math.PI * 2) * 1.3, cy + Math.sin((k / 10) * Math.PI * 2) * 1.3, 0.18);
        }
      }
      break;
    }
    case "privatedining": {
      const tw = Math.min(w - 1.8, 4.2);
      if (tw > 1.4 && h > 2.8) g += table(x + w / 2, y + h / 2, tw, Math.max(2, Math.floor(tw / 0.7)));
      g += d.rect(x + 0.1, y + 0.1, Math.min(1.6, w - 0.2), 0.45);
      break;
    }
    case "grill":
      // charcoal grills (mangal) along the back wall, a tandir oven, the pass counter with stools facing the room
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.8);
      for (let gx = x + 0.4; gx + 1.4 < x + w - 1.6; gx += 1.8) g += d.rect(gx, y + 0.2, 1.4, 0.6) + d.line(gx, y + 0.5, gx + 1.4, y + 0.5);
      g += d.circle(x + w - 0.9, y + 1.6, 0.55);
      if (h > 4) {
        g += d.rect(x + 0.4, y + 2.4, w - 0.8, 0.6, { round: 2 });
        for (let sx = x + 0.8; sx < x + w - 0.5; sx += 0.75) g += d.circle(sx, y + 3.35, 0.2);
      }
      break;
    case "prokitchen": {
      // cooking line along the back wall, two prep islands, cold counter and wash-up at the side
      g += d.rect(x + 0.1, y + 0.1, w - 0.2, 0.8);
      for (let bx = x + 0.6; bx + 0.4 < x + w * 0.6; bx += 0.6) g += d.circle(bx, y + 0.5, 0.18);
      const iw = Math.min(w - 2.6, 6);
      if (iw > 1.5 && h > 4.2) for (const fy of [0.45, 0.75]) g += d.rect(x + (w - iw) / 2, y + h * fy - 0.45, iw, 0.9);
      if (w > 4) g += d.rect(x + w - 1.6, y + 1.0, 1.4, 1.4) + d.rect(x + 0.1, y + 1.0, 0.75, Math.min(3, h - 1.4));
      break;
    }
    case "gym":
      // a row of treadmills along the back, the free-weights floor in front
      for (let cx = x + 0.6; cx + 0.8 < x + w - 0.4; cx += 1.4) g += d.rect(cx, y + 0.4, 0.8, 1.9, { round: 3 });
      if (h > 6) g += d.rect(x + 0.6, y + 3.2, w - 1.2, h - 4.2, { dash: "6 4" });
      break;
  }
  return g;
}

// ------------------------------------------------------------------ floor plan sheet

/**
 * Elements of a surveyed building drawn on its floor plans: balconies and the rear bay outside the walls, the round
 * stair tower, the chamfered street corner and the reinforced-concrete columns.
 */
function surveyPlanFeatures(model, level, px, s, rect) {
  const { W, D } = model;
  const X = (m) => f1(px.X(m)), Y = (m) => f1(px.Y(m));
  let g = "";
  for (const b of level.balconies ?? []) {
    const label = (cx, cy) => `<text x="${X(cx)}" y="${f1(px.Y(cy) + 3)}" text-anchor="middle" font-family="${FONT}" font-size="8.5" letter-spacing="1.5" fill="${MID}">BALCONY</text>`;
    if (b.side === "right" && b.round) {
      const y0 = b.a0 * D, y1 = b.a1 * D, r = (y1 - y0) / 2;
      g += `<path d="M${X(W)} ${Y(y0)} A${f1(Math.min(r, b.depth) * s)} ${f1(r * s)} 0 0 1 ${X(W)} ${Y(y1)} Z" fill="#f1ead6" stroke="${INK}" stroke-width="1.1"/>` + label(W + b.depth * 0.5, (y0 + y1) / 2);
    } else if (b.side === "right") {
      g += rect(W, b.a0 * D, b.depth, (b.a1 - b.a0) * D, `fill="#f1ead6" stroke="${INK}" stroke-width="1.1"`);
    } else {
      const y = b.side === "top" ? -b.depth : D;
      g += rect(b.a0 * W, y, (b.a1 - b.a0) * W, b.depth, `fill="#f1ead6" stroke="${INK}" stroke-width="1.1"`) + label(((b.a0 + b.a1) / 2) * W, y + b.depth / 2);
    }
  }
  for (const b of level.bays ?? []) {
    // rear bay window: a walled projection opening fully into the room
    const x0 = b.a0 * W, x1 = b.a1 * W;
    g += rect(x0, -b.depth, x1 - x0, b.depth + EXT, `fill="${INK}"`) + rect(x0 + EXT, -b.depth + EXT, x1 - x0 - 2 * EXT, b.depth + EXT, `fill="${PAPER}"`);
    g += rect(x0 + 0.8, -b.depth, x1 - x0 - 1.6, EXT, `fill="${PAPER}" stroke="${INK}" stroke-width="0.9"`) + `<line x1="${X(x0 + 0.8)}" y1="${Y(-b.depth + EXT / 2)}" x2="${X(x1 - 0.8)}" y2="${Y(-b.depth + EXT / 2)}" stroke="${INK}" stroke-width="1.3"/>`;
  }
  if (model.towerArc) {
    // round stair tower bulging out of the street facade (wall ring, glazing slits)
    const { cx, r } = model.towerArc;
    const ring = (rr) => `M${X(cx - rr)} ${Y(D)} A${f1(rr * s)} ${f1(rr * s)} 0 0 0 ${X(cx + rr)} ${Y(D)}`;
    g += `<path d="${ring(r)} Z" fill="${INK}"/><path d="${ring(r - EXT)} Z" fill="${PAPER}"/>`;
    for (const a of [0.3, 0.5, 0.7]) {
      const ang = Math.PI * a, gx = cx - Math.cos(ang) * (r - EXT / 2), gy = D + Math.sin(ang) * (r - EXT / 2);
      g += `<circle cx="${X(gx)}" cy="${Y(gy)}" r="${f1(0.28 * s)}" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`;
    }
    g += rect(cx - r + EXT, D - EXT - 0.02, 2 * (r - EXT), EXT + 0.04, `fill="${PAPER}"`);
  }
  if (model.chamfer) {
    // chamfered street corner (front left) with a corner window
    const { a, b } = model.chamfer;
    g += `<polygon points="${X(-0.6)},${Y(D - b)} ${X(0)},${Y(D - b)} ${X(a)},${Y(D)} ${X(a)},${Y(D + 0.6)} ${X(-0.6)},${Y(D + 0.6)}" fill="${PAPER}"/>`;
    g += `<polygon points="${X(0)},${Y(D - b)} ${X(a)},${Y(D)} ${X(a + 0.42)},${Y(D - EXT)} ${X(EXT)},${Y(D - b - 0.42)} ${X(EXT)},${Y(D - b)}" fill="${INK}"/>`;
    g += `<line x1="${X(a * 0.2)}" y1="${Y(D - b * 0.8)}" x2="${X(a * 0.8)}" y2="${Y(D - b * 0.2)}" stroke="${PAPER}" stroke-width="2.2"/>`;
  }
  for (const [x, y] of model.columns ?? []) {
    g += rect(x - 0.22, y - 0.22, 0.44, 0.44, `fill="#5a6aa3" stroke="${INK}" stroke-width="0.8"`) + `<path d="M${X(x)} ${Y(y - 0.22)}V${Y(y + 0.22)}M${X(x - 0.22)} ${Y(y)}H${X(x + 0.22)}" stroke="#d9def0" stroke-width="0.8"/>`;
  }
  return g;
}

export function floorPlanSheet(model, levelIndex, sheetNo, { preview = false, mode = "layout", title = null } = {}) {
  const ST = model.storey;
  const { W, D, plan, spec } = model;
  const level = model.levels[levelIndex];
  // interior sets draw the same plan three ways: furniture layout, floor finishes, reflected ceiling and lighting
  const drawingName = title ?? (!model.interior || mode === "layout" ? level.name : `${level.floorName ? `${level.floorName} ` : ""}${mode === "finish" ? "FINISHES PLAN" : "CEILING PLAN"}`);
  const isGround = levelIndex === 0;
  const garage = isGround ? model.garage : null;
  const site = model.site;
  const extraW = garage ? garage.w + 0.5 : 0;
  const outside = (side) => Math.max(0, ...[...(level.balconies ?? []), ...(level.bays ?? [])].filter((b) => b.side === side).map((b) => b.depth));
  const frontExtent = isGround ? Math.max(site.T, site.deck ? site.T + site.deck.h : 0, garage ? 3 : 0) : level.terrace ? level.terrace.depth : outside("bottom");
  const backOut = outside("top");
  const extraD = Math.max(frontExtent, model.towerArc ? model.towerArc.r + 0.3 : 0) + 1.4 + backOut;
  const margin = 3.0; // axes, bubbles and dimension chains (m)
  const areaW = SHEET_W - 330 - 36 - 90;
  const areaH = SHEET_H - 72 - 180;
  const sideOut = outside("right");
  const s = Math.min(areaW / (W + extraW + sideOut + margin), areaH / (D + extraD + margin), model.interior ? 80 : 58);
  const ox = 36 + 45 + (areaW - (W + extraW + sideOut + margin) * s) / 2 + margin * s;
  const oy = 36 + 40 + (areaH - (D + extraD + margin) * s) / 2 + (margin + backOut) * s;
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
    g += `<line x1="${f1(px.X(x))}" y1="${f1(px.Y(-2.3 - backOut))}" x2="${f1(px.X(x))}" y2="${f1(px.Y(D + 0.4))}" stroke="${LIGHT}" stroke-width="0.7" stroke-dasharray="14 4 2 4"/>`;
    g += `<circle cx="${f1(px.X(x))}" cy="${f1(px.Y(-2.3 - backOut) - 12)}" r="12" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><text x="${f1(px.X(x))}" y="${f1(px.Y(-2.3 - backOut) - 8)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}">${i + 1}</text>`;
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
    if (mode === "finish" && sp.kind !== "void" && sp.kind !== "stair") {
      const mt = matOf(model, roomFinish(model, sp).floor);
      g += rect(inn.x, inn.y, inn.w, inn.h, `fill="${shade(mt.fill, 0.42)}"`);
      if (patternFill(mt.pattern)) g += rect(inn.x, inn.y, inn.w, inn.h, `fill="${patternFill(mt.pattern)}"`);
    }
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

  g += surveyPlanFeatures(model, level, px, s, rect);

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
      if (d.rail) for (const f of [0.3, 0.7]) g += `<line x1="${f1(px.X(x0))}" y1="${f1(px.Y(wy + t * f))}" x2="${f1(px.X(x0 + w))}" y2="${f1(px.Y(wy + t * f))}" stroke="${INK}" stroke-width="0.8"/>`; // glass balustrade
      if (!d.open && mode !== "ceiling") {
        const into = d.side === "top" ? 1 : -1; // swing into the space
        const hy = d.side === "top" ? wy + t : wy;
        g += `<line x1="${f1(px.X(x0))}" y1="${f1(px.Y(hy))}" x2="${f1(px.X(x0))}" y2="${f1(px.Y(hy + into * w))}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${f1(px.X(x0))} ${f1(px.Y(hy + into * w))} A${f1(w * s)} ${f1(w * s)} 0 0 ${into > 0 ? 0 : 1} ${f1(px.X(x0 + w))} ${f1(px.Y(hy))}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
      if (d.entry && d.side === "bottom") {
        const ay = D + (site.T > 0 ? site.T : 0) + 1.1;
        g += `<path d="M${f1(px.X(x0 + w / 2))} ${f1(px.Y(ay))} v${f1(-0.8 * s)} m-6 8 l6 -8 l6 8" fill="none" stroke="${ACCENT}" stroke-width="1.4"/><text x="${f1(px.X(x0 + w / 2))}" y="${f1(px.Y(ay + 0.45))}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${ACCENT}">ENTRANCE</text>`;
      } else if (d.entry && d.side === "top" && model.interior && sp.h >= 4) {
        const ay = wy + t + 0.3;
        g += `<path d="M${f1(px.X(x0 + w / 2))} ${f1(px.Y(ay))} v${f1(0.8 * s)} m-6 -8 l6 8 l6 -8" fill="none" stroke="${ACCENT}" stroke-width="1.4"/><text x="${f1(px.X(x0 + w / 2))}" y="${f1(px.Y(ay + 1.25))}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${ACCENT}">ENTRANCE</text>`;
      }
    } else {
      const y0 = sp.y + c - w / 2;
      const wx = ext ? (d.side === "left" ? 0 : W - EXT) : seg.x1 - INT / 2;
      g += `<rect x="${f1(px.X(wx) - 1)}" y="${f1(px.Y(y0))}" width="${f1(t * s + 2)}" height="${f1(w * s)}" fill="${PAPER}"/>`;
      if (!d.open && mode !== "ceiling") {
        const into = d.side === "left" ? 1 : -1;
        const hx = d.side === "left" ? wx + t : wx;
        g += `<line x1="${f1(px.X(hx))}" y1="${f1(px.Y(y0))}" x2="${f1(px.X(hx + into * w))}" y2="${f1(px.Y(y0))}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${f1(px.X(hx + into * w))} ${f1(px.Y(y0))} A${f1(w * s)} ${f1(w * s)} 0 0 ${into > 0 ? 1 : 0} ${f1(px.X(hx))} ${f1(px.Y(y0 + w))}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
    }
  }

  // ---- furniture + room tags (numbers match the room schedule, sheet A-401)
  const pen = svgPen(s, px);
  if (mode === "layout") for (const sp of level.spaces) g += furniture(pen, sp.kind, inner(model, sp), sp);
  else if (mode === "ceiling") for (const sp of level.spaces) if (sp.kind === "stair") g += furniture(pen, sp.kind, inner(model, sp), sp);
  if (mode === "ceiling") {
    const c = ceilingLayout(model, level);
    for (const r of c.cove) g += rect(r.x, r.y, r.w, r.h, `fill="none" stroke="${ACCENT}" stroke-width="1.1" stroke-dasharray="7 4"`);
    for (const t of c.track) {
      g += `<line x1="${f1(px.X(t.x1))}" y1="${f1(px.Y(t.y1))}" x2="${f1(px.X(t.x2))}" y2="${f1(px.Y(t.y2))}" stroke="${INK}" stroke-width="2"/>`;
      const n = Math.max(2, Math.round(Math.hypot(t.x2 - t.x1, t.y2 - t.y1) / 1.2));
      for (let i = 0; i <= n; i++) g += `<rect x="${f1(px.X(t.x1 + ((t.x2 - t.x1) * i) / n) - 3)}" y="${f1(px.Y(t.y1 + ((t.y2 - t.y1) * i) / n) - 3)}" width="6" height="6" fill="${ACCENT}"/>`;
    }
    for (const r of c.linear) g += rect(r.x, r.y, r.w, r.h, `fill="${PAPER}" stroke="${INK}" stroke-width="1.1"`) + `<line x1="${f1(px.X(r.x + 0.1))}" y1="${f1(px.Y(r.y + r.h / 2))}" x2="${f1(px.X(r.x + r.w - 0.1))}" y2="${f1(px.Y(r.y + r.h / 2))}" stroke="${ACCENT}" stroke-width="1.4"/>`;
    for (const [x, y] of c.down) g += SYM.down(px.X(x), px.Y(y));
    for (const [x, y] of c.pend) g += SYM.pend(px.X(x), px.Y(y));
    for (const [x, y] of c.mirror) g += SYM.mirror(px.X(x), px.Y(y));
  }
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
    if (sp.labelY) cy = px.Y(inn.y + inn.h * sp.labelY); // clear of the columns of a surveyed open floor
    const fs = inn.w * s < 90 ? 9 : 11;
    const label = inn.w * s < 70 && sp.label.length > 8 ? sp.label.split(/[ -]/)[0] : sp.label;
    const tw = label.length * fs * 0.68 + 16;
    g += `<rect x="${f1(cx - tw / 2)}" y="${f1(cy - fs - 4)}" width="${f1(tw)}" height="${fs * 2 + 14}" fill="${PAPER}" fill-opacity=".92"/>`;
    g += `<text x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="600" letter-spacing="1.2" fill="${INK}">${label}</text>`;
    const second = mode === "finish" ? `${roomFinish(model, sp).floor} · ${area} m²` : mode === "ceiling" ? `CH ${roomFinish(model, sp).ch.toFixed(2)}` : `${roomNo[sp.id]} · ${area} m²`;
    if (sp.kind !== "void") g += `<text x="${f1(cx)}" y="${f1(cy + fs + 5)}" text-anchor="middle" font-family="${FONT}" font-size="${fs - 1}" fill="${mode === "layout" ? MID : INK}">${second}</text>`;
  }
  // finished floor level tag
  const ffl = levelIndex === 0 ? "±0.000" : `+${(levelIndex * ST).toFixed(3)}`;
  const hall = level.spaces.find((sp) => sp.kind === "hall") ?? (model.interior && level.spaces.find((sp) => ["reception", "living", "open", "teahall", "boutique", "lounge"].includes(sp.kind))) ?? level.spaces[0];
  const hin = inner(model, hall);
  // a long corridor keeps its room label in the middle, so the tag moves towards its end
  const [tagX, tagY] = (spec.survey || COMMERCIAL_LEVELS[plan.style]) && hin.w > hin.h * 4 ? [hin.x + hin.w * 0.16, hin.y + hin.h / 2] : [hin.x + hin.w / 2, hin.y + hin.h * 0.82];
  if (mode !== "ceiling") g += `<g transform="translate(${f1(px.X(tagX))} ${f1(px.Y(tagY))})" font-family="${FONT}" font-size="9" fill="${INK}">
    <circle r="6" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/><path d="M-6 0H6M0 -6V6" stroke="${INK}" stroke-width="0.8"/>
    <path d="M0 -6A6 6 0 0 1 6 0H0Z M0 6A6 6 0 0 1 -6 0H0Z" fill="${INK}"/>
    <text x="10" y="3">FFL ${ffl}</text></g>`;

  // ---- dimension chains: detailed at 0.9 m, overall at 1.6 m (left out of public previews)
  if (!preview) {
    const back = level.spaces.filter((sp) => sp.y < 0.01).flatMap((sp) => [sp.x, sp.x + sp.w]);
    g += dimChain([...new Set([0, W, ...back].map(r1))].sort((a, b) => a - b), -0.9 - backOut, s, ox, oy, true, 1);
    g += dimChain([0, W, ...(garage ? [W + garage.w] : [])], -1.6 - backOut, s, ox, oy, true, 1);
    const left = level.spaces.filter((sp) => sp.x < 0.01).flatMap((sp) => [sp.y, sp.y + sp.h]);
    g += dimChain([...new Set([0, D, ...left].map(r1))].sort((a, b) => a - b), -0.9, s, ox, oy, false);
    g += dimChain([0, D], -1.6, s, ox, oy, false);
  }

  const gia = level.spaces.reduce((sum, sp) => sum + (sp.kind === "void" ? 0 : inner(model, sp).w * inner(model, sp).h), 0);
  const what = mode === "finish" ? "FLOOR FINISHES, CODES AS ON THE MATERIALS BOARD" : mode === "ceiling" ? "REFLECTED CEILING · LIGHTING · CLEAR HEIGHTS" : `NET INTERNAL AREA ${gia.toFixed(1)} m²`;
  g += sheetTitle(drawingName, `${plan.title.en.toUpperCase()}${unitNote(model)} · ${what} · ${preview ? "PREVIEW" : "DIMENSIONS IN METRES"}`);
  g += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
  let legend;
  if (mode === "finish") {
    const used = [...new Set(level.spaces.filter((sp) => sp.kind !== "void" && sp.kind !== "stair").map((sp) => roomFinish(model, sp).floor))].sort();
    legend = used.map((code) => matOf(model, code)).map((mt) => ({ fill: shade(mt.fill, 0.42), pattern: patternFill(mt.pattern) ? `ip-${mt.pattern}` : null, label: `${mt.code}  ${mt.name.split(",")[0]}` }));
    legend.title = "FLOOR FINISHES";
  } else if (mode === "ceiling") {
    const c = ceilingLayout(model, level);
    legend = [
      c.down.length && { symbol: SYM.down(0, 0), label: "L1  Recessed LED downlight" },
      c.pend.length && { symbol: SYM.pend(0, 0), label: "L2  Decorative pendant" },
      c.cove.length && { symbol: `<rect x="-9" y="-7" width="18" height="14" fill="none" stroke="${ACCENT}" stroke-width="1.1" stroke-dasharray="4 2"/>`, label: "L3  LED cove at bulkhead edge" },
      c.track.length && { symbol: `<line x1="-10" y1="0" x2="10" y2="0" stroke="${INK}" stroke-width="2"/><rect x="-3" y="-3" width="6" height="6" fill="${ACCENT}"/>`, label: "L4  Track with adjustable spots" },
      c.linear.length && { symbol: `<rect x="-10" y="-3" width="20" height="6" fill="${PAPER}" stroke="${INK}"/>`, label: "L5  Linear LED pendant" },
      c.mirror.length && { symbol: SYM.mirror(0, 0), label: "L6  Mirror / wall light, IP44" },
    ].filter(Boolean);
    legend.title = "LIGHTING";
  }
  return sheet({ plan, drawing: drawingName, sheetNo, scaleNote: "GRAPHIC SCALE", body: g, defs: materialDefs(s, hash(plan.slug)) + (model.interior ? interiorDefs(s) : ""), north: true, legend, preview });
}

// ------------------------------------------------------------------ site plan sheet

/** Roof plan of one house (and its garage) through the plan-metre mappers X, Y at s px per metre. */
function roofPlan(model, X, Y, s, { notes = true } = {}) {
  const { W, D, plan, spec, site } = model;
  const gW = model.garage?.w ?? 0;
  const gD = model.garage?.d ?? 0;
  const rect = (x, y, w, h, extra) => `<rect x="${X(x)}" y="${Y(y)}" width="${f1(w * s)}" height="${f1(h * s)}" ${extra}/>`;
  const label = (x, y, str, size = 10, fill = MID) => `<text x="${X(x)}" y="${Y(y)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" letter-spacing="2" fill="${fill}">${str}</text>`;
  let g = "";
  const roofCol = { terracotta: "#d9a283", seam: "#8d9195", slate: "#8c9198" }[spec.roof] ?? (spec.slabMat === "charcoal" ? "#9a9c9f" : "#ebe6dc");
  const ov = model.roofOv;
  if (plan.roof === "flat") {
    const fo = spec.canopy ?? spec.slab ?? 0.2;
    const sideOv = spec.canopy ? 1.6 : 0.3;
    if (model.chamfer) {
      // slab and parapet follow the chamfered street corner; the round stair tower stands in front
      const { a, b } = model.chamfer;
      const outline = (dSide, dFront) => {
        const len = Math.hypot(a, b), d = (dSide + dFront) / 2;
        const q = [(-d * b) / len, D - b + (d * a) / len]; // a point of the chamfer line pushed out by the overhang
        const xF = q[0] + ((D + dFront - q[1]) / b) * a, yS = q[1] + ((-dSide - q[0]) / a) * b;
        return [[-dSide, -dSide], [W + dSide, -dSide], [W + dSide, D + dFront], [xF, D + dFront], [-dSide, yS]];
      };
      const pts = (arr) => arr.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
      g += `<polygon points="${pts(outline(sideOv, fo))}" fill="${roofCol}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
      g += `<polygon points="${pts(outline(sideOv - 0.35, fo - 0.35))}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      if (model.towerArc) {
        const { cx, r } = model.towerArc;
        g += `<path d="M${X(cx - r)} ${Y(D)} A${f1(r * s)} ${f1(r * s)} 0 0 0 ${X(cx + r)} ${Y(D)} Z" fill="${shade(roofCol, -0.08)}" stroke="${INK}" stroke-width="1.4"/>`;
        if (notes) g += label(cx, D + r * 0.55, "STAIR", 8, INK);
      }
    } else {
      g += rect(-sideOv, -0.3, W + 2 * sideOv, D + 0.3 + fo, `fill="${roofCol}" stroke="${INK}" stroke-width="1.6"`);
      g += rect(-sideOv + 0.35, 0.05, W + 2 * sideOv - 0.7, D - 0.1 + fo - 0.3, `fill="none" stroke="${MID}" stroke-width="0.7"`);
    }
    for (const [dx, dy] of [[0.25, 0.3], [0.75, 0.3], [0.25, 0.75], [0.75, 0.75]]) g += `<circle cx="${X(W * dx)}" cy="${Y(D * dy)}" r="3" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
    if (spec.rooflights) {
      const nx = Math.max(2, Math.round((W * 0.8) / 9)), ny = Math.max(1, Math.round((D * 0.48) / 9));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) g += rect(((i + 0.5) * W * 0.8) / nx - 1, D * 0.24 + ((j + 0.5) * D * 0.48) / ny - 2, 2, 4, `fill="#c9dce2" stroke="${INK}" stroke-width="0.8"`);
      for (let i = 0; i < 3; i++) g += rect(W * 0.62 + i * 3.4, D * 0.06, 2.6, 1.8, `fill="#c7c4bd" stroke="${INK}" stroke-width="0.9"`);
    }
    if (spec.roofTerrace) g += rect(W * 0.12, D * 0.15, W * 0.55, D * 0.6, `fill="#e6dfd2" stroke="#7fa3ad" stroke-width="2.2"`) + rect(W * 0.12, D * 0.15, W * 0.55, D * 0.6, `fill="url(#p-paving)"`) + label(W * 0.395, D * 0.47, "ROOF TERRACE", 9, INK);
    if (notes) g += label(W / 2, D * (spec.roofTerrace ? 0.88 : 0.52), `FLAT ROOF  +${(model.wallTop + 0.45).toFixed(2)}`, 10, INK);
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
    if (notes) g += `<rect x="${X(W / 2) - 52}" y="${Y(D * 0.5) - 9}" width="104" height="18" fill="${PAPER}" fill-opacity=".85"/><text x="${X(W / 2)}" y="${Y(D * 0.5) + 4}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${INK}">RIDGE +${model.H.toFixed(2)}</text>`;
  }
  if (model.garage) {
    const gy = D - gD;
    if (spec.roof === "terracotta" || spec.roof === "slate") {
      g += `<polygon points="${X(W)},${Y(gy - 0.4)} ${X(W + gW + 0.4)},${Y(gy - 0.4)} ${X(W + gW + 0.4)},${Y(D + 0.4)} ${X(W)},${Y(D + 0.4)}" fill="${shade(roofCol, -0.06)}" stroke="${INK}" stroke-width="1.2"/>`;
      g += rect(W, gy - 0.4, gW + 0.4, gD + 0.8, `fill="url(#p-roofh)"`);
    } else {
      g += rect(W, gy, gW, gD, `fill="${roofCol}" stroke="${INK}" stroke-width="1.4"`);
    }
    if (notes) g += label(W + gW / 2, gy + gD / 2 + 0.2, "GARAGE", 9, INK);
  }

  return g;
}

export function sitePlanSheet(model, sheetNo, { preview = false } = {}) {
  if (model.project) return masterplanSheet(model, sheetNo, { preview });
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

  g += roofPlan(model, X, Y, s);

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
  return sheet({ plan, drawing: "SITE PLAN", sheetNo, scaleNote: "GRAPHIC SCALE", body: g + schedule, defs: materialDefs(s, seed), north: true, preview });
}

// ------------------------------------------------------------------ multi-unit projects

/**
 * Masterplan of a project in plan metres (x east, y south): plot, house positions and the shared landscape.
 * row = terrace of townhouses on a street; farm = farmhouses on an arc above a vineyard, barn yard behind;
 * cluster = two staggered rows of houses on a slope with a lodge and parking at the entrance.
 */
function projectLayout(model) {
  const { W, D, plan, site, spec } = model;
  const { kind, units: N } = model.project;
  const rand = rng(hash(plan.slug) + 99);
  const front = Math.max(site.T, site.deck ? site.T + site.deck.h : 0);
  const units = [];
  const items = [];
  let trees = [];
  const tree = (x, y, r, k = spec.tree) => trees.push({ x, y, r, kind: k });
  // parking bays for a house: on the wider side of its entrance path, along the lane at y = edge
  const housePark = (u, m, edge, n) => {
    const ex = u.x + m.site.entryX;
    const right = u.x + W - ex >= ex - u.x;
    for (let k = 0; k < n; k++) items.push({ t: "bay", x: right ? ex + 1.6 + k * 2.7 : ex - 1.6 - (k + 1) * 2.7, y: edge - 5.2, w: 2.6, h: 5.2 });
  };
  let plot;
  let shared;
  if (kind === "row") {
    const court = 6.5, garden = 11, rowW = N * W;
    plot = { x0: -9, y0: -garden - 1.6, x1: rowW + 16, y1: D + court };
    for (let i = 0; i < N; i++) {
      const mirror = i % 2 === 1;
      const u = { x: i * W, y: 0, mirror, no: i + 1 };
      units.push(u);
      const m = mirror ? model.project.mirrored : model;
      const ex = u.x + m.site.entryX;
      items.push({ t: "paving", x: u.x, y: -3.2, w: W, h: 3.2 });
      items.push({ t: "paving", x: ex - 0.7, y: D, w: 1.4, h: court });
      const bx = mirror ? u.x + W - 3.1 : u.x + 0.4;
      items.push({ t: "bay", x: bx, y: D + court - 5.2, w: 2.7, h: 5.2 });
      // low front hedge, open at the path and the parking bay
      let hx = u.x;
      for (const [g0, g1] of [[ex - 0.7, ex + 0.7], [bx, bx + 2.7]].sort((a, b) => a[0] - b[0])) {
        if (g0 - hx > 0.5) items.push({ t: "hedge", pts: [[hx + 0.15, D + court - 0.45], [g0 - 0.15, D + court - 0.45]] });
        hx = g1;
      }
      if (u.x + W - hx > 0.5) items.push({ t: "hedge", pts: [[hx + 0.15, D + court - 0.45], [u.x + W - 0.15, D + court - 0.45]] });
      tree(u.x + W * (mirror ? 0.3 : 0.7), -garden + 2.6, 1.7 + rand() * 0.5);
    }
    items.push({ t: "fence", lines: [[[0, -garden], [rowW, -garden]], ...Array.from({ length: N + 1 }, (_, i) => [[i * W, -garden], [i * W, 0]])] });
    items.push({ t: "paving", x: plot.x0, y: plot.y0, w: plot.x1 - plot.x0, h: 1.6, label: "GARDEN PATH" });
    // west end: bin + cycle store; east end: visitor parking and a pocket park with a play area
    items.push({ t: "building", x: -7, y: D + 1.2, w: 5, h: 3, wallH: 2.6, roof: "flat", mat: wallMat(spec, 0), label: "BINS · CYCLES" });
    items.push({ t: "paving", x: -5.2, y: D + 4.2, w: 1.4, h: court - 4.2 });
    for (let k = 0; k < 4; k++) items.push({ t: "bay", x: rowW + 2 + k * 2.6, y: D + court - 5.2, w: 2.6, h: 5.2 });
    items.push({ t: "paving", x: rowW + 12.8, y: plot.y0 + 1.6, w: 1.6, h: plot.y1 - plot.y0 - 1.6 });
    items.push({ t: "play", x: rowW + 2.5, y: -garden + 1.5, w: 9, h: 7.5, label: "PLAY" });
    items.push({ t: "label", x: rowW + 7, y: -0.4, text: "POCKET PARK" });
    for (const [x, y] of [[rowW + 3, -1.6], [rowW + 9.5, -2.4], [rowW + 14.2, -6], [rowW + 14.2, 2.5], [-6.5, -8], [-6.5, -2.5], [-3, -10.5], [rowW + 13.5, -9.5]]) tree(x, y, 1.9 + rand() * 0.6);
    for (let x = plot.x0 + 2; x < plot.x1; x += 9) tree(x, plot.y1 + 1.1, 1.3, "round");
    shared = "Pocket park with play area · 4 visitor bays · bin and cycle store";
  } else if (kind === "farm") {
    const margin = 14, gap = 9;
    const PW = 2 * margin + N * W + (N - 1) * gap;
    const cx = PW / 2;
    for (let i = 0; i < N; i++) {
      const t = i - (N - 1) / 2;
      units.push({ x: r1(margin + i * (W + gap)), y: r1(34 + 2.6 * t * t), mirror: false, no: i + 1 });
    }
    const laneY = r1(Math.max(...units.map((u) => u.y)) + D + front + 6);
    const v0 = laneY + 5 + 24;
    plot = { x0: 0, y0: 0, x1: PW, y1: v0 + 26 };
    items.push({ t: "lane", x: margin - 8, y: laneY, w: PW - 2 * margin + 16, h: 5, label: "ESTATE LANE" });
    items.push({ t: "lane", x: cx - 3, y: laneY + 5, w: 6, h: plot.y1 - laneY - 5 });
    for (const u of units) {
      const ex = u.x + site.entryX;
      items.push({ t: "paving", x: ex - 0.8, y: u.y + D + front, w: 1.6, h: laneY - (u.y + D + front) });
      housePark(u, model, laneY, 2);
      items.push({ t: "hedge", pts: [[u.x - 2.5, u.y + 2], [u.x - 2.5, laneY - 0.6]] }, { t: "hedge", pts: [[u.x + W + 2.5, u.y + 2], [u.x + W + 2.5, laneY - 0.6]] });
      tree(u.x + W * 0.15, u.y + D + front + 4, 2.2);
    }
    // farmyard with the winery barn and stables, reached by a service track along the east boundary
    items.push({ t: "yard", x: cx - 24, y: 3, w: 48, h: 19, label: "FARMYARD" });
    items.push({ t: "building", x: cx - 21, y: 5, w: 18, h: 12, wallH: 5.2, roof: "gable", mat: "rubble", roofMat: "terracotta", label: "WINERY · BARN" });
    items.push({ t: "building", x: cx + 3, y: 6, w: 17, h: 9, wallH: 3.6, roof: "gable", mat: "rubble", roofMat: "terracotta", label: "STABLES" });
    items.push({ t: "lane", x: PW - 9, y: 9, w: 4, h: laneY - 9 }, { t: "lane", x: cx + 24, y: 9, w: PW - 9 - cx - 24, h: 4 });
    items.push({ t: "paddock", x: cx + 27, y: 16, w: PW - 13 - cx - 27, h: 14, label: "PADDOCK" });
    items.push({ t: "orchard", x: 6, y: 4, w: cx - 34, h: 24, label: "ORCHARD" });
    for (let x = 9; x < cx - 29; x += 5.5) for (let y = 7; y < 27; y += 5.5) tree(x + (rand() - 0.5) * 0.6, y + (rand() - 0.5) * 0.6, 1.6, "round");
    // pond and estate pool either side of the cypress avenue
    items.push({ t: "pond", cx: cx - 28, cy: laneY + 5 + 12, rx: 13, ry: 6.5, label: "POND" });
    items.push({ t: "pool", x: cx + 10, y: laneY + 9, w: 20, h: 11, pool: { x: cx + 13, y: laneY + 12, w: 14, d: 5 } });
    items.push({ t: "building", x: cx + 31.5, y: laneY + 10, w: 7, h: 5, wallH: 3, roof: "gable", mat: "rubble", roofMat: "terracotta", label: "POOL HOUSE" });
    items.push({ t: "vineyard", x: margin, y: v0, w: cx - 5 - margin, h: plot.y1 - 5 - v0, label: "VINEYARD" });
    items.push({ t: "vineyard", x: cx + 5, y: v0, w: PW - margin - cx - 5, h: plot.y1 - 5 - v0 });
    for (let y = laneY + 9; y < plot.y1 - 1.5; y += 7) tree(cx - 4.6, y, 0.9, "cypress"), tree(cx + 4.6, y, 0.9, "cypress");
    for (let y = 36; y < v0 - 3; y += 9 + rand() * 4) tree(4.5, y, 2.2, "olive"), tree(PW - 2.8, y + 4, 2.0, "olive");
    shared = "Winery barn · stables · estate pool · pond · vineyard · orchard";
  } else if (kind === "retail") {
    // supermarket: forecourt and car park in front, delivery yard behind, a service road along the east side
    units.push({ x: 0, y: 0, mirror: false, no: 1 });
    const fc = 5, rowD = 5, aisle = 6.5, bay = 2.5, x0 = -6, x1 = W + 3, rx = W + 4.5;
    plot = { x0: -14, y0: -25, x1: r1(rx + 10), y1: 0 };
    items.push({ t: "paving", x: x0, y: D, w: x1 - x0, h: fc, label: "" });
    let y = D + fc;
    const rows = [];
    for (const pair of [0, 1]) {
      rows.push(y);
      y += rowD;
      items.push({ t: "lane", x: x0, y, w: rx - x0, h: aisle, label: pair ? "" : "CAR PARK" });
      y += aisle;
      rows.push(y);
      y += rowD;
      if (!pair) {
        items.push({ t: "island", x: x0, y, w: x1 - x0, h: 2.4 });
        items.push({ t: "building", x: W * 0.3, y: y + 0.3, w: 7, h: 1.8, wallH: 2.4, roof: "flat", mat: "panel", label: "TROLLEYS" });
        items.push({ t: "building", x: W * 0.68, y: y + 0.3, w: 7, h: 1.8, wallH: 2.4, roof: "flat", mat: "panel", label: "TROLLEYS" });
        for (let tx = x0 + 3; tx < x1 - 2; tx += 7) if (Math.abs(tx - W * 0.3 - 3.5) > 6 && Math.abs(tx - W * 0.68 - 3.5) > 6) tree(tx, y + 1.2, 1.6);
        y += 2.4;
      }
    }
    for (const ry of rows) for (let bx = x0; bx + bay <= x1 + 0.01; bx += bay) items.push({ t: "bay", x: bx, y: ry, w: bay, h: rowD });
    plot.y1 = r1(y + 4);
    items.push({ t: "label", x: x0 + 6, y: D + fc + rowD + 1.2, text: "EV CHARGING" });
    // delivery yard behind the goods-in door, reached by the service road
    const dock = model.levels[0].spaces.find((sp) => sp.kind === "dock");
    const dockX = dock ? dock.x + dock.w / 2 : W * 0.7;
    items.push({ t: "yard", x: W * 0.5, y: -22, w: rx - W * 0.5, h: 22, label: "DELIVERY YARD" });
    items.push({ t: "lane", x: rx, y: -22, w: 7, h: plot.y1 - -22 });
    items.push({ t: "truck", x: dockX - 1.25, y: -14.2, w: 2.5, h: 13.6 });
    items.push({ t: "building", x: W * 0.5 + 1.5, y: -21, w: 6, h: 3.5, wallH: 2.6, roof: "flat", mat: "panel", label: "WASTE" });
    for (let tx = plot.x0 + 3; tx < plot.x1 - 2; tx += 7.5) tree(tx, plot.y1 - 1.8, 1.9);
    for (let ty = plot.y0 + 3; ty < plot.y1 - 4; ty += 7) tree(plot.x0 + 3.5, ty, 2.0 + rand() * 0.4);
    for (let tx = 2; tx < W * 0.45; tx += 7) tree(tx, -12 - rand() * 6, 2.1);
    shared = `${items.filter((it) => it.t === "bay").length} parking bays with EV charging · trolley shelters · delivery yard with service road`;
  } else if (kind === "urban" && model.plan.style === "showroom") {
    // roadside showroom: pavement and a row of forecourt bays off the road, a service yard behind the dispatch door
    units.push({ x: 0, y: 0, mirror: false, no: 1 });
    const fw = 2.5, rowD = 5.0, bay = 2.5;
    plot = { x0: -3, y0: -13, x1: r1(W + 9), y1: r1(D + fw + rowD + 0.5) };
    items.push({ t: "paving", x: plot.x0, y: D, w: plot.x1 - plot.x0, h: fw, label: "" });
    for (let bx = plot.x0 + 0.5; bx + bay <= W + 2.6; bx += bay) items.push({ t: "bay", x: bx, y: D + fw, w: bay, h: rowD });
    items.push({ t: "yard", x: plot.x0 + 1, y: plot.y0 + 1, w: W + 2, h: -plot.y0 - 1, label: "SERVICE YARD" });
    items.push({ t: "lane", x: W + 2.4, y: plot.y0 + 1, w: 5.6, h: plot.y1 - plot.y0 - 1, label: "" });
    const disp = model.levels[0].spaces.find((sp) => sp.kind === "dock");
    items.push({ t: "truck", x: (disp ? disp.x + disp.w / 2 : W * 0.6) - 1.1, y: -8.4, w: 2.2, h: 7.2 });
    shared = `${items.filter((it) => it.t === "bay").length} forecourt parking bays · service yard for deliveries`;
  } else if (kind === "urban") {
    // corner plot in town: streets to the south and west, the entrance at the corner, gated parking on the east side
    units.push({ x: 0, y: 0, mirror: false, no: 1 });
    plot = { x0: -4, y0: -8, x1: r1(W + 18), y1: r1(D + 8) };
    items.push({ t: "street", x: -14, y: plot.y0 - 4, w: 10, h: plot.y1 - plot.y0 + 4, label: "SIDE STREET" });
    items.push({ t: "paving", x: plot.x0, y: D, w: W + 5, h: plot.y1 - D, label: "" }, { t: "paving", x: plot.x0, y: plot.y0, w: 4, h: D - plot.y0 });
    items.push({ t: "lane", x: W + 6.2, y: plot.y0 + 1, w: 6, h: plot.y1 - plot.y0 - 1, label: "" });
    for (let by = plot.y0 + 1; by + 2.5 <= plot.y1 - 2.6; by += 2.5) items.push({ t: "bay", x: W + 1, y: by, w: 5.2, h: 2.5 }, { t: "bay", x: W + 12.2, y: by, w: 5.2, h: 2.5 });
    items.push({ t: "fence", lines: [[[W + 6.4, plot.y1 - 1.6], [W + 10.8, plot.y1 - 1.6]]] }, { t: "label", x: W + 9.2, y: plot.y1 - 0.4, text: "BARRIER" });
    for (let ty = plot.y0 + 2; ty < plot.y1 - 1; ty += 6) tree(-2, ty, 1.5);
    for (let tx = 2; tx < W + 4; tx += 6.5) tree(tx, D + 5.6, 1.5);
    shared = `${items.filter((it) => it.t === "bay").length} parking bays behind a barrier · corner forecourt under a glass canopy · roof terrace`;
  } else if (["business", "hotel", "dining", "events", "residential"].includes(kind)) {
    // one building on its plot: a forecourt to the road, car parks beside it, service yard or garden behind
    units.push({ x: 0, y: 0, mirror: false, no: 1 });
    const rowD = 5, aisle = 6.5, bay = 2.5, lotW = 2 * rowD + aisle;
    const fc = { business: 10, hotel: 12, dining: 8, events: 16, residential: 8 }[kind];
    const behind = { business: 14, hotel: layoutOf(plan) === "b" ? 26 : 12, dining: 9, events: 24, residential: 20 }[kind];
    const west = kind === "events" || kind === "business" ? lotW + 5 : kind === "dining" ? 9 : 6;
    plot = { x0: -west, y0: -behind, x1: r1(W + 5 + lotW + 2), y1: r1(D + fc) };
    // a car park: two rows of bays either side of an aisle running front to back
    const lot = (lx, ly0, ly1) => {
      items.push({ t: "lane", x: lx + rowD, y: ly0, w: aisle, h: ly1 - ly0, label: "" });
      for (let by = ly0 + 0.5; by + bay <= ly1 - 0.5; by += bay) items.push({ t: "bay", x: lx, y: by, w: rowD, h: bay }, { t: "bay", x: lx + rowD + aisle, y: by, w: rowD, h: bay });
      items.push({ t: "label", x: lx + lotW / 2, y: ly0 + 1.6, text: "CAR PARK" });
    };
    lot(W + 5, plot.y0 + 2, plot.y1 - 0.5);
    if (kind === "events" || kind === "business") lot(plot.x0 + 2.5, plot.y0 + 2, plot.y1 - 0.5);
    const label = { business: "ENTRANCE PLAZA", hotel: "DROP-OFF", dining: "TERRACE", events: "FORECOURT", residential: "" }[kind];
    const px0 = kind === "events" || kind === "business" ? plot.x0 + lotW + 3 : plot.x0 + 1;
    items.push({ t: "paving", x: px0, y: D, w: W + 4 - px0, h: fc - 0.6, label: "" });
    if (label) items.push({ t: "label", x: W * (kind === "events" ? 0.5 : 0.3), y: D + fc - 1.4, text: label });
    if (kind === "events") items.push({ t: "pond", cx: W / 2, cy: D + fc / 2, rx: 6, ry: 2.6, label: "FOUNTAIN" });
    if (kind === "hotel" && layoutOf(plan) === "b") {
      // resort: the pool garden behind the building
      items.push({ t: "pool", x: W * 0.2, y: -21, w: Math.min(30, W * 0.55), h: 15, pool: { x: W * 0.2 + 3, y: -18, w: Math.min(24, W * 0.55 - 6), d: 9 } });
      items.push({ t: "label", x: W * 0.2 + Math.min(30, W * 0.55) / 2, y: -3.2, text: "POOL GARDEN" });
      for (let tx = 2; tx < W; tx += 6) tree(tx, -24 + (rand() - 0.5), 1.6, "palm");
    } else if (kind === "residential") {
      // residents' courtyard with a play area
      items.push({ t: "play", x: W * 0.15, y: -15, w: 12, h: 9, label: "PLAY" });
      items.push({ t: "label", x: W * 0.6, y: -8, text: "COURTYARD GARDEN" });
      for (let tx = W * 0.4; tx < W - 2; tx += 5.5) tree(tx, -14 + (rand() - 0.5) * 2, 2.0);
    } else {
      items.push({ t: "yard", x: 1, y: -behind + 1, w: Math.min(W - 2, 26), h: behind - 2.5, label: "SERVICE YARD" });
      for (let tx = Math.min(W - 2, 26) + 4; tx < W - 1; tx += 6) tree(tx, -behind / 2, 1.9);
    }
    // planting: a row of trees along the road and the western edge
    for (let tx = plot.x0 + 3; tx < W + 3; tx += 7) tree(tx, plot.y1 - 1.6, 1.7);
    for (let ty = plot.y0 + 3; ty < D; ty += 7) tree(plot.x0 + 2.4, ty, 1.9 + rand() * 0.4);
    const bays = items.filter((it) => it.t === "bay").length;
    shared = {
      business: `${bays} parking bays in two car parks · entrance plaza with planting · service yard with loading bay`,
      hotel: layoutOf(plan) === "b" ? `${bays} parking bays · drop-off under the canopy · pool garden` : `${bays} parking bays · drop-off under the canopy · service yard`,
      dining: `${bays} parking bays · front terrace · service yard`,
      events: `${bays} parking bays in two car parks · forecourt with fountain · service yard`,
      residential: `${bays} parking bays · residents' courtyard with play area`,
    }[kind];
  } else {
    const margin = 15, gap = 7, deck = 3;
    const perRow = Math.ceil(N / 2);
    const step = W + gap;
    const PW = 2 * margin + perRow * W + (perRow - 1) * gap + step / 2;
    const yA = 18;
    for (let i = 0; i < perRow; i++) units.push({ x: r1(margin + i * step), y: yA, mirror: false, no: i + 1 });
    // deck, then a front garden with two parking bays, then the lane
    const laneA = r1(yA + D + Math.max(front, deck) + 7);
    const yB = laneA + 10;
    for (let i = 0; i < N - perRow; i++) units.push({ x: r1(margin + step / 2 + i * step), y: yB, mirror: false, no: perRow + i + 1 });
    const laneB = r1(yB + D + Math.max(front, deck) + 7);
    const yP = laneB + 8;
    plot = { x0: 0, y0: 0, x1: r1(PW), y1: r1(yP + 22) };
    for (const [ly, label] of [[laneA, "UPPER LANE"], [laneB, "LOWER LANE"]]) items.push({ t: "lane", x: 5, y: ly, w: PW - 13, h: 5, label });
    items.push({ t: "lane", x: 5, y: laneA, w: 5, h: plot.y1 - laneA });
    for (const u of units) {
      const edge = u.y === yA ? laneA : laneB;
      if (!site.T) items.push({ t: "deck", x: u.x + 0.6, y: u.y + D, w: W - 1.2, h: deck });
      const ex = u.x + site.entryX;
      const from = u.y + D + Math.max(front, deck);
      items.push({ t: "paving", x: ex - 0.7, y: from, w: 1.4, h: edge - from });
      housePark(u, model, edge, 2);
    }
    // entrance: parking court, spa lodge and a fire-pit terrace
    items.push({ t: "yard", x: 11, y: yP, w: 22, h: 16, label: "" });
    for (let k = 0; k < 8; k++) items.push({ t: "bay", x: 11.4 + k * 2.65, y: yP + 0.4, w: 2.6, h: 5.2 }, { t: "bay", x: 11.4 + k * 2.65, y: yP + 10.4, w: 2.6, h: 5.2 });
    items.push({ t: "building", x: 37, y: yP + 1, w: 24, h: 13, wallH: 6.2, roof: "gable", mat: wallMat(spec, 0), roofMat: spec.roof ?? null, label: "SPA LODGE · RECEPTION" });
    items.push({ t: "firepit", cx: Math.min(PW - 12, 72), cy: yP + 8, r: 4, label: "FIRE PIT" });
    // the slope falls to the south: contours every 2 m
    for (let y = 6, z = 1262; y < plot.y1; y += 8, z -= 2) items.push({ t: "contour", y, z, phase: rand() * 6 });
    for (let i = 0; i < 70; i++) {
      const edge = rand();
      const x = edge < 0.45 ? rand() * PW : edge < 0.7 ? 1.5 + rand() * 4 : PW - 1.5 - rand() * 4;
      const y = edge < 0.45 ? 1.5 + rand() * (yA - 4) : 1.5 + rand() * (plot.y1 - 3);
      tree(x, y, 1.7 + rand() * 0.7);
    }
    for (const u of units) tree(u.x - gap / 2, u.y + D * 0.5, 1.8), tree(u.x + W + gap / 2, u.y + D * 0.2, 1.6);
    shared = "Spa lodge with reception · 16 parking bays · fire-pit terrace";
  }
  // keep trees clear of houses, buildings, lanes, parking and water
  const solid = [
    ...units.map((u) => ({ x: u.x - 0.8, y: u.y - 0.8, w: W + (model.garage?.w ?? 0) + 1.6, h: D + front + 1.6 })),
    ...items.filter((it) => ["building", "lane", "bay", "pool", "deck", "yard", "play", "paddock", "truck"].includes(it.t)),
    ...items.filter((it) => it.t === "pond" || it.t === "firepit").map((it) => ({ x: it.cx - (it.rx ?? it.r) - 1, y: it.cy - (it.ry ?? it.r) - 1, w: 2 * (it.rx ?? it.r) + 2, h: 2 * (it.ry ?? it.r) + 2 })),
  ];
  const clear = (t) => !solid.some((r) => t.x + t.r * 0.75 > r.x && t.x - t.r * 0.75 < r.x + r.w && t.y + t.r * 0.75 > r.y && t.y - t.r * 0.75 < r.y + r.h);
  const inPlot = (t) => t.y > plot.y1 || (t.x > plot.x0 + t.r * 0.5 && t.x < plot.x1 - t.r * 0.5 && t.y > plot.y0 + t.r * 0.5 && t.y < plot.y1 - t.r * 0.5);
  const kept = [];
  for (const t of trees) if (clear(t) && inPlot(t) && !kept.some((k) => Math.hypot(k.x - t.x, k.y - t.y) < (k.r + t.r) * 0.75)) kept.push(t);
  trees = kept;
  const buildings = items.filter((it) => it.t === "building");
  const footprint = units.length * (W * D + (model.garage ? model.garage.w * model.garage.d : 0)) + buildings.reduce((n, b) => n + b.w * b.h, 0);
  return { plot, units, items, trees, shared, footprint, parking: items.filter((it) => it.t === "bay").length };
}

const PROJECT_WORD = { row: "TOWNHOUSES", farm: "FARMHOUSES", cluster: "HOUSES", retail: "BUILDING" };
const multi = (model) => !!model.project && model.project.units > 1;
/** What the project is, for sheet titles: the style may name it more precisely than its project kind. */
const kindLabel = (model) => model.spec.projectLabel ?? PROJECT_RULES[model.project.kind].label;
/** "7 × 180 m² = 1260 m²" for a project of several houses, "180 m²" otherwise. */
const grossArea = (model) => (multi(model) ? `${model.project.units} × ${model.plan.areaM2} = ${model.project.totalArea} m²` : `${model.plan.areaM2} m²`);
const unitNote = (model) => (multi(model) ? ` · TYPICAL HOUSE, ${model.project.units} NO.` : "");

/** A-001 for a project: every house, the lanes and the shared landscape on one sheet. */
function masterplanSheet(model, sheetNo, { preview = false } = {}) {
  const { plan, project, W, D } = model;
  const { plot, units, items, trees } = project.layout;
  const roadD = 9.2; // footway 2.2 + carriageway 7
  const ext = { x0: plot.x0 - 4, x1: plot.x1 + 4, y0: plot.y0 - 4.5, y1: plot.y1 + roadD + 1 };
  for (const st of items.filter((it) => it.t === "street")) ext.x0 = Math.min(ext.x0, st.x - 1);
  const EW = ext.x1 - ext.x0, ED = ext.y1 - ext.y0;
  const areaW = SHEET_W - 330 - 36 - 100;
  const areaH = SHEET_H - 72 - 170;
  const s = Math.min(areaW / EW, areaH / ED, 30);
  const ox = 36 + 50 + (areaW - EW * s) / 2 - ext.x0 * s;
  const oy = 36 + 34 + (areaH - ED * s) / 2 - ext.y0 * s;
  const X = (m) => f1(ox + m * s);
  const Y = (m) => f1(oy + m * s);
  const rect = (x, y, w, h, extra) => `<rect x="${X(x)}" y="${Y(y)}" width="${f1(w * s)}" height="${f1(h * s)}" ${extra}/>`;
  const label = (x, y, str, size = 10, fill = MID, extra = "") => `<text x="${X(x)}" y="${Y(y)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" letter-spacing="2" fill="${fill}" ${extra}>${str}</text>`;
  const tag = (x, y, str, size = 9) => {
    const w = str.length * size * 0.78 + 12;
    return `<rect x="${f1(X(x) - w / 2)}" y="${f1(Y(y) - size - 2)}" width="${f1(w)}" height="${size + 8}" fill="${PAPER}" fill-opacity=".88"/>` + label(x, y, str, size, INK);
  };
  const seed = hash(plan.slug);
  const PW = plot.x1 - plot.x0, PD = plot.y1 - plot.y0;
  let g = "";

  // public road along the south boundary
  g += rect(ext.x0 + 1, plot.y1, EW - 2, 2.2, `fill="#e7e2d8" stroke="${MID}" stroke-width="0.6"`);
  g += rect(ext.x0 + 1, plot.y1 + 2.2, EW - 2, 7, `fill="#d9d5cd"`);
  g += `<line x1="${X(ext.x0 + 1)}" y1="${Y(plot.y1 + 5.7)}" x2="${X(ext.x1 - 1)}" y2="${Y(plot.y1 + 5.7)}" stroke="#ffffff" stroke-width="2" stroke-dasharray="18 12"/>`;
  g += label((plot.x0 + plot.x1) / 2, plot.y1 + 8.2, project.kind === "row" ? "STREET" : "ACCESS ROAD", 11, INK);

  // ground: grass, contours, hard and soft landscape
  g += rect(plot.x0, plot.y0, PW, PD, `fill="#e3e5d4"`) + rect(plot.x0, plot.y0, PW, PD, `fill="url(#p-grass)"`);
  const paved = (it, fill, pat) => rect(it.x, it.y, it.w, it.h, `fill="${fill}" stroke="${MID}" stroke-width="0.6"`) + rect(it.x, it.y, it.w, it.h, `fill="url(#${pat})"`);
  const car = (b) => {
    const vertical = b.h > b.w;
    const cw = vertical ? 1.8 : 4.4, ch = vertical ? 4.4 : 1.8;
    const x = b.x + (b.w - cw) / 2, y = b.y + (b.h - ch) / 2;
    return rect(x, y, cw, ch, `rx="${f1(0.5 * s)}" fill="#c4c7c8" stroke="${INK}" stroke-width="0.7"`) + rect(x + (vertical ? 0.2 : 1.2), y + (vertical ? 1.2 : 0.2), vertical ? 1.4 : 1.1, vertical ? 1.1 : 1.4, `fill="#7f8f97" fill-opacity=".8"`);
  };
  let parked = 0;
  for (const it of items) {
    switch (it.t) {
      case "contour": {
        let d = "";
        for (let x = plot.x0; x <= plot.x1 + 0.01; x += 2) d += `${d ? "L" : "M"}${X(x)} ${Y(it.y + Math.sin(x / 13 + it.phase) * 1.4)}`;
        g += `<path d="${d}" fill="none" stroke="#a49a86" stroke-width="0.8" stroke-opacity=".7"/>`;
        const ly = Y(it.y + Math.sin((plot.x1 - 3) / 13 + it.phase) * 1.4);
        g += `<rect x="${f1(X(plot.x1 - 3) - 16)}" y="${f1(ly - 6)}" width="32" height="12" fill="#e3e5d4"/><text x="${X(plot.x1 - 3)}" y="${f1(ly + 3)}" text-anchor="middle" font-family="${FONT}" font-size="8.5" fill="#8a816f">+${it.z}</text>`;
        break;
      }
      case "lane":
        g += paved(it, "#e1dbcf", "p-setts");
        break;
      case "street":
        g += rect(it.x, it.y, it.w, it.h + roadD, `fill="#d9d5cd"`);
        g += `<line x1="${X(it.x + it.w / 2)}" y1="${Y(it.y)}" x2="${X(it.x + it.w / 2)}" y2="${Y(it.y + it.h + roadD)}" stroke="#ffffff" stroke-width="2" stroke-dasharray="18 12"/>`;
        g += `<text transform="translate(${X(it.x + it.w / 2 - 0.9)} ${Y(it.y + it.h / 2)}) rotate(-90)" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${INK}">${it.label}</text>`;
        break;
      case "yard":
        g += paved(it, "#e1dbcf", "p-setts");
        break;
      case "paving":
        g += paved(it, "#ebe4d6", "p-paving");
        break;
      case "deck":
        g += rect(it.x, it.y, it.w, it.h, `fill="#c9a882" stroke="${MID}" stroke-width="0.6"`) + rect(it.x, it.y, it.w, it.h, `fill="url(#p-boards)"`);
        break;
      case "bay":
        g += rect(it.x, it.y, it.w, it.h, `fill="#e6e1d6" stroke="${MID}" stroke-width="0.7"`);
        if (parked++ % 3 !== 1) g += car(it);
        break;
      case "play":
        g += rect(it.x, it.y, it.w, it.h, `rx="${f1(1.2 * s)}" fill="#e7d3b6" stroke="${MID}" stroke-width="0.8"`);
        g += `<circle cx="${X(it.x + it.w * 0.3)}" cy="${Y(it.y + it.h * 0.45)}" r="${f1(1.3 * s)}" fill="none" stroke="${INK}" stroke-width="0.8"/>` + rect(it.x + it.w * 0.58, it.y + it.h * 0.2, it.w * 0.28, 0.5, `fill="${INK}" fill-opacity=".5"`);
        break;
      case "vineyard":
        g += rect(it.x, it.y, it.w, it.h, `fill="#e4e2c8"`);
        for (let x = it.x + 1.2; x < it.x + it.w - 0.6; x += 2.6) g += `<line x1="${X(x)}" y1="${Y(it.y + 0.8)}" x2="${X(x)}" y2="${Y(it.y + it.h - 0.8)}" stroke="#76834f" stroke-width="${f1(Math.max(1.2, 0.55 * s))}" stroke-linecap="round" stroke-dasharray="${f1(0.7 * s)} ${f1(0.45 * s)}" stroke-opacity=".85"/>`;
        break;
      case "paddock":
        g += rect(it.x, it.y, it.w, it.h, `fill="#dde2c5" stroke="#8a7a5a" stroke-width="1.1" stroke-dasharray="7 3"`);
        break;
      case "island":
        g += rect(it.x, it.y, it.w, it.h, `rx="${f1(0.8 * s)}" fill="#d6ddc0" stroke="${MID}" stroke-width="0.7"`);
        break;
      case "truck":
        // backed up to the loading door: trailer toward the building, cab away from it
        g += rect(it.x, it.y + 2.4, it.w, it.h - 2.4, `fill="#eeeeec" stroke="${INK}" stroke-width="0.9"`) + rect(it.x + 0.1, it.y, it.w - 0.2, 2.3, `rx="${f1(0.3 * s)}" fill="#c4c7c8" stroke="${INK}" stroke-width="0.9"`);
        break;
      case "orchard":
        g += rect(it.x, it.y, it.w, it.h, `fill="#dfe3c9" fill-opacity=".7"`);
        break;
      case "pond":
        g += `<ellipse cx="${X(it.cx)}" cy="${Y(it.cy)}" rx="${f1((it.rx + 1) * s)}" ry="${f1((it.ry + 1) * s)}" fill="#cfd8c0"/>`;
        g += `<ellipse cx="${X(it.cx)}" cy="${Y(it.cy)}" rx="${f1(it.rx * s)}" ry="${f1(it.ry * s)}" fill="url(#water)" stroke="${INK}" stroke-width="1.2"/>`;
        g += `<ellipse cx="${X(it.cx - it.rx * 0.15)}" cy="${Y(it.cy - it.ry * 0.1)}" rx="${f1(it.rx * 0.7 * s)}" ry="${f1(it.ry * 0.6 * s)}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1"/>`;
        break;
      case "pool":
        g += paved(it, "#ebe4d6", "p-paving") + planPool(X(it.pool.x), Y(it.pool.y), it.pool.w * s, it.pool.d * s, it.pool.w * s > 90 ? "POOL" : "");
        break;
      case "firepit":
        g += `<circle cx="${X(it.cx)}" cy="${Y(it.cy)}" r="${f1(it.r * s)}" fill="#ebe4d6" stroke="${MID}" stroke-width="0.7"/><circle cx="${X(it.cx)}" cy="${Y(it.cy)}" r="${f1(it.r * 0.3 * s)}" fill="#8f7a64" stroke="${INK}" stroke-width="0.8"/>`;
        break;
    }
  }

  // shadows (sun from the south-west), then houses and shared buildings
  const shadow = (x0, y0, w, h, ht) => {
    const sh = Math.min(ht * 0.28, 9);
    return `<polygon points="${X(x0)},${Y(y0 + h)} ${X(x0)},${Y(y0)} ${X(x0 + sh * 0.8)},${Y(y0 - sh)} ${X(x0 + w + sh * 0.8)},${Y(y0 - sh)} ${X(x0 + w + sh * 0.8)},${Y(y0 + h - sh)} ${X(x0 + w)},${Y(y0 + h)}" fill="${INK}" fill-opacity=".13"/>`;
  };
  const buildings = items.filter((it) => it.t === "building");
  if (project.kind === "row") g += shadow(0, 0, units.length * W, D, model.H);
  else for (const u of units) g += shadow(u.x, u.y, W, D, model.H);
  for (const b of buildings) g += shadow(b.x, b.y, b.w, b.h, b.wallH + (b.roof === "gable" ? b.h * 0.25 : 0.4));
  for (const u of units) {
    const m = u.mirror ? project.mirrored : model;
    const UX = (x) => X(u.x + x), UY = (y) => Y(u.y + y);
    if (m.site.T > 0) g += rect(u.x, u.y + D, W, m.site.T, `fill="#ebe4d6" stroke="${MID}" stroke-width="0.6"`) + rect(u.x, u.y + D, W, m.site.T, `fill="url(#p-paving)"`);
    if (m.site.deck) {
      const { deck, pool } = m.site;
      g += rect(u.x + deck.x, u.y + deck.y, deck.w, deck.h, `fill="#ebe4d6" stroke="${MID}" stroke-width="0.6"`) + planPool(UX(pool.x), UY(pool.y), pool.w * s, pool.d * s, "");
    }
    g += roofPlan(m, UX, UY, s, { notes: false });
  }
  for (const b of buildings) {
    const col = b.roof === "gable" ? { terracotta: "#d9a283", seam: "#8d9195", slate: "#8c9198" }[b.roofMat] ?? "#b9b4ab" : "#ebe6dc";
    if (b.roof === "gable") {
      const ov = 0.5, along = b.w >= b.h;
      const halves = along
        ? [[b.x - ov, b.y - ov, b.w + 2 * ov, b.h / 2 + ov, shade(col, -0.12), "p-roofh"], [b.x - ov, b.y + b.h / 2, b.w + 2 * ov, b.h / 2 + ov, col, "p-roofh"]]
        : [[b.x - ov, b.y - ov, b.w / 2 + ov, b.h + 2 * ov, shade(col, -0.15), "p-roofv"], [b.x + b.w / 2, b.y - ov, b.w / 2 + ov, b.h + 2 * ov, col, "p-roofv"]];
      for (const [x, y, w, h, fill, pat] of halves) g += rect(x, y, w, h, `fill="${fill}" stroke="${INK}" stroke-width="1.2"`) + rect(x, y, w, h, `fill="url(#${pat})"`);
    } else {
      g += rect(b.x - 0.3, b.y - 0.3, b.w + 0.6, b.h + 0.6, `fill="${col}" stroke="${INK}" stroke-width="1.4"`);
    }
  }

  // hedges, fences, trees
  for (const it of items) {
    if (it.t === "hedge") g += `<polyline points="${it.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="none" stroke="#8e9b6f" stroke-width="${f1(Math.max(2, 0.7 * s))}" stroke-linecap="round" stroke-opacity=".85"/>`;
    if (it.t === "fence") for (const [[x1, y1], [x2, y2]] of it.lines) g += `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="#7a6a50" stroke-width="1" stroke-dasharray="5 2"/>`;
  }
  if (project.kind !== "row") g += `<path d="M${X(plot.x0 + 0.5)} ${Y(plot.y1 - 0.3)} V${Y(plot.y0 + 0.5)} H${X(plot.x1 - 0.5)} V${Y(plot.y1 - 0.3)}" fill="none" stroke="#9aa57f" stroke-width="${f1(Math.max(2, 0.8 * s))}" stroke-linejoin="round" stroke-opacity=".6"/>`;
  trees.forEach((t, i) => (g += planTree(t.kind, X(t.x), Y(t.y), f1(t.r * s), seed + i)));

  // plot boundary, labels, house numbers, dimensions
  g += rect(plot.x0, plot.y0, PW, PD, `fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="22 5 4 5"`);
  for (const [x, y] of [[plot.x0, plot.y0], [plot.x1, plot.y0], [plot.x1, plot.y1], [plot.x0, plot.y1]]) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`;
  for (const it of items) {
    if (!it.label && !it.text) continue;
    if (it.t === "building") g += tag(it.x + it.w / 2, it.y + it.h / 2 + 0.3, it.label, 8.5);
    else if (it.t === "pond" || it.t === "firepit") g += tag(it.cx, it.cy + (it.ry ?? it.r) + 2.4, it.label, 8.5);
    else if (it.t === "label") g += tag(it.x, it.y, it.text, 9);
    else if (it.t === "lane" && it.w > it.h) g += label(it.x + it.w * 0.5, it.y + it.h / 2 + 0.25, it.label, 8.5, INK, 'dominant-baseline="middle"');
    else if (it.t === "pool" || it.t === "street") continue;
    else if (it.t === "yard") g += tag(it.x + it.w / 2, it.y + it.h - 1.2, it.label, 8.5);
    else g += tag(it.x + it.w / 2, it.y + it.h / 2 + 0.4, it.label, 8.5);
  }
  for (const u of units) {
    const cx = X(u.x + W / 2), cy = Y(u.y + D / 2);
    if (units.length === 1) g += tag(u.x + W / 2, u.y + D * (model.spec.roofTerrace ? 0.86 : 0.5) + 0.6, plan.sign ?? STYLE_EN[plan.style], 11);
    else g += `<circle cx="${cx}" cy="${cy}" r="12" fill="${PAPER}" stroke="${INK}" stroke-width="1.1"/><text x="${cx}" y="${f1(cy + 4)}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="600" fill="${INK}">${String(u.no).padStart(2, "0")}</text>`;
  }
  const unitChain = !preview && project.kind === "row";
  g += dimChain([plot.x0, plot.x1], plot.y0 - (unitChain ? 3.6 : 2.2), s, ox, oy, true, 1);
  g += dimChain([plot.y0, plot.y1], plot.x0 - 2.2, s, ox, oy, false);
  if (unitChain) g += dimChain([plot.x0, ...units.map((u) => u.x), units.length * W, plot.x1], plot.y0 - 1.5, s, ox, oy, true, 1);

  // schedule in the title block column
  const plotArea = PW * PD;
  const rows = [
    ["PLOT (INDICATIVE)", `${PW.toFixed(0)} × ${PD.toFixed(0)} m · ${plotArea >= 10000 ? `${(plotArea / 10000).toFixed(2)} ha` : `${plotArea.toFixed(0)} m²`}`],
    ...(units.length > 1 ? [["HOUSES", `${units.length} × ${plan.areaM2} m² · ${plan.bedrooms} bedrooms each`]] : [["BUILDING", `${W.toFixed(1)} × ${D.toFixed(1)} m · ${plan.floors > 1 ? `${plan.floors} floors × ` : ""}${model.storey.toFixed(1)} m`]]),
    [units.length > 1 ? "TOTAL GROSS FLOOR AREA" : "GROSS FLOOR AREA · PARKING", units.length > 1 ? `${project.totalArea} m²` : `${plan.areaM2} m² · ${project.layout.parking} bays`],
    ["BUILT FOOTPRINT · COVERAGE", `${project.layout.footprint.toFixed(0)} m² · ${((project.layout.footprint / plotArea) * 100).toFixed(0)} %`],
  ];
  let schedule = `<text x="${SHEET_W - 330 + 28}" y="${492}" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${MID}">PROJECT SCHEDULE</text>`;
  rows.forEach(([k, v], i) => (schedule += `<text x="${SHEET_W - 330 + 28}" y="${528 + i * 42}" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${MID}">${k}</text><text x="${SHEET_W - 330 + 28}" y="${546 + i * 42}" font-family="${FONT}" font-size="13.5" font-weight="500" fill="${INK}">${esc(v)}</text>`));
  schedule += `<text x="${SHEET_W - 330 + 28}" y="${528 + rows.length * 42}" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${MID}">${units.length > 1 ? "SHARED FACILITIES" : "SITE"}</text>`;
  wrap(project.layout.shared, 38).forEach((line, i) => (schedule += `<text x="${SHEET_W - 330 + 28}" y="${546 + rows.length * 42 + i * 17}" font-family="${FONT}" font-size="12" fill="${INK}">${esc(line)}</text>`));
  const k = s >= 25 ? 1 : s >= 10 ? 2 : s >= 5 ? 5 : 10;
  g += sheetTitle("MASTERPLAN", `${plan.title.en.toUpperCase()} · ${units.length > 1 ? `${units.length} ${PROJECT_WORD[project.kind]} · ` : ""}${kindLabel(model)}`);
  g += scaleBar(SHEET_W - 330 - 60 - 5 * k * s, SHEET_H - 72, s, k);
  return sheet({ plan, drawing: "MASTERPLAN", sheetNo, scaleNote: "GRAPHIC SCALE", body: g + schedule, defs: materialDefs(s, seed), north: true, preview });
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

export function elevationSheet(model, sheetNo, bare = false, { preview = false } = {}) {
  const ST = model.storey;
  const { W, plan, above, spec, wallTop, H } = model;
  const garage = model.garage;
  const gW = garage ? garage.w : 0;
  // a terrace is drawn as its whole street front (three houses on the catalogue card)
  const row = model.project?.kind === "row" ? (bare ? Math.min(3, model.project.units) : model.project.units) : 1;
  const totalW = W * row + gW;
  const below = model.basement ? 4.6 : 2.4;
  const topRoom = (bare ? 1.0 : 3.4) + (plan.sign && spec.signTwoLines ? 3.8 : 0);
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
  let overlay = ""; // drawn again over the callout leaders (the owner's sign must stay legible)
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
    const pane = spec.pane ?? (spec.glassy ? 1.6 : 0.85);
    const n = Math.max(1, Math.round(w / pane));
    const top = arch ? z + h - w / 2 : z + h;
    for (let i = 1; i < n; i++) o += box(x + (w * i) / n - 0.03, z, 0.06, top - z, frame);
    if (spec.transom) for (let k = 1, nt = Math.max(1, Math.round(h / spec.transom)); k < nt; k++) o += box(x, z + (h * k) / nt - 0.03, w, 0.06, frame);
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

  const glazingTower = (x, z, w, h) => box(x, z, w, h, "url(#glass)", `stroke="${frame}" stroke-width="1.4"`) + `<line x1="${X(x + w * 0.2)}" y1="${Y(z + h * 0.1)}" x2="${X(x + w * 0.6)}" y2="${Y(z + h * 0.8)}" stroke="#ffffff" stroke-opacity=".25" stroke-width="1.2"/>`;
  let env = "";
  let back = "";
  let g = "";
  let front = "";
  let fg = "";

  // ---- ground: earth + basement
  env += box(-leftPad + 0.3, -below + 1.5, totalW + leftPad + rightPad - 0.6, below - 1.5, "url(#p-earth)");
  env += `<line x1="${X(-leftPad + 0.3)}" y1="${Y(0)}" x2="${X(totalW + rightPad - 0.3)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2.4"/>`;
  if (model.basement) {
    g += box(0, -3.2, W, 3.2, PAPER, `stroke="${INK}" stroke-width="1.2" stroke-dasharray="10 6"`);
    g += `<text x="${X(W / 2)}" y="${Y(-1.75)}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${MID}">LOWER LEVEL −3.30 · SPA · CINEMA · OPENS TO REAR GARDEN</text>`;
  }

  // ---- background trees (behind the house; in the rear gardens of a terrace)
  if (row > 1) for (let i = 1; i < row; i += 2) back += elevTree(spec.tree, i * W + (i % 4 === 1 ? 0.8 : -0.8), X, Y, s, seed + 20 + i, 1.55);
  else if (!["cypress"].includes(spec.tree)) back += elevTree(spec.tree, W * 0.78, X, Y, s, seed + 3, 1.15);
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
    if (spec.roof === "terracotta" || spec.roof === "slate") {
      g += matPoly(spec.roof, [[W - 0.2, gh], [W + gW + 0.5, gh], [W + gW - 1.2, gh + 1.0], [W, gh + 1.0]]);
      g += box(W, gh - 0.4, gW, 0.4, INK, `fill-opacity=".16"`);
    } else {
      g += box(W - 0.1, gh, gW + 0.5, 0.35, MAT[spec.slabMat ?? "render"].fill, `stroke="${INK}" stroke-width="1.4"`);
      g += box(W, gh - 0.45, gW, 0.45, "url(#shadeDown)");
    }
  }

  // ---- round stair tower (drawn over the walls, under the openings) and the rooftop sign
  if (spec.tower) {
    const st = model.levels[0].spaces.find((sp) => sp.kind === "stair");
    const tx = st.x - 0.3, tw = st.w + 0.6, tz = wallTop + 1.4;
    back += `<defs><linearGradient id="cyl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8f959a"/><stop offset=".42" stop-color="#eff1f2"/><stop offset="1" stop-color="#868c91"/></linearGradient></defs>`;
    front += box(tx, 0, tw, tz, "url(#cyl)", `stroke="${INK}" stroke-width="1.4"`);
    for (let f = 1; f <= above; f++) front += box(tx, f * ST - 0.32, tw, 0.32, MAT.silver.fill, `fill-opacity=".9" stroke="${INK}" stroke-width="0.6"`);
    front += `<path d="M${X(tx - 0.35)} ${Y(tz)} Q${X(tx + tw / 2)} ${Y(tz + 1.1)} ${X(tx + tw + 0.35)} ${Y(tz)} Z" fill="${MAT[wallMat(spec, 0)].fill}" stroke="${INK}" stroke-width="1.2"/>`;
    for (let f = 0; f < above; f++) front += glazingTower(tx + tw / 2 - 0.45, f * ST + 0.4, 0.9, ST - 1.1);
    mark("silver", tx + tw * 0.75, ST - 0.16);
  }
  if (plan.sign && spec.signBand) {
    // the owner's sign band along the top of the facade: deep green with gilded letters
    const bx = W * 0.04, bw = W * 0.92, bz = wallTop - 0.9, bh = 0.8;
    const fs = Math.min(0.5 * s, (bw * s) / (plan.sign.length * 0.95));
    overlay = box(bx, bz, bw, bh, MAT.signGreen.fill, `stroke="${INK}" stroke-width="1"`) + box(bx + 0.12, bz + 0.1, bw - 0.24, bh - 0.2, "none", `stroke="#c9b26e" stroke-width="0.8"`)
      + `<text x="${X(bx + bw / 2)}" y="${f1(Y(bz + bh / 2) + fs * 0.36)}" text-anchor="middle" font-family="${FONT}" font-size="${f1(fs)}" font-weight="600" letter-spacing="${f1(fs * 0.35)}" fill="#d9c27c">${esc(plan.sign)}</text>`;
    front += overlay;
    mark("signGreen", bx + bw * 0.93, bz + bh / 2);
  } else if (plan.sign && spec.signTwoLines) {
    const lines = plan.sign.split(" ");
    const lh = 1.45, fs = 1.2 * s, sw = Math.max(...lines.map((l) => l.length)) * 0.92 + 0.6, sx = W * 0.24 - sw / 2, sz = wallTop + 1.1;
    for (const px of [sx + 0.3, sx + sw - 0.3]) front += box(px, wallTop + 0.4, 0.08, sz - wallTop - 0.4 + lines.length * lh, MAT.steel.fill);
    front += box(sx, sz + 0.05, sw, 0.06, MAT.steel.fill) + box(sx, sz + lh, sw, 0.06, MAT.steel.fill);
    lines.forEach((line, i) => {
      front += `<text x="${X(sx + sw / 2)}" y="${f1(Y(sz + (lines.length - 1 - i) * lh + 0.15))}" text-anchor="middle" font-family="${FONT}" font-size="${f1(fs)}" font-weight="700" letter-spacing="${f1(fs * 0.04)}" fill="#2f8f63" stroke="#ffffff" stroke-width="1" paint-order="stroke">${esc(line)}</text>`;
    });
  } else if (plan.sign) {
    const sx = W * 0.08, sw = Math.min(W * 0.55, plan.sign.length * 0.95 + 1.2), sz = wallTop + 0.6;
    front += box(sx, sz, sw, 1.5, "#2c2f33", `stroke="${INK}" stroke-width="1"`);
    for (const px of [sx + 0.5, sx + sw - 0.6]) front += box(px, wallTop + 0.45, 0.1, 0.15, MAT.steel.fill);
    const fs = Math.min(0.95 * s, (sw * s * 0.9) / (plan.sign.length * 0.72));
    front += `<text x="${X(sx + sw / 2)}" y="${f1(Y(sz + 0.75) + fs * 0.36)}" text-anchor="middle" font-family="${FONT}" font-size="${f1(fs)}" font-weight="600" letter-spacing="${f1(fs * 0.08)}" fill="#e6c98f">${esc(plan.sign)}</text>`;
  }

  // ---- walls per storey
  for (let li = 0; li < above; li++) {
    const key = wallMat(spec, li);
    g += mat(key, 0, li * ST, W, ST, `stroke="${INK}" stroke-width="1.6"`);
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
      g += mat("timber", d.x - 0.7, 0, d.w + 1.4, ST - 0.2, `stroke="${INK}" stroke-width="1.2"`);
      mark("timber", d.x - 0.35, 1.6);
    }
  }

  // ---- openings, per storey (front facade = plan bottom edge)
  const openings = [];
  model.levels.forEach((lv, li) => {
    if (li >= above) return;
    const z0 = li * ST;
    for (const w of frontWindows(model, lv)) {
      const living = ["open", "living", "kitchen", "dining"].includes(w.kind);
      if (spec.loggia && li === 0 && living) continue; // arcade drawn separately
      const glassy = spec.glassy;
      const sill = lv.sill ?? (glassy ? 0.05 : living && li === 0 ? 0.05 : li > 0 && spec.ironBalcony ? 0.05 : 0.9);
      const head = lv.head ?? spec.head ?? (glassy ? ST - 0.42 : spec.arches ? 2.75 : 2.45);
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
        const dh = spec.head ?? (spec.glassy ? ST - 0.42 : 2.6);
        if (spec.slidingEntry) {
          // automatic sliding glass doors: two leaves meeting in the middle
          g += box(d.x - 0.08, 0, d.w + 0.16, Math.min(dh, 2.7) + 0.08, frame) + box(d.x, 0, d.w, Math.min(dh, 2.7), "url(#glass)", `stroke="${INK}" stroke-width="1"`);
          g += box(d.x + d.w / 2 - 0.04, 0, 0.08, Math.min(dh, 2.7), frame) + box(d.x - 0.08, 2.7, d.w + 0.16, 0.3, frame);
          continue;
        }
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

  // ---- shopfront: fascia band over the glazing and a timber canopy over the entrance
  if (spec.fascia) {
    const fz = (spec.head ?? ST - 0.42) + 0.25;
    g += box(-0.02, fz, W + 0.04, wallTop - fz - 0.35, MAT.fascia.fill, `stroke="${INK}" stroke-width="1.2"`);
    g += box(-0.02, fz, W + 0.04, 0.08, INK, `fill-opacity=".25"`);
    mark("fascia", W * 0.86, fz + 0.5);
  }
  if (spec.entryCanopy) {
    const d0 = entryDoors(model.levels[0])[0];
    if (d0) {
      const cz = (spec.head ?? ST - 0.42) - 0.05, cx0 = Math.max(d0.x - 3, model.chamfer ? model.chamfer.a : spec.piers ? 0.05 : -Infinity), cw = d0.x + d0.w + 3 - cx0;
      if (spec.canopyGlass) {
        // cantilevered glass canopy hung from steel tie rods
        front += box(cx0, cz, cw, 0.16, MAT.canopyGlass.fill, `fill-opacity=".85" stroke="${MAT.steel.fill}" stroke-width="1.4"`);
        for (const px of [cx0 + 0.6, cx0 + cw / 2, cx0 + cw - 0.6]) front += `<line x1="${X(px)}" y1="${Y(cz + 0.16)}" x2="${X(px)}" y2="${Y(cz + 1.6)}" stroke="${MAT.steel.fill}" stroke-width="1.3"/>`;
        mark("canopyGlass", cx0 + cw * 0.7, cz + 0.08);
      } else {
        front += box(cx0, cz, cw, 0.42, MAT.timber.fill, `stroke="${INK}" stroke-width="1.2"`);
        front += box(cx0, cz - 0.6, cw, 0.6, "url(#shadeDown)");
        for (const px of [cx0 + 0.3, cx0 + cw - 0.42]) front += box(px, 0, 0.12, cz, MAT.steel.fill);
        mark("timber", cx0 + 0.8, cz + 0.2);
      }
    }
  }

  // ---- owner's concept facade: black frames on the column lines, black-clad street balconies
  if (model.chamfer) {
    // the chamfered corner seen at an angle: a darker strip of full-height corner glazing
    const { a } = model.chamfer;
    front += box(0, 0, a, wallTop, INK, `fill-opacity=".1"`);
    model.levels.forEach((lv, li) => {
      if (li >= above) return;
      const sill = lv.sill ?? 0.9, head = lv.head ?? spec.head ?? ST - 0.42;
      front += box(0.15, li * ST + sill, a - 0.3, head - sill, "url(#glass)", `stroke="${frame}" stroke-width="1.2"`);
    });
  }
  if (spec.piers && model.columns) {
    const xs = [...new Set(model.columns.map(([x]) => x))].filter((x) => !model.towerArc || Math.abs(x - model.towerArc.cx) > model.towerArc.r);
    if (model.chamfer) xs.push(model.chamfer.a);
    const pw = spec.pierW ?? 0.6, pm = spec.pierMat ?? "blackalu";
    for (const x of xs) {
      const px0 = Math.max(-0.05, Math.min(W + 0.05 - pw, x - pw / 2));
      front += box(px0, 0, pw, wallTop + 0.1, MAT[pm].fill, `stroke="${INK}" stroke-width="0.8"`);
      if (pm === "pilaster") front += box(px0 + pw * 0.62, 0, pw * 0.38, wallTop + 0.1, INK, `fill-opacity=".08"`); // rounded pilaster in shade
    }
    if (spec.pierMat) mark(pm, xs[0] + pw * 0.3, ST * 0.6);
  }
  model.levels.forEach((lv, li) => {
    for (const b of (lv.balconies ?? []).filter((bb) => bb.side === "bottom")) {
      if (b.glass) {
        // balcony slab with a frameless glass balustrade
        front += box(b.a0 * W, li * ST - 0.25, (b.a1 - b.a0) * W, 0.25, MAT[spec.slabMat ?? "render"].fill, `stroke="${INK}" stroke-width="1"`);
        front += box(b.a0 * W, li * ST, (b.a1 - b.a0) * W, 1.1, MAT.balustrade.fill, `fill-opacity=".38" stroke="#7fa3ad" stroke-width="1"`);
        mark("balustrade", b.a1 * W - 0.6, li * ST + 0.7);
        continue;
      }
      front += box(b.a0 * W, li * ST - 0.3, (b.a1 - b.a0) * W, 1.4, MAT.blackalu.fill, `stroke="${INK}" stroke-width="1"`);
      front += box(b.a0 * W, li * ST + 1.02, (b.a1 - b.a0) * W, 0.06, "#ffffff", `fill-opacity=".35"`);
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
    if (spec.glassy) g += box(-0.05, f * ST - 0.35, W + 0.1, 0.35, MAT[spec.slabMat ?? "render"].fill, `stroke="${INK}" stroke-width="1.1"`);
    else g += box(-0.08, f * ST - 0.12, W + 0.16, 0.18, "#e9dfcc", `stroke="${INK}" stroke-width="0.9"`);
  }
  const terrace = model.levels[1]?.terrace;
  if (terrace) {
    const { x0, x1 } = terrace;
    const z = ST;
    g += box(x0 - 0.1, z - 0.4, x1 - x0 + 0.2, 0.4, spec.balcony ? "#6c5240" : MAT[spec.slabMat ?? "render"].fill, `stroke="${INK}" stroke-width="1.3"`);
    g += box(x0, z - 0.4 - Math.min(1.1, terrace.depth * 0.55), x1 - x0, Math.min(1.1, terrace.depth * 0.55), "url(#shadeDown)");
    front += box(x0, z, x1 - x0, 1.1, MAT.balustrade.fill, `fill-opacity=".38" stroke="#7fa3ad" stroke-width="1"`);
    front += box(x0, z + 1.06, x1 - x0, 0.05, "#9fb9c0");
    front += `<line x1="${X(x0 + 0.4)}" y1="${Y(z + 0.15)}" x2="${X(x0 + 1.0)}" y2="${Y(z + 1.0)}" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>`;
    mark("balustrade", x1 - 0.8, z + 0.7);
  }

  // ---- coastal: teak louvre screens on the upper floor
  if (spec.louvres && above > 1) {
    const x0 = W * 0.5, x1 = W * 0.78;
    front += mat("teak", x0, ST, x1 - x0, ST - 0.42, `stroke="${INK}" stroke-width="1.2"`);
    mark("teak", x0 + 0.5, ST + 1.8);
  }

  // ---- roofs
  if (plan.roof === "flat") {
    const fo = spec.canopy ? 1.6 : spec.slab ? Math.min(0.9, spec.slab * 0.4) : 0.15;
    const th = spec.canopy ? 0.5 : 0.4;
    // shadow cast by the slab on the facade below it
    const shadowH = Math.min(1.5, (spec.canopy ?? spec.slab ?? 0.2) * 0.65);
    g += box(0, wallTop - shadowH, W, shadowH, "url(#shadeDown)");
    g += box(-fo, wallTop, W + 2 * fo, th, MAT[spec.slabMat ?? "render"].fill, `stroke="${INK}" stroke-width="1.8"`);
    g += box(-fo, wallTop + th - 0.06, W + 2 * fo, 0.06, INK, `fill-opacity=".35"`);
    mark(spec.slabMat ?? "render", -fo + 0.8, wallTop + th / 2);
    if (spec.roofTerrace) {
      g += box(W * 0.12, wallTop + th, W * 0.55, 1.05, MAT.balustrade.fill, `fill-opacity=".38" stroke="#7fa3ad" stroke-width="1"`);
      if (!spec.tower) g += box(W * 0.72, wallTop + th, 2.6, 2.5, MAT.render.fill, `stroke="${INK}" stroke-width="1.4"`);
      mark("balustrade", W * 0.6, wallTop + th + 0.6);
    }
  } else if (plan.roof === "hip") {
    const ov = model.roofOv, a = Math.min(model.D / 2, W / 2);
    const ez = wallTop - ov * 0.45;
    if (spec.chimney) back += mat("ashlar", W * 0.7, wallTop, 0.9, H - wallTop + 0.9) + box(W * 0.7 - 0.12, H + 0.9, 1.14, 0.18, "#cdb894", `stroke="${INK}" stroke-width="1"`);
    g += box(0, wallTop - 0.55, W, 0.55, "url(#shadeDown)");
    g += matPoly(spec.roof ?? "terracotta", [[-ov, ez], [W + ov, ez], [W - a, H], [a, H]]);
    g += box(-ov - 0.05, ez - 0.14, W + 2 * ov + 0.1, 0.16, "#e8dfcf", `stroke="${INK}" stroke-width="1.1"`);
    mark(spec.roof ?? "terracotta", W * 0.4, (ez + H) / 2);
  } else if (plan.roof === "gable") {
    const ov = model.roofOv;
    const ez = wallTop - ov * 0.5;
    if (spec.chimney) back += mat("rubble", W * 0.25, wallTop, 0.9, H - wallTop + 1.0) + box(W * 0.25 - 0.12, H + 1.0, 1.14, 0.18, "#cdb894", `stroke="${INK}" stroke-width="1"`);
    g += box(0, wallTop - 0.55, W, 0.55, "url(#shadeDown)");
    g += matPoly(spec.roof ?? "terracotta", [[-ov, ez], [W + ov, ez], [W + ov, H], [-ov, H]]);
    g += box(-ov - 0.05, H - 0.02, W + 2 * ov + 0.1, 0.14, "#9a5a3c", `stroke="${INK}" stroke-width="1"`);
    g += box(-ov - 0.05, ez - 0.14, W + 2 * ov + 0.1, 0.16, "#e8dfcf", `stroke="${INK}" stroke-width="1.1"`);
    mark(spec.roof ?? "terracotta", W * 0.55, (ez + H) / 2);
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
    const z = li * ST + 1.6;
    const ops = openings.filter((o) => o.li === li);
    const candidates = [0.6, W - 0.6, W * 0.5, W * 0.3, W * 0.85];
    const x = candidates.find((cx) => !ops.some((o) => cx > o.x - 0.3 && cx < o.x + o.w + 0.3)) ?? 0.6;
    mark(key, x, z);
  }

  // ---- foreground trees and planting
  const t = spec.tree;
  fg += elevTree(t, -2.6, X, Y, s, seed + 1, t === "cypress" ? 1.05 : 1);
  if (t === "cypress") fg += elevTree("olive", -4.2, X, Y, s, seed + 2, 0.85);
  fg += elevTree(t, totalW + 2.4, X, Y, s, seed + 5, t === "cypress" ? 0.95 : 0.92);
  if (t === "cypress" || t === "palm") fg += elevTree(t, totalW + 3.8, X, Y, s, seed + 6, 0.8);
  fg += shrubs(X, Y, s, -1.4, 0.4, seed + 7) + shrubs(X, Y, s, totalW - 0.2, totalW + 1.6, seed + 8);

  // the house; along a terrace every second house is mirrored so the front doors pair up
  const house = g + front;
  let houses = house;
  for (let i = 1; i < row; i++) houses += `<g transform="${i % 2 ? `matrix(-1 0 0 1 ${f1(2 * ox + (i + 1) * W * s)} 0)` : `translate(${f1(i * W * s)} 0)`}">${house}</g>`;
  let out = back + env + houses + fg;

  if (!bare) {
    // level markers
    const lx = X(totalW + rightPad - 1.9);
    const levelsZ = [...(model.basement ? [-3.3] : []), 0, ...Array.from({ length: above - 1 }, (_, i) => (i + 1) * ST), plan.roof === "flat" ? wallTop + 0.45 : H];
    levelsZ.forEach((z) => {
      out += `<g font-family="${FONT}" font-size="11" fill="${INK}"><line x1="${lx - 30}" y1="${Y(z)}" x2="${lx + 70}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.7" stroke-dasharray="${z === 0 ? "none" : "6 3"}"/>
        <path d="M${lx} ${Y(z)} l-7 -10 h14 z" fill="${z === 0 ? INK : "none"}" stroke="${INK}" stroke-width="0.9"/>
        <text x="${lx + 12}" y="${Y(z) - 5}">${z === 0 ? "±0.00" : `${z > 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}`}</text></g>`;
    });
    // overall dimension
    if (!preview) out += dimChain(row > 1 ? Array.from({ length: row + 1 }, (_, i) => i * W) : [0, W, ...(garage ? [W + garage.w] : [])], below - 0.7, s, ox, gy, true, -1);
    // material callouts: numbered tags above the building, leaders to sample points
    const keys = [...marks.keys()].filter((k) => MAT[k]);
    const pts = keys.map((k) => ({ k, p: marks.get(k) })).sort((a, b) => a.p[0] - b.p[0]);
    const tagZ = H + topRoom - 1.0;
    const span = (row > 1 ? Math.min(totalW, 2.5 * W) : totalW) + 2;
    pts.forEach((it, i) => {
      const tx = -1 + (span * (i + 0.5)) / pts.length;
      const n = keys.indexOf(it.k) + 1;
      out += `<line x1="${X(it.p[0])}" y1="${Y(it.p[1])}" x2="${X(tx)}" y2="${Y(tagZ) + 11}" stroke="${INK}" stroke-width="0.7"/>`;
      out += `<circle cx="${X(it.p[0])}" cy="${Y(it.p[1])}" r="2.6" fill="${INK}"/>`;
      out += `<circle cx="${X(tx)}" cy="${Y(tagZ)}" r="11" fill="${PAPER}" stroke="${INK}" stroke-width="1"/><text x="${X(tx)}" y="${Y(tagZ) + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="${INK}">${n}</text>`;
    });
    out += overlay;
    const defs = materialDefs(s, seed);
    const elevName = row > 1 ? "STREET ELEVATION" : "SOUTH ELEVATION";
    const what = row > 1 ? `${row} HOUSES IN MIRRORED PAIRS · LEVELS IN METRES` : multi(model) ? `TYPICAL ${STYLE_EN[plan.style]}, ${model.project.units} NO. · LEVELS IN METRES ABOVE GROUND FLOOR` : `${STYLE_EN[plan.style]} · LEVELS IN METRES ABOVE FINISHED GROUND FLOOR`;
    out += sheetTitle(elevName, `${plan.title.en.toUpperCase()} · ${what}`);
    out += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
    const legend = keys.map((k) => ({ fill: MAT[k].fill === "#7f949f" ? "url(#glass)" : MAT[k].fill, pattern: MAT[k].pattern ? `p-${MAT[k].pattern}` : null, label: MAT[k].label }));
    legend.title = "MATERIALS";
    return sheet({ plan, drawing: elevName, sheetNo, scaleNote: "GRAPHIC SCALE", body: out, defs, north: false, legend, preview });
  }
  return bareSvg(out + overlay, materialDefs(s, seed));
}

// ------------------------------------------------------------------ axonometric (coloured massing)

// isometric projection; b = depth measured from the front facade toward the back
const C30 = Math.cos(Math.PI / 6);
const isoProj = (x, b, z) => [x * C30 - b * C30, -(x * 0.5) - b * 0.5 - z];
const isoPoly = (points, fill, extra = "") =>
  `<polygon points="${points.join(" ")}" fill="${fill}" ${extra.includes('stroke="') ? "" : `stroke="${INK}"`} ${extra.includes("stroke-width") ? "" : 'stroke-width="1.1"'} stroke-linejoin="round" ${extra}/>`;
const ISO_GLASS = "#4a5961";
const isoColours = (key) => {
  const base = MAT[key].fill;
  return { front: base, side: shade(base, -0.16), top: shade(base, 0.25) };
};

export function axonometricSheet(model, sheetNo, { preview = false, typical = false } = {}) {
  if (model.project && !typical) return ensembleSheet(model, sheetNo, { preview });
  const { W, D, plan, site } = model;
  const proj = isoProj;
  const H = model.H;

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

  let g = "";
  // ground plate
  g += `<polygon points="${[P(-2.5, frontB - 1, 0), P(W + gW + 2.5, frontB - 1, 0), P(W + gW + 2.5, D + 2.5, 0), P(-2.5, D + 2.5, 0)].join(" ")}" fill="#e6e7d8" fill-opacity=".8"/>`;
  for (let x = -2; x <= W + gW + 2; x += 1) g += `<polyline points="${P(x, frontB - 1, 0)} ${P(x, D + 2.5, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.4" stroke-opacity=".6"/>`;
  for (let b = Math.ceil(frontB - 1); b <= D + 2; b += 1) g += `<polyline points="${P(-2.5, b, 0)} ${P(W + gW + 2.5, b, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.4" stroke-opacity=".6"/>`;
  g += isoGround(model, P) + isoHouse(model, P);

  const what = multi(model) ? `TYPICAL ${STYLE_EN[plan.style]}, ${model.project.units} NO.` : STYLE_EN[plan.style];
  g += sheetTitle("AXONOMETRIC VIEW", `${plan.title.en.toUpperCase()} · ${what} · VIEW FROM SOUTH-WEST`);
  return sheet({ plan, drawing: "AXONOMETRIC VIEW", sheetNo, scaleNote: "NTS", body: g, north: false, preview });
}

/** Ground-level parts of one house in isometric (P maps house metres to px): shadow, terrace, deck and pool. */
function isoGround(model, P, { shadow = true } = {}) {
  const { W, D, site } = model;
  const gW = model.garage ? model.garage.w : 0;
  const poly = isoPoly;
  let g = "";
  // soft shadow toward the north-east
  if (shadow) g += `<polygon points="${[P(0, 0, 0), P(W + gW + 2.6, 2.2, 0), P(W + gW + 2.6, D + 2.2, 0), P(0, D, 0)].join(" ")}" fill="${INK}" fill-opacity=".1"/>`;

  // deck + pool (plan y -> b = D - y)
  const B = (y) => D - y;
  if (site.T > 0) g += poly([P(0, 0, 0), P(W, 0, 0), P(W, B(D + site.T), 0), P(0, B(D + site.T), 0)], "#e8dfcf", 'stroke-width="0.6"');
  if (site.deck) {
    const { deck, pool } = site;
    g += poly([P(deck.x, B(deck.y), 0), P(deck.x + deck.w, B(deck.y), 0), P(deck.x + deck.w, B(deck.y + deck.h), 0), P(deck.x, B(deck.y + deck.h), 0)], "#e8dfcf", 'stroke-width="0.6"');
    g += poly([P(pool.x, B(pool.y), 0), P(pool.x + pool.w, B(pool.y), 0), P(pool.x + pool.w, B(pool.y + pool.d), 0), P(pool.x, B(pool.y + pool.d), 0)], "#8fbcc2", 'stroke-width="0.9"');
  }
  return g;
}

/** One house in isometric through P (house metres -> px): garage, storeys, openings, terraces and roof. */
function isoHouse(model, P) {
  const ST = model.storey;
  const { W, D, plan, above, spec, wallTop, H, site } = model;
  const gW = model.garage ? model.garage.w : 0;
  const poly = isoPoly;
  const GLASS = ISO_GLASS;
  const colours = isoColours;
  let g = "";

  const box = (x0, x1, b0, b1, z0, z1, c, top = true) => {
    let o = poly([P(x0, b0, z0), P(x1, b0, z0), P(x1, b0, z1), P(x0, b0, z1)], c.front);
    o += poly([P(x0, b0, z0), P(x0, b1, z0), P(x0, b1, z1), P(x0, b0, z1)], c.side);
    if (top) o += poly([P(x0, b0, z1), P(x1, b0, z1), P(x1, b1, z1), P(x0, b1, z1)], c.top);
    return o;
  };
  // extruded footprint polygon [[x, b], …]; only the faces turned to the viewer are drawn
  const prism = (pts, z0, z1, c, top = true) => {
    let o = "";
    const sg = Math.sign(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0));
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const nx = (q[1] - p[1]) * sg, nb = -(q[0] - p[0]) * sg;
      if (nx > 1e-6 || nb > 1e-6) return;
      const fill = Math.abs(nb) > 3 * Math.abs(nx) ? c.front : Math.abs(nx) > 3 * Math.abs(nb) ? c.side : shade(c.front, -0.07);
      o += poly([P(p[0], p[1], z0), P(q[0], q[1], z0), P(q[0], q[1], z1), P(p[0], p[1], z1)], fill);
    });
    if (top) o += poly(pts.map(([x, b]) => P(x, b, z1)), c.top);
    return o;
  };
  const cham = model.chamfer;
  const body = cham ? [[cham.a, 0], [W, 0], [W, D], [0, D], [0, cham.b]] : null;
  const frontWin0 = (x, w, z, h) => poly([P(x, 0, z), P(x + w, 0, z), P(x + w, 0, z + h), P(x, 0, z + h)], GLASS, 'stroke-width="0.7"') + `<polyline points="${P(x + w * 0.15, 0, z + h * 0.2)} ${P(x + w * 0.45, 0, z + h * 0.85)}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>`;
  // windows keep clear of the chamfered corner
  const frontWin = (x, w, z, h) => {
    if (cham && x < cham.a + 0.15) { w -= cham.a + 0.15 - x; x = cham.a + 0.15; }
    return w > 0.3 ? frontWin0(x, w, z, h) : "";
  };
  const sideWin0 = (b, w, z, h) => poly([P(0, b, z), P(0, b + w, z), P(0, b + w, z + h), P(0, b, z + h)], shade(GLASS, -0.2), 'stroke-width="0.7"');
  const sideWin = (b, w, z, h) => {
    if (cham && b < cham.b + 0.15) { w -= cham.b + 0.15 - b; b = cham.b + 0.15; }
    return w > 0.3 ? sideWin0(b, w, z, h) : "";
  };

  // garage first (it sits to the right, behind the house's silhouette)
  if (model.garage) {
    const c = colours(wallMat(spec, 0));
    g += box(W, W + gW, 0, model.garage.d, 0, 3.1, c);
    g += poly([P(W + 0.45, 0, 0), P(W + gW - 0.45, 0, 0), P(W + gW - 0.45, 0, 2.4), P(W + 0.45, 0, 2.4)], spec.garageDoor === "bronze" ? "#55483b" : "#94693f", 'stroke-width="0.7"');
    if (spec.roof === "terracotta" || spec.roof === "slate") g += poly([P(W, -0.4, 3.1), P(W + gW + 0.4, -0.4, 3.1), P(W + gW - 0.8, model.garage.d / 2, 4.0), P(W + 0.6, model.garage.d / 2, 4.0)], MAT[spec.roof].fill);
    else g += box(W - 0.1, W + gW + 0.3, -0.3, model.garage.d + 0.2, 3.1, 3.45, colours(spec.slabMat ?? "render"));
  }
  // storeys
  for (let li = 0; li < above; li++) {
    const c = colours(wallMat(spec, li));
    const top = li === above - 1 && plan.roof === "flat";
    g += body ? prism(body, li * ST, (li + 1) * ST, c, top) : box(0, W, 0, D, li * ST, (li + 1) * ST, c, top);
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
      const sill = lv.sill ?? (spec.glassy || (living && li === 0) ? 0.05 : 0.9);
      const head = lv.head ?? spec.head ?? (spec.glassy ? ST - 0.42 : 2.5);
      if (w.side === "bottom" && Math.abs(sp.y + sp.h - D) < 0.01) {
        const ww = Math.min(w.w, sp.w - 0.6);
        g += frontWin(sp.x + w.at * sp.w - ww / 2, ww, li * ST + sill, head - sill);
      }
      if (w.side === "left" && sp.x < 0.01) {
        const ww = Math.min(w.w, sp.h - 0.6);
        const bFromFront = D - (sp.y + w.at * sp.h) - ww / 2;
        g += sideWin(bFromFront, ww, li * ST + sill, head - sill);
      }
    }
    if (cham) {
      // full-height glazing on the chamfered corner
      const sill = lv.sill ?? 0.9, head = lv.head ?? spec.head ?? ST - 0.42;
      const [x1, b1, x2, b2] = [cham.a * 0.88, cham.b * 0.12, cham.a * 0.12, cham.b * 0.88];
      g += poly([P(x1, b1, li * ST + sill), P(x2, b2, li * ST + sill), P(x2, b2, li * ST + head), P(x1, b1, li * ST + head)], shade(GLASS, -0.1), 'stroke-width="0.7"');
    }
    if (li === 0) for (const d of entryDoors(lv)) g += poly([P(d.x, 0, 0), P(d.x + d.w, 0, 0), P(d.x + d.w, 0, 2.6), P(d.x, 0, 2.6)], spec.slidingEntry ? shade(GLASS, 0.15) : "#7c5a3e", 'stroke-width="0.8"');
  });
  if (spec.fascia) {
    const fz = (spec.head ?? ST - 0.42) + 0.25;
    g += poly([P(0, 0, fz), P(W, 0, fz), P(W, 0, wallTop - 0.1), P(0, 0, wallTop - 0.1)], MAT.fascia.fill, 'stroke-width="0.8"');
  }
  if (spec.entryCanopy) {
    const d0 = entryDoors(model.levels[0])[0];
    if (d0) {
      const cz = (spec.head ?? ST - 0.42) - 0.05;
      const cx0 = Math.max(d0.x - 3, cham ? cham.a : spec.piers ? 0.05 : -Infinity);
      g += box(cx0, d0.x + d0.w + 3, -3.2, 0, cz, cz + (spec.canopyGlass ? 0.16 : 0.42), colours(spec.canopyGlass ? "canopyGlass" : "timber"));
      for (const px of [cx0 + 0.3, d0.x + d0.w + 2.6]) g += `<polyline points="${P(px, -3.0, 0)} ${P(px, -3.0, cz)}" fill="none" stroke="${MAT.steel.fill}" stroke-width="1.6"/>`;
    }
  }
  if (plan.roof === "frontgable") {
    const inset = 0.9;
    g += poly([P(inset, 0, wallTop + 0.1), P(W - inset, 0, wallTop + 0.1), P(W / 2, 0, wallTop + (W / 2 - inset) * 0.84)], GLASS, 'stroke-width="0.8"');
  }
  if (spec.louvres && above > 1) {
    for (let x = W * 0.5; x < W * 0.78; x += 0.22) g += `<polyline points="${P(x, -0.08, ST)} ${P(x, -0.08, wallTop - 0.42)}" fill="none" stroke="${MAT.teak.fill}" stroke-width="2"/>`;
  }
  // upper terrace slab + glass balustrade
  const terrace = model.levels[1]?.terrace;
  if (terrace) {
    const { x0, x1, depth } = terrace;
    g += box(x0, x1, -depth, 0, ST - 0.4, ST, colours(spec.balcony ? "timber" : spec.slabMat ?? "render"));
    g += poly([P(x0, -depth, ST), P(x1, -depth, ST), P(x1, -depth, ST + 1.1), P(x0, -depth, ST + 1.1)], "#cfe0e6", 'fill-opacity=".45" stroke="#7fa3ad" stroke-width="0.9"');
    g += poly([P(x0, -depth, ST), P(x0, 0, ST), P(x0, 0, ST + 1.1), P(x0, -depth, ST + 1.1)], "#cfe0e6", 'fill-opacity=".35" stroke="#7fa3ad" stroke-width="0.9"');
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
    const sz1 = wallTop + (spec.canopy ? 0.5 : 0.4);
    if (cham) {
      // slab edge parallel to the chamfer, pushed out by the overhang
      const len = Math.hypot(cham.a, cham.b), d = (fo + sideOv) / 2;
      const p0 = [cham.a - (d * cham.b) / len, -(d * cham.a) / len];
      const xAt = p0[0] - ((-fo - p0[1]) / cham.b) * cham.a, bAt = p0[1] + ((p0[0] + sideOv) / cham.a) * cham.b;
      g += prism([[xAt, -fo], [W + sideOv, -fo], [W + sideOv, D + 0.3], [-sideOv, D + 0.3], [-sideOv, bAt]], wallTop, sz1, colours(spec.slabMat ?? "render"));
    } else g += box(-sideOv, W + sideOv, -fo, D + 0.3, wallTop, sz1, colours(spec.slabMat ?? "render"));
    if (spec.roofTerrace) {
      const tb0 = D * 0.25, tb1 = D * 0.85;
      g += poly([P(W * 0.12, tb0, wallTop + 0.4), P(W * 0.67, tb0, wallTop + 0.4), P(W * 0.67, tb0, wallTop + 1.45), P(W * 0.12, tb0, wallTop + 1.45)], "#cfe0e6", 'fill-opacity=".4" stroke="#7fa3ad" stroke-width="0.9"');
      if (!spec.tower) g += box(W * 0.72, W * 0.72 + 2.6, D * 0.3, D * 0.3 + 2.4, wallTop + 0.4, wallTop + 2.9, colours("render"));
      void tb1;
    }
  } else if (plan.roof === "hip") {
    const ov = model.roofOv, a = Math.min(D / 2, W / 2), b2 = W - a, ez = wallTop - ov * 0.45;
    const R = MAT[spec.roof ?? "terracotta"].fill;
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
    const R = MAT[spec.roof ?? "terracotta"].fill;
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
  // concept facade frames and street balconies
  if (spec.piers && model.columns) {
    for (const x of [...new Set(model.columns.map(([cx]) => cx)), ...(cham ? [cham.a] : [])].filter((x) => (!model.towerArc || Math.abs(x - model.towerArc.cx) > model.towerArc.r) && !(cham && x < cham.a - 0.1))) {
      const hw = (spec.pierW ?? 0.6) / 2, xa = x - hw, xb = x + hw;
      g += poly([P(xa, -0.05, 0), P(xb, -0.05, 0), P(xb, -0.05, wallTop), P(xa, -0.05, wallTop)], MAT[spec.pierMat ?? "blackalu"].fill, 'stroke-width="0.4"');
    }
  }
  if (spec.piers && cham) g += poly([P(-0.05, cham.b - 0.3, 0), P(-0.05, cham.b + 0.3, 0), P(-0.05, cham.b + 0.3, wallTop), P(-0.05, cham.b - 0.3, wallTop)], shade(MAT.blackalu.fill, -0.1), 'stroke-width="0.4"');
  model.levels.forEach((lv, li) => {
    for (const b of (lv.balconies ?? []).filter((bb) => bb.side === "bottom")) {
      if (!b.glass) {
        g += box(b.a0 * W, b.a1 * W, -b.depth, 0, li * ST - 0.3, li * ST + 1.1, colours("blackalu"));
        continue;
      }
      g += box(b.a0 * W, b.a1 * W, -b.depth, 0, li * ST - 0.25, li * ST, colours(spec.slabMat ?? "render"));
      g += poly([P(b.a0 * W, -b.depth, li * ST), P(b.a1 * W, -b.depth, li * ST), P(b.a1 * W, -b.depth, li * ST + 1.1), P(b.a0 * W, -b.depth, li * ST + 1.1)], "#cfe0e6", 'fill-opacity=".45" stroke="#7fa3ad" stroke-width="0.8"');
    }
  });
  // round stair tower and rooftop sign stand in front of / on top of the roof slab
  if (spec.tower && model.towerArc) {
    // half cylinder bulging from the street facade, facets drawn far to near
    const { cx, r } = model.towerArc;
    const tz = wallTop + 1.4, n = 14;
    const facets = Array.from({ length: n }, (_, i) => {
      const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n);
      const p0 = [cx + Math.cos(a0) * r, -Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, -Math.sin(a1) * r];
      return { p0, p1, key: (p0[0] + p1[0]) / 2 + (p0[1] + p1[1]) / 2, light: 0.25 - 0.35 * Math.abs(Math.cos((a0 + a1) / 2 - Math.PI * 0.25)) };
    }).sort((a, b) => b.key - a.key);
    for (const f of facets) g += poly([P(f.p0[0], f.p0[1], 0), P(f.p1[0], f.p1[1], 0), P(f.p1[0], f.p1[1], tz), P(f.p0[0], f.p0[1], tz)], shade(MAT.silver.fill, f.light), 'stroke-width="0.3"');
    g += poly(Array.from({ length: n + 1 }, (_, i) => P(cx + Math.cos(Math.PI * (i / n)) * r, -Math.sin(Math.PI * (i / n)) * r, tz)), shade(MAT.silver.fill, 0.3), 'stroke-width="0.6"');
    for (let f = 0; f < above; f++) g += poly([P(cx - r * 0.7 - 0.3, -r * 0.71, f * ST + 0.6), P(cx - r * 0.7 + 0.3, -r * 0.71, f * ST + 0.6), P(cx - r * 0.7 + 0.3, -r * 0.71, (f + 1) * ST - 0.7), P(cx - r * 0.7 - 0.3, -r * 0.71, (f + 1) * ST - 0.7)], GLASS, 'stroke-width="0.4"');
  } else if (spec.tower) {
    const st = model.levels[0].spaces.find((sp) => sp.kind === "stair");
    const x0 = st.x - 0.3, x1 = W + 0.3, tz = wallTop + 1.4;
    g += box(x0, x1, -0.5, st.h * 0.8, 0, tz, colours("silver"));
    for (let f = 0; f < above; f++) g += poly([P((x0 + x1) / 2 - 0.45, -0.5, f * ST + 0.4), P((x0 + x1) / 2 + 0.45, -0.5, f * ST + 0.4), P((x0 + x1) / 2 + 0.45, -0.5, (f + 1) * ST - 0.7), P((x0 + x1) / 2 - 0.45, -0.5, (f + 1) * ST - 0.7)], GLASS, 'stroke-width="0.6"');
  }
  if (plan.sign && spec.signBand) {
    const bx = W * 0.04, bw = W * 0.92, bz = wallTop - 0.9, bh = 0.8;
    g += poly([P(bx, -0.08, bz), P(bx + bw, -0.08, bz), P(bx + bw, -0.08, bz + bh), P(bx, -0.08, bz + bh)], MAT.signGreen.fill, 'stroke-width="0.5"');
    const pt = (x, b, z) => P(x, b, z).split(",").map(Number);
    const O = pt(bx, -0.08, bz), X1 = pt(bx + 1, -0.08, bz), Z1 = pt(bx, -0.08, bz + 1);
    g += `<g transform="matrix(${[X1[0] - O[0], X1[1] - O[1], O[0] - Z1[0], O[1] - Z1[1], O[0], O[1]].map((v) => v.toFixed(3)).join(" ")})"><text x="${(bw / 2).toFixed(2)}" y="${(-(bh / 2) + 0.18).toFixed(2)}" text-anchor="middle" font-family="${FONT}" font-size="0.5" font-weight="600" letter-spacing="0.2" fill="#d9c27c">${esc(plan.sign)}</text></g>`;
  } else if (plan.sign && spec.signTwoLines) {
    // green letters on a light steel frame standing on the roof edge, as on the building today
    const lines = plan.sign.split(" ");
    const lh = 1.45, sw = Math.max(...lines.map((l) => l.length)) * 0.92 + 0.6, sx = W * 0.24 - sw / 2, sb = 0.45, sz = wallTop + 1.1;
    const pt = (x, b, z) => P(x, b, z).split(",").map(Number);
    for (const px of [sx + 0.3, sx + sw - 0.3]) g += `<polyline points="${P(px, sb, wallTop + 0.4)} ${P(px, sb, sz + lines.length * lh)}" fill="none" stroke="${MAT.steel.fill}" stroke-width="1"/>`;
    for (const z of [sz + 0.05, sz + lh]) g += `<polyline points="${P(sx, sb, z)} ${P(sx + sw, sb, z)}" fill="none" stroke="${MAT.steel.fill}" stroke-width="0.8"/>`;
    const O = pt(sx, sb, sz), X1 = pt(sx + 1, sb, sz), Z1 = pt(sx, sb, sz + 1);
    g += `<g transform="matrix(${[X1[0] - O[0], X1[1] - O[1], O[0] - Z1[0], O[1] - Z1[1], O[0], O[1]].map((v) => v.toFixed(3)).join(" ")})" font-family="${FONT}" font-size="1.2" font-weight="700" letter-spacing="0.05" fill="#2f8f63" stroke="#ffffff" stroke-width="0.05" paint-order="stroke" text-anchor="middle">`;
    lines.forEach((line, i) => (g += `<text x="${(sw / 2).toFixed(2)}" y="${(-((lines.length - 1 - i) * lh + 0.15)).toFixed(2)}">${esc(line)}</text>`));
    g += "</g>";
  } else if (plan.sign) {
    const sx = W * 0.08, sw = Math.min(W * 0.55, plan.sign.length * 0.95 + 1.2);
    g += box(sx, sx + sw, 0.3, 0.45, wallTop + 0.6, wallTop + 2.1, { front: "#2c2f33", side: "#24272a", top: "#3a3e42" });
  }
  if (plan.style === "duplex") g += `<polyline points="${P(W / 2, 0, 0)} ${P(W / 2, 0, wallTop + 0.4)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  return g;
}

/** A-301 for a project: every house, the shared buildings, lanes and planting in one isometric view. */
function ensembleSheet(model, sheetNo, { preview = false } = {}) {
  const { plan, project, W, D } = model;
  const { plot, units, items, trees } = project.layout;
  const refY = plot.y1; // b = refY - plan y: depth from the front boundary toward the back
  const bOf = (y) => refY - y;
  const tall = Math.max(model.H, ...items.filter((it) => it.t === "building").map((b) => b.wallH + Math.min(b.w, b.h) * 0.25)) + 3;
  const corners = [];
  const west = Math.min(plot.x0 - 3, ...items.filter((it) => it.t === "street").map((it) => it.x));
  for (const x of [west, plot.x1 + 3]) for (const y of [plot.y0 - 3, plot.y1 + 9.2]) for (const z of [0, y < plot.y1 ? tall : 0]) corners.push(isoProj(x, bOf(y), z));
  const minX = Math.min(...corners.map((p) => p[0])), maxX = Math.max(...corners.map((p) => p[0]));
  const minY = Math.min(...corners.map((p) => p[1])), maxY = Math.max(...corners.map((p) => p[1]));
  const areaW = SHEET_W - 330 - 36 - 110;
  const areaH = SHEET_H - 72 - 180;
  const s = Math.min(areaW / (maxX - minX), areaH / (maxY - minY));
  const ox = 36 + 55 + (areaW - (maxX - minX) * s) / 2 - minX * s;
  const oy = 36 + 60 + (areaH - (maxY - minY) * s) / 2 - minY * s;
  const xy = (x, b, z) => {
    const [u, v] = isoProj(x, b, z);
    return [ox + u * s, oy + v * s];
  };
  const P = (x, b, z) => xy(x, b, z).map((n) => n.toFixed(1)).join(",");
  const flat = (x, y, w, h, fill, extra = 'stroke-width="0.5"') => isoPoly([P(x, bOf(y + h), 0), P(x + w, bOf(y + h), 0), P(x + w, bOf(y), 0), P(x, bOf(y), 0)], fill, extra);
  const seed = hash(plan.slug);
  let g = "";

  // ground: plot, road, hard and soft landscape
  g += flat(plot.x0 - 3, plot.y1, plot.x1 - plot.x0 + 6, 9.2, "#d9d5cd", 'stroke="none"');
  g += flat(plot.x0 - 3, plot.y1, plot.x1 - plot.x0 + 6, 2.2, "#e7e2d8", 'stroke-width="0.4"');
  g += flat(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0, "#e3e6d2", 'stroke-width="0.8"');
  for (const it of items) {
    switch (it.t) {
      case "lane":
      case "yard":
        g += flat(it.x, it.y, it.w, it.h, "#ddd6c8");
        break;
      case "street":
        g += flat(it.x, it.y, it.w, it.h + 9.2, "#d9d5cd", 'stroke="none"');
        break;
      case "paving":
      case "pool":
        g += flat(it.x, it.y, it.w, it.h, "#e8dfcf");
        if (it.pool) g += flat(it.pool.x, it.pool.y, it.pool.w, it.pool.d, "#8fbcc2", 'stroke-width="0.8"');
        break;
      case "bay":
        g += flat(it.x, it.y, it.w, it.h, "#e6e1d6", 'stroke="#9a9286" stroke-width="0.5"');
        break;
      case "deck":
        g += flat(it.x, it.y, it.w, it.h, "#c9a882", 'stroke-width="0.5"');
        break;
      case "play":
        g += flat(it.x, it.y, it.w, it.h, "#e7d3b6");
        break;
      case "paddock":
      case "orchard":
        g += flat(it.x, it.y, it.w, it.h, it.t === "paddock" ? "#dae0bf" : "#dde2c6", 'stroke="none"');
        break;
      case "island":
        g += flat(it.x, it.y, it.w, it.h, "#cfd8b6", 'stroke-width="0.5"');
        break;
      case "vineyard":
        g += flat(it.x, it.y, it.w, it.h, "#e2e0c4", 'stroke="none"');
        for (let x = it.x + 1.2; x < it.x + it.w - 0.6; x += 2.6) g += `<polyline points="${P(x, bOf(it.y + it.h - 0.8), 0.9)} ${P(x, bOf(it.y + 0.8), 0.9)}" fill="none" stroke="#6f7d48" stroke-width="${f1(Math.max(1.4, 0.7 * s))}" stroke-linecap="round" stroke-opacity=".9"/>`;
        break;
      case "pond":
      case "firepit": {
        const rx = it.rx ?? it.r, ry = it.ry ?? it.r;
        const pts = Array.from({ length: 28 }, (_, i) => P(it.cx + Math.cos((i / 28) * Math.PI * 2) * rx, bOf(it.cy + Math.sin((i / 28) * Math.PI * 2) * ry), 0));
        g += isoPoly(pts, it.t === "pond" ? "#9cc4c9" : "#e8dfcf", 'stroke-width="0.8"');
        break;
      }
    }
  }
  // shadows and private terraces of the houses (all on the ground, before anything stands up)
  if (project.kind === "row") g += `<polygon points="${[P(0, bOf(D), 0), P(units.length * W + 2.6, bOf(D) + 2.2, 0), P(units.length * W + 2.6, bOf(0) + 2.2, 0), P(0, bOf(0), 0)].join(" ")}" fill="${INK}" fill-opacity=".1"/>`;
  const unitP = (u) => (x, b, z) => P(u.x + x, bOf(u.y + D) + b, z);
  for (const u of units) g += isoGround(u.mirror ? project.mirrored : model, unitP(u), { shadow: project.kind !== "row" });
  for (const it of items) {
    if (it.t === "hedge") g += `<polyline points="${it.pts.map(([x, y]) => P(x, bOf(y), 0.6)).join(" ")}" fill="none" stroke="#7f8d5f" stroke-width="${f1(Math.max(2.4, 0.9 * s))}" stroke-linecap="round"/>`;
    if (it.t === "fence") for (const [[x1, y1], [x2, y2]] of it.lines) g += `<polyline points="${P(x1, bOf(y1), 1.5)} ${P(x2, bOf(y2), 1.5)}" fill="none" stroke="#7a6a50" stroke-width="0.9"/>`;
    if (it.t === "paddock") g += `<polygon points="${[P(it.x, bOf(it.y + it.h), 1.2), P(it.x + it.w, bOf(it.y + it.h), 1.2), P(it.x + it.w, bOf(it.y), 1.2), P(it.x, bOf(it.y), 1.2)].join(" ")}" fill="none" stroke="#8a7a5a" stroke-width="0.9"/>`;
  }

  // everything that stands up, far to near
  const solids = [];
  for (const u of units) solids.push({ key: u.x + W / 2 + bOf(u.y + D / 2), svg: () => isoHouse(u.mirror ? project.mirrored : model, unitP(u)) });
  for (const b of items.filter((it) => it.t === "building")) {
    solids.push({
      key: b.x + b.w / 2 + bOf(b.y + b.h / 2),
      svg: () => {
        const x0 = b.x, x1 = b.x + b.w, b0 = bOf(b.y + b.h), b1 = bOf(b.y), z1 = b.wallH;
        const c = isoColours(b.mat);
        let o = isoPoly([P(x0, b0, 0), P(x1, b0, 0), P(x1, b0, z1), P(x0, b0, z1)], c.front) + isoPoly([P(x0, b0, 0), P(x0, b1, 0), P(x0, b1, z1), P(x0, b0, z1)], c.side);
        // doors and windows on the front
        const door = Math.min(3.2, b.w * 0.25), dh = Math.min(3.4, z1 - 0.6);
        o += isoPoly([P((x0 + x1) / 2 - door / 2, b0, 0), P((x0 + x1) / 2 + door / 2, b0, 0), P((x0 + x1) / 2 + door / 2, b0, dh), P((x0 + x1) / 2 - door / 2, b0, dh)], "#6b4e36", 'stroke-width="0.6"');
        for (const fx of [0.18, 0.82]) if (b.w > 9) o += isoPoly([P(x0 + b.w * fx - 0.6, b0, 1.0), P(x0 + b.w * fx + 0.6, b0, 1.0), P(x0 + b.w * fx + 0.6, b0, 2.3), P(x0 + b.w * fx - 0.6, b0, 2.3)], ISO_GLASS, 'stroke-width="0.5"');
        if (b.roof !== "gable") return o + isoPoly([P(x0 - 0.3, b0 - 0.3, z1), P(x1 + 0.3, b0 - 0.3, z1), P(x1 + 0.3, b1 + 0.3, z1), P(x0 - 0.3, b1 + 0.3, z1)], isoColours("render").top);
        const R = MAT[b.roofMat ?? "terracotta"].fill, ov = 0.5;
        if (b.w >= b.h) {
          const bm = (b0 + b1) / 2, top = z1 + (b.h / 2) * 0.5, ez = z1 - ov * 0.5;
          o += isoPoly([P(x0, b0, z1), P(x0, b1, z1), P(x0, bm, top)], c.side);
          o += isoPoly([P(x0 - ov, b1 + ov, ez), P(x1 + ov, b1 + ov, ez), P(x1 + ov, bm, top), P(x0 - ov, bm, top)], shade(R, 0.1));
          o += isoPoly([P(x0 - ov, b0 - ov, ez), P(x1 + ov, b0 - ov, ez), P(x1 + ov, bm, top), P(x0 - ov, bm, top)], R);
        } else {
          const xm = (x0 + x1) / 2, top = z1 + (b.w / 2) * 0.6, ez = z1 - ov * 0.6;
          o += isoPoly([P(x0, b0, z1), P(x1, b0, z1), P(xm, b0, top)], c.front);
          o += isoPoly([P(xm, b0 - ov, top), P(x1 + ov, b0 - ov, ez), P(x1 + ov, b1 + ov, ez), P(xm, b1 + ov, top)], shade(R, 0.18));
          o += isoPoly([P(x0 - ov, b0 - ov, ez), P(xm, b0 - ov, top), P(xm, b1 + ov, top), P(x0 - ov, b1 + ov, ez)], R);
        }
        return o;
      },
    });
  }
  // parked cars (same bays as on the masterplan) and delivery trucks, as simple boxes
  const vehicle = (x0, x1, b0, b1, z1, body) => {
    const c = { front: body, side: shade(body, -0.18), top: shade(body, 0.12) };
    return isoPoly([P(x0, b0, 0), P(x1, b0, 0), P(x1, b0, z1), P(x0, b0, z1)], c.front, 'stroke-width="0.5"') + isoPoly([P(x0, b0, 0), P(x0, b1, 0), P(x0, b1, z1), P(x0, b0, z1)], c.side, 'stroke-width="0.5"') + isoPoly([P(x0, b0, z1), P(x1, b0, z1), P(x1, b1, z1), P(x0, b1, z1)], c.top, 'stroke-width="0.5"');
  };
  const paint = ["#c4c7c8", "#8d9aa3", "#e9e7e2", "#5b6168", "#a7563f"];
  let parked = 0;
  for (const it of items) {
    if (it.t === "bay" && parked++ % 3 !== 1) {
      const vertical = it.h > it.w, cw = vertical ? 1.8 : 4.4, cd = vertical ? 4.4 : 1.8;
      const x0 = it.x + (it.w - cw) / 2, y0 = it.y + (it.h - cd) / 2;
      const body = paint[parked % paint.length];
      solids.push({ key: x0 + cw / 2 + bOf(y0 + cd / 2), svg: () => vehicle(x0, x0 + cw, bOf(y0 + cd), bOf(y0), 1.45, body) });
    }
    if (it.t === "truck") solids.push({ key: it.x + it.w / 2 + bOf(it.y + it.h / 2), svg: () => vehicle(it.x, it.x + it.w, bOf(it.y + it.h), bOf(it.y), 3.9, "#eeeeec") });
  }
  trees.forEach((t, i) => {
    solids.push({
      key: t.x + bOf(t.y),
      svg: () => {
        const rand = rng(seed + i);
        const b = bOf(t.y);
        const h = ({ cypress: 8.5, pine: 10, palm: 7.5, olive: 4.6, round: 5.8 }[t.kind] ?? 5.5) * (0.85 + rand() * 0.3);
        const [bx, by] = xy(t.x, b, 0);
        const [tx, ty] = xy(t.x, b, h * (t.kind === "cypress" ? 0.12 : t.kind === "palm" ? 0.92 : 0.5));
        let o = `<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(tx)}" y2="${f1(ty)}" stroke="#5a4733" stroke-width="${f1(Math.max(1.2, 0.25 * s))}"/>`;
        const [cx, cy] = xy(t.x, b, h * (t.kind === "cypress" ? 0.55 : t.kind === "pine" ? 0.6 : 0.78));
        const r = t.r * s;
        if (t.kind === "cypress") o += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(r * 0.7)}" ry="${f1(h * 0.47 * s)}" fill="#56633f" stroke="${INK}" stroke-opacity=".4" stroke-width="0.7"/>`;
        else if (t.kind === "pine") o += `<path d="M${f1(cx)} ${f1(cy - h * 0.42 * s)} L${f1(cx + r)} ${f1(cy + h * 0.3 * s)} L${f1(cx - r)} ${f1(cy + h * 0.3 * s)} Z" fill="#4c5b3c" stroke="${INK}" stroke-opacity=".4" stroke-width="0.7"/>`;
        else o += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(r)}" ry="${f1(r * 0.82)}" fill="${t.kind === "olive" ? "#93a079" : "#7f8d5f"}" stroke="${INK}" stroke-opacity=".4" stroke-width="0.7"/><ellipse cx="${f1(cx - r * 0.25)}" cy="${f1(cy - r * 0.25)}" rx="${f1(r * 0.45)}" ry="${f1(r * 0.35)}" fill="#ffffff" fill-opacity=".14"/>`;
        return o;
      },
    });
  });
  solids.sort((a, b) => b.key - a.key);
  for (const it of solids) g += it.svg();

  // house numbers above the roofs
  for (const u of units.length > 1 ? units : []) {
    const [x, y] = xy(u.x + W / 2, bOf(u.y + D / 2), model.H + 2.2);
    g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="${PAPER}" stroke="${INK}" stroke-width="1"/><text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle" font-family="${FONT}" font-size="9.5" font-weight="600" fill="${INK}">${String(u.no).padStart(2, "0")}</text>`;
  }
  g += sheetTitle("AXONOMETRIC VIEW", `${plan.title.en.toUpperCase()} · ${units.length > 1 ? `${units.length} ${PROJECT_WORD[project.kind]}` : kindLabel(model)} · VIEW FROM SOUTH-WEST`);
  return sheet({ plan, drawing: "AXONOMETRIC VIEW", sheetNo, scaleNote: "NTS", body: g, north: false, preview });
}

// ------------------------------------------------------------------ schedules + cover sheet

const FACADE = { top: "N", bottom: "S", left: "W", right: "E" };

const MARKET_FINISH = {
  sales: "Polished concrete, sealed", checkout: "Polished concrete, sealed", gate: "Entrance matting, polished concrete",
  lobby: "Porcelain stoneware 60×60, R11", cafe: "Porcelain stoneware 60×60", kiosk: "Porcelain stoneware 60×60",
  deli: "Anti-slip resin, coved skirting", prep: "Anti-slip resin, coved skirting", cold: "Insulated floor, anti-slip resin",
  dock: "Power-floated concrete, hardener", racks: "Power-floated concrete, hardener", staff: "Vinyl sheet", office: "Vinyl sheet",
};

const OFFICE_FINISH = {
  showroom: "Large-format porcelain 120×120", reception: "Honed limestone", hall: "Honed limestone", lift: "Honed limestone",
  openoffice: "Raised access floor, carpet tiles", office: "Raised access floor, carpet tiles", meeting: "Raised access floor, carpet tiles",
  studio: "Raised access floor, carpet tiles", director: "Engineered oak, acoustic underlay", lounge: "Engineered oak, acoustic underlay",
  kitchenette: "Porcelain stoneware 60×60", store: "Sealed screed", racks: "Sealed screed",
};

const HOSPITALITY_FINISH = {
  reception: "Honed limestone 60×120", lobby: "Honed limestone 60×120", hall: "Porcelain stoneware 60×120", lift: "Honed limestone",
  guestroom: "Engineered oak, acoustic underlay", restaurant: "Engineered oak, oiled", privatedining: "Engineered oak, oiled", bar: "Smoked oak herringbone",
  banquet: "Marble-effect porcelain 120×120, oak parquet dance floor", teahall: "Hand-made terracotta tiles", grill: "Anti-slip porcelain, R11",
  prokitchen: "Anti-slip resin, coved skirting", prep: "Anti-slip resin, coved skirting", cold: "Insulated floor, anti-slip resin",
  staff: "Vinyl sheet", store: "Sealed screed", dock: "Power-floated concrete, hardener", treatment: "Porcelain stoneware, heated",
  gym: "Rubber sports flooring", lounge: "Engineered oak, acoustic underlay", cafe: "Porcelain stoneware 60×60", boutique: "Large-format porcelain 120×120",
};

function finishFor(style, kind) {
  if (["bizcenter", "hotel", "restaurant", "banquet"].includes(style)) return HOSPITALITY_FINISH[kind] ?? OFFICE_FINISH[kind] ?? "Porcelain tiles, walls tiled 2.40";
  if (style === "apartments" && ["reception", "boutique", "lift"].includes(kind)) return HOSPITALITY_FINISH[kind];
  if (style === "market" && MARKET_FINISH[kind]) return MARKET_FINISH[kind];
  if (style === "office" && OFFICE_FINISH[kind]) return OFFICE_FINISH[kind];
  if (style === "showroom") return { dock: "Power-floated concrete, sealed", staff: "Porcelain stoneware 60×60", racks: "Sealed screed" }[kind] ?? OFFICE_FINISH[kind] ?? "Porcelain tiles, walls tiled 2.40";
  const stone = ["modern", "minimal", "coastal", "luxury", "pavilion", "absheron", "noir"].includes(style);
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
/** Gross area of one level: the footprint less any double-height void. */
const levelGrossArea = (model, lv) => model.W * model.D - lv.spaces.filter((sp) => sp.kind === "void").reduce((n, sp) => n + sp.w * sp.h, 0);
/** Gross floor area of the building as drawn (checked against plan.areaM2 for buildings with a known footprint). */
export const grossFloorArea = (model) => model.levels.reduce((n, lv) => n + levelGrossArea(model, lv), 0);

export function schedules(model) {
  const ST = model.storey;
  const { plan, spec, W, D } = model;
  const rooms = [];
  const doors = [];
  const windows = [];
  model.levels.forEach((lv, li) => {
    const byId = Object.fromEntries(lv.spaces.map((sp) => [sp.id, sp]));
    let k = 0;
    for (const sp of lv.spaces) {
      if (sp.kind === "stair" || sp.kind === "void") continue;
      const inn = inner(model, sp);
      rooms.push({ no: `${li}.${String(++k).padStart(2, "0")}`, id: sp.id, level: li, name: sp.label, area: inn.w * inn.h, finish: finishFor(plan.style, sp.kind) });
    }
    for (const d of lv.doors) {
      const sp = byId[d.space];
      if (!sp || (d.open && !d.sliding)) continue;
      const len = d.side === "top" || d.side === "bottom" ? sp.w : sp.h;
      const w = Math.min(d.w, len - 0.3);
      doors.push({
        level: li,
        room: sp.label,
        w,
        h: d.sliding || (d.entry && spec.slidingEntry) ? 2.7 : d.entry ? (spec.glassy ? 2.88 : 2.6) : 2.1,
        type: d.sliding || (d.entry && spec.slidingEntry)
          ? "Automatic sliding glass doors"
          : d.entry
          ? "Entrance door, insulated oak"
          : sp.kind === "bath" || sp.kind === "wc" || sp.kind === "shower" ? "Internal, single leaf, privacy lock"
          : sp.kind === "cold" ? "Insulated cold-room door"
          : w >= 1.6 ? "Steel double doors, kick plates"
          : isExterior(model, sp, d.side) && lv.balconies?.some((b) => b.side === d.side) ? "Glazed balcony door, aluminium"
          : isExterior(model, sp, d.side) ? "External steel door, panic bar"
          : "Internal, single leaf, flush oak",
      });
    }
    for (const win of lv.windows) {
      const sp = byId[win.space];
      if (!sp || !isExterior(model, sp, win.side)) continue;
      const len = win.side === "top" || win.side === "bottom" ? sp.w : sp.h;
      const w = Math.min(win.w, len - 0.6);
      const living = ["open", "living", "kitchen", "dining"].includes(sp.kind);
      const sill = lv.sill ?? (spec.glassy || (living && li === 0) ? 0.05 : 0.9);
      const head = lv.head ?? spec.head ?? (spec.glassy ? ST - 0.42 : spec.arches ? 2.75 : 2.45);
      const type = win.w > 50 ? (STYLE_RULES[plan.style].commercial ? "Shopfront curtain wall, aluminium" : "Lift-and-slide glazing, aluminium") : spec.glassy ? "Tilt-and-turn, aluminium, low-E" : spec.arches && w <= 2.6 ? "Arched casement, oak, low-E" : "Casement, oak, low-E";
      windows.push({ level: li, room: sp.kind === "void" ? "SHOWROOM VOID" : sp.label, facade: FACADE[win.side], w, h: head - sill, sill, type });
    }
  });
  if (model.garage) doors.push({ level: 0, room: "GARAGE", w: model.garage.w - 0.9, h: 2.4, type: "Sectional garage door, motorised" });
  doors.forEach((d, i) => (d.no = `D${String(i + 1).padStart(2, "0")}`));
  windows.forEach((w, i) => (w.no = `W${String(i + 1).padStart(2, "0")}`));
  const areas = model.levels.map((lv, li) => ({
    level: lv.name.replace(" PLAN", ""),
    nia: rooms.filter((r) => r.level === li).reduce((n, r) => n + r.area, 0),
    gea: levelGrossArea(model, lv),
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
  const totalRow = [multi(model) ? "TOTAL PER HOUSE" : "TOTAL", totalNia.toFixed(1), (totalGea + sc.garageArea).toFixed(1)];
  totalRow.bold = true;
  areaRows.push(totalRow);
  if (multi(model)) {
    const n = model.project.units;
    const projectRow = [`PROJECT · ${n} HOUSES`, (totalNia * n).toFixed(1), ((totalGea + sc.garageArea) * n).toFixed(1)];
    projectRow.bold = true;
    areaRows.push(projectRow);
  }
  const area = table(L, 84, [{ label: "LEVEL", w: 210 }, { label: "NET INTERNAL m²", w: 130, right: true }, { label: "GROSS EXTERNAL m²", w: 150, right: true }], areaRows, { title: "AREA SCHEDULE" });
  g += area.svg;
  const many = sc.rooms.length > 22;
  const crowded = sc.rooms.length > 30; // multi-storey buildings
  let roomRows = sc.rooms.map((r) => [r.no, r.name, r.area.toFixed(1), r.finish]);
  if (sc.rooms.length > 50) {
    // repeated typical floors are listed once, numbered by their floor range (e.g. 2–4.01)
    const sig = (li) => sc.rooms.filter((r) => r.level === li).map((r) => [r.name, r.area.toFixed(1), r.finish].join("|")).join(";");
    roomRows = [];
    for (let li = 0; li < model.levels.length; ) {
      let last = li;
      while (last + 1 < model.levels.length && sig(last + 1) === sig(li)) last++;
      for (const r of sc.rooms.filter((rr) => rr.level === li)) roomRows.push([last > li ? `${li}–${last}${r.no.slice(r.no.indexOf("."))}` : r.no, r.name, r.area.toFixed(1), r.finish]);
      li = last + 1;
    }
  }
  const rooms = table(L, area.bottom + 40, [{ label: "NO.", w: 50 }, { label: "ROOM", w: 170 }, { label: "AREA m²", w: 72, right: true }, { label: "FLOOR FINISH", w: 198 }], roomRows, { title: "ROOM SCHEDULE", size: crowded ? 8.4 : many ? 9.5 : 10.5, rowH: crowded ? 12.2 : many ? 15 : 17 });
  g += rooms.svg;
  const R = 620;
  const dense = sc.doors.length + sc.windows.length > 34;
  const rowH = dense ? 14.5 : 17;
  const size = dense ? 9.2 : 10.5;
  const lv = (l) => (l ? `${l}F` : "GF");
  const floorsOf = (items) => {
    const levels = [...new Set(items.map((w) => w.level))].sort((a, b) => a - b);
    return levels.length > 1 && levels[levels.length - 1] - levels[0] === levels.length - 1 ? `${lv(levels[0])}–${lv(levels[levels.length - 1])}` : levels.map(lv).join(", ");
  };
  let doorRows = sc.doors.map((d) => [d.no, `${lv(d.level)} · ${d.room}`, `${(d.w * 1000).toFixed(0)}×${(d.h * 1000).toFixed(0)}`, d.type]);
  if (sc.doors.length > 40) {
    // many floors: the same door in the same room on several floors is one row
    const groups = new Map();
    for (const d of sc.doors) {
      const k = [d.room, (d.w * 1000).toFixed(0), (d.h * 1000).toFixed(0), d.type].join("|");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d);
    }
    doorRows = [...groups.values()].map((ds, i) => [`DT${String(i + 1).padStart(2, "0")}`, `${ds.length > 1 ? `${ds.length} no. · ` : ""}${floorsOf(ds)} · ${ds[0].room}`, `${(ds[0].w * 1000).toFixed(0)}×${(ds[0].h * 1000).toFixed(0)}`, ds[0].type]);
  }
  const doors = table(R, 84, [{ label: "NO.", w: 44 }, { label: "LOCATION", w: 150 }, { label: "W × H", w: 86, right: true }, { label: "TYPE", w: 300 }], doorRows, { title: sc.doors.length > 40 ? "DOOR SCHEDULE (BY TYPE)" : "DOOR SCHEDULE", size, rowH });
  g += doors.svg;
  // many floors: identical windows (facade, size, sill, type) are listed once with their count and floors
  let winRows = sc.windows.map((w) => [w.no, `${lv(w.level)} · ${w.room}`, w.facade, `${(w.w * 1000).toFixed(0)}×${(w.h * 1000).toFixed(0)}`, (w.sill * 1000).toFixed(0), w.type]);
  if (sc.windows.length > 30) {
    const groups = new Map();
    for (const w of sc.windows) {
      const k = [w.facade, (w.w * 1000).toFixed(0), (w.h * 1000).toFixed(0), (w.sill * 1000).toFixed(0), w.type].join("|");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(w);
    }
    winRows = [...groups.values()].map((ws, i) => {
      const span = floorsOf(ws);
      const w = ws[0];
      return [`WT${String(i + 1).padStart(2, "0")}`, `${ws.length} no. · ${span}`, w.facade, `${(w.w * 1000).toFixed(0)}×${(w.h * 1000).toFixed(0)}`, (w.sill * 1000).toFixed(0), w.type];
    });
  }
  const wins = table(R, doors.bottom + 36, [{ label: "NO.", w: 44 }, { label: sc.windows.length > 30 ? "COUNT · FLOORS" : "ROOM", w: 128 }, { label: "FAC.", w: 34 }, { label: "W × H", w: 86, right: true }, { label: "SILL", w: 50, right: true }, { label: "TYPE", w: 238 }], winRows, { title: sc.windows.length > 30 ? "WINDOW SCHEDULE (BY TYPE)" : "WINDOW SCHEDULE", size, rowH });
  g += wins.svg;
  g += `<text x="${L}" y="${SHEET_H - 112}" font-family="${FONT}" font-size="10" fill="${MID}">Door and window sizes are structural openings in millimetres (width × height). Sill heights above finished floor level.</text>`;
  g += sheetTitle("SCHEDULES", `${plan.title.en.toUpperCase()}${unitNote(model)} · ${sc.rooms.length} ROOMS · ${sc.doors.length} DOORS · ${sc.windows.length} WINDOWS`);
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
  const titleSize = plan.title.en.length > 18 ? Math.floor(380 / (plan.title.en.length * 0.72)) : 34; // long project names
  g += `<text x="${rx}" y="${iy + 52}" font-family="${FONT}" font-size="${titleSize}" font-weight="600" letter-spacing="1" fill="${INK}">${esc(plan.title.en.toUpperCase())}</text>`;
  g += `<text x="${rx}" y="${iy + 76}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${model.interior ? `${INTERIOR_TYPES[model.interior.type].label} · ${model.interior.palette.name} INTERIOR` : model.project ? `${kindLabel(model)}${multi(model) ? ` · ${model.project.units} HOUSES` : ""}` : `${STYLE_EN[plan.style]} VILLA`}</text>`;
  const summary = wrap(plan.summary.en, 58);
  summary.forEach((line, i) => (g += `<text x="${rx}" y="${iy + 110 + i * 17}" font-family="${FONT}" font-size="11.5" fill="${INK}">${esc(line)}</text>`));
  const sc = schedules(model);
  const project = model.project;
  const itype = model.interior ? INTERIOR_TYPES[model.interior.type] : null;
  const data = itype ? [
    ["Project type", itype.label.charAt(0) + itype.label.slice(1).toLowerCase()],
    ["Design style", model.interior.palette.name.charAt(0) + model.interior.palette.name.slice(1).toLowerCase()],
    ["Floor area", `${plan.areaM2} m²`],
    ["Net internal area", `${sc.rooms.reduce((n, r) => n + r.area, 0).toFixed(0)} m²`],
    ["Levels", `${plan.floors}`],
    ...(itype.commercial ? [["WCs", `${plan.bathrooms}`]] : [["Bedrooms / bathrooms", `${plan.bedrooms} / ${plan.bathrooms}`]]),
    ["Clear ceiling height", `${model.interior.ch.toFixed(2)} m`],
  ] : [
    ...(multi(model) ? [["Houses", `${project.units} × ${STYLE_EN[plan.style].toLowerCase()}`], ["Total gross floor area", `${project.totalArea} m²`]] : []),
    ...(project ? [["Plot (indicative)", `${((project.layout.plot.x1 - project.layout.plot.x0) * (project.layout.plot.y1 - project.layout.plot.y0) / 10000).toFixed(2)} ha`]] : []),
    [multi(model) ? "Gross floor area per house" : "Gross floor area", `${plan.areaM2} m²`],
    ["Net internal area", `${sc.rooms.reduce((n, r) => n + r.area, 0).toFixed(0)} m²`],
    ["Footprint", `${W.toFixed(2)} × ${D.toFixed(2)} m`],
    ["Levels", `${plan.floors}${model.basement ? " (incl. lower level)" : ""}`],
    ...(STYLE_RULES[plan.style].residential ? [["Flats", `${model.metrics.flats}`]] : []),
    ...(STYLE_RULES[plan.style].metric === "rooms" ? [["Guest rooms", `${model.metrics.rooms}`]] : STYLE_RULES[plan.style].metric === "seats" ? [["Seats", `${model.metrics.seats}`]] : []),
    ...(STYLE_RULES[plan.style].commercial ? [["WCs", `${plan.bathrooms}`], ["Parking", `${project.layout.parking} bays`]] : [["Bedrooms / bathrooms", `${plan.bedrooms} / ${plan.bathrooms}`], ...(STYLE_RULES[plan.style].residential ? [["Parking", `${project.layout.parking} bays`]] : [])]),
    ...(STYLE_RULES[plan.style].commercial || STYLE_RULES[plan.style].residential
      ? []
      : [
          ["Garage", model.garage ? `${model.garage.w > 5 ? "Double" : "Single"}, ${(model.garage.w * model.garage.d).toFixed(0)} m²` : "—"],
          ["Pool", model.site.pool ? `${model.site.pool.w.toFixed(1)} × ${model.site.pool.d.toFixed(1)} m` : "—"],
        ]),
  ];
  g += table(rx, iy + Math.max(230, 110 + summary.length * 17 + 18), [{ label: "PROJECT DATA", w: project ? 210 : 190 }, { label: "", w: 180, right: true }], data, { size: 11, rowH: project ? 15.5 : 17 }).svg;
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
  g += sheetTitle("COVER SHEET", `${plan.title.en.toUpperCase()} · ${grossArea(model)} · ${sheetList.length} SHEETS`);
  return sheet({ plan, drawing: "COVER SHEET", sheetNo: "A-000", scaleNote: "NTS", body: g, north: false });
}

// ------------------------------------------------------------------ CAD export (geometry for DXF / DWG)

/**
 * Plan geometry of one level for the CAD export: walls (solid regions + outlines), windows, doors with
 * swings, furniture, room tags, structural grid, dimension chains and outdoor areas.
 * Metres, plan coordinates (x to the right, y toward the front/south); the DXF writer flips y.
 */
/** Survey elements of one level for the DXF: chamfered corner, stair tower, rear bays, balconies and columns. */
function cadSurvey(model, level) {
  const { W, D } = model;
  const out = [];
  const add = (layer, e) => out.push({ layer, ...e });
  const wallPoly = (pts) => {
    add("A-WALL-PATT", { t: "poly", pts, closed: true, fill: true });
    add("A-WALL", { t: "poly", pts, closed: true });
  };
  const arc = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  if (model.chamfer) {
    const { a, b } = model.chamfer;
    wallPoly([[0, D - b], [a, D], [a + 0.42, D - EXT], [EXT, D - b - 0.42], [EXT, D - b]]);
    const len = Math.hypot(a, b), n = [(b / len) * (EXT / 2), (-a / len) * (EXT / 2)];
    const p = (t) => [t * a + n[0], D - b + t * b + n[1]];
    add("A-GLAZ", { t: "line", x1: p(0.2)[0], y1: p(0.2)[1], x2: p(0.8)[0], y2: p(0.8)[1] });
  }
  if (model.towerArc) {
    const { cx, r } = model.towerArc;
    wallPoly([...arc(cx, D, r, r, 0, Math.PI), ...arc(cx, D, r - EXT, r - EXT, Math.PI, 0)]);
    for (const t of [0.3, 0.5, 0.7]) {
      const ang = Math.PI * t;
      add("A-GLAZ", { t: "line", x1: cx - Math.cos(ang) * (r - EXT), y1: D + Math.sin(ang) * (r - EXT), x2: cx - Math.cos(ang) * r, y2: D + Math.sin(ang) * r });
    }
  }
  for (const b of level.bays ?? []) {
    const x0 = b.a0 * W, x1 = b.a1 * W, d = b.depth;
    wallPoly([[x0, EXT], [x0, -d], [x0 + 0.8, -d], [x0 + 0.8, -d + EXT], [x0 + EXT, -d + EXT], [x0 + EXT, EXT]]);
    wallPoly([[x1, EXT], [x1, -d], [x1 - 0.8, -d], [x1 - 0.8, -d + EXT], [x1 - EXT, -d + EXT], [x1 - EXT, EXT]]);
    add("A-GLAZ", { t: "rect", x: x0 + 0.8, y: -d, w: x1 - x0 - 1.6, h: EXT });
    add("A-GLAZ", { t: "line", x1: x0 + 0.8, y1: -d + EXT / 2, x2: x1 - 0.8, y2: -d + EXT / 2 });
  }
  for (const b of level.balconies ?? []) {
    let pts, at;
    if (b.side === "right") {
      const y0 = b.a0 * D, y1 = b.a1 * D, r = (y1 - y0) / 2;
      pts = b.round ? arc(W, (y0 + y1) / 2, Math.min(r, b.depth), r, -Math.PI / 2, Math.PI / 2) : [[W, y0], [W + b.depth, y0], [W + b.depth, y1], [W, y1]];
      at = [W + b.depth / 2, (y0 + y1) / 2];
    } else {
      const x0 = b.a0 * W, x1 = b.a1 * W, y = b.side === "top" ? -b.depth : D + b.depth, y0 = b.side === "top" ? 0 : D;
      pts = [[x0, y0], [x0, y], [x1, y], [x1, y0]];
      at = [(x0 + x1) / 2, (y + y0) / 2];
    }
    add("A-BALC", { t: "poly", pts });
    add("A-ANNO-TEXT", { t: "text", x: at[0], y: at[1], h: 0.16, text: "BALCONY" });
  }
  for (const [x, y] of model.columns ?? []) {
    add("A-COLS", { t: "rect", x: x - 0.22, y: y - 0.22, w: 0.44, h: 0.44 });
    add("A-COLS", { t: "line", x1: x - 0.22, y1: y - 0.22, x2: x + 0.22, y2: y + 0.22 });
    add("A-COLS", { t: "line", x1: x - 0.22, y1: y + 0.22, x2: x + 0.22, y2: y - 0.22 });
  }
  return out;
}

export function cadLevel(model, levelIndex) {
  const ST = model.storey;
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
    let w = Math.min(win.w, len - 0.6);
    const c = win.at * len;
    if (win.side === "top" && (level.bays ?? []).some((b) => sp.x + c > b.a0 * W && sp.x + c < b.a1 * W)) continue;
    if (seg.horizontal) {
      let x0 = sp.x + c - w / 2;
      if (model.chamfer && win.side === "bottom" && x0 < model.chamfer.a + 0.1) {
        w -= model.chamfer.a + 0.1 - x0;
        x0 = model.chamfer.a + 0.1;
      }
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
      if (model.chamfer && win.side === "left") w = Math.min(w, D - model.chamfer.b - 0.1 - y0);
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
      if (d.rail) add("A-GLAZ", { t: "line", x1: x0, y1: wy + t / 2, x2: x0 + w, y2: wy + t / 2 }); // glass balustrade
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

  // surveyed building: the chamfered corner, the opening into the stair tower and the rear bays are not wall
  if (model.chamfer) holes.push({ x: 0, y: D - model.chamfer.b, w: model.chamfer.a, h: model.chamfer.b });
  if (model.towerArc) holes.push({ x: model.towerArc.cx - model.towerArc.r + EXT, y: D - EXT - 0.01, w: 2 * (model.towerArc.r - EXT), h: EXT + 0.02 });
  for (const b of level.bays ?? []) holes.push({ x: b.a0 * W + EXT, y: -0.01, w: (b.a1 - b.a0) * W - 2 * EXT, h: EXT + 0.02 });

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
  ents.push(...cadSurvey(model, level));

  // furniture and stairs
  const pen = cadPen(ents, "A-FURN");
  for (const sp of level.spaces) furniture(pen, sp.kind, inner(model, sp), sp);

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
    if (sp.labelY) cy = inn.y + inn.h * sp.labelY;
    const small = inn.w < 2.2;
    add("A-AREA-IDEN", { t: "text", x: inn.x + inn.w / 2, y: cy, h: small ? 0.17 : 0.25, text: small && sp.label.length > 8 ? sp.label.split(/[ -]/)[0] : sp.label });
    if (sp.kind !== "void") add("A-AREA-IDEN", { t: "text", x: inn.x + inn.w / 2, y: cy + (small ? 0.28 : 0.38), h: small ? 0.14 : 0.19, text: `${(inn.w * inn.h).toFixed(1)} m²` });
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
  // interior sets: the lighting layout on its own layer (reflected ceiling plan)
  if (model.interior) {
    const c = ceilingLayout(model, level);
    for (const [x, y] of c.down) add("A-LITE", { t: "circle", cx: x, cy: y, r: 0.08 });
    for (const [x, y] of c.pend) add("A-LITE", { t: "circle", cx: x, cy: y, r: 0.18 }), add("A-LITE", { t: "circle", cx: x, cy: y, r: 0.06 });
    for (const r of c.cove) add("A-LITE", { t: "rect", x: r.x, y: r.y, w: r.w, h: r.h, dashed: true });
    for (const t of c.track) add("A-LITE", { t: "line", x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 });
    for (const r of c.linear) add("A-LITE", { t: "rect", x: r.x, y: r.y, w: r.w, h: r.h });
    for (const [x, y] of c.mirror) add("A-LITE", { t: "rect", x: x - 0.25, y: y - 0.05, w: 0.5, h: 0.1 });
  }
  return {
    name: level.name,
    ffl: levelIndex * ST,
    extents: { x0: -3.2, y0: -3.2, x1: Math.max(extW, W + (level.canopy ? 1.6 : 0)) + 1, y1: D + front + 2 },
    entities: ents,
  };
}

/** Masterplan of a project for the CAD export: plot, road, house footprints, shared buildings and landscape. */
export function cadMasterplan(model) {
  const { W, D, project } = model;
  const { plot, units, items, trees } = project.layout;
  const ents = [];
  const add = (layer, e) => ents.push({ layer, ...e });
  // text ~2.2 mm high on the A3 layout, at the scale make_dxf.py will pick for these extents
  const wm = plot.x1 - plot.x0 + 10, hm = plot.y1 - plot.y0 + 18;
  const scale = [100, 125, 150, 200, 250, 500, 1000].find((k) => [[260, 267], [390, 202]].some(([rw, rh]) => (wm * 1000) / k <= rw && (hm * 1000) / k <= rh)) ?? 1000;
  const th = (2.2 * scale) / 1000;
  add("C-PROP", { t: "rect", x: plot.x0, y: plot.y0, w: plot.x1 - plot.x0, h: plot.y1 - plot.y0 });
  add("C-ROAD", { t: "rect", x: plot.x0 - 3, y: plot.y1, w: plot.x1 - plot.x0 + 6, h: 2.2 });
  add("C-ROAD", { t: "rect", x: plot.x0 - 3, y: plot.y1 + 2.2, w: plot.x1 - plot.x0 + 6, h: 7 });
  add("C-ROAD", { t: "line", x1: plot.x0 - 3, y1: plot.y1 + 5.7, x2: plot.x1 + 3, y2: plot.y1 + 5.7, dashed: true });
  for (const it of items) {
    if (["lane", "yard", "paving", "bay", "deck", "play", "pool", "island", "truck"].includes(it.t)) add("L-PAVE", { t: "rect", x: it.x, y: it.y, w: it.w, h: it.h });
    if (it.pool) add("L-POOL", { t: "rect", x: it.pool.x, y: it.pool.y, w: it.pool.w, h: it.pool.d });
    if (it.t === "pond") add("L-POOL", { t: "ellipse", cx: it.cx, cy: it.cy, rx: it.rx, ry: it.ry });
    if (it.t === "firepit") add("L-PAVE", { t: "circle", cx: it.cx, cy: it.cy, r: it.r });
    if (it.t === "paddock" || it.t === "orchard" || it.t === "vineyard") add("L-PLNT", { t: "rect", x: it.x, y: it.y, w: it.w, h: it.h, dashed: it.t === "paddock" });
    if (it.t === "vineyard") for (let x = it.x + 1.2; x < it.x + it.w - 0.6; x += 2.6) add("L-PLNT", { t: "line", x1: x, y1: it.y + 0.8, x2: x, y2: it.y + it.h - 0.8 });
    if (it.t === "hedge") add("L-PLNT", { t: "poly", pts: it.pts });
    if (it.t === "fence") for (const [[x1, y1], [x2, y2]] of it.lines) add("L-PLNT", { t: "line", x1, y1, x2, y2, dashed: true });
    if (it.t === "building") add("A-BLDG", { t: "rect", x: it.x, y: it.y, w: it.w, h: it.h });
    if (it.t === "street") add("C-ROAD", { t: "rect", x: it.x, y: it.y, w: it.w, h: it.h + 9.2 });
    const text = it.label ?? it.text;
    if (text) {
      const at = it.t === "pond" || it.t === "firepit" ? [it.cx, it.cy + (it.ry ?? it.r) + th * 1.6] : it.t === "label" ? [it.x, it.y] : [it.x + it.w / 2, it.y + it.h / 2];
      add("A-ANNO-TEXT", { t: "text", x: at[0], y: at[1], h: th * 0.8, text: text.replace(" · ", " / ") });
    }
  }
  for (const u of units) {
    const m = u.mirror ? project.mirrored : model;
    add("A-BLDG", { t: "rect", x: u.x, y: u.y, w: W, h: D });
    if (model.garage) add("A-BLDG", { t: "rect", x: u.x + W, y: u.y + D - model.garage.d, w: model.garage.w, h: model.garage.d });
    if (m.site.T > 0) add("L-PAVE", { t: "rect", x: u.x, y: u.y + D, w: W, h: m.site.T });
    if (m.site.pool) add("L-POOL", { t: "rect", x: u.x + m.site.pool.x, y: u.y + m.site.pool.y, w: m.site.pool.w, h: m.site.pool.d });
    add("A-AREA-IDEN", { t: "text", x: u.x + W / 2, y: u.y + D / 2, h: th, text: units.length > 1 ? `HOUSE ${String(u.no).padStart(2, "0")}` : STYLE_EN[model.plan.style] });
    add("A-ANNO-TEXT", { t: "text", x: u.x + m.site.entryX, y: u.y + D + Math.max(m.site.T, 0) + th * 1.5, h: th * 0.6, text: "ENTRANCE" });
  }
  for (const t of trees) add("L-PLNT", { t: "circle", cx: t.x, cy: t.y, r: t.r });
  add("A-ANNO-TEXT", { t: "text", x: (plot.x0 + plot.x1) / 2, y: plot.y1 + 8.3, h: th, text: project.kind === "row" ? "STREET" : "ACCESS ROAD" });
  add("A-ANNO-TEXT", { t: "text", x: (plot.x0 + plot.x1) / 2, y: plot.y0 - th * 2, h: th, text: `PLOT ${(plot.x1 - plot.x0).toFixed(1)} x ${(plot.y1 - plot.y0).toFixed(1)} m (INDICATIVE)` });
  return { name: "MASTERPLAN", sheet: "A-001", ffl: 0, extents: { x0: plot.x0 - 5, y0: plot.y0 - 4 * th, x1: plot.x1 + 5, y1: plot.y1 + 10 }, entities: ents };
}

/** Everything the DXF writer needs for one plan (a project adds its masterplan before the typical house). */
export function cadModel(model) {
  const { plan } = model;
  const levels = model.levels.map((_, i) => cadLevel(model, i));
  if (model.project) levels.forEach((lv, i) => Object.assign(lv, { name: multi(model) ? `TYPICAL HOUSE - ${lv.name}` : lv.name, sheet: `A-10${i + 1}` }));
  return {
    slug: plan.slug,
    title: plan.title.en,
    style: STYLE_EN[plan.style],
    areaM2: plan.areaM2,
    levels: model.project ? [cadMasterplan(model), ...levels] : levels,
  };
}

// ================================================================== interior design projects
//
// plan.style === "interior", plan.interior = { type, palette }. The shell (rooms, doors, windows) comes from a layout
// template per project type; the design language (finishes, joinery, stone, metal, textiles, colours, light) from a
// palette. The package is an interior set: furniture layout, finishes plan, reflected ceiling and lighting plan,
// interior elevations, a cutaway axonometric, the materials board and the finishes / FF&E / lighting schedules.

/** Project types: layout template, footprint proportion and clear ceiling height (m). */
export const INTERIOR_TYPES = {
  flat: { label: "APARTMENT", floors: [1], bedrooms: [1, 2, 3], ratio: 1.45, ch: 2.8 },
  penthouse: { label: "PENTHOUSE", floors: [1], bedrooms: [3], ratio: 1.65, ch: 3.0, glassy: true },
  residence: { label: "VILLA INTERIOR", floors: [2], bedrooms: [3, 4, 5], ratio: 1.4, ch: 2.9 },
  cafe: { label: "CAFE AND TEA HOUSE", floors: [1], bedrooms: [0], ratio: 1.5, ch: 3.2, commercial: true },
  workspace: { label: "OFFICE INTERIOR", floors: [1], bedrooms: [0], ratio: 1.6, ch: 3.0, commercial: true },
  boutique: { label: "FASHION BOUTIQUE", floors: [1], bedrooms: [0], ratio: 1.4, ch: 3.2, commercial: true },
  clinic: { label: "DENTAL CLINIC", floors: [1], bedrooms: [0], ratio: 1.5, ch: 2.8, commercial: true },
  salon: { label: "BEAUTY SALON", floors: [1], bedrooms: [0], ratio: 1.5, ch: 3.0, commercial: true },
};

// material row: [code, name, colour, pattern, where it is used]
const mats = (rows) => rows.map(([code, name, fill, pattern, use]) => ({ code, name, fill, pattern, use }));

// the kinds of space a palette is written for: its material uses and light name those rooms
const HOME = ["flat", "penthouse", "residence"];

/** Interior design languages (families in docs/design-references.md, "Interior design families"). */
export const PALETTES = {
  "baku-classic": {
    name: "BAKU CLASSIC",
    for: HOME,
    concept: "A neoclassical Baku apartment brought up to date: crisp plaster mouldings and panelled walls, oak herringbone and honed marble, bottle-green joinery, deep velvet and aged brass.",
    materials: mats([
      ["F1", "Oak herringbone parquet, natural oil", "#c49a68", "herring", "Living rooms, bedrooms, hall"],
      ["F2", "Honed white marble 60×60", "#e8e4dc", "marble", "Bathrooms, kitchen"],
      ["W1", "Warm white paint, plaster mouldings", "#f1ece2", "panels", "Walls"],
      ["W2", "Silk wallcovering, sage", "#b9bfa8", "weave", "Feature walls"],
      ["J1", "Painted joinery, bottle green", "#2f4a3a", "plain", "Kitchen, wardrobes, media wall"],
      ["S1", "Calacatta-style marble", "#ece8e1", "marble", "Worktops, vanity tops, fireplace"],
      ["M1", "Aged brass", "#b08d57", "plain", "Handles, taps, light fittings"],
      ["T1", "Velvet, bottle green and ochre", "#2f5a45", "weave", "Upholstery, curtains"],
    ]),
    colours: [["Warm white", "#f1ece2"], ["Stone", "#d8cfc0"], ["Sage", "#b9bfa8"], ["Bottle green", "#2f4a3a"], ["Brass", "#b08d57"]],
    ceiling: "Plaster ceiling with cornice and centre rose",
    skirting: "Moulded oak skirting, 150 mm",
    light: "2700 K warm white; crystal chandelier over the dining table, brass picture lights and wall lights",
  },
  japandi: {
    name: "JAPANDI",
    for: HOME,
    concept: "Japanese calm meets Scandinavian warmth: pale ash, rice-paper whites and charcoal, low furniture, washi light and natural textures, nothing that does not need to be there.",
    materials: mats([
      ["F1", "Ash wide plank, white oil", "#d8c3a0", "planks", "Living rooms, bedrooms, hall"],
      ["F2", "Porcelain 60×120, warm stone", "#cfc6b8", "bigtile", "Bathrooms, kitchen"],
      ["W1", "Limewash paint, rice paper", "#ece4d6", "plain", "Walls"],
      ["W2", "Ash slatted panels", "#cbb08a", "slats", "Feature walls"],
      ["J1", "Ash veneer joinery, matt", "#c9ad86", "grain", "Kitchen, wardrobes, media unit"],
      ["S1", "Honed basalt", "#4a4846", "stone", "Worktops, vanity tops"],
      ["M1", "Blackened steel", "#2f2e2c", "plain", "Handles, frames, light fittings"],
      ["T1", "Linen and boucle, oat", "#ddd3c3", "weave", "Upholstery, curtains"],
    ]),
    colours: [["Rice paper", "#ece4d6"], ["Oat", "#ddd3c3"], ["Ash", "#cbb08a"], ["Moss", "#7d8466"], ["Charcoal", "#3a3835"]],
    ceiling: "Flat plaster, matt white; ash slats over the dining area",
    skirting: "Flush shadow-gap skirting",
    light: "2700 K warm white; washi paper pendants, concealed LED in the slatted panels",
  },
  scandi: {
    name: "SCANDINAVIAN",
    for: HOME,
    concept: "A bright, practical Nordic home: white oak, soft whites and fjord blue, terrazzo in the wet rooms, wool and cotton textiles with a single mustard accent.",
    materials: mats([
      ["F1", "White oak plank, matt lacquer", "#dcc7a6", "planks", "Living room, bedroom, hall"],
      ["F2", "Terrazzo tile, white with grey chips", "#e6e2db", "terrazzo", "Bathroom, kitchen"],
      ["W1", "Soft white paint", "#f2f0eb", "plain", "Walls"],
      ["W2", "Fjord blue paint", "#b9c5cc", "plain", "Feature walls"],
      ["J1", "White oak and white lacquer joinery", "#e2d3b9", "grain", "Kitchen, wardrobe, shelving"],
      ["S1", "Light grey quartz", "#d9d8d4", "stone", "Worktops, vanity top"],
      ["M1", "Brushed steel", "#a7a9ab", "plain", "Handles, taps, light fittings"],
      ["T1", "Wool and cotton, dove grey", "#cfcac2", "weave", "Upholstery, curtains, rugs"],
    ]),
    colours: [["Snow", "#f2f0eb"], ["Dove", "#cfcac2"], ["Fjord", "#b9c5cc"], ["Oak", "#dcc7a6"], ["Mustard", "#d2a64a"]],
    ceiling: "Flat plaster, matt white",
    skirting: "White oak skirting, 80 mm",
    light: "3000 K; opal glass and paper pendants, generous daylight kept free of heavy curtains",
  },
  "luxury-dark": {
    name: "DARK LUXURY",
    for: HOME,
    concept: "An evening apartment above the city: smoked oak chevron, walnut panelling with bronze inlay, grey and black marble, cognac leather and champagne metal under dimmable light scenes.",
    materials: mats([
      ["F1", "Smoked oak chevron parquet", "#6e5440", "chevron", "Living rooms, bedrooms, hall"],
      ["F2", "Grey marble 120×120, honed", "#8d8b88", "marble", "Bathrooms, kitchen"],
      ["W1", "Taupe mineral paint", "#a39789", "plain", "Walls"],
      ["W2", "Walnut panelling, bronze inlay", "#5a3f2d", "slats", "Feature walls"],
      ["J1", "Dark walnut veneer joinery", "#4f3828", "grain", "Kitchen, wardrobes, bar"],
      ["S1", "Black marble, white veining", "#2c2b2a", "marble", "Worktops, island, vanity tops"],
      ["M1", "Champagne bronze", "#b5a07a", "plain", "Handles, trims, light fittings"],
      ["T1", "Velvet and leather, cognac", "#7a4f33", "weave", "Upholstery, headboards"],
    ]),
    colours: [["Ivory", "#ece6da"], ["Taupe", "#a39789"], ["Cognac", "#8a5a38"], ["Champagne", "#b5a07a"], ["Graphite", "#3d3b39"]],
    ceiling: "Plaster with recessed coves, dark-taupe paint in the dining area",
    skirting: "Recessed shadow-gap skirting, bronze trim",
    light: "2700 K dimmable scenes; linear coves, a glass chandelier over the island, bronze wall lights",
  },
  "mediterranean-calm": {
    name: "MEDITERRANEAN",
    for: HOME,
    concept: "A sunlit seaside house on the Absheron coast: lime plaster and terracotta, limed oak, travertine and rattan, olive and sea green, everything soft and hand-made.",
    materials: mats([
      ["F1", "Hand-made terracotta tiles", "#c98a62", "cotto", "Living rooms, bedrooms, hall"],
      ["F2", "Zellige-style glazed tile, sea green", "#7fa59b", "cotto", "Bathrooms, kitchen splashback"],
      ["W1", "Lime plaster, warm white", "#efe7da", "plain", "Walls"],
      ["W2", "Tadelakt-effect plaster, sand", "#dccab0", "plain", "Feature walls, niches"],
      ["J1", "Limed oak joinery", "#cdb592", "grain", "Kitchen, wardrobes, doors"],
      ["S1", "Honed travertine", "#d8c8ad", "stone", "Worktops, vanity tops, stair"],
      ["M1", "Black wrought iron", "#2e2c29", "plain", "Handles, rails, light fittings"],
      ["T1", "Linen and rattan, natural", "#d9cdb8", "weave", "Upholstery, curtains, pendants"],
    ]),
    colours: [["Lime", "#efe7da"], ["Sand", "#dccab0"], ["Terracotta", "#c98a62"], ["Olive", "#7f8455"], ["Sea", "#7fa59b"]],
    ceiling: "Lime plaster with exposed timber beams in the living room",
    skirting: "Terracotta tile skirting",
    light: "2700 K; rattan pendants, plaster wall lights and warm uplights in the niches",
  },
  "oriental-modern": {
    name: "AZERBAIJANI MODERN",
    for: ["cafe"],
    concept: "A contemporary tea house that remembers Sheki and Old Baku: walnut and clay plaster, shebeke-inspired lattice screens, carpet motifs set in cement tiles, copper and pomegranate red.",
    materials: mats([
      ["F1", "Walnut plank, oiled", "#7a5639", "planks", "Cafe, tea lounge"],
      ["F2", "Encaustic cement tile, carpet motif", "#b8735a", "motif", "Bar, kitchen, WCs"],
      ["W1", "Warm clay plaster", "#e6d6c0", "plain", "Walls"],
      ["W2", "Lattice screens after shebeke", "#8b5e3c", "lattice", "Screens, feature walls"],
      ["J1", "Walnut joinery with carved panels", "#6b4a33", "grain", "Bar front, banquettes, shelving"],
      ["S1", "Honed travertine", "#d6c6a8", "stone", "Bar top, tables, WC tops"],
      ["M1", "Hammered copper", "#b06f45", "plain", "Pendants, samovar shelf, trims"],
      ["T1", "Wool kilim and velvet, pomegranate", "#8c2f2b", "weave", "Banquettes, cushions, curtains"],
    ]),
    colours: [["Clay", "#e6d6c0"], ["Pomegranate", "#8c2f2b"], ["Saffron", "#d29b3e"], ["Walnut", "#6b4a33"], ["Copper", "#b06f45"]],
    ceiling: "Clay plaster with a timber lattice raft over the tea lounge",
    skirting: "Walnut skirting, 100 mm",
    light: "2700 K; perforated copper pendants, lattice lanterns and candle-warm wall lights",
  },
  "art-deco": {
    name: "ART DECO",
    for: ["boutique"],
    concept: "A small jewel box of a shop: emerald fluted panels, black lacquer and polished brass, terrazzo with brass inlay, curved display niches and soft blush velvet.",
    materials: mats([
      ["F1", "Terrazzo with brass inlay", "#e8e1d6", "terrazzo", "Sales floor"],
      ["F2", "Black marble mosaic", "#2a2a2a", "hex", "Fitting rooms, WC"],
      ["W1", "Ivory paint", "#f0e9dd", "plain", "Walls"],
      ["W2", "Fluted panels, emerald lacquer", "#1f5a4a", "slats", "Feature walls, cash desk"],
      ["J1", "Black lacquer joinery, brass trims", "#1f1f1f", "plain", "Shelving, display units"],
      ["S1", "Green marble", "#2f5e4e", "marble", "Display tops, cash desk top"],
      ["M1", "Polished brass", "#c9a24e", "plain", "Rails, trims, light fittings"],
      ["T1", "Velvet, blush and emerald", "#d9b3a6", "weave", "Curtains, seating"],
    ]),
    colours: [["Ivory", "#f0e9dd"], ["Emerald", "#1f5a4a"], ["Black", "#1f1f1f"], ["Brass", "#c9a24e"], ["Blush", "#d9b3a6"]],
    ceiling: "Plaster with a stepped central coffer",
    skirting: "Black lacquer skirting with brass edge",
    light: "2700 K; brass track spots over displays, opal globe pendants and fluted wall sconces",
  },
  "industrial-loft": {
    name: "INDUSTRIAL LOFT",
    for: ["workspace"],
    concept: "A workspace with the bones of a warehouse: polished concrete, reclaimed brick and black steel, oiled oak desks, felt acoustics and cognac leather in the breakout.",
    materials: mats([
      ["F1", "Polished concrete, sealed", "#a9a6a0", "concrete", "Open office, reception, breakout"],
      ["F2", "Porcelain 60×60, anthracite", "#5c5b59", "bigtile", "WCs, kitchenette"],
      ["W1", "Off-white paint", "#e9e4dc", "plain", "Walls"],
      ["W2", "Reclaimed brick", "#a4644a", "brick", "Feature walls"],
      ["J1", "Oiled oak and black steel joinery", "#a8835a", "grain", "Desks, storage, reception desk"],
      ["S1", "Concrete worktops", "#9c9a95", "concrete", "Kitchenette, reception top"],
      ["M1", "Black steel", "#262626", "plain", "Frames, glazing, light fittings"],
      ["T1", "Wool felt and leather, charcoal and cognac", "#8a5a38", "weave", "Acoustic panels, seating"],
    ]),
    colours: [["Concrete", "#a9a6a0"], ["Brick", "#a4644a"], ["Oak", "#a8835a"], ["Forest", "#3f5a46"], ["Steel", "#262626"]],
    ceiling: "Exposed soffit painted dark, acoustic rafts over the desks",
    skirting: "Black steel skirting",
    light: "3500 K for work; black linear pendants over desks, track spots, warm pendants in the breakout",
  },
  biophilic: {
    name: "BIOPHILIC",
    for: ["clinic"],
    concept: "A clinic that calms the nerves: daylight, birch and sage, moss walls in the waiting room, rounded corners and wipe-clean surfaces that never feel clinical.",
    materials: mats([
      ["F1", "Hygienic vinyl, pale oak effect", "#d7c4a5", "planks", "Reception, waiting, corridor, offices"],
      ["F2", "Anti-slip porcelain, warm white", "#e5e1da", "bigtile", "Surgeries, sterilisation, WCs"],
      ["W1", "Washable paint, warm white", "#f1eee8", "plain", "Walls"],
      ["W2", "Preserved moss panels", "#6f7f4e", "moss", "Waiting room feature wall"],
      ["J1", "Birch plywood and white laminate joinery", "#e0cfae", "grain", "Reception desk, cabinets"],
      ["S1", "Solid surface, white", "#f2f2ef", "plain", "Worktops, basins"],
      ["M1", "Brushed stainless steel", "#a9abad", "plain", "Handles, rails, fittings"],
      ["T1", "Wipe-clean upholstery, sage", "#9fae8f", "weave", "Waiting seating"],
    ]),
    colours: [["Warm white", "#f1eee8"], ["Sage", "#9fae8f"], ["Moss", "#6f7f4e"], ["Birch", "#e0cfae"], ["Sky", "#bcd2db"]],
    ceiling: "Acoustic plaster; timber baffles over the waiting area",
    skirting: "Coved vinyl skirting, 100 mm",
    light: "4000 K neutral in the surgeries, 3000 K in reception and waiting; circular pendants over the desk",
  },
  "mid-century": {
    name: "MID-CENTURY",
    for: ["salon"],
    concept: "A sixties salon with a smile: warm terrazzo, walnut slats, mustard and teal velvet, round mirrors, globe lights and brushed brass.",
    materials: mats([
      ["F1", "Terrazzo, cream with terracotta chips", "#e7dccb", "terrazzo", "Reception, styling, nail bar"],
      ["F2", "Porcelain 30×60, sage green", "#9aa58c", "bigtile", "Wash area, treatment room, WC"],
      ["W1", "Warm white paint", "#f0e9de", "plain", "Walls"],
      ["W2", "Walnut slatted panels", "#6b4a33", "slats", "Feature walls, reception"],
      ["J1", "Walnut veneer joinery", "#7a5639", "grain", "Stations, reception desk, shelving"],
      ["S1", "Terracotta-pink quartz", "#d7a48c", "stone", "Counters, nail table"],
      ["M1", "Brushed brass", "#b8955a", "plain", "Mirror frames, taps, light fittings"],
      ["T1", "Boucle and velvet, mustard and teal", "#c99a3a", "weave", "Chairs, waiting sofa"],
    ]),
    colours: [["Cream", "#f0e9de"], ["Mustard", "#c99a3a"], ["Teal", "#2f6b6a"], ["Walnut", "#7a5639"], ["Blush", "#d7a48c"]],
    ceiling: "Plaster with a curved bulkhead over the styling stations",
    skirting: "Walnut skirting, 100 mm",
    light: "2700 K for mood, 4000 K mirror lights at the stations; opal globe pendants",
  },
  "warm-minimal": {
    name: "WARM MINIMAL",
    for: HOME,
    concept: "Quiet luxury: travertine and white oak, linen whites and soft bronze, built-in everything and deep, even light.",
    materials: mats([
      ["F1", "White oak wide plank, matt", "#d4bf9c", "planks", "Living rooms, bedrooms, hall"],
      ["F2", "Travertine 60×120, honed", "#ddd0b8", "stone", "Bathrooms, kitchen"],
      ["W1", "Linen white paint", "#efe9df", "plain", "Walls"],
      ["W2", "Travertine-effect plaster", "#e3d6c0", "plain", "Feature walls"],
      ["J1", "White oak joinery, matt", "#cdb491", "grain", "Kitchen, wardrobes, media wall"],
      ["S1", "Travertine", "#ddd0b8", "stone", "Worktops, island, vanity tops"],
      ["M1", "Soft bronze", "#8a6e4f", "plain", "Handles, taps, light fittings"],
      ["T1", "Linen and wool, ecru", "#e3dccf", "weave", "Upholstery, curtains"],
    ]),
    colours: [["Linen", "#efe9df"], ["Ecru", "#e3dccf"], ["Travertine", "#ddd0b8"], ["Oak", "#cdb491"], ["Bronze", "#8a6e4f"]],
    ceiling: "Flat plaster with shadow-gap coves",
    skirting: "Flush shadow-gap skirting",
    light: "2700 K; concealed coves, plaster wall lights, a sculptural pendant over the table",
  },
  "nordic-cafe": {
    name: "NORDIC CAFE",
    for: ["cafe"],
    concept: "A bright neighbourhood coffee house and bakery: pale oak and handmade white tile, a terrazzo bar, fog blue and rye, linen and wool, daylight and the smell of bread.",
    materials: mats([
      ["F1", "Oak plank, white oil", "#dcc8a6", "planks", "Cafe hall, window lounge"],
      ["F2", "Terrazzo tile, white with grey chips", "#e6e2db", "terrazzo", "Bar, bakery, store, WC"],
      ["W1", "Soft white paint", "#f2f0eb", "plain", "Walls"],
      ["W2", "Handmade white tile, vertical stack", "#eeebe4", "bigtile", "Back bar, feature walls"],
      ["J1", "Pale oak joinery", "#d9c3a0", "grain", "Bar front, banquettes, bread shelves"],
      ["S1", "Grey terrazzo", "#cfcbc4", "terrazzo", "Bar top, cafe tables"],
      ["M1", "Brushed steel", "#a7a9ab", "plain", "Pendants, rails, fittings"],
      ["T1", "Wool and linen, fog blue", "#aebbc2", "weave", "Banquette cushions, curtains"],
    ]),
    colours: [["Snow", "#f2f0eb"], ["Oat", "#e4dccd"], ["Fog blue", "#aebbc2"], ["Oak", "#d9c3a0"], ["Rye", "#a7743f"]],
    ceiling: "Flat plaster; an oak-slat acoustic raft over the cafe hall",
    skirting: "Oak skirting, 80 mm",
    light: "3000 K; opal glass pendants over the bar, paper lanterns in the hall, daylight kept free of heavy curtains",
  },
  "noir-jewel": {
    name: "NOIR JEWELLERY",
    for: ["boutique"],
    concept: "A jewellery and accessories boutique like a lacquered box: smoked oak, black marble and champagne bronze, cognac leather and a pin-point of light on every piece.",
    materials: mats([
      ["F1", "Smoked oak chevron parquet", "#5e4636", "chevron", "Sales floor, VIP lounge"],
      ["F2", "Black marble, honed", "#2e2c2b", "marble", "WC, safe room, stock, staff"],
      ["W1", "Taupe mineral paint", "#9a8d80", "plain", "Walls"],
      ["W2", "Walnut panelling, bronze inlay", "#5a3f2c", "panels", "Feature walls, display niches"],
      ["J1", "Walnut and glass, display cases", "#4a3426", "grain", "Display cases, cash desk, shelving"],
      ["S1", "Black marble, white veining", "#2b2a29", "marble", "Case tops, cash desk top"],
      ["M1", "Champagne bronze", "#b59a6d", "plain", "Trims, rails, light fittings"],
      ["T1", "Velvet and leather, cognac", "#9a5a32", "weave", "VIP seating, curtains"],
    ]),
    colours: [["Taupe", "#9a8d80"], ["Walnut", "#5a3f2c"], ["Onyx", "#2b2a29"], ["Cognac", "#9a5a32"], ["Champagne", "#b59a6d"]],
    ceiling: "Dark-taupe plaster with recessed coves and pin-spot tracks",
    skirting: "Bronze shadow-gap skirting",
    light: "3000 K, CRI 97; pin spots on every display case, glare-free coves, a glass chandelier in the VIP lounge",
  },
  "green-studio": {
    name: "GREEN STUDIO",
    for: ["workspace"],
    concept: "A creative studio full of daylight and plants: natural cork and birch, terracotta and sage, felt acoustics, a planted library wall and soft rounded edges.",
    materials: mats([
      ["F1", "Natural cork plank, sealed", "#b88f63", "planks", "Studio, reception, library lounge"],
      ["F2", "Porcelain 60×60, warm sand", "#d9ccb6", "bigtile", "WCs, kitchen"],
      ["W1", "Warm white paint", "#f1ece3", "plain", "Walls"],
      ["W2", "Preserved moss, planted shelving", "#5f7146", "moss", "Feature walls"],
      ["J1", "Birch plywood joinery", "#e0c9a2", "grain", "Desks, shelving, reception desk"],
      ["S1", "Terrazzo, terracotta chips", "#e3d3c2", "terrazzo", "Kitchen top, reception top"],
      ["M1", "Powder-coated steel, sage", "#8d9a7f", "plain", "Frames, light fittings"],
      ["T1", "Wool felt, sage and terracotta", "#a9b59a", "weave", "Acoustic panels, seating"],
    ]),
    colours: [["Chalk", "#f1ece3"], ["Birch", "#e0c9a2"], ["Cork", "#b88f63"], ["Sage", "#a9b59a"], ["Terracotta", "#c0704a"]],
    ceiling: "Acoustic plaster; birch baffles over the studio desks",
    skirting: "Birch skirting, 60 mm",
    light: "4000 K task light over the desks, 3000 K in the lounge and kitchen; linear pendants and grow lights over the planters",
  },
  "soft-clinic": {
    name: "SOFT CLINIC",
    for: ["clinic"],
    concept: "A dental studio that feels like a quiet hotel: travertine tones, white oak and linen whites, soft bronze, curved corners and indirect, glare-free light.",
    materials: mats([
      ["F1", "Hygienic vinyl, white oak effect", "#d6c2a2", "planks", "Reception, waiting, corridor, consultation"],
      ["F2", "Anti-slip porcelain, travertine effect", "#ddd0b8", "stone", "Surgeries, sterilisation, X-ray, WC"],
      ["W1", "Washable paint, linen white", "#efe9df", "plain", "Walls"],
      ["W2", "Travertine-effect plaster", "#e3d6c0", "plain", "Reception feature wall"],
      ["J1", "White oak and solid surface, joinery", "#d8c4a3", "grain", "Reception desk, cabinets"],
      ["S1", "Solid surface, warm white", "#f3efe8", "plain", "Worktops, basins"],
      ["M1", "Soft bronze", "#8a6e4f", "plain", "Handles, rails, light fittings"],
      ["T1", "Wipe-clean upholstery, ecru", "#e3dccf", "weave", "Waiting seating"],
    ]),
    colours: [["Linen", "#efe9df"], ["Ecru", "#e3dccf"], ["Travertine", "#ddd0b8"], ["Oak", "#d8c4a3"], ["Bronze", "#8a6e4f"]],
    ceiling: "Flat plaster with shadow-gap coves; acoustic tiles in the surgeries",
    skirting: "Coved vinyl skirting, hygienic",
    light: "4000 K neutral in the surgeries, 2700 K in reception and waiting; concealed coves and a sculptural pendant over the desk",
  },
  "barber-loft": {
    name: "BARBER LOFT",
    for: ["salon"],
    concept: "A hair and barber studio with workshop character: polished concrete and reclaimed brick, black steel and oiled oak, cognac leather chairs and warm filament light.",
    materials: mats([
      ["F1", "Polished concrete, sealed", "#a8a39b", "concrete", "Barber, styling, reception, waiting"],
      ["F2", "Porcelain 60×60, anthracite", "#4b4a48", "bigtile", "Wash area, treatment room, WC"],
      ["W1", "Off-white paint", "#eeeae3", "plain", "Walls"],
      ["W2", "Reclaimed brick", "#9a5a43", "brick", "Feature walls, station walls"],
      ["J1", "Oiled oak and black steel joinery", "#8a6a4a", "grain", "Stations, reception desk, shelving"],
      ["S1", "Concrete counters", "#b7b2aa", "concrete", "Station tops, reception top"],
      ["M1", "Black steel and aged copper", "#2f2e2c", "plain", "Mirror frames, rails, light fittings"],
      ["T1", "Leather, cognac", "#9a5a32", "weave", "Barber chairs, waiting bench"],
    ]),
    colours: [["Concrete", "#a8a39b"], ["Brick", "#9a5a43"], ["Oak", "#8a6a4a"], ["Cognac", "#9a5a32"], ["Steel", "#2f2e2c"]],
    ceiling: "Exposed soffit painted dark, black track lighting",
    skirting: "Black steel skirting, 50 mm",
    light: "3000 K ambient, 4000 K mirror lights at the stations; filament pendants over the reception desk",
  },
};

const paletteOf = (model) => model.interior.palette;
const matOf = (model, code) => paletteOf(model).materials.find((m) => m.code === code);
const WET_KINDS = ["bath", "shower", "wc", "wash", "treatment"];
const KITCHEN_KINDS = ["kitchen", "kitchenette", "prep", "bar"];
const SERVICE_KINDS = ["store", "racks", "staff", "dock"];
const COVE_KINDS = ["living", "open", "master", "lounge", "reception", "director", "boutique", "teahall", "styling", "meeting"];
/** Table centres of a tea hall: two or three rows clear of the banquette along the left wall. */
const teaTables = ({ x, y, w, h }) => {
  const out = [];
  for (let cx = x + 1.9; cx < x + w - 1.0; cx += 2.3) for (let cy = y + 1.2; cy < y + h - 0.8; cy += 2.0) out.push([cx, cy]);
  return out;
};

/** Finishes of one room: floor code, walls, ceiling and clear height. */
function roomFinish(model, sp) {
  const pal = paletteOf(model);
  const ch = model.interior.ch;
  const wet = WET_KINDS.includes(sp.kind);
  const floor = wet || KITCHEN_KINDS.includes(sp.kind) || SERVICE_KINDS.includes(sp.kind) ? "F2" : "F1";
  const feature = ["living", "open", "master", "reception", "bar", "lounge", "director", "boutique", "styling", "teahall"].includes(sp.kind);
  const walls = wet ? "F2 tiling to 2.40, W1 above" : feature ? "W1, feature wall W2" : "W1";
  return { floor, walls, ceiling: wet ? "Moisture-resistant plasterboard, matt white" : pal.ceiling, ch: wet ? Math.max(2.4, ch - 0.35) : ch };
}

// ------------------------------------------------------------------ layout templates (fractions; y = 1 is the window front)

function flatOneBed() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "kitchen", label: "KITCHEN", kind: "kitchen", x: 0, y: 0, w: 0.3, h: 0.42 },
      { id: "hall", label: "HALL", kind: "hall", x: 0.3, y: 0, w: 0.3, h: 0.42 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.6, y: 0, w: 0.4, h: 0.42 },
      { id: "living", label: "LIVING / DINING", kind: "living", x: 0, y: 0.42, w: 0.6, h: 0.58 },
      { id: "master", label: "BEDROOM", kind: "master", x: 0.6, y: 0.42, w: 0.4, h: 0.58 },
    ],
    doors: [
      { space: "hall", side: "top", at: 0.5, w: 1.0, entry: true },
      { space: "hall", side: "bottom", at: 0.5, w: 1.4, open: true },
      { space: "kitchen", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "bath", side: "left", at: 0.5, w: 0.8 },
      { space: "master", side: "left", at: 0.25, w: 0.9 },
    ],
    windows: [
      { space: "living", side: "bottom", at: 0.5, w: 2.4 },
      { space: "living", side: "left", at: 0.5, w: 1.4 },
      { space: "kitchen", side: "left", at: 0.5, w: 1.0 },
      { space: "master", side: "bottom", at: 0.5, w: 1.8 },
      { space: "bath", side: "right", at: 0.5, w: 0.6 },
    ],
  };
}

function cafeLevel() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "bar", label: "BAR COUNTER", kind: "bar", x: 0, y: 0, w: 0.36, h: 0.42 },
      { id: "kit", label: "KITCHEN", kind: "prep", x: 0.36, y: 0, w: 0.26, h: 0.42 },
      { id: "store", label: "STORE", kind: "store", x: 0.62, y: 0, w: 0.16, h: 0.42 },
      { id: "wc1", label: "WC", kind: "wc", x: 0.78, y: 0, w: 0.11, h: 0.24 },
      { id: "wc2", label: "WC", kind: "wc", x: 0.89, y: 0, w: 0.11, h: 0.24 },
      { id: "lob", label: "LOBBY", kind: "hall", x: 0.78, y: 0.24, w: 0.22, h: 0.18 },
      { id: "hall", label: "TEA HALL", kind: "teahall", x: 0, y: 0.42, w: 0.68, h: 0.58 },
      { id: "tea", label: "TEA LOUNGE", kind: "lounge", x: 0.68, y: 0.42, w: 0.32, h: 0.58 },
    ],
    doors: [
      { space: "hall", side: "bottom", at: 0.16, w: 1.8, entry: true },
      { space: "bar", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "kit", side: "bottom", at: 0.5, w: 1.0 },
      { space: "kit", side: "left", at: 0.3, w: 0.9 },
      { space: "store", side: "left", at: 0.5, w: 0.9 },
      { space: "store", side: "top", at: 0.5, w: 1.0 },
      { space: "wc1", side: "bottom", at: 0.5, w: 0.8 },
      { space: "wc2", side: "bottom", at: 0.5, w: 0.8 },
      { space: "lob", side: "bottom", at: 0.5, w: 1.2, open: true },
      { space: "tea", side: "left", at: 0.5, w: 99, open: true },
    ],
    windows: [
      { space: "hall", side: "bottom", at: 0.45, w: 3.0 },
      { space: "hall", side: "bottom", at: 0.82, w: 2.4 },
      { space: "hall", side: "left", at: 0.5, w: 2.0 },
      { space: "tea", side: "bottom", at: 0.5, w: 2.4 },
      { space: "tea", side: "right", at: 0.5, w: 1.8 },
      { space: "kit", side: "top", at: 0.5, w: 1.2 },
    ],
  };
}

function workspaceLevel() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wc1", label: "WC", kind: "wc", x: 0, y: 0, w: 0.11, h: 0.25 },
      { id: "wc2", label: "WC", kind: "wc", x: 0.11, y: 0, w: 0.11, h: 0.25 },
      { id: "brk", label: "BREAKOUT", kind: "lounge", x: 0, y: 0.25, w: 0.22, h: 0.3 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0, y: 0.55, w: 0.22, h: 0.45 },
      { id: "focus", label: "FOCUS ROOM", kind: "office", x: 0.22, y: 0, w: 0.18, h: 0.38 },
      { id: "kit", label: "KITCHENETTE", kind: "kitchenette", x: 0.4, y: 0, w: 0.18, h: 0.38 },
      { id: "srv", label: "SERVER / STORE", kind: "store", x: 0.58, y: 0, w: 0.14, h: 0.38 },
      { id: "open", label: "OPEN OFFICE", kind: "openoffice", x: 0.22, y: 0.38, w: 0.5, h: 0.62 },
      { id: "arch", label: "ARCHIVE", kind: "store", x: 0.72, y: 0, w: 0.28, h: 0.25 },
      { id: "dir", label: "DIRECTOR", kind: "director", x: 0.72, y: 0.25, w: 0.28, h: 0.35 },
      { id: "meet", label: "MEETING ROOM", kind: "meeting", x: 0.72, y: 0.6, w: 0.28, h: 0.4 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.42, w: 1.6, entry: true },
      { space: "rec", side: "top", at: 0.5, w: 99, open: true },
      { space: "rec", side: "right", at: 0.5, w: 1.8, open: true },
      { space: "brk", side: "right", at: 0.6, w: 1.4, open: true },
      { space: "wc1", side: "bottom", at: 0.5, w: 0.8 },
      { space: "wc2", side: "bottom", at: 0.5, w: 0.8 },
      { space: "focus", side: "bottom", at: 0.5, w: 0.9 },
      { space: "kit", side: "bottom", at: 0.5, w: 1.2, open: true },
      { space: "srv", side: "bottom", at: 0.5, w: 0.9 },
      { space: "arch", side: "bottom", at: 0.5, w: 0.9 },
      { space: "dir", side: "left", at: 0.5, w: 0.9 },
      { space: "meet", side: "left", at: 0.5, w: 0.9 },
    ],
    windows: [
      { space: "rec", side: "bottom", at: 0.84, w: 1.0 },
      { space: "rec", side: "left", at: 0.5, w: 2.0 },
      { space: "brk", side: "left", at: 0.5, w: 1.6 },
      { space: "open", side: "bottom", at: 0.2, w: 2.4 },
      { space: "open", side: "bottom", at: 0.5, w: 2.4 },
      { space: "open", side: "bottom", at: 0.8, w: 2.4 },
      { space: "meet", side: "bottom", at: 0.5, w: 2.4 },
      { space: "meet", side: "right", at: 0.5, w: 2.0 },
      { space: "dir", side: "right", at: 0.5, w: 1.8 },
      { space: "kit", side: "top", at: 0.5, w: 1.2 },
      { space: "focus", side: "top", at: 0.5, w: 1.2 },
    ],
  };
}

function boutiqueLevel() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "stock", label: "STOCK ROOM", kind: "racks", x: 0, y: 0, w: 0.45, h: 0.32 },
      { id: "staff", label: "STAFF", kind: "staff", x: 0.45, y: 0, w: 0.3, h: 0.32 },
      { id: "wc", label: "WC", kind: "wc", x: 0.75, y: 0, w: 0.25, h: 0.32 },
      { id: "sales", label: "SALES FLOOR", kind: "boutique", x: 0, y: 0.32, w: 0.72, h: 0.68 },
      { id: "fit", label: "FITTING ROOMS", kind: "fitting", x: 0.72, y: 0.32, w: 0.28, h: 0.68 },
    ],
    doors: [
      { space: "sales", side: "bottom", at: 0.5, w: 1.6, entry: true },
      { space: "stock", side: "bottom", at: 0.5, w: 1.0 },
      { space: "staff", side: "bottom", at: 0.3, w: 0.9 },
      { space: "wc", side: "bottom", at: 0.5, w: 0.8 },
      { space: "fit", side: "left", at: 0.5, w: 99, open: true },
    ],
    windows: [
      { space: "sales", side: "bottom", at: 0.17, w: 2.0 },
      { space: "sales", side: "bottom", at: 0.83, w: 2.0 },
      { space: "staff", side: "top", at: 0.5, w: 1.0 },
    ],
  };
}

function clinicLevel() {
  const surgery = (id, label, x) => ({ id, label, kind: "treatment", x, y: 0.58, w: 0.2333, h: 0.42 });
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wait", label: "WAITING", kind: "lounge", x: 0, y: 0, w: 0.3, h: 0.44 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0, y: 0.44, w: 0.3, h: 0.56 },
      { id: "ster", label: "STERILISATION", kind: "prep", x: 0.3, y: 0, w: 0.18, h: 0.44 },
      { id: "doc", label: "DOCTOR'S OFFICE", kind: "office", x: 0.48, y: 0, w: 0.2, h: 0.44 },
      { id: "staff", label: "STAFF ROOM", kind: "staff", x: 0.68, y: 0, w: 0.18, h: 0.44 },
      { id: "wc1", label: "WC", kind: "wc", x: 0.86, y: 0, w: 0.14, h: 0.2 },
      { id: "wc2", label: "WC", kind: "wc", x: 0.86, y: 0.2, w: 0.14, h: 0.24 },
      { id: "corr", label: "CORRIDOR", kind: "hall", x: 0.3, y: 0.44, w: 0.7, h: 0.14 },
      surgery("s1", "SURGERY 1", 0.3),
      surgery("s2", "SURGERY 2", 0.5333),
      { ...surgery("s3", "SURGERY 3", 0.7666), w: 0.2334 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.3, w: 1.2, entry: true },
      { space: "rec", side: "top", at: 0.5, w: 99, open: true },
      { space: "rec", side: "right", at: 0.125, w: 1.2, open: true },
      { space: "ster", side: "bottom", at: 0.5, w: 0.9 },
      { space: "doc", side: "bottom", at: 0.5, w: 0.9 },
      { space: "staff", side: "bottom", at: 0.5, w: 0.9 },
      { space: "wc1", side: "left", at: 0.5, w: 0.8 },
      { space: "wc2", side: "bottom", at: 0.5, w: 0.8 },
      { space: "s1", side: "top", at: 0.5, w: 1.0 },
      { space: "s2", side: "top", at: 0.5, w: 1.0 },
      { space: "s3", side: "top", at: 0.5, w: 1.0 },
    ],
    windows: [
      { space: "rec", side: "bottom", at: 0.74, w: 1.8 },
      { space: "rec", side: "left", at: 0.5, w: 1.8 },
      { space: "wait", side: "left", at: 0.5, w: 1.8 },
      { space: "wait", side: "top", at: 0.5, w: 1.6 },
      { space: "s1", side: "bottom", at: 0.5, w: 1.8 },
      { space: "s2", side: "bottom", at: 0.5, w: 1.8 },
      { space: "s3", side: "bottom", at: 0.5, w: 1.8 },
      { space: "s3", side: "right", at: 0.5, w: 1.4 },
      { space: "ster", side: "top", at: 0.5, w: 1.2 },
      { space: "doc", side: "top", at: 0.5, w: 1.2 },
      { space: "staff", side: "top", at: 0.5, w: 1.2 },
      { space: "wc2", side: "right", at: 0.5, w: 0.6 },
    ],
  };
}

function salonLevel() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wc", label: "WC", kind: "wc", x: 0, y: 0, w: 0.15, h: 0.22 },
      { id: "store", label: "STORE", kind: "store", x: 0.15, y: 0, w: 0.15, h: 0.22 },
      { id: "wait", label: "WAITING", kind: "lounge", x: 0, y: 0.22, w: 0.3, h: 0.33 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0, y: 0.55, w: 0.3, h: 0.45 },
      { id: "wash", label: "WASH AREA", kind: "wash", x: 0.3, y: 0, w: 0.25, h: 0.5 },
      { id: "nails", label: "NAIL BAR", kind: "nails", x: 0.55, y: 0, w: 0.23, h: 0.5 },
      { id: "treat", label: "TREATMENT ROOM", kind: "treatment", x: 0.78, y: 0, w: 0.22, h: 0.5 },
      { id: "style", label: "HAIR STYLING", kind: "styling", x: 0.3, y: 0.5, w: 0.7, h: 0.5 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.4, w: 1.4, entry: true },
      { space: "rec", side: "top", at: 0.5, w: 99, open: true },
      { space: "rec", side: "right", at: 0.5, w: 99, open: true },
      { space: "wc", side: "bottom", at: 0.5, w: 0.8 },
      { space: "store", side: "bottom", at: 0.5, w: 0.8 },
      { space: "wash", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "nails", side: "bottom", at: 0.5, w: 1.6, open: true },
      { space: "treat", side: "bottom", at: 0.5, w: 0.9 },
    ],
    windows: [
      { space: "rec", side: "bottom", at: 0.82, w: 1.0 },
      { space: "rec", side: "left", at: 0.5, w: 1.6 },
      { space: "wait", side: "left", at: 0.5, w: 1.4 },
      { space: "style", side: "bottom", at: 0.25, w: 2.4 },
      { space: "style", side: "bottom", at: 0.75, w: 2.4 },
      { space: "style", side: "right", at: 0.5, w: 1.6 },
      { space: "nails", side: "top", at: 0.5, w: 1.6 },
      { space: "treat", side: "top", at: 0.5, w: 1.2 },
    ],
  };
}

// ---- second layouts of the commercial interiors ("layout": "b"): a different arrangement of the same kind of space

/** Coffee house and bakery: the bar faces a long cafe hall, the bakery works behind glass beside it. */
function cafeLevelB() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wc", label: "WC", kind: "wc", x: 0, y: 0, w: 0.11, h: 0.4 },
      { id: "store", label: "STORE", kind: "store", x: 0.11, y: 0, w: 0.11, h: 0.4 },
      { id: "bar", label: "COFFEE BAR", kind: "bar", x: 0.22, y: 0, w: 0.44, h: 0.4 },
      { id: "kit", label: "BAKERY", kind: "prep", x: 0.66, y: 0, w: 0.34, h: 0.46 },
      { id: "hall", label: "CAFE HALL", kind: "teahall", x: 0, y: 0.4, w: 0.66, h: 0.6 },
      { id: "win", label: "WINDOW LOUNGE", kind: "lounge", x: 0.66, y: 0.46, w: 0.34, h: 0.54 },
    ],
    doors: [
      { space: "hall", side: "bottom", at: 0.35, w: 1.1, entry: true },
      { space: "bar", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "win", side: "left", at: 0.5, w: 99, open: true },
      { space: "kit", side: "bottom", at: 0.15, w: 0.9 },
      { space: "wc", side: "bottom", at: 0.5, w: 0.8 },
      { space: "store", side: "bottom", at: 0.5, w: 0.8 },
      { space: "store", side: "top", at: 0.5, w: 1.0 },
    ],
    windows: [
      { space: "hall", side: "bottom", at: 0.72, w: 3.0 },
      { space: "hall", side: "left", at: 0.5, w: 2.0 },
      { space: "win", side: "bottom", at: 0.5, w: 2.4 },
      { space: "win", side: "right", at: 0.5, w: 1.8 },
      { space: "kit", side: "right", at: 0.5, w: 1.0 },
      { space: "kit", side: "top", at: 0.5, w: 1.2 },
    ],
  };
}

/** Design studio: one wide studio along the windows, meeting room and kitchen at the back, a library lounge by reception. */
function workspaceLevelB() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wc1", label: "WC", kind: "wc", x: 0, y: 0, w: 0.125, h: 0.2 },
      { id: "wc2", label: "WC", kind: "wc", x: 0.125, y: 0, w: 0.125, h: 0.2 },
      { id: "lib", label: "LIBRARY LOUNGE", kind: "lounge", x: 0, y: 0.2, w: 0.25, h: 0.35 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0, y: 0.55, w: 0.25, h: 0.45 },
      { id: "kit", label: "KITCHEN", kind: "kitchenette", x: 0.25, y: 0, w: 0.2, h: 0.45 },
      { id: "meet", label: "MEETING ROOM", kind: "meeting", x: 0.45, y: 0, w: 0.25, h: 0.45 },
      { id: "focus", label: "FOCUS ROOM", kind: "office", x: 0.7, y: 0, w: 0.13, h: 0.45 },
      { id: "mat", label: "MATERIALS LIBRARY", kind: "store", x: 0.83, y: 0, w: 0.17, h: 0.45 },
      { id: "open", label: "STUDIO", kind: "openoffice", x: 0.25, y: 0.45, w: 0.75, h: 0.55 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.5, w: 1.6, entry: true },
      { space: "rec", side: "top", at: 0.5, w: 99, open: true },
      { space: "rec", side: "right", at: 0.5, w: 99, open: true },
      { space: "wc1", side: "bottom", at: 0.5, w: 0.8 },
      { space: "wc2", side: "bottom", at: 0.5, w: 0.8 },
      { space: "kit", side: "bottom", at: 0.5, w: 1.6, open: true },
      { space: "meet", side: "bottom", at: 0.5, w: 0.9 },
      { space: "focus", side: "bottom", at: 0.5, w: 0.9 },
      { space: "mat", side: "bottom", at: 0.5, w: 0.9 },
    ],
    windows: [
      { space: "open", side: "bottom", at: 0.2, w: 2.4 },
      { space: "open", side: "bottom", at: 0.5, w: 2.4 },
      { space: "open", side: "bottom", at: 0.8, w: 2.4 },
      { space: "open", side: "right", at: 0.5, w: 2.0 },
      { space: "rec", side: "left", at: 0.5, w: 1.8 },
      { space: "lib", side: "left", at: 0.5, w: 1.6 },
      { space: "kit", side: "top", at: 0.5, w: 1.2 },
      { space: "meet", side: "top", at: 0.5, w: 2.0 },
      { space: "focus", side: "top", at: 0.5, w: 0.9 },
      { space: "mat", side: "right", at: 0.5, w: 1.2 },
    ],
  };
}

/** Jewellery and accessories: display cases on the sales floor, a VIP lounge, a workshop and a safe room. */
function boutiqueLevelB() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "safe", label: "SAFE ROOM", kind: "store", x: 0, y: 0, w: 0.18, h: 0.28 },
      { id: "staff", label: "STAFF", kind: "staff", x: 0.18, y: 0, w: 0.26, h: 0.28 },
      { id: "wc", label: "WC", kind: "wc", x: 0.44, y: 0, w: 0.18, h: 0.28 },
      { id: "stock", label: "STOCK", kind: "store", x: 0.62, y: 0, w: 0.38, h: 0.24 },
      { id: "work", label: "WORKSHOP", kind: "office", x: 0.62, y: 0.24, w: 0.2, h: 0.26 },
      { id: "fit", label: "FITTING", kind: "fitting", x: 0.82, y: 0.24, w: 0.18, h: 0.26 },
      { id: "sales", label: "SALES FLOOR", kind: "boutique", x: 0, y: 0.28, w: 0.62, h: 0.72 },
      { id: "vip", label: "VIP LOUNGE", kind: "lounge", x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
    doors: [
      { space: "sales", side: "bottom", at: 0.3, w: 1.6, entry: true },
      { space: "vip", side: "left", at: 0.15, w: 1.0 },
      { space: "fit", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "safe", side: "bottom", at: 0.5, w: 0.9 },
      { space: "staff", side: "bottom", at: 0.5, w: 0.9 },
      { space: "wc", side: "left", at: 0.5, w: 0.8 },
      { space: "work", side: "left", at: 0.5, w: 0.9 },
      { space: "stock", side: "bottom", at: 0.25, w: 0.9 },
    ],
    windows: [
      { space: "sales", side: "bottom", at: 0.1, w: 1.2 },
      { space: "sales", side: "bottom", at: 0.75, w: 2.4 },
      { space: "sales", side: "left", at: 0.5, w: 1.6 },
      { space: "vip", side: "bottom", at: 0.5, w: 2.4 },
      { space: "vip", side: "right", at: 0.5, w: 1.6 },
      { space: "staff", side: "top", at: 0.5, w: 1.0 },
    ],
  };
}

/** Dental studio: reception and waiting at the front, two surgeries, X-ray and a consultation room off one corridor. */
function clinicLevelB() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wc", label: "WC", kind: "wc", x: 0, y: 0, w: 0.13, h: 0.45 },
      { id: "ster", label: "STERILISATION", kind: "prep", x: 0.13, y: 0, w: 0.21, h: 0.45 },
      { id: "xray", label: "X-RAY", kind: "store", x: 0.34, y: 0, w: 0.16, h: 0.45 },
      { id: "s2", label: "SURGERY 2", kind: "treatment", x: 0.5, y: 0, w: 0.26, h: 0.45 },
      { id: "cons", label: "CONSULTATION", kind: "office", x: 0.76, y: 0, w: 0.24, h: 0.45 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0, y: 0.45, w: 0.34, h: 0.55 },
      { id: "corr", label: "CORRIDOR", kind: "hall", x: 0.34, y: 0.45, w: 0.66, h: 0.15 },
      { id: "wait", label: "WAITING", kind: "lounge", x: 0.34, y: 0.6, w: 0.34, h: 0.4 },
      { id: "s1", label: "SURGERY 1", kind: "treatment", x: 0.68, y: 0.6, w: 0.32, h: 0.4 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.35, w: 1.2, entry: true },
      { space: "rec", side: "right", at: 0.5, w: 99, open: true },
      { space: "wc", side: "bottom", at: 0.5, w: 0.8 },
      { space: "ster", side: "bottom", at: 0.5, w: 0.9 },
      { space: "xray", side: "bottom", at: 0.5, w: 0.9 },
      { space: "s2", side: "bottom", at: 0.5, w: 1.0 },
      { space: "cons", side: "bottom", at: 0.5, w: 0.9 },
      { space: "s1", side: "top", at: 0.5, w: 1.0 },
    ],
    windows: [
      { space: "rec", side: "bottom", at: 0.78, w: 1.4 },
      { space: "rec", side: "left", at: 0.5, w: 1.8 },
      { space: "wait", side: "bottom", at: 0.5, w: 2.0 },
      { space: "s1", side: "bottom", at: 0.5, w: 1.8 },
      { space: "s1", side: "right", at: 0.5, w: 1.4 },
      { space: "s2", side: "top", at: 0.5, w: 1.6 },
      { space: "cons", side: "top", at: 0.5, w: 1.2 },
      { space: "cons", side: "right", at: 0.5, w: 1.2 },
      { space: "ster", side: "top", at: 0.5, w: 1.0 },
      { space: "wc", side: "left", at: 0.5, w: 0.6 },
    ],
  };
}

/** Hair and barber studio: reception in the middle of the front, barber stations on one side, hair styling on the other. */
function salonLevelB() {
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "wash", label: "WASH AREA", kind: "wash", x: 0, y: 0, w: 0.36, h: 0.45 },
      { id: "staff", label: "STAFF / STORE", kind: "staff", x: 0.36, y: 0, w: 0.14, h: 0.28 },
      { id: "wc", label: "WC", kind: "wc", x: 0.5, y: 0, w: 0.14, h: 0.28 },
      { id: "treat", label: "TREATMENT ROOM", kind: "treatment", x: 0.64, y: 0, w: 0.36, h: 0.45 },
      { id: "wait", label: "WAITING BAR", kind: "lounge", x: 0.36, y: 0.28, w: 0.28, h: 0.32 },
      { id: "barber", label: "BARBER STATIONS", kind: "styling", x: 0, y: 0.45, w: 0.36, h: 0.55 },
      { id: "rec", label: "RECEPTION", kind: "reception", x: 0.36, y: 0.6, w: 0.28, h: 0.4 },
      { id: "style", label: "HAIR STYLING", kind: "styling", x: 0.64, y: 0.45, w: 0.36, h: 0.55 },
    ],
    doors: [
      { space: "rec", side: "bottom", at: 0.5, w: 1.4, entry: true },
      { space: "rec", side: "top", at: 0.5, w: 99, open: true },
      { space: "rec", side: "left", at: 0.5, w: 99, open: true },
      { space: "rec", side: "right", at: 0.5, w: 99, open: true },
      { space: "wait", side: "left", at: 0.8, w: 1.2, open: true },
      { space: "wait", side: "right", at: 0.8, w: 1.2, open: true },
      { space: "wash", side: "bottom", at: 0.92, w: 0.8, open: true },
      { space: "staff", side: "bottom", at: 0.2, w: 0.8 },
      { space: "wc", side: "bottom", at: 0.8, w: 0.8 },
      { space: "treat", side: "left", at: 0.8, w: 0.9 },
    ],
    windows: [
      { space: "barber", side: "bottom", at: 0.5, w: 2.4 },
      { space: "barber", side: "left", at: 0.5, w: 1.6 },
      { space: "style", side: "bottom", at: 0.5, w: 2.4 },
      { space: "style", side: "right", at: 0.5, w: 1.6 },
      { space: "wash", side: "left", at: 0.5, w: 1.2 },
      { space: "treat", side: "top", at: 0.5, w: 1.2 },
      { space: "treat", side: "right", at: 0.5, w: 1.2 },
      { space: "wc", side: "top", at: 0.5, w: 0.6 },
      { space: "staff", side: "top", at: 0.5, w: 1.0 },
    ],
  };
}

/** Three-bedroom apartment, second plan: a long living room on the window front, kitchen and dining behind it, the
 *  master suite at one end and the two bedrooms off a corridor at the back. The front door opens from the back. */
function apartmentLevelB(spec) {
  const front = spec.glassy ? [{ at: 0.5, w: 99 }] : [{ at: 0.27, w: 2.2 }, { at: 0.73, w: 2.2 }];
  return {
    name: "FURNITURE LAYOUT",
    spaces: [
      { id: "kitchen", label: "KITCHEN", kind: "kitchen", x: 0, y: 0, w: 0.28, h: 0.4 },
      { id: "dining", label: "DINING", kind: "dining", x: 0.28, y: 0, w: 0.19, h: 0.44 },
      { id: "hall", label: "HALL", kind: "hall", x: 0.47, y: 0, w: 0.11, h: 0.44 },
      { id: "bedB", label: "BEDROOM", kind: "bedroom", x: 0.58, y: 0, w: 0.16, h: 0.34 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.74, y: 0, w: 0.1, h: 0.34 },
      { id: "bedC", label: "BEDROOM", kind: "bedroom", x: 0.84, y: 0, w: 0.16, h: 0.34 },
      { id: "corr", label: "CORRIDOR", kind: "hall", x: 0.58, y: 0.34, w: 0.42, h: 0.1 },
      { id: "ensuite", label: "EN-SUITE", kind: "bath", x: 0, y: 0.4, w: 0.09, h: 0.6 },
      { id: "master", label: "MASTER BEDROOM", kind: "master", x: 0.09, y: 0.4, w: 0.19, h: 0.6 },
      { id: "living", label: "LIVING ROOM", kind: "living", x: 0.28, y: 0.44, w: 0.72, h: 0.56 },
    ],
    doors: [
      { space: "hall", side: "top", at: 0.5, w: 1.0, entry: true },
      { space: "hall", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "hall", side: "left", at: 0.5, w: 1.2, open: true },
      { space: "hall", side: "right", at: 0.886, w: 0.9, open: true },
      { space: "kitchen", side: "right", at: 0.5, w: 99, open: true },
      { space: "dining", side: "bottom", at: 0.5, w: 99, open: true },
      { space: "master", side: "right", at: 0.4, w: 0.9 },
      { space: "ensuite", side: "right", at: 0.5, w: 0.8 },
      { space: "bedB", side: "bottom", at: 0.5, w: 0.9 },
      { space: "bath", side: "bottom", at: 0.5, w: 0.8 },
      { space: "bedC", side: "bottom", at: 0.5, w: 0.9 },
    ],
    windows: [
      ...front.map((f) => ({ space: "living", side: "bottom", ...f })),
      { space: "living", side: "right", at: 0.5, w: spec.glassy ? 3.0 : 2.0 },
      { space: "master", side: "bottom", at: 0.5, w: spec.glassy ? 2.4 : 1.8 },
      { space: "ensuite", side: "left", at: 0.5, w: 0.8 },
      { space: "kitchen", side: "top", at: 0.5, w: 1.6 },
      { space: "kitchen", side: "left", at: 0.5, w: 1.2 },
      { space: "dining", side: "top", at: 0.5, w: 1.6 },
      { space: "bedB", side: "top", at: 0.5, w: 1.4 },
      { space: "bath", side: "top", at: 0.5, w: 0.6 },
      { space: "bedC", side: "top", at: 0.5, w: 1.4 },
      { space: "bedC", side: "right", at: 0.5, w: 1.2 },
    ],
  };
}

const COMMERCIAL_LAYOUTS = {
  cafe: [cafeLevel, cafeLevelB],
  workspace: [workspaceLevel, workspaceLevelB],
  boutique: [boutiqueLevel, boutiqueLevelB],
  clinic: [clinicLevel, clinicLevelB],
  salon: [salonLevel, salonLevelB],
};
/** Layout variants of the interior types ("a" is the default; an apartment or penthouse has a second plan with three bedrooms). */
export const INTERIOR_LAYOUTS = { ...Object.fromEntries(Object.entries(COMMERCIAL_LAYOUTS).map(([k, v]) => [k, v.map((_, i) => "ab"[i])])), flat: ["a", "b"], penthouse: ["a", "b"] };

/** Levels of an interior project, named for the interior set (FURNITURE LAYOUT / GROUND FLOOR LAYOUT …). */
function interiorLevels(plan, W, D, spec) {
  const type = plan.interior.type;
  let levels;
  if (type === "residence") levels = twoStorey(plan, W, D, spec);
  else if (type === "flat" && plan.bedrooms === 1) levels = [flatOneBed()];
  else if ((type === "flat" || type === "penthouse") && plan.bedrooms === 3 && plan.interior.layout === "b") levels = [apartmentLevelB(spec)];
  else if (type === "flat" || type === "penthouse") levels = [singleStorey(plan, W, D, spec)];
  else levels = [COMMERCIAL_LAYOUTS[type][plan.interior.layout === "b" ? 1 : 0]()];
  const floors = levels.length > 1 ? ["GROUND FLOOR", "FIRST FLOOR"] : [""];
  levels.forEach((lv, i) => {
    lv.floorName = floors[i];
    lv.name = floors[i] ? `${floors[i]} LAYOUT` : "FURNITURE LAYOUT";
    lv.veranda = false;
    lv.canopy = false;
  });
  return levels;
}

// ------------------------------------------------------------------ patterns for floors, swatches and elevations

function interiorDefs(s, prefix = "ip") {
  const m = (v) => +(v * s).toFixed(2);
  const ln = (o = 0.3) => `stroke="#3b2f22" stroke-opacity="${o}" stroke-width="0.7" fill="none"`;
  const pat = (id, w, h, body) => `<pattern id="${prefix}-${id}" patternUnits="userSpaceOnUse" width="${m(w)}" height="${m(h)}">${body}</pattern>`;
  let terr = "";
  const rnd = rng(11);
  for (let i = 0; i < 26; i++) terr += `<circle cx="${m(rnd() * 0.5)}" cy="${m(rnd() * 0.5)}" r="${(0.6 + rnd() * 1.6).toFixed(1)}" fill="${["#8a7b6a", "#b88a6d", "#ffffff", "#5f5a55"][i % 4]}" fill-opacity=".55"/>`;
  let conc = "";
  for (let i = 0; i < 30; i++) conc += `<circle cx="${m(rnd() * 0.6)}" cy="${m(rnd() * 0.6)}" r="0.6" fill="#3b3833" fill-opacity=".18"/>`;
  let moss = "";
  for (let i = 0; i < 18; i++) moss += `<circle cx="${m(rnd() * 0.3)}" cy="${m(rnd() * 0.3)}" r="${(1.2 + rnd() * 2.2).toFixed(1)}" fill="#3f4d2b" fill-opacity=".35"/>`;
  const herring = `<path d="M0 ${m(0.15)} L${m(0.15)} 0 M0 ${m(0.45)} L${m(0.45)} 0 M${m(0.15)} ${m(0.6)} L${m(0.6)} ${m(0.15)} M${m(0.45)} ${m(0.6)} L${m(0.6)} ${m(0.45)} M${m(0.15)} 0 L${m(0.6)} ${m(0.45)} M0 ${m(0.15)} L${m(0.45)} ${m(0.6)}" ${ln(0.32)}/>`;
  return `<defs>
    ${pat("planks", 1.2, 0.4, `<path d="M0 ${m(0.2)}H${m(1.2)}M0 ${m(0.4) - 0.4}H${m(1.2)}M${m(0.45)} 0V${m(0.2)}M${m(1.0)} ${m(0.2)}V${m(0.4)}" ${ln(0.3)}/>`)}
    ${pat("herring", 0.6, 0.6, herring)}
    ${pat("chevron", 0.6, 0.3, `<path d="M0 ${m(0.3)} L${m(0.3)} 0 L${m(0.6)} ${m(0.3)} M0 ${m(0.15)} L${m(0.15)} 0 M${m(0.45)} 0 L${m(0.6)} ${m(0.15)}" ${ln(0.32)}/>`)}
    ${pat("bigtile", 0.6, 0.6, `<path d="M0 ${m(0.6) - 0.4}H${m(0.6)}M${m(0.6) - 0.4} 0V${m(0.6)}" ${ln(0.28)}/>`)}
    ${pat("cotto", 0.3, 0.3, `<path d="M0 ${m(0.3) - 0.4}H${m(0.3)}M${m(0.3) - 0.4} 0V${m(0.3)}" ${ln(0.3)}/>`)}
    ${pat("hex", 0.26, 0.3, `<path d="M0 ${m(0.075)} L${m(0.13)} 0 L${m(0.26)} ${m(0.075)} V${m(0.225)} L${m(0.13)} ${m(0.3)} L0 ${m(0.225)} Z" ${ln(0.35)}/>`)}
    ${pat("terrazzo", 0.5, 0.5, terr)}
    ${pat("concrete", 0.6, 0.6, conc)}
    ${pat("moss", 0.3, 0.3, moss)}
    ${pat("marble", 1.2, 1.2, `<path d="M0 ${m(0.3)} C${m(0.3)} ${m(0.2)} ${m(0.5)} ${m(0.6)} ${m(1.2)} ${m(0.45)} M${m(0.2)} ${m(1.2)} C${m(0.4)} ${m(0.9)} ${m(0.8)} ${m(1.0)} ${m(1.0)} ${m(0.7)}" stroke="#6d665e" stroke-opacity=".28" stroke-width="0.8" fill="none"/>`)}
    ${pat("stone", 0.6, 1.2, `<path d="M0 ${m(1.2) - 0.4}H${m(0.6)}M${m(0.6) - 0.4} 0V${m(1.2)}M${m(0.1)} ${m(0.4)} q${m(0.2)} ${m(-0.05)} ${m(0.4)} 0" ${ln(0.22)}/>`)}
    ${pat("weave", 0.08, 0.08, `<path d="M0 ${m(0.04)}H${m(0.08)}M${m(0.04)} 0V${m(0.08)}" stroke="#3b2f22" stroke-opacity=".14" stroke-width="0.6"/>`)}
    ${pat("slats", 0.08, 1, `<path d="M${m(0.08) - 0.6} 0V${m(1)}" stroke="#2b2017" stroke-opacity=".35" stroke-width="1"/>`)}
    ${pat("grain", 0.6, 0.2, `<path d="M0 ${m(0.06)} q${m(0.15)} ${m(-0.03)} ${m(0.3)} 0 t${m(0.3)} 0 M0 ${m(0.15)} q${m(0.15)} ${m(0.03)} ${m(0.3)} 0 t${m(0.3)} 0" ${ln(0.18)}/>`)}
    ${pat("panels", 1.2, 1.4, `<rect x="${m(0.12)}" y="${m(0.12)}" width="${m(0.96)}" height="${m(1.16)}" ${ln(0.22)}/>`)}
    ${pat("brick", 0.25, 0.14, `<path d="M0 ${m(0.07)}H${m(0.25)}M0 ${m(0.14) - 0.4}H${m(0.25)}M${m(0.125)} 0V${m(0.07)}M0.4 ${m(0.07)}V${m(0.14)}" stroke="#f3eee6" stroke-opacity=".6" stroke-width="0.9" fill="none"/>`)}
    ${pat("motif", 0.4, 0.4, `<path d="M${m(0.2)} ${m(0.04)} L${m(0.36)} ${m(0.2)} L${m(0.2)} ${m(0.36)} L${m(0.04)} ${m(0.2)} Z M${m(0.2)} ${m(0.12)} L${m(0.28)} ${m(0.2)} L${m(0.2)} ${m(0.28)} L${m(0.12)} ${m(0.2)} Z" stroke="#f6efe4" stroke-opacity=".55" stroke-width="0.9" fill="none"/><path d="M0 ${m(0.4) - 0.4}H${m(0.4)}M${m(0.4) - 0.4} 0V${m(0.4)}" ${ln(0.25)}/>`)}
    ${pat("lattice", 0.3, 0.3, `<path d="M${m(0.15)} 0 L${m(0.3)} ${m(0.15)} L${m(0.15)} ${m(0.3)} L0 ${m(0.15)} Z M0 0 L${m(0.3)} ${m(0.3)} M${m(0.3)} 0 L0 ${m(0.3)}" stroke="#f3e6d2" stroke-opacity=".55" stroke-width="1" fill="none"/>`)}
  </defs>`;
}
const patternFill = (p, prefix = "ip") => (p && p !== "plain" ? `url(#${prefix}-${p})` : null);

// ------------------------------------------------------------------ ceiling and lighting layout

/** Pendants over tables, islands, counters and beside beds (plan metres), matching the furniture drawn on the plans. */
function pendantsFor(kind, r) {
  const { x, y, w, h } = r;
  const out = [];
  if (kind === "dining" && w > 3 && h > 3) out.push([x + w / 2 - 0.55, y + h / 2], [x + w / 2 + 0.55, y + h / 2]);
  if (kind === "kitchen" && w > 3.6 && h > 3.4) {
    const iw = Math.min(2.6, w - 2.0), ix = x + (w - iw) / 2 + 0.3;
    out.push([ix + iw * 0.25, y + h * 0.5 + 0.47], [ix + iw * 0.75, y + h * 0.5 + 0.47]);
  }
  if (kind === "open" && h > 6) out.push([x + w / 2 - 0.5, y + h * 0.45 + 0.5], [x + w / 2 + 0.5, y + h * 0.45 + 0.5]);
  if (kind === "master" || kind === "bedroom") {
    const bw = kind === "master" ? 1.8 : w < 2.6 ? 0.9 : 1.6;
    if (w >= bw + 0.4 && h >= 2.65) {
      const bx = x + (w - bw) / 2;
      out.push([bx - 0.32, y + 0.3], [bx + bw + 0.32, y + 0.3]);
    }
  }
  if (kind === "bar") {
    const cw = Math.min(w - 0.8, 6.0), n = Math.max(2, Math.floor(cw / 1.4));
    for (let i = 0; i < n; i++) out.push([x + (w - cw) / 2 + (cw * (i + 0.5)) / n, y + 1.6]);
  }
  if (kind === "reception") {
    const dw = Math.min(2.4, w - 0.8);
    out.push([x + 0.4 + dw * 0.3, y + 0.95], [x + 0.4 + dw * 0.7, y + 0.95]);
  }
  if (kind === "meeting") {
    const tw = Math.min(w - 2.0, 6.0);
    if (tw > 1.5) for (const f of [0.25, 0.5, 0.75]) out.push([x + (w - tw) / 2 + tw * f, y + h / 2]);
  }
  if (kind === "teahall") out.push(...teaTables(r));
  if (kind === "nails") {
    const tw = Math.min(w - 1.6, 3.6);
    for (let cx = x + (w - tw) / 2 + 0.6; cx < x + (w + tw) / 2 - 0.3; cx += 1.2) out.push([cx, y + h * 0.4 + 0.35]);
  }
  if (kind === "treatment") out.push([x + w / 2, y + 2.0]);
  if (kind === "staff" && w > 3 && h > 3) out.push([x + w / 2, y + h / 2 + 0.3]);
  if (kind === "kitchenette" && h > 3 && w > 2.4) out.push([x + w / 2, y + h * 0.62]);
  if (kind === "boutique" && h > 5) out.push([x + w * 0.5, y + h * 0.75]);
  return out;
}

/** Light fittings of one level: downlights, pendants, coves, tracks, linear pendants and mirror lights. */
function ceilingLayout(model, level) {
  const out = { down: [], pend: [], cove: [], track: [], linear: [], mirror: [] };
  for (const sp of level.spaces) {
    if (sp.kind === "stair" || sp.kind === "void") continue;
    const r = inner(model, sp);
    const wet = WET_KINDS.includes(sp.kind);
    const cove = COVE_KINDS.includes(sp.kind) && r.w > 3 && r.h > 3;
    if (cove) out.cove.push({ x: r.x + 0.45, y: r.y + 0.45, w: r.w - 0.9, h: r.h - 0.9 });
    const pend = pendantsFor(sp.kind, r);
    out.pend.push(...pend);
    if (sp.kind === "boutique" || sp.kind === "showroom") {
      for (const f of [0.3, 0.62]) out.track.push({ x1: r.x + 0.8, y1: r.y + r.h * f, x2: r.x + r.w - 0.8, y2: r.y + r.h * f });
      continue;
    }
    if (sp.kind === "openoffice") {
      for (let cx = r.x + 1.2; cx + 3.2 < r.x + r.w - 0.6; cx += 4.0) for (let cy = r.y + 1.2; cy + 1.6 < r.y + r.h - 1.0; cy += 3.4) out.linear.push({ x: cx + 0.2, y: cy + 0.7, w: 2.8, h: 0.2 });
      continue;
    }
    // downlights on an even grid inside the room (inside the cove line when there is one), clear of the pendants
    const inset = cove ? 0.95 : 0.6, step = wet ? 1.2 : 1.7;
    const gw = r.w - 2 * inset, gh = r.h - 2 * inset;
    const pts = [];
    if (gw > 0.2 && gh > 0.2) {
      const nx = Math.max(1, Math.round(gw / step) + 1), ny = Math.max(1, Math.round(gh / step) + 1);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([r.x + inset + (nx === 1 ? gw / 2 : (gw * i) / (nx - 1)), r.y + inset + (ny === 1 ? gh / 2 : (gh * j) / (ny - 1))]);
    } else pts.push([r.x + r.w / 2, r.y + r.h / 2]);
    out.down.push(...pts.filter(([px, py]) => !pend.some(([qx, qy]) => Math.hypot(px - qx, py - qy) < 0.7)));
    if (["bath", "shower", "wc"].includes(sp.kind)) out.mirror.push([r.x + Math.min(0.6, r.w / 2), r.y + r.h - 0.12]);
  }
  return out;
}

/** Fittings by type for the lighting schedule. */
function lightingSchedule(model) {
  const tot = { down: 0, pend: 0, cove: 0, track: 0, spots: 0, linear: 0, mirror: 0 };
  for (const lv of model.levels) {
    const c = ceilingLayout(model, lv);
    tot.down += c.down.length;
    tot.pend += c.pend.length;
    tot.cove += c.cove.reduce((n, r) => n + 2 * (r.w + r.h), 0);
    tot.track += c.track.length;
    tot.spots += c.track.reduce((n, t) => n + Math.max(2, Math.round(Math.hypot(t.x2 - t.x1, t.y2 - t.y1) / 1.2)), 0);
    tot.linear += c.linear.length;
    tot.mirror += c.mirror.length;
  }
  const rows = [
    ["L1", "Recessed LED downlight, 2700 K, IP44 in wet rooms", tot.down],
    ["L2", "Decorative pendant (see palette)", tot.pend],
    ["L3", "Concealed LED cove strip, m", Math.round(tot.cove)],
    ["L4", `Track, ${tot.track} runs, with adjustable spots`, tot.spots],
    ["L5", "Linear LED pendant over desks", tot.linear],
    ["L6", "Mirror light / wall light, IP44", tot.mirror],
  ];
  return rows.filter((r) => r[2] > 0);
}

// plan symbols (px at s px per metre)
const SYM = {
  down: (x, y) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/><path d="M${f1(x - 4)} ${f1(y)}H${f1(x + 4)}M${f1(x)} ${f1(y - 4)}V${f1(y + 4)}" stroke="${INK}" stroke-width="0.6"/>`,
  pend: (x, y) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="none" stroke="${ACCENT}" stroke-width="1.1"/><circle cx="${f1(x)}" cy="${f1(y)}" r="3.2" fill="${ACCENT}"/>`,
  mirror: (x, y) => `<rect x="${f1(x - 7)}" y="${f1(y - 2.5)}" width="14" height="5" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`,
};

// ------------------------------------------------------------------ cutaway axonometric

/** Loose furniture and built-ins of a room as boxes: [x, y, w, h, z0, z1, material] in plan metres. */
function furnitureBlocks(kind, r) {
  const { x, y, w, h } = r;
  const B = [];
  const add = (bx, by, bw, bh, z0, z1, c) => bw > 0.05 && bh > 0.05 && B.push([bx, by, bw, bh, z0, z1, c]);
  const seating = (cx, sw) => {
    const chairs = h > 3.3;
    const gy = y + Math.max(0.25, (h - (chairs ? 3.0 : 1.85)) / 2);
    add(cx - sw / 2, gy, sw, 0.9, 0, 0.42, "fabric");
    add(cx - sw / 2, gy, sw, 0.22, 0.42, 0.8, "fabric");
    add(cx - 0.55, gy + 1.25, 1.1, 0.6, 0, 0.38, "wood");
    if (chairs) add(cx - 1.25, gy + 2.2, 0.8, 0.8, 0, 0.42, "fabric"), add(cx + 0.45, gy + 2.2, 0.8, 0.8, 0, 0.42, "fabric");
  };
  const sofa = (cx, cy, sw) => {
    add(cx - sw / 2, cy, sw, 0.95, 0, 0.42, "fabric");
    add(cx - sw / 2, cy + 0.72, sw, 0.23, 0.42, 0.8, "fabric");
    add(cx - 0.6, cy - 1.0, 1.2, 0.65, 0, 0.38, "wood");
  };
  const table = (cx, cy, tw, seats) => {
    add(cx - tw / 2, cy - 0.5, tw, 1.0, 0, 0.75, "wood");
    for (let i = 0; i < seats; i++) {
      const sx = cx - tw / 2 + (tw / seats) * (i + 0.5) - 0.22;
      add(sx, cy - 1.0, 0.44, 0.42, 0, 0.46, "fabric");
      add(sx, cy + 0.58, 0.44, 0.42, 0, 0.46, "fabric");
    }
  };
  const bed = (bw) => {
    if (w < bw + 0.4 || h < 2.65) return;
    const bx = x + (w - bw) / 2;
    add(bx, y + 0.05, bw, 2.05, 0, 0.5, "white");
    add(bx - 0.1, y + 0.02, bw + 0.2, 0.1, 0, 1.15, "fabric");
    if (w > bw + 1.4) add(bx - 0.55, y + 0.1, 0.45, 0.4, 0, 0.5, "wood"), add(bx + bw + 0.1, y + 0.1, 0.45, 0.4, 0, 0.5, "wood");
    if (h > 3.85) add(x + 0.2, y + h - 0.62, Math.min(w - 0.4, 2.4), 0.6, 0, 2.2, "wood");
  };
  switch (kind) {
    case "master": bed(1.8); break;
    case "bedroom": bed(w < 2.6 ? 0.9 : 1.6); break;
    case "living": {
      const sw = Math.min(3.4, w - 2.2);
      if (sw > 2 && h * 0.42 >= 2.0) sofa(x + w * 0.45, y + h * 0.42, sw);
      else if (sw > 2 && h > 2.4) seating(x + (w - 0.6) / 2, Math.min(2.6, sw));
      add(x + w - 0.5, y + h * 0.15, 0.4, Math.min(2.4, h * 0.4), 0, 0.5, "wood");
      break;
    }
    case "open": {
      const kl = Math.min(w - 0.4, 4.2);
      add(x + 0.1, y + 0.05, kl, 0.62, 0, 0.9, "wood");
      if (h > 5.5 && w > 2.6) add(x + 0.1 + (kl - 2.2) / 2, y + 1.55, 2.2, 0.9, 0, 0.9, "stone");
      if (h > 6) table(x + w / 2, y + h * 0.45 + 0.5, Math.min(2.0, w - 1.6), 3);
      const sw = Math.min(2.8, w - 1);
      const sy = y + h - 2.6;
      add(x + (w - sw) / 2, sy, sw, 0.95, 0, 0.75, "fabric");
      add(x + (w - 1.2) / 2, sy + 1.35, 1.2, 0.6, 0, 0.38, "wood");
      break;
    }
    case "kitchen": {
      add(x + 0.05, y + 0.05, w - 0.1, 0.62, 0, 0.9, "wood");
      add(x + 0.05, y + 0.67, 0.62, Math.min(h * 0.55, h - 1.0), 0, 0.9, "wood");
      if (w > 3.6 && h > 3.4) add(x + (w - Math.min(2.6, w - 2.0)) / 2 + 0.3, y + h * 0.5, Math.min(2.6, w - 2.0), 0.95, 0, 0.9, "stone");
      break;
    }
    case "dining": {
      const tw = Math.min(3.0, w - 1.6);
      if (tw > 1.4 && h > 3) table(x + w / 2, y + h / 2, tw, tw >= 2.6 ? 4 : 3);
      break;
    }
    case "bath":
      if (w > 1.9 && h > 2.2) add(x + 0.05, y + 0.05, 1.7, 0.75, 0, 0.55, "white");
      add(x + w - 0.55, y + h - 0.75, 0.45, 0.6, 0, 0.42, "white");
      add(x + 0.1, y + h - 0.55, 0.9, 0.5, 0.3, 0.85, "wood");
      break;
    case "shower":
    case "wc":
      if (w > 5 && h > 3.5) break;
      add(x + w - 0.5, y + h - 0.72, 0.42, 0.6, 0, 0.42, "white");
      break;
    case "study":
    case "office":
      if (w > 2 && h > 2) add(x + 0.1, y + 0.1, Math.min(1.8, w - 0.4), 0.7, 0, 0.75, "wood"), add(x + 0.6, y + 0.95, 0.5, 0.5, 0, 0.5, "fabric");
      break;
    case "director":
      add(x + w / 2 - 1.0, y + 1.0, 2.0, 0.9, 0, 0.75, "wood");
      add(x + 0.1, y + 0.1, 0.4, Math.min(3, h * 0.4), 0, 2.0, "wood");
      if (h > 5) sofa(x + w / 2, y + h - 1.6, Math.min(2.6, w - 1.6));
      break;
    case "lounge": {
      if (w >= 9 && h > 3) sofa(x + w * 0.35, y + h * 0.55, Math.min(3.0, w * 0.3)), table(x + w * 0.75, y + h / 2, Math.min(2.0, w * 0.2), 2);
      else if (w > 3.2 && h > 2.4) seating(x + w / 2, Math.min(2.6, w - 1.2));
      else if (w > 2.5 && h > 2.5) add(x + 0.3, y + h - 1.2, w - 0.6, 0.8, 0, 0.45, "fabric");
      break;
    }
    case "teahall":
      add(x + 0.1, y + 0.6, 0.6, h - 1.2, 0, 0.45, "fabric");
      add(x + 0.1, y + 0.6, 0.18, h - 1.2, 0.45, 0.95, "fabric");
      for (const [cx, cy] of teaTables(r)) {
        add(cx - 0.38, cy - 0.38, 0.76, 0.76, 0, 0.75, "stone");
        add(cx - 0.88, cy - 0.2, 0.4, 0.4, 0, 0.46, "fabric");
        add(cx + 0.48, cy - 0.2, 0.4, 0.4, 0, 0.46, "fabric");
      }
      break;
    case "bar": {
      const cw = Math.min(w - 0.8, 6.0);
      add(x + 0.1, y + 0.1, w - 0.2, 0.45, 0, 2.1, "wood");
      add(x + (w - cw) / 2, y + 1.3, cw, 0.6, 0, 1.1, "wood");
      add(x + (w - cw) / 2 - 0.05, y + 1.25, cw + 0.1, 0.7, 1.1, 1.15, "stone");
      for (let sx = x + (w - cw) / 2 + 0.4; sx < x + (w + cw) / 2 - 0.2; sx += 0.75) add(sx - 0.2, y + 2.1, 0.4, 0.4, 0, 0.75, "metal");
      break;
    }
    case "prep":
    case "kitchenette":
      add(x + 0.1, y + 0.1, w - 0.2, 0.65, 0, 0.9, kind === "prep" ? "metal" : "wood");
      if (kind === "kitchenette" && h > 3 && w > 2.4) table(x + w / 2, y + h * 0.62, Math.min(1.8, w - 1.4), 2);
      break;
    case "openoffice":
      for (let cx = x + 1.2; cx + 3.2 < x + w - 0.6; cx += 4.0) for (let cy = y + 1.2; cy + 1.6 < y + h - 1.0; cy += 3.4) {
        add(cx, cy, 3.2, 1.6, 0, 0.74, "wood");
        add(cx + 1.57, cy, 0.06, 1.6, 0.74, 1.15, "fabric");
      }
      break;
    case "meeting": {
      const tw = Math.min(w - 2.0, 6.0), th = Math.min(h - 2.0, 1.4);
      if (tw > 1.5 && th > 0.8) {
        const tx = x + (w - tw) / 2, ty = y + (h - th) / 2;
        add(tx, ty, tw, th, 0, 0.75, "wood");
        for (let cx = tx + 0.45; cx < tx + tw - 0.2; cx += 0.9) add(cx - 0.22, ty - 0.57, 0.44, 0.44, 0, 0.46, "fabric"), add(cx - 0.22, ty + th + 0.13, 0.44, 0.44, 0, 0.46, "fabric");
      }
      break;
    }
    case "reception":
      add(x + 0.4, y + 0.6, Math.min(2.4, w - 0.8), 0.7, 0, 1.1, "wood");
      add(x + 0.4, y + h - 2.2, Math.min(2.2, w - 0.8), 0.85, 0, 0.45, "fabric");
      break;
    case "boutique":
      add(x + 0.1, y + 0.1, w - 0.2, 0.45, 0, 2.3, "wood");
      add(x + 0.1, y + 0.55, 0.45, h - 2.4, 0, 2.3, "wood");
      for (let cx = x + w * 0.3; cx < x + w * 0.75; cx += w * 0.3) add(cx - 0.8, y + h * 0.42, 1.6, 0.9, 0, 0.85, "stone");
      add(x + w - 2.4, y + h - 1.9, 1.8, 0.7, 0, 1.05, "feature");
      break;
    case "fitting": {
      const n = Math.max(2, Math.floor(h / 1.5));
      for (let i = 0; i <= n; i++) add(x + w - 1.6, y + 0.1 + (i * (h - 0.2)) / n - 0.03, 1.5, 0.06, 0, 2.2, "feature");
      add(x + 0.4, y + h / 2 - 0.9, 0.5, 1.8, 0, 0.45, "fabric");
      break;
    }
    case "treatment":
      add(x + 0.1, y + 0.1, w - 0.2, 0.6, 0, 0.9, "white");
      add(x + w / 2 - 0.4, y + 1.2, 0.8, 1.9, 0, 0.65, "fabric");
      break;
    case "styling":
      for (let cx = x + 0.9; cx + 0.6 < x + w - 0.4; cx += 1.6) add(cx - 0.45, y + 0.1, 0.9, 0.45, 0, 0.8, "wood"), add(cx - 0.3, y + 0.75, 0.6, 0.6, 0, 0.55, "fabric");
      break;
    case "wash":
      for (let cx = x + 0.8; cx + 0.4 < x + w - 0.2; cx += 1.2) add(cx - 0.35, y + 0.1, 0.7, 0.5, 0, 0.9, "white"), add(cx - 0.3, y + 0.65, 0.6, 1.3, 0, 0.55, "fabric");
      break;
    case "nails": {
      const tw = Math.min(w - 1.6, 3.6);
      add(x + (w - tw) / 2, y + h * 0.4, tw, 0.7, 0, 0.75, "stone");
      break;
    }
    case "racks":
      for (let ry = y + 0.4; ry + 1.1 < y + h - 0.6; ry += 2.4) add(x + 0.6, ry, w - 1.2, 0.6, 0, 2.1, "metal");
      break;
    case "store":
      add(x + 0.1, y + 0.1, Math.min(1.2, w - 0.2), 0.6, 0, 2.0, "metal");
      break;
    case "staff":
      if (w > 3 && h > 3) table(x + w / 2, y + h / 2 + 0.3, Math.min(2.4, w - 1.8), 3);
      break;
  }
  return B;
}

/** Cutaway isometric of the interior: floors in their finishes, walls cut at 1.2 m, furniture as blocks. */
export function cutawaySheet(model, sheetNo, { preview = false, bare = false } = {}) {
  const { W, D, plan } = model;
  const pal = paletteOf(model);
  const col = {
    wood: matOf(model, "J1").fill, fabric: matOf(model, "T1").fill, stone: matOf(model, "S1").fill, metal: matOf(model, "M1").fill,
    white: "#f4f2ee", feature: matOf(model, "W2").fill, wall: matOf(model, "W1").fill,
  };
  const cut = 1.25;
  const levels = bare ? [0] : model.levels.map((_, i) => i);
  const proj = isoProj;
  // extents of one level in projected units
  const ext = [[0, 0], [W, 0], [0, D], [W, D]].flatMap(([x, b]) => [proj(x, b, 0), proj(x, b, cut)]);
  const minX = Math.min(...ext.map((p) => p[0])), maxX = Math.max(...ext.map((p) => p[0]));
  const minY = Math.min(...ext.map((p) => p[1])), maxY = Math.max(...ext.map((p) => p[1]));
  const areaW = (bare ? COVER_W - 80 : SHEET_W - 330 - 36 - 120) / levels.length - (levels.length > 1 ? 40 : 0);
  const areaH = bare ? COVER_H - 80 : SHEET_H - 72 - 210;
  const s = Math.min(areaW / (maxX - minX), areaH / (maxY - minY));
  let g = "";
  levels.forEach((li, k) => {
    const ox = (bare ? 40 : 36 + 60) + k * (areaW + 40) + (areaW - (maxX - minX) * s) / 2 - minX * s;
    const oy = (bare ? 40 : 36 + 60) + (areaH - (maxY - minY) * s) / 2 - minY * s;
    const P = (x, y, z) => {
      const [u, v] = proj(x, D - y, z);
      return `${(ox + u * s).toFixed(1)},${(oy + v * s).toFixed(1)}`;
    };
    const level = model.levels[li];
    // floors in their finish colours
    g += isoPoly([P(0, 0, -0.15), P(W, 0, -0.15), P(W, D, -0.15), P(0, D, -0.15)], "#d8d2c6", 'stroke-width="0.8"');
    for (const sp of level.spaces) {
      const r = inner(model, sp);
      const fin = sp.kind === "void" ? null : matOf(model, roomFinish(model, sp).floor);
      g += isoPoly([P(r.x, r.y, 0), P(r.x + r.w, r.y, 0), P(r.x + r.w, r.y + r.h, 0), P(r.x, r.y + r.h, 0)], fin ? fin.fill : PAPER, 'stroke-width="0.4"');
    }
    // walls (from the CAD wall cells) and furniture as boxes, painted far to near
    const boxes = [];
    // walls cut into ~1 m pieces so they sort correctly against the furniture
    for (const e of cadLevel(model, li).entities) {
      if (e.layer !== "A-WALL-PATT" || e.t !== "solid") continue;
      const along = e.w >= e.h, len = along ? e.w : e.h, n = Math.max(1, Math.round(len / 1.0));
      for (let k = 0; k < n; k++) boxes.push(along ? [e.x + (e.w * k) / n, e.y, e.w / n, e.h, 0, cut, "wallcut"] : [e.x, e.y + (e.h * k) / n, e.w, e.h / n, 0, cut, "wallcut"]);
    }
    for (const sp of level.spaces) for (const b of furnitureBlocks(sp.kind, inner(model, sp))) boxes.push(b);
    boxes.sort((a, b) => a[0] + a[2] / 2 + (D - a[1] - a[3] / 2) - (b[0] + b[2] / 2 + (D - b[1] - b[3] / 2)) || a[4] - b[4]).reverse();
    for (const [bx, by, bw, bh, z0, z1, c] of boxes) {
      const base = c === "wallcut" ? col.wall : col[c] ?? col.white;
      const front = shade(base, -0.08), side = shade(base, -0.2), top = c === "wallcut" ? "#3d3a36" : shade(base, 0.12);
      // visible faces: front (y + h, toward the viewer), left (x) and top
      g += isoPoly([P(bx, by + bh, z0), P(bx + bw, by + bh, z0), P(bx + bw, by + bh, z1), P(bx, by + bh, z1)], front, 'stroke-width="0.45"');
      g += isoPoly([P(bx, by, z0), P(bx, by + bh, z0), P(bx, by + bh, z1), P(bx, by, z1)], side, 'stroke-width="0.45"');
      g += isoPoly([P(bx, by, z1), P(bx + bw, by, z1), P(bx + bw, by + bh, z1), P(bx, by + bh, z1)], top, 'stroke-width="0.45"');
    }
    if (!bare && levels.length > 1) {
      const [u, v] = proj(W / 2, -1.5, 0);
      g += `<text x="${(ox + u * s).toFixed(1)}" y="${(oy + v * s + 30).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="12" letter-spacing="2.5" fill="${INK}">${level.floorName}</text>`;
    }
  });
  if (bare) return bareSvg(g);
  g += sheetTitle("CUTAWAY AXONOMETRIC", `${plan.title.en.toUpperCase()} · ${pal.name} · WALLS CUT AT 1.25 m · FLOORS SHOWN IN THEIR FINISHES`);
  return sheet({ plan, drawing: "CUTAWAY AXONOMETRIC", sheetNo, scaleNote: "NTS", body: g, north: false, preview });
}

// ------------------------------------------------------------------ interior elevations

const ELEVATIONS = {
  media: "MEDIA WALL", kitchen: "KITCHEN RUN", bed: "BED WALL", vanity: "VANITY WALL", bar: "BAR AND BACK BAR", banquette: "BANQUETTE WALL",
  desk: "RECEPTION DESK", storage: "STORAGE AND ACOUSTIC WALL", display: "DISPLAY WALL", fitting: "FITTING ROOMS", surgery: "SURGERY WALL",
  bench: "WAITING WALL", stations: "STYLING STATIONS", wash: "WASH AREA", nails: "NAIL BAR",
};
const ELEVATION_PICKS = {
  home: [["media", ["living", "open"]], ["kitchen", ["kitchen", "open"]], ["bed", ["master", "bedroom"]], ["vanity", ["bath", "shower"]]],
  cafe: [["bar", ["bar"]], ["banquette", ["teahall"]], ["media", ["lounge"]], ["vanity", ["wc"]]],
  workspace: [["desk", ["reception"]], ["storage", ["openoffice"]], ["media", ["meeting"]], ["kitchen", ["kitchenette"]]],
  boutique: [["display", ["boutique"]], ["desk", ["boutique"]], ["fitting", ["fitting"]], ["vanity", ["wc"]]],
  clinic: [["desk", ["reception"]], ["bench", ["lounge"]], ["surgery", ["treatment"]], ["vanity", ["wc"]]],
  salon: [["desk", ["reception"]], ["stations", ["styling"]], ["wash", ["wash"]], ["nails", ["nails"]], ["media", ["lounge"]]],
};

/** The four walls drawn on A-201: [elevation type, space] picks for the project type. */
function elevationPicks(model) {
  const type = model.interior.type;
  const picks = ELEVATION_PICKS[["flat", "penthouse", "residence"].includes(type) ? "home" : type];
  const spaces = model.levels.flatMap((lv) => lv.spaces);
  const out = [];
  for (const [kind, kinds] of picks) {
    const sp = kinds.map((k) => spaces.find((x) => x.kind === k)).find(Boolean);
    if (sp) out.push({ kind, sp });
  }
  return out.slice(0, 4);
}

/** One wall elevation drawn into a panel (x0, y0 = top-left, pw × ph px). */
function wallElevation(model, { kind, sp }, x0, y0, pw, ph, letter) {
  const r = inner(model, sp);
  const wallW = Math.min(Math.max(r.w, 2.4), 8.5);
  const H = roomFinish(model, sp).ch;
  const s = Math.min((pw - 90) / wallW, (ph - 120) / (H + 0.2));
  const ox = x0 + 60 + (pw - 90 - wallW * s) / 2, gy = y0 + 46 + (H + 0.1) * s;
  const X = (m) => f1(ox + m * s), Y = (z) => f1(gy - z * s);
  const c = (code) => matOf(model, code);
  const R = (x, z, w, h, fill, extra = "") => (w > 0 && h > 0 ? `<rect x="${X(x)}" y="${Y(z + h)}" width="${f1(w * s)}" height="${f1(h * s)}" fill="${fill}" ${extra.includes("stroke=") ? "" : `stroke="${INK}" stroke-width="0.8"`} ${extra}/>` : "");
  const P = (x, z, w, h, code) => (patternFill(c(code).pattern) ? R(x, z, w, h, patternFill(c(code).pattern), 'stroke="none"') : "");
  const M = (x, z, w, h, code, extra = "") => R(x, z, w, h, c(code).fill, extra) + P(x, z, w, h, code);
  const tags = [];
  const tag = (x, z, code) => tags.push([x, z, code]);
  let g = "";
  // wall, ceiling and floor
  const wet = kind === "vanity" || kind === "wash" || kind === "surgery";
  g += M(0, 0, wallW, H, "W1");
  tag(0.3, H - 0.35, "W1");
  if (wet) {
    g += M(0, 0, wallW, Math.min(2.4, H), "F2");
    tag(0.35, 2.0, "F2");
  }
  const feature = (x, w, z0 = 0, z1 = H) => {
    g += M(x, z0, w, z1 - z0, "W2");
    tag(x + w - 0.3, z1 - 0.45, "W2");
  };
  const pendant = (x, z) => (g += `<line x1="${X(x)}" y1="${Y(H)}" x2="${X(x)}" y2="${Y(z + 0.3)}" stroke="${INK}" stroke-width="0.8"/><path d="M${X(x - 0.22)} ${Y(z)} Q${X(x)} ${Y(z + 0.42)} ${X(x + 0.22)} ${Y(z)} Z" fill="${c("M1").fill}" stroke="${INK}" stroke-width="0.8"/>`);
  const cab = (x, z, w, h, code, n) => {
    g += M(x, z, w, h, code);
    for (let i = 1; i < n; i++) g += `<line x1="${X(x + (w * i) / n)}" y1="${Y(z)}" x2="${X(x + (w * i) / n)}" y2="${Y(z + h)}" stroke="${INK}" stroke-width="0.6"/>`;
  };
  const mid = wallW / 2;
  switch (kind) {
    case "media": {
      const fw = Math.min(wallW * 0.55, 3.6);
      feature(mid - fw / 2, fw);
      const uw = Math.min(wallW * 0.8, 4.2);
      cab(mid - uw / 2, 0.12, uw, 0.42, "J1", 4);
      tag(mid - uw / 2 + 0.3, 0.3, "J1");
      g += R(mid - 0.75, 1.05, 1.5, 0.86, "#1d1d1d");
      if (wallW > 4) for (let z = 0.8; z < H - 0.6; z += 0.55) g += M(mid + fw / 2 + 0.25, z, Math.min(1.2, wallW - mid - fw / 2 - 0.45), 0.04, "J1");
      break;
    }
    case "kitchen": {
      const tall = Math.min(1.2, wallW * 0.25);
      const run = wallW - tall;
      cab(0, 0.1, run, 0.8, "J1", Math.max(2, Math.round(run / 0.6)));
      g += M(0, 0.9, run, 0.04, "S1");
      g += M(0, 0.94, run, 0.6, "S1");
      tag(0.4, 1.25, "S1");
      cab(0, 1.54, run * 0.55, 0.72, "J1", Math.max(1, Math.round((run * 0.55) / 0.6)));
      tag(0.35, 1.9, "J1");
      g += R(run * 0.6, 1.62, 0.9, 0.62, c("M1").fill);
      g += R(run * 0.6 + 0.05, 0.94, 0.8, 0.03, INK);
      cab(run, 0, tall, 2.3, "J1", 2);
      g += R(run * 0.25, 0.9, 0.6, 0.06, "#cfd4d6");
      break;
    }
    case "bed": {
      const bw = sp.kind === "master" ? 1.8 : 1.6;
      const hw = Math.min(wallW - 0.4, bw + 1.6);
      feature(mid - hw / 2 - 0.3, hw + 0.6, 0, H);
      g += M(mid - hw / 2, 0.35, hw, 0.9, "T1");
      for (let x = mid - hw / 2 + 0.25; x < mid + hw / 2; x += 0.25) g += `<line x1="${X(x)}" y1="${Y(0.35)}" x2="${X(x)}" y2="${Y(1.25)}" stroke="${INK}" stroke-opacity=".35" stroke-width="0.6"/>`;
      tag(mid + hw / 2 - 0.25, 1.0, "T1");
      g += R(mid - bw / 2, 0.15, bw, 0.4, "#f4f2ee");
      for (const sx of [mid - bw / 2 - 0.55, mid + bw / 2 + 0.1]) g += M(sx, 0.05, 0.45, 0.48, "J1");
      pendant(mid - bw / 2 - 0.32, 1.25);
      pendant(mid + bw / 2 + 0.32, 1.25);
      break;
    }
    case "vanity": {
      const vw = Math.min(1.4, wallW * 0.45);
      g += M(0.3, 0.45, vw, 0.4, "J1") + M(0.25, 0.85, vw + 0.1, 0.05, "S1");
      tag(0.5, 0.65, "J1");
      g += R(0.3 + vw / 2 - 0.25, 0.9, 0.5, 0.1, "#ffffff");
      g += R(0.35, 1.15, vw - 0.1, 0.8, "#dfe7ea") + R(0.35, 1.97, vw - 0.1, 0.03, c("M1").fill);
      if (wallW > 2.4) g += R(wallW - 1.0, 0, 0.9, 2.0, "#e4eef0", 'fill-opacity=".55"') + R(wallW - 1.4, 0.4, 0.38, 0.4, "#ffffff");
      break;
    }
    case "bar": {
      const cw = Math.min(wallW - 0.6, 6.0);
      g += M(mid - cw / 2, 1.45, cw, 0.04, "S1") + M(mid - cw / 2, 1.9, cw, 0.04, "S1");
      tag(mid - cw / 2 + 0.3, 1.7, "S1");
      g += M(mid - cw / 2, 0, cw, 1.1, "J1");
      for (let x = mid - cw / 2 + 0.12; x < mid + cw / 2; x += 0.12) g += `<line x1="${X(x)}" y1="${Y(0.05)}" x2="${X(x)}" y2="${Y(1.05)}" stroke="${INK}" stroke-opacity=".3" stroke-width="0.6"/>`;
      g += M(mid - cw / 2 - 0.05, 1.1, cw + 0.1, 0.06, "S1");
      tag(mid + cw / 2 - 0.4, 0.5, "J1");
      for (let i = 0; i < 3; i++) pendant(mid - cw / 2 + (cw * (i + 0.5)) / 3, 2.05);
      for (let sx = mid - cw / 2 + 0.4; sx < mid + cw / 2 - 0.2; sx += 0.75) g += R(sx - 0.18, 0.72, 0.36, 0.05, c("M1").fill) + `<line x1="${X(sx)}" y1="${Y(0)}" x2="${X(sx)}" y2="${Y(0.72)}" stroke="${INK}" stroke-width="1"/>`;
      break;
    }
    case "banquette": {
      feature(0, wallW, 0, 1.1);
      g += M(0.1, 0.42, wallW - 0.2, 0.5, "T1") + M(0.1, 0, wallW - 0.2, 0.42, "J1");
      tag(wallW * 0.5, 0.65, "T1");
      for (let x = 0.9; x < wallW - 0.5; x += 1.6) g += R(x - 0.35, 0.72, 0.7, 0.04, c("S1").fill) + `<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${Y(0.72)}" stroke="${INK}" stroke-width="1"/>`;
      for (let x = 0.9; x < wallW - 0.5; x += 1.6) g += R(x - 0.3, 1.5, 0.6, 0.8, c("W2").fill) + P(x - 0.3, 1.5, 0.6, 0.8, "W2");
      break;
    }
    case "desk": {
      const dw = Math.min(wallW * 0.6, 3.2);
      feature(mid - dw / 2 - 0.4, dw + 0.8, 1.2, H - 0.2);
      g += R(mid - 0.8, 1.7, 1.6, 0.45, PAPER, 'stroke-dasharray="4 3"');
      g += M(mid - dw / 2, 0, dw, 1.05, "J1") + M(mid - dw / 2 - 0.05, 1.05, dw + 0.1, 0.06, "S1");
      tag(mid - dw / 2 + 0.3, 0.5, "J1");
      tag(mid + dw / 2 - 0.2, 1.08, "S1");
      pendant(mid - dw * 0.25, 1.75);
      pendant(mid + dw * 0.25, 1.75);
      break;
    }
    case "storage": {
      cab(0.1, 0, wallW - 0.2, 0.75, "J1", Math.max(2, Math.round((wallW - 0.2) / 0.8)));
      tag(0.5, 0.4, "J1");
      for (let x = 0.3; x + 0.9 < wallW - 0.2; x += 1.1) g += M(x, 1.3, 0.9, 0.9, "T1");
      tag(1.2, 1.75, "T1");
      break;
    }
    case "display": {
      g += M(0.1, 0, wallW - 0.2, 2.4, "J1");
      for (let x = 0.1; x < wallW - 0.1; x += 1.0) g += R(x, 0, 0.04, 2.4, c("M1").fill);
      for (const z of [0.45, 1.05, 1.65, 2.2]) g += R(0.1, z, wallW - 0.2, 0.03, c("M1").fill);
      g += M(wallW * 0.4, 0.3, Math.min(1.6, wallW * 0.2), 2.0, "W2");
      tag(0.4, 1.3, "J1");
      tag(wallW * 0.4 + 0.3, 2.0, "W2");
      tag(1.2, 2.2, "M1");
      break;
    }
    case "fitting": {
      const n = Math.max(2, Math.floor(wallW / 1.3));
      for (let i = 0; i < n; i++) {
        const x = 0.15 + (i * (wallW - 0.3)) / n, w = (wallW - 0.3) / n - 0.08;
        g += M(x, 0.1, w, 2.1, "T1") + R(x, 2.2, w, 0.05, c("M1").fill);
      }
      tag(0.5, 1.2, "T1");
      tag(wallW - 0.5, 2.25, "M1");
      break;
    }
    case "surgery": {
      cab(0.1, 0.1, wallW - 0.2, 0.8, "J1", Math.max(2, Math.round(wallW / 0.6)));
      g += M(0.1, 0.9, wallW - 0.2, 0.04, "S1");
      cab(0.1, 1.5, wallW * 0.6, 0.7, "J1", 3);
      g += R(wallW * 0.7, 1.3, 0.7, 0.45, "#1d1d1d");
      g += R(0.4, 0.94, 0.5, 0.06, "#cfd4d6");
      tag(0.5, 0.5, "J1");
      tag(wallW * 0.3, 0.93, "S1");
      break;
    }
    case "bench": {
      feature(0.2, wallW - 0.4, 0.95, H - 0.3);
      g += M(0.3, 0.45, wallW - 0.6, 0.05, "J1") + M(0.3, 0, wallW - 0.6, 0.45, "T1");
      tag(0.6, 0.25, "T1");
      break;
    }
    case "stations": {
      for (let x = 0.5; x + 0.9 < wallW; x += 1.6) {
        g += `<circle cx="${X(x + 0.45)}" cy="${Y(1.55)}" r="${f1(0.42 * s)}" fill="#dfe7ea" stroke="${c("M1").fill}" stroke-width="${f1(Math.max(1.5, 0.04 * s))}"/>`;
        g += M(x, 0.75, 0.9, 0.06, "S1") + M(x + 0.05, 0.35, 0.8, 0.4, "J1");
      }
      tag(0.9, 0.55, "J1");
      tag(1.2, 0.78, "S1");
      tag(0.95, 1.95, "M1");
      break;
    }
    case "wash": {
      for (let x = 0.4; x + 0.8 < wallW; x += 1.2) g += M(x, 0, 0.8, 0.85, "J1") + R(x + 0.1, 0.85, 0.6, 0.12, "#ffffff");
      g += M(0.2, 1.5, wallW - 0.4, 0.03, "J1");
      tag(0.7, 0.4, "J1");
      break;
    }
    case "nails": {
      const tw = Math.min(wallW - 0.6, 3.6);
      g += M(mid - tw / 2, 0.72, tw, 0.05, "S1") + M(mid - tw / 2, 0, tw, 0.72, "J1");
      for (const z of [1.2, 1.5, 1.8]) g += M(0.3, z, wallW - 0.6, 0.03, "J1");
      for (let i = 0; i < 4; i++) pendant(mid - tw / 2 + (tw * (i + 0.5)) / 4, 1.6);
      tag(mid - tw / 2 + 0.3, 0.75, "S1");
      tag(mid + tw / 2 - 0.3, 0.35, "J1");
      break;
    }
  }
  // skirting, ceiling and floor lines
  g += R(0, 0, wallW, 0.08, shade(c("W1").fill, -0.18));
  g += `<line x1="${X(-0.4)}" y1="${Y(0)}" x2="${X(wallW + 0.4)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2.2"/><line x1="${X(-0.4)}" y1="${Y(H)}" x2="${X(wallW + 0.4)}" y2="${Y(H)}" stroke="${INK}" stroke-width="1.6"/>`;
  g += `<rect x="${X(-0.4)}" y="${Y(0)}" width="${f1((wallW + 0.8) * s)}" height="8" fill="url(#p-earth)"/>`;
  // material tags
  for (const [tx, tz, code] of tags) g += `<g font-family="${FONT}"><circle cx="${X(tx)}" cy="${Y(tz)}" r="10" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/><text x="${X(tx)}" y="${f1(+Y(tz) + 3.5)}" text-anchor="middle" font-size="8.5" font-weight="600" fill="${INK}">${code}</text></g>`;
  // dimensions: width below, ceiling height on the left
  const dy = +Y(0) + 26;
  g += `<g stroke="${INK}" stroke-width="0.7" font-family="${FONT}" font-size="10" fill="${INK}"><line x1="${X(0)}" y1="${dy}" x2="${X(wallW)}" y2="${dy}"/><line x1="${X(0)}" y1="${dy - 6}" x2="${X(0)}" y2="${dy + 6}"/><line x1="${X(wallW)}" y1="${dy - 6}" x2="${X(wallW)}" y2="${dy + 6}"/>
    <text x="${f1((+X(0) + +X(wallW)) / 2)}" y="${dy - 5}" text-anchor="middle" stroke="none">${(wallW * 1000).toFixed(0)}</text>
    <line x1="${f1(+X(0) - 26)}" y1="${Y(0)}" x2="${f1(+X(0) - 26)}" y2="${Y(H)}"/><line x1="${f1(+X(0) - 32)}" y1="${Y(H)}" x2="${f1(+X(0) - 20)}" y2="${Y(H)}"/><line x1="${f1(+X(0) - 32)}" y1="${Y(0)}" x2="${f1(+X(0) - 20)}" y2="${Y(0)}"/>
    <text x="${f1(+X(0) - 30)}" y="${f1((+Y(0) + +Y(H)) / 2)}" text-anchor="middle" stroke="none" transform="rotate(-90 ${f1(+X(0) - 30)} ${f1((+Y(0) + +Y(H)) / 2)})">CH ${(H * 1000).toFixed(0)}</text></g>`;
  // panel title
  g += `<g font-family="${FONT}"><circle cx="${x0 + 18}" cy="${y0 + 14}" r="13" fill="none" stroke="${INK}" stroke-width="1"/><text x="${x0 + 18}" y="${y0 + 19}" text-anchor="middle" font-size="13" font-weight="600" fill="${INK}">${letter}</text>
    <text x="${x0 + 40}" y="${y0 + 12}" font-size="12" font-weight="600" letter-spacing="1.5" fill="${INK}">${esc(sp.label)} — ${ELEVATIONS[kind]}</text>
    <text x="${x0 + 40}" y="${y0 + 28}" font-size="10" letter-spacing="1.2" fill="${MID}">INTERIOR ELEVATION · DIMENSIONS IN MILLIMETRES</text></g>`;
  return g;
}

export function interiorElevationsSheet(model, sheetNo, { preview = false } = {}) {
  const { plan } = model;
  const picks = elevationPicks(model);
  const areaW = SHEET_W - 330 - 36 - 50, areaH = SHEET_H - 72 - 130;
  const pw = areaW / 2, ph = areaH / 2;
  let g = "";
  picks.forEach((pk, i) => (g += wallElevation(model, pk, 36 + 24 + (i % 2) * pw, 36 + 22 + Math.floor(i / 2) * ph, pw, ph, "ABCD"[i])));
  const legend = paletteOf(model).materials.map((m) => ({ fill: m.fill, pattern: m.pattern && m.pattern !== "plain" ? `ip-${m.pattern}` : null, label: `${m.code}  ${m.name.split(",")[0]}` }));
  legend.title = "MATERIALS";
  g += sheetTitle("INTERIOR ELEVATIONS", `${plan.title.en.toUpperCase()} · ${paletteOf(model).name} · MATERIAL CODES AS ON THE MATERIALS BOARD (A-501)`);
  return sheet({ plan, drawing: "INTERIOR ELEVATIONS", sheetNo, scaleNote: "GRAPHIC", body: g, defs: interiorDefs(60) + materialDefs(28), north: false, legend, preview });
}

// ------------------------------------------------------------------ materials board

export function materialsSheet(model, sheetNo, { preview = false } = {}) {
  const { plan } = model;
  const pal = paletteOf(model);
  const S = 210; // px per metre on the swatches
  let g = "";
  const x0 = 36 + 50, y0 = 36 + 46, tw = 250, th = 150, gx = 24, gy = 86;
  g += `<text x="${x0}" y="${y0 - 10}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="2.5" fill="${INK}">${pal.name} — MATERIALS</text>`;
  pal.materials.forEach((mt, i) => {
    const x = x0 + (i % 4) * (tw + gx), y = y0 + Math.floor(i / 4) * (th + gy);
    g += `<rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${mt.fill}" stroke="${INK}" stroke-width="0.8"/>`;
    if (patternFill(mt.pattern, "sw")) g += `<rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${patternFill(mt.pattern, "sw")}"/>`;
    g += `<rect x="${x + 10}" y="${y + 10}" width="34" height="22" fill="${PAPER}" fill-opacity=".9"/><text x="${x + 27}" y="${y + 26}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${INK}">${mt.code}</text>`;
    wrap(mt.name, 36).forEach((line, j) => (g += `<text x="${x}" y="${y + th + 20 + j * 15}" font-family="${FONT}" font-size="11.5" font-weight="${j ? 400 : 600}" fill="${INK}">${esc(line)}</text>`));
    g += `<text x="${x}" y="${y + th + 52}" font-family="${FONT}" font-size="10" fill="${MID}">${esc(mt.use)}</text>`;
  });
  // colour palette strip
  const cy = y0 + 2 * (th + gy) + 6;
  g += `<text x="${x0}" y="${cy}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="2.5" fill="${INK}">COLOUR PALETTE</text>`;
  pal.colours.forEach(([name, hex], i) => {
    const x = x0 + i * 206;
    g += `<rect x="${x}" y="${cy + 14}" width="190" height="64" fill="${hex}" stroke="${INK}" stroke-width="0.8"/><text x="${x}" y="${cy + 96}" font-family="${FONT}" font-size="11.5" font-weight="600" fill="${INK}">${esc(name)}</text><text x="${x}" y="${cy + 111}" font-family="${FONT}" font-size="10" fill="${MID}">${hex.toUpperCase()}</text>`;
  });
  // design statement and lighting
  const ty = cy + 150;
  g += `<text x="${x0}" y="${ty}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing="2.5" fill="${INK}">DESIGN INTENT</text>`;
  wrap(pal.concept, 110).forEach((line, i) => (g += `<text x="${x0}" y="${ty + 22 + i * 17}" font-family="${FONT}" font-size="12" fill="${INK}">${esc(line)}</text>`));
  g += `<text x="${x0}" y="${ty + 80}" font-family="${FONT}" font-size="11" fill="${MID}">LIGHTING: ${esc(pal.light)}</text>`;
  g += sheetTitle("MATERIALS AND COLOUR PALETTE", `${plan.title.en.toUpperCase()} · ${pal.name} · SAMPLES TO BE APPROVED BEFORE ORDERING`);
  return sheet({ plan, drawing: "MATERIALS BOARD", sheetNo, scaleNote: "NTS", body: g, defs: interiorDefs(S, "sw"), north: false, preview });
}

// ------------------------------------------------------------------ schedules

/** Furniture, fixtures and equipment per room kind: [item, quantity, material codes]. */
const FFE = {
  master: [["Bed 180 × 200, upholstered headboard", 1, "T1"], ["Bedside table", 2, "J1"], ["Built-in wardrobe", 1, "J1"]],
  bedroom: [["Bed 160 × 200 or single", 1, "T1"], ["Bedside table", 1, "J1"], ["Built-in wardrobe", 1, "J1"]],
  living: [["Sofa, three-seat", 1, "T1"], ["Coffee table", 1, "J1 / S1"], ["Media unit", 1, "J1"], ["Rug", 1, "T1"]],
  open: [["Kitchen run with appliances", 1, "J1 / S1"], ["Island", 1, "S1"], ["Dining table", 1, "J1"], ["Dining chair", 6, "T1"], ["Sofa, three-seat", 1, "T1"], ["Coffee table", 1, "J1"]],
  kitchen: [["Kitchen run with appliances", 1, "J1 / S1"], ["Island with stools", 1, "S1"]],
  dining: [["Dining table", 1, "J1"], ["Dining chair", 6, "T1"]],
  bath: [["Vanity unit with basin", 1, "J1 / S1"], ["Bath or walk-in shower", 1, "F2"], ["WC, wall-hung", 1, "—"], ["Mirror with light", 1, "M1"]],
  shower: [["Shower enclosure", 1, "F2"], ["WC, wall-hung", 1, "—"], ["Basin", 1, "S1"]],
  wc: [["WC, wall-hung", 1, "—"], ["Basin with mirror", 1, "S1 / M1"]],
  study: [["Desk with chair", 1, "J1"], ["Bookcase", 1, "J1"]],
  hall: [["Console or bench", 1, "J1"]],
  teahall: [["Banquette along the wall", 1, "T1 / J1"], ["Cafe table, round", 0, "S1"], ["Cafe chair", 0, "T1"]],
  bar: [["Bar counter", 1, "J1 / S1"], ["Back bar shelving", 1, "J1 / M1"], ["Bar stool", 0, "M1 / T1"]],
  lounge: [["Sofa or banquette", 1, "T1"], ["Low table", 1, "J1"], ["Armchair", 2, "T1"]],
  prep: [["Stainless steel worktops and appliances", 1, "M1"]],
  kitchenette: [["Kitchenette run", 1, "J1 / S1"], ["Table with chairs", 1, "J1"]],
  reception: [["Reception desk", 1, "J1 / S1"], ["Visitor sofa", 1, "T1"]],
  openoffice: [["Desk cluster of four", 0, "J1"], ["Task chair", 0, "T1"]],
  meeting: [["Meeting table", 1, "J1"], ["Meeting chair", 0, "T1"], ["Screen", 1, "—"]],
  director: [["Executive desk", 1, "J1"], ["Bookcase", 1, "J1"], ["Sofa", 1, "T1"]],
  office: [["Desk with chair", 1, "J1"]],
  boutique: [["Wall shelving and rails", 1, "J1 / M1"], ["Display table", 2, "S1"], ["Cash desk", 1, "W2 / S1"]],
  fitting: [["Fitting cubicle with curtain and mirror", 0, "T1 / M1"], ["Bench", 1, "T1"]],
  treatment: [["Treatment chair", 1, "T1"], ["Cabinet run with sink", 1, "J1 / S1"]],
  styling: [["Styling station with mirror", 0, "J1 / M1"], ["Styling chair", 0, "T1"]],
  wash: [["Backwash unit", 0, "J1 / T1"]],
  nails: [["Nail table", 1, "S1 / J1"], ["Nail chair", 0, "T1"]],
  staff: [["Table with chairs", 1, "J1"]],
  racks: [["Shelving", 0, "M1"]],
  store: [["Shelving", 1, "M1"]],
};

/** Quantities that depend on the room size (counted from the furniture blocks). */
function ffeQuantity(kind, item, inn, qty) {
  if (qty) return qty;
  const blocks = furnitureBlocks(kind, inn);
  if (/table, round/.test(item)) return blocks.filter((b) => b[6] === "stone").length;
  if (/Cafe chair|Meeting chair|Task chair|Styling chair|Nail chair/.test(item)) return Math.max(2, blocks.filter((b) => b[6] === "fabric").length);
  if (/Bar stool/.test(item)) return blocks.filter((b) => b[6] === "metal").length;
  if (/Desk cluster/.test(item)) return blocks.filter((b) => b[6] === "wood").length;
  if (/Fitting cubicle/.test(item)) return Math.max(2, Math.floor(inn.h / 1.5));
  if (/Styling station/.test(item)) return blocks.filter((b) => b[6] === "wood").length;
  if (/Backwash/.test(item)) return blocks.filter((b) => b[6] === "white").length;
  if (/Shelving/.test(item)) return Math.max(1, blocks.length);
  return 1;
}

export function interiorScheduleSheet(model, sheetNo) {
  const { plan } = model;
  const sc = schedules(model);
  let g = "";
  const L = 70;
  // finishes by room (repeat rooms on several floors keep their own numbers)
  const finRows = [];
  model.levels.forEach((lv, li) => {
    for (const sp of lv.spaces) {
      if (sp.kind === "stair" || sp.kind === "void") continue;
      const room = sc.rooms.find((r) => r.level === li && r.id === sp.id);
      const f = roomFinish(model, sp);
      finRows.push([room?.no ?? "", sp.label, room ? room.area.toFixed(1) : "", f.floor, f.walls, f.ch.toFixed(2)]);
    }
  });
  const many = finRows.length > 18;
  const fin = table(L, 84, [{ label: "NO.", w: 44 }, { label: "ROOM", w: 150 }, { label: "m²", w: 46, right: true }, { label: "FLOOR", w: 50 }, { label: "WALLS", w: 190 }, { label: "CH", w: 44, right: true }], finRows, { title: "FINISHES SCHEDULE", size: many ? 8.6 : 9.8, rowH: many ? 12.5 : 15 });
  g += fin.svg;
  const note = wrap(`Ceilings: ${paletteOf(model).ceiling}; wet rooms moisture-resistant plasterboard. Skirting: ${paletteOf(model).skirting}.`, 100);
  note.forEach((line, i) => (g += `<text x="${L}" y="${fin.bottom + 18 + i * 13}" font-family="${FONT}" font-size="9.5" fill="${MID}">${esc(line)}</text>`));
  // lighting
  const lit = table(L, fin.bottom + 40 + note.length * 13, [{ label: "TYPE", w: 44 }, { label: "FITTING", w: 380 }, { label: "QTY", w: 60, right: true }], lightingSchedule(model).map(([a, b, n]) => [a, b, String(n)]), { title: "LIGHTING SCHEDULE", size: 9.8, rowH: 15 });
  g += lit.svg;
  // furniture, fixtures and equipment (aggregated)
  const agg = new Map();
  for (const lv of model.levels) for (const sp of lv.spaces) for (const [item, qty, codes] of FFE[sp.kind] ?? []) {
    const n = ffeQuantity(sp.kind, item, inner(model, sp), qty);
    const k = `${item}|${codes}`;
    agg.set(k, (agg.get(k) ?? 0) + n);
  }
  const ffeRows = [...agg.entries()].map(([k, n], i) => {
    const [item, codes] = k.split("|");
    return [`FF${String(i + 1).padStart(2, "0")}`, item, codes, String(n)];
  });
  const R = 660;
  const ffe = table(R, 84, [{ label: "NO.", w: 50 }, { label: "ITEM", w: 290 }, { label: "MATERIAL", w: 90 }, { label: "QTY", w: 50, right: true }], ffeRows, { title: "FURNITURE, FIXTURES AND EQUIPMENT", size: ffeRows.length > 24 ? 8.8 : 9.8, rowH: ffeRows.length > 24 ? 13 : 15.5 });
  g += ffe.svg;
  g += `<text x="${L}" y="${SHEET_H - 112}" font-family="${FONT}" font-size="10" fill="${MID}">Material codes refer to the materials board (A-501). Quantities are for the concept layout and are to be confirmed with the supplier.</text>`;
  g += sheetTitle("SCHEDULES", `${plan.title.en.toUpperCase()} · FINISHES · LIGHTING · FURNITURE, FIXTURES AND EQUIPMENT`);
  return sheet({ plan, drawing: "INTERIOR SCHEDULES", sheetNo, scaleNote: "NTS", body: g, north: false });
}

// ------------------------------------------------------------------ the interior drawing set

/** Sheets of an interior package in order; kind = gallery key on the website. */
export function interiorSheets(model) {
  const list = [];
  const L = model.levels;
  const label = (lv, what) => (lv.floorName ? `${lv.floorName.charAt(0)}${lv.floorName.slice(1).toLowerCase()} — ${what}` : what.charAt(0).toUpperCase() + what.slice(1));
  L.forEach((lv, i) => list.push({ kind: `plan-${i}`, no: `A-10${i + 1}`, title: label(lv, "furniture layout"), scale: "Graphic", svg: (o = {}) => floorPlanSheet(model, i, `A-10${i + 1}`, o) }));
  L.forEach((lv, i) => list.push({ kind: `finish-${i}`, no: `A-11${i + 1}`, title: label(lv, "finishes plan"), scale: "Graphic", svg: (o = {}) => floorPlanSheet(model, i, `A-11${i + 1}`, { ...o, mode: "finish" }) }));
  L.forEach((lv, i) => list.push({ kind: `ceiling-${i}`, no: `A-12${i + 1}`, title: label(lv, "ceiling and lighting plan"), scale: "Graphic", svg: (o = {}) => floorPlanSheet(model, i, `A-12${i + 1}`, { ...o, mode: "ceiling" }) }));
  list.push({ kind: "interior", no: "A-201", title: "Interior elevations", scale: "Graphic", svg: (o = {}) => interiorElevationsSheet(model, "A-201", o) });
  list.push({ kind: "cutaway", no: "A-301", title: "Cutaway axonometric", scale: "NTS", svg: (o = {}) => cutawaySheet(model, "A-301", o) });
  list.push({ kind: "schedules", no: "A-401", title: "Finishes, lighting and FF&E schedules", scale: "NTS", svg: () => interiorScheduleSheet(model, "A-401") });
  list.push({ kind: "materials", no: "A-501", title: "Materials and colour palette", scale: "NTS", svg: (o = {}) => materialsSheet(model, "A-501", o) });
  return list;
}
