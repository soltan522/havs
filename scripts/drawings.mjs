// Concept drawing generator for demo plans.
// Produces CAD-style sheets (floor plans, front elevation, axonometric massing) from a simple
// building model, so every sheet of a plan is geometrically consistent with the others.
// Units in the model are metres; each renderer maps them to pixels.

export const SHEET_W = 1600;
export const SHEET_H = 1067;
export const COVER_W = 1600;
export const COVER_H = 1200;

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
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ------------------------------------------------------------------ model

/** Builds footprint, levels (spaces, doors, windows) and extras for a plan. */
export function buildModel(plan) {
  const above = plan.style === "luxury" ? plan.floors - 1 : plan.floors;
  const footprintArea = plan.areaM2 / plan.floors;
  const ratio = plan.roof === "aframe" ? 0.95 : plan.style === "duplex" ? 2.0 : above === 1 ? 1.7 : 1.4;
  const W = r1(Math.sqrt(footprintArea * ratio));
  const D = r1(footprintArea / W);

  let levels;
  if (plan.roof === "aframe") levels = chaletLevels();
  else if (plan.style === "duplex") levels = duplexLevels();
  else if (above === 1) levels = [singleStorey(plan)];
  else levels = twoStorey(plan);

  // fractions -> metres
  for (const lv of levels) {
    for (const s of lv.spaces) {
      s.x *= W; s.y *= D; s.w *= W; s.h *= D;
    }
  }

  const garage = plan.garage ? { w: plan.style === "luxury" ? 6.4 : 3.6, d: 6.2 } : null;
  const pool = plan.pool ? { w: Math.min(10, W * 0.7), d: 4 } : null;
  return { plan, W, D, above, levels, garage, pool, basement: plan.style === "luxury" };
}

// Each template uses fractions of the footprint. y = 0 is the back facade, y = 1 the front (entrance).
function twoStorey(plan) {
  const guestDown = plan.bedrooms >= 4;
  const up = plan.bedrooms - (guestDown ? 1 : 0);
  const ground = {
    name: "GROUND FLOOR PLAN",
    spaces: [
      { id: "open", label: "LIVING / DINING / KITCHEN", kind: "open", x: 0, y: 0, w: 0.6, h: 1 },
      { id: "back", label: guestDown ? "GUEST BEDROOM" : "STUDY", kind: guestDown ? "bedroom" : "study", x: 0.6, y: 0, w: 0.4, h: 0.4 },
      { id: "hall", label: "ENTRANCE HALL", kind: "hall", x: 0.6, y: 0.4, w: 0.2, h: 0.6 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.8, y: 0.4, w: 0.2, h: 0.24 },
      { id: "wc", label: guestDown ? "SHOWER" : "WC", kind: guestDown ? "shower" : "wc", x: 0.8, y: 0.64, w: 0.2, h: 0.36 },
    ],
    doors: [
      { space: "hall", side: "bottom", at: 0.5, w: 1.1, entry: true },
      { space: "hall", side: "left", at: 0.45, w: 1.6, open: true },
      { space: "back", side: "bottom", at: 0.25, w: 0.9 },
      { space: "wc", side: "left", at: 0.3, w: 0.8 },
      { space: "stair", side: "left", at: 0.5, w: 1.0, open: true },
    ],
    windows: [
      { space: "open", side: "bottom", at: 0.3, w: 3.4 },
      { space: "open", side: "bottom", at: 0.78, w: 1.8 },
      { space: "open", side: "left", at: 0.55, w: 2.4 },
      { space: "open", side: "top", at: 0.3, w: 2.2 },
      { space: "open", side: "top", at: 0.75, w: 1.6 },
      { space: "back", side: "top", at: 0.5, w: 1.6 },
      { space: "back", side: "right", at: 0.5, w: 1.2 },
      { space: "wc", side: "bottom", at: 0.5, w: 0.6 },
    ],
  };

  const backRooms = Math.max(0, up - 2);
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
      { space: "master", side: "bottom", at: 0.5, w: 2.6 },
      { space: "master", side: "left", at: 0.5, w: 1.4 },
      { space: "bed2", side: "bottom", at: 0.5, w: 1.8 },
      { space: "bath2", side: "bottom", at: 0.5, w: 0.6 },
      { space: "ensuite", side: "left", at: 0.5, w: 0.6 },
    ],
  };
  // back row: remaining bedrooms + a family room / study when space is left over
  const backCount = Math.max(1, backRooms);
  const names = [];
  for (let i = 0; i < backRooms; i++) names.push(["BEDROOM", "bedroom"]);
  if (backRooms === 0) names.push(["FAMILY ROOM", "study"]);
  if (backRooms === 1) names.push(["STUDY", "study"]);
  const cells = names.length;
  names.forEach(([label, kind], i) => {
    const id = `b${i}`;
    first.spaces.push({ id, label, kind, x: i / cells, y: 0, w: 1 / cells, h: 0.4 });
    first.doors.push({ space: id, side: "bottom", at: i === 0 ? 0.8 : i === cells - 1 ? 0.25 : 0.5, w: 0.9 });
    first.windows.push({ space: id, side: "top", at: 0.5, w: Math.min(2, 1.4 + 0.2 * cells) });
  });
  void backCount;
  return [ground, first];
}

function singleStorey(plan) {
  if (plan.bedrooms >= 3) {
    // Corridor plan: living wing on the left, bedroom wing on the right served by one corridor.
    return {
      name: "GROUND FLOOR PLAN",
      veranda: plan.style === "farmhouse",
      spaces: [
        { id: "open", label: "LIVING / DINING / KITCHEN", kind: "open", x: 0, y: 0, w: 0.45, h: 1 },
        { id: "hall", label: "ENTRANCE HALL", kind: "hall", x: 0.45, y: 0.43, w: 0.13, h: 0.57 },
        { id: "corr", label: "CORRIDOR", kind: "hall", x: 0.58, y: 0.43, w: 0.42, h: 0.12 },
        { id: "master", label: "MASTER BEDROOM", kind: "master", x: 0.58, y: 0.55, w: 0.42, h: 0.45 },
        { id: "bedB", label: "BEDROOM", kind: "bedroom", x: 0.45, y: 0, w: 0.25, h: 0.43 },
        { id: "bath", label: "BATH", kind: "bath", x: 0.7, y: 0, w: 0.13, h: 0.43 },
        { id: "bedC", label: "BEDROOM", kind: "bedroom", x: 0.83, y: 0, w: 0.17, h: 0.43 },
      ],
      doors: [
        { space: "hall", side: "bottom", at: 0.5, w: 1.1, entry: true },
        { space: "hall", side: "left", at: 0.5, w: 1.8, open: true },
        { space: "corr", side: "left", at: 0.5, w: 1.2, open: true },
        { space: "master", side: "top", at: 0.15, w: 0.9 },
        { space: "bedB", side: "bottom", at: 0.8, w: 0.9 },
        { space: "bath", side: "bottom", at: 0.5, w: 0.8 },
        { space: "bedC", side: "bottom", at: 0.3, w: 0.9 },
      ],
      windows: [
        { space: "open", side: "bottom", at: 0.5, w: 3.0 },
        { space: "open", side: "left", at: 0.3, w: 1.8 },
        { space: "open", side: "left", at: 0.72, w: 1.8 },
        { space: "open", side: "top", at: 0.5, w: 1.8 },
        { space: "master", side: "bottom", at: 0.5, w: 2.2 },
        { space: "master", side: "right", at: 0.5, w: 1.2 },
        { space: "bedB", side: "top", at: 0.5, w: 1.6 },
        { space: "bath", side: "top", at: 0.5, w: 0.6 },
        { space: "bedC", side: "top", at: 0.5, w: 1.2 },
        { space: "bedC", side: "right", at: 0.5, w: 1.0 },
      ],
    };
  }
  // Compact two-bedroom plan: one hall serves both bedrooms and the bathroom.
  return {
    name: "GROUND FLOOR PLAN",
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
      { space: "open", side: "bottom", at: 0.5, w: 2.6 },
      { space: "open", side: "left", at: 0.3, w: 1.6 },
      { space: "open", side: "left", at: 0.75, w: 1.6 },
      { space: "open", side: "top", at: 0.5, w: 1.4 },
      { space: "bedB", side: "top", at: 0.5, w: 1.6 },
      { space: "bath", side: "right", at: 0.5, w: 0.6 },
      { space: "bedA", side: "bottom", at: 0.5, w: 1.8 },
    ],
  };
}

function chaletLevels() {
  const ground = {
    name: "GROUND FLOOR PLAN",
    spaces: [
      { id: "open", label: "LIVING / KITCHEN", kind: "open", x: 0, y: 0.38, w: 1, h: 0.62 },
      { id: "bed", label: "BEDROOM", kind: "bedroom", x: 0, y: 0, w: 0.5, h: 0.38 },
      { id: "bath", label: "BATH", kind: "bath", x: 0.5, y: 0, w: 0.26, h: 0.38 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.76, y: 0, w: 0.24, h: 0.38 },
    ],
    doors: [
      { space: "open", side: "bottom", at: 0.5, w: 1.0, entry: true },
      { space: "bed", side: "bottom", at: 0.75, w: 0.9 },
      { space: "bath", side: "bottom", at: 0.5, w: 0.8 },
      { space: "stair", side: "bottom", at: 0.5, w: 1.0, open: true },
    ],
    windows: [
      { space: "open", side: "bottom", at: 0.22, w: 2.0 },
      { space: "open", side: "bottom", at: 0.78, w: 2.0 },
      { space: "bed", side: "top", at: 0.5, w: 1.2 },
    ],
  };
  const mezz = {
    name: "MEZZANINE PLAN",
    spaces: [
      { id: "void", label: "VOID", kind: "void", x: 0, y: 0.38, w: 1, h: 0.62 },
      { id: "bed2", label: "BEDROOM", kind: "bedroom", x: 0, y: 0, w: 0.76, h: 0.38 },
      { id: "stair", label: "STAIR", kind: "stair", x: 0.76, y: 0, w: 0.24, h: 0.38 },
    ],
    doors: [{ space: "stair", side: "left", at: 0.5, w: 1.0, open: true }],
    windows: [{ space: "bed2", side: "top", at: 0.5, w: 1.4 }],
  };
  return [ground, mezz];
}

function duplexLevels() {
  // Two mirrored units. Templates are written in unit fractions (0..1) and mapped onto each half.
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
      { space: "open", side: "bottom", at: 0.5, w: 2.4 },
      { space: "open", side: "top", at: 0.5, w: 2.0 },
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
      { space: "m", side: "bottom", at: 0.5, w: 2.0 },
      { space: "b", side: "bottom", at: 0.5, w: 1.4 },
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
  // gable-end windows on the outer walls
  ground.windows.push({ space: "openL", side: "left", at: 0.5, w: 2.0 }, { space: "openR", side: "right", at: 0.5, w: 2.0 });
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

/** Drawing only, on a plain paper background (used for catalogue cards). */
function bareSvg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
    <rect width="100%" height="100%" fill="${PAPER}"/>${body}</svg>`);
}

// ------------------------------------------------------------------ sheet frame + title block

function sheet({ plan, drawing, sheetNo, scaleNote, body, north }) {
  const tbX = SHEET_W - 330;
  const rows = [
    ["PROJECT", plan.title.en.toUpperCase()],
    ["DRAWING", drawing],
    ["SCALE", scaleNote],
    ["SHEET", sheetNo],
    ["GROSS AREA", `${plan.areaM2} m²`],
    ["LEVELS / BEDROOMS", `${plan.floors} / ${plan.bedrooms}`],
  ];
  let tb = `<g font-family="${FONT}">
    <line x1="${tbX}" y1="36" x2="${tbX}" y2="${SHEET_H - 36}" stroke="${INK}" stroke-width="1.2"/>
    <g transform="translate(${tbX + 28} 74)">
      <rect x="0" y="-14" width="14" height="14" fill="none" stroke="${ACCENT}" stroke-width="1.6" transform="rotate(45 7 -7)"/>
      <text x="28" y="0" font-size="20" font-weight="600" fill="${INK}" letter-spacing="1">havs.dev</text>
      <text x="0" y="26" font-size="10.5" fill="${MID}" letter-spacing="2">VILLA PLANS · EXTERIOR DESIGN</text>
    </g>`;
  rows.forEach(([k, v], i) => {
    const y = 160 + i * 74;
    tb += `<line x1="${tbX}" y1="${y - 26}" x2="${SHEET_W - 36}" y2="${y - 26}" stroke="${LIGHT}"/>
      <text x="${tbX + 28}" y="${y}" font-size="10" fill="${MID}" letter-spacing="2">${k}</text>
      <text x="${tbX + 28}" y="${y + 26}" font-size="${i === 0 ? 19 : 16}" font-weight="${i === 0 ? 600 : 500}" fill="${i === 4 ? ACCENT : INK}" letter-spacing="0.5">${esc(v)}</text>`;
  });
  if (north) {
    tb += `<g transform="translate(${tbX + 165} ${SHEET_H - 250})"><circle r="30" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <path d="M0 -24 L9 14 L0 6 L-9 14 Z" fill="${INK}"/><text y="-38" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}">N</text></g>`;
  }
  tb += `<line x1="${tbX}" y1="${SHEET_H - 150}" x2="${SHEET_W - 36}" y2="${SHEET_H - 150}" stroke="${INK}" stroke-width="1.2"/>
    <text x="${tbX + 28}" y="${SHEET_H - 118}" font-size="10" fill="${MID}" letter-spacing="1.6">CONCEPT DESIGN</text>
    <text x="${tbX + 28}" y="${SHEET_H - 100}" font-size="10" fill="${MID}" letter-spacing="1.6">NOT FOR CONSTRUCTION</text>
    <text x="${tbX + 28}" y="${SHEET_H - 66}" font-size="10" fill="${MID}" letter-spacing="1.6">© havs.dev 2026</text>
  </g>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">
    <rect width="100%" height="100%" fill="${PAPER}"/>
    <rect x="24" y="24" width="${SHEET_W - 48}" height="${SHEET_H - 48}" fill="none" stroke="${INK}" stroke-width="0.8"/>
    <rect x="36" y="36" width="${SHEET_W - 72}" height="${SHEET_H - 72}" fill="none" stroke="${INK}" stroke-width="1.6"/>
    ${body}${tb}
  </svg>`);
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
    const label = (len).toFixed(2);
    g += horizontal
      ? `<text x="${x}" y="${y - 6 * labelSide}" text-anchor="middle" stroke="none" ${labelSide < 0 ? 'dominant-baseline="hanging"' : ""}>${label}</text>`
      : `<text x="${x - 6}" y="${y}" text-anchor="middle" stroke="none" transform="rotate(-90 ${x - 6} ${y})">${label}</text>`;
  }
  return g + "</g>";
}

// ------------------------------------------------------------------ furniture blocks (metres, drawn in px)

function furniture(model, s, kind, inn, px) {
  const { x, y, w, h } = inn;
  const R = (fx, fy, fw, fh, extra = "") => `<rect x="${px.X(fx)}" y="${px.Y(fy)}" width="${fw * s}" height="${fh * s}" fill="none" stroke="${MID}" stroke-width="0.9" ${extra}/>`;
  const C = (cx, cy, r) => `<circle cx="${px.X(cx)}" cy="${px.Y(cy)}" r="${r * s}" fill="none" stroke="${MID}" stroke-width="0.9"/>`;
  const L = (x1, y1, x2, y2, extra = "") => `<line x1="${px.X(x1)}" y1="${px.Y(y1)}" x2="${px.X(x2)}" y2="${px.Y(y2)}" stroke="${MID}" stroke-width="0.8" ${extra}/>`;
  let g = "";
  const bed = (bw) => {
    const bl = 2.05;
    if (w < bw + 0.4 || h < bl + 0.6) return "";
    const bx = x + (w - bw) / 2;
    const by = y + 0.05;
    let b = R(bx, by, bw, bl) + R(bx + 0.12, by + 0.12, bw / 2 - 0.18, 0.42, 'rx="3"') + R(bx + bw / 2 + 0.06, by + 0.12, bw / 2 - 0.18, 0.42, 'rx="3"');
    b += L(bx, by + 0.7, bx + bw, by + 0.7);
    if (w > bw + 1.4) b += R(bx - 0.55, by + 0.05, 0.45, 0.4) + R(bx + bw + 0.1, by + 0.05, 0.45, 0.4);
    if (h > bl + 1.8) {
      // wardrobe along the opposite wall
      const ww = Math.min(w - 0.4, 2.4);
      const wy = y + h - 0.62;
      b += R(x + 0.2, wy, ww, 0.6);
      for (let i = 1; i < 4; i++) b += L(x + 0.2 + (ww * i) / 4, wy, x + 0.2 + (ww * i) / 4, wy + 0.6);
    }
    return b;
  };
  switch (kind) {
    case "master": g += bed(1.8); break;
    case "bedroom": g += bed(w < 2.6 ? 0.9 : 1.6); break;
    case "open": {
      // kitchen run along the back wall, dining in the middle, sofa group toward the front windows
      const kl = Math.min(w - 0.4, 4.2);
      g += R(x + 0.1, y + 0.05, kl, 0.62);
      g += C(x + 0.1 + kl * 0.72, y + 0.24, 0.09) + C(x + 0.1 + kl * 0.72 + 0.28, y + 0.24, 0.09) + C(x + 0.1 + kl * 0.72, y + 0.48, 0.09) + C(x + 0.1 + kl * 0.72 + 0.28, y + 0.48, 0.09);
      g += R(x + 0.1 + kl * 0.25, y + 0.14, 0.7, 0.42, 'rx="4"');
      if (h > 5.5 && w > 2.6) g += R(x + 0.1 + (kl - 2.2) / 2, y + 1.55, 2.2, 0.9);
      const ty = y + h * 0.45;
      if (h > 6) {
        const tw = Math.min(2.0, w - 1.6);
        const tx = x + (w - tw) / 2;
        g += R(tx, ty, tw, 0.95, 'rx="2"');
        for (let i = 0; i < 3; i++) {
          g += R(tx + 0.15 + i * (tw - 0.3) / 2.6, ty - 0.5, 0.42, 0.4, 'rx="2"');
          g += R(tx + 0.15 + i * (tw - 0.3) / 2.6, ty + 1.05, 0.42, 0.4, 'rx="2"');
        }
      }
      const sw = Math.min(2.8, w - 1);
      const sy = y + h - 2.6;
      g += R(x + (w - sw) / 2, sy, sw, 0.95, 'rx="4"') + R(x + (w - sw) / 2 + 0.1, sy + 0.12, sw - 0.2, 0.7, 'rx="3"');
      g += R(x + (w - 1.2) / 2, sy + 1.35, 1.2, 0.6, 'rx="2"');
      g += R(x + 0.3, sy + 0.2, 0.85, 0.85, 'rx="4"');
      break;
    }
    case "bath": {
      if (w > 1.9) g += R(x + 0.05, y + 0.05, 1.7, 0.75, 'rx="8"') + `<ellipse cx="${px.X(x + 0.9)}" cy="${px.Y(y + 0.42)}" rx="${0.7 * s}" ry="${0.26 * s}" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
      else g += R(x + 0.05, y + 0.05, 0.9, 0.9) + L(x + 0.05, y + 0.05, x + 0.95, y + 0.95) + L(x + 0.95, y + 0.05, x + 0.05, y + 0.95);
      g += R(x + w - 0.55, y + h - 0.75, 0.45, 0.2) + `<ellipse cx="${px.X(x + w - 0.33)}" cy="${px.Y(y + h - 0.38)}" rx="${0.19 * s}" ry="${0.26 * s}" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
      g += `<ellipse cx="${px.X(x + 0.45)}" cy="${px.Y(y + h - 0.3)}" rx="${0.28 * s}" ry="${0.2 * s}" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
      break;
    }
    case "shower":
      g += R(x + 0.05, y + 0.05, 0.9, 0.9) + L(x + 0.05, y + 0.05, x + 0.95, y + 0.95) + L(x + 0.95, y + 0.05, x + 0.05, y + 0.95);
    // falls through to WC fixtures
    case "wc":
      g += R(x + w - 0.5, y + h - 0.72, 0.42, 0.18) + `<ellipse cx="${px.X(x + w - 0.29)}" cy="${px.Y(y + h - 0.36)}" rx="${0.18 * s}" ry="${0.24 * s}" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
      g += `<ellipse cx="${px.X(x + 0.35)}" cy="${px.Y(y + h - 0.25)}" rx="${0.22 * s}" ry="${0.16 * s}" fill="none" stroke="${MID}" stroke-width="0.8"/>`;
      break;
    case "study":
      if (w > 2 && h > 2) g += R(x + 0.1, y + 0.1, Math.min(1.8, w - 0.4), 0.7) + R(x + 0.6, y + 0.95, 0.5, 0.5, 'rx="3"') + R(x + w - 0.5, y + 0.1, 0.4, Math.min(2.4, h - 0.6));
      break;
    case "stair": {
      const vertical = h > w;
      const n = 12;
      for (let i = 1; i < n; i++) {
        g += vertical ? L(x, y + (h * i) / n, x + w, y + (h * i) / n) : L(x + (w * i) / n, y, x + (w * i) / n, y + h);
      }
      g += vertical
        ? `<path d="M${px.X(x + w / 2)} ${px.Y(y + h - 0.2)} V${px.Y(y + 0.3)} m-5 7 l5 -7 l5 7" fill="none" stroke="${INK}" stroke-width="1"/>`
        : `<path d="M${px.X(x + 0.2)} ${px.Y(y + h / 2)} H${px.X(x + w - 0.3)} m-7 -5 l7 5 l-7 5" fill="none" stroke="${INK}" stroke-width="1"/>`;
      g += L(x, y + h, x + w, y, `stroke-dasharray="6 4"`);
      break;
    }
    case "void":
      g += L(x, y, x + w, y + h, 'stroke-dasharray="8 6"') + L(x + w, y, x, y + h, 'stroke-dasharray="8 6"');
      break;
    case "store":
      g += R(x + 0.1, y + 0.1, Math.min(1.2, w - 0.2), 0.6);
      break;
  }
  return g;
}

// ------------------------------------------------------------------ floor plan sheet

export function floorPlanSheet(model, levelIndex, sheetNo) {
  const { W, D, plan } = model;
  const level = model.levels[levelIndex];
  const isGround = levelIndex === 0;
  const garage = isGround ? model.garage : null;
  const pool = isGround ? model.pool : null;
  const extraW = garage ? garage.w + 0.5 : 0;
  const extraD = pool ? pool.d + 2 : 0;
  const areaW = SHEET_W - 330 - 36 - 180;
  const areaH = SHEET_H - 72 - 230;
  const s = Math.min(areaW / (W + extraW), areaH / (D + extraD), 58);
  const ox = 36 + 120 + (areaW - (W + extraW) * s) / 2;
  const oy = 36 + 140 + (areaH - (D + extraD) * s) / 2;
  const px = { X: (m) => ox + m * s, Y: (m) => oy + m * s };

  let g = "";
  // axes from unique wall lines
  const dedupe = (vals) => vals.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.6);
  const xs = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.x), r1(sp.x + sp.w)]))]);
  const ys = dedupe([...new Set(level.spaces.flatMap((sp) => [r1(sp.y), r1(sp.y + sp.h)]))]);
  const letters = "ABCDEFGH";
  xs.forEach((x, i) => {
    g += `<line x1="${px.X(x)}" y1="${px.Y(-1.6)}" x2="${px.X(x)}" y2="${px.Y(D + 0.4)}" stroke="${LIGHT}" stroke-width="0.7" stroke-dasharray="14 4 2 4"/>`;
    g += `<circle cx="${px.X(x)}" cy="${px.Y(-1.6) - 13}" r="13" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><text x="${px.X(x)}" y="${px.Y(-1.6) - 9}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${INK}">${i + 1}</text>`;
  });
  ys.forEach((y, i) => {
    g += `<line x1="${px.X(-1.6)}" y1="${px.Y(y)}" x2="${px.X(W + 0.4)}" y2="${px.Y(y)}" stroke="${LIGHT}" stroke-width="0.7" stroke-dasharray="14 4 2 4"/>`;
    g += `<circle cx="${px.X(-1.6) - 13}" cy="${px.Y(y)}" r="13" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><text x="${px.X(-1.6) - 13}" y="${px.Y(y) + 4}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${INK}">${letters[i] ?? ""}</text>`;
  });

  // veranda (farmhouse) in front
  if (level.veranda) {
    g += `<rect x="${px.X(0)}" y="${px.Y(D)}" width="${W * s}" height="${2.4 * s}" fill="none" stroke="${MID}" stroke-width="0.9" stroke-dasharray="6 4"/>`;
    for (let i = 0; i <= 4; i++) g += `<rect x="${px.X((W * i) / 4) - 4}" y="${px.Y(D + 2.2) - 4}" width="8" height="8" fill="${INK}"/>`;
    g += `<text x="${px.X(W / 2)}" y="${px.Y(D + 1.4)}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${MID}">COVERED VERANDA</text>`;
  }

  // walls: poché footprint, then cut out clear room areas
  g += `<rect x="${px.X(0)}" y="${px.Y(0)}" width="${W * s}" height="${D * s}" fill="${INK}"/>`;
  for (const sp of level.spaces) {
    const inn = inner(model, sp);
    g += `<rect x="${px.X(inn.x)}" y="${px.Y(inn.y)}" width="${inn.w * s}" height="${inn.h * s}" fill="${PAPER}"/>`;
  }
  // garage (attached on the right)
  if (garage) {
    const gx = W;
    const gy = D - garage.d;
    g += `<rect x="${px.X(gx)}" y="${px.Y(gy)}" width="${garage.w * s}" height="${garage.d * s}" fill="${INK}"/>`;
    g += `<rect x="${px.X(gx + INT / 2)}" y="${px.Y(gy + EXT)}" width="${(garage.w - EXT - INT / 2) * s}" height="${(garage.d - EXT) * s}" fill="${PAPER}"/>`;
    g += `<rect x="${px.X(gx + 0.4)}" y="${px.Y(D - EXT - 0.02)}" width="${(garage.w - 0.8) * s}" height="${(EXT + 0.04) * s}" fill="${PAPER}"/>`;
    g += `<line x1="${px.X(gx + 0.4)}" y1="${px.Y(D - EXT / 2)}" x2="${px.X(gx + garage.w - 0.4)}" y2="${px.Y(D - EXT / 2)}" stroke="${INK}" stroke-width="0.8" stroke-dasharray="6 3"/>`;
    const cars = garage.w > 5 ? 2 : 1;
    for (let i = 0; i < cars; i++) {
      const cx = gx + 0.6 + i * 3;
      g += `<rect x="${px.X(cx)}" y="${px.Y(gy + 0.9)}" width="${1.85 * s}" height="${4.6 * s}" rx="${0.4 * s}" fill="none" stroke="${MID}" stroke-width="0.9" stroke-dasharray="5 3"/>`;
    }
    g += `<text x="${px.X(gx + garage.w / 2)}" y="${px.Y(gy + 0.6)}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="1.6" fill="${INK}">GARAGE</text>`;
  }

  // openings
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
      g += `<rect x="${px.X(x0)}" y="${px.Y(yOuter) - 0.5}" width="${w * s}" height="${EXT * s + 1}" fill="${PAPER}"/>`;
      g += `<rect x="${px.X(x0)}" y="${px.Y(yOuter)}" width="${w * s}" height="${EXT * s}" fill="none" stroke="${INK}" stroke-width="0.9"/>`;
      g += `<line x1="${px.X(x0)}" y1="${px.Y(yOuter + EXT / 2)}" x2="${px.X(x0 + w)}" y2="${px.Y(yOuter + EXT / 2)}" stroke="${INK}" stroke-width="1.3"/>`;
    } else {
      const y0 = sp.y + c - w / 2;
      const xOuter = win.side === "left" ? 0 : W - EXT;
      g += `<rect x="${px.X(xOuter) - 0.5}" y="${px.Y(y0)}" width="${EXT * s + 1}" height="${w * s}" fill="${PAPER}"/>`;
      g += `<rect x="${px.X(xOuter)}" y="${px.Y(y0)}" width="${EXT * s}" height="${w * s}" fill="none" stroke="${INK}" stroke-width="0.9"/>`;
      g += `<line x1="${px.X(xOuter + EXT / 2)}" y1="${px.Y(y0)}" x2="${px.X(xOuter + EXT / 2)}" y2="${px.Y(y0 + w)}" stroke="${INK}" stroke-width="1.3"/>`;
    }
  }
  for (const d of level.doors) {
    const sp = spaceById[d.space];
    if (!sp) continue;
    const ext = isExterior(model, sp, d.side);
    const t = ext ? EXT : INT;
    const seg = sideSegment(sp, d.side);
    const len = seg.horizontal ? sp.w : sp.h;
    const w = Math.min(d.w, len - 0.3);
    const c = Math.min(Math.max(d.at * len, w / 2 + 0.15), len - w / 2 - 0.15);
    if (seg.horizontal) {
      const x0 = sp.x + c - w / 2;
      const wy = ext ? (d.side === "top" ? 0 : D - EXT) : seg.y1 - INT / 2;
      g += `<rect x="${px.X(x0)}" y="${px.Y(wy) - 1}" width="${w * s}" height="${t * s + 2}" fill="${PAPER}"/>`;
      if (!d.open) {
        const into = d.side === "top" ? 1 : -1; // swing into the space
        const hy = d.side === "top" ? wy + t : wy;
        g += `<line x1="${px.X(x0)}" y1="${px.Y(hy)}" x2="${px.X(x0)}" y2="${px.Y(hy + into * w)}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${px.X(x0)} ${px.Y(hy + into * w)} A${w * s} ${w * s} 0 0 ${into > 0 ? 0 : 1} ${px.X(x0 + w)} ${px.Y(hy)}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
      if (d.entry) g += `<path d="M${px.X(x0 + w / 2)} ${px.Y(D + 1.1)} v${-0.7 * s} m-6 8 l6 -8 l6 8" fill="none" stroke="${ACCENT}" stroke-width="1.4"/><text x="${px.X(x0 + w / 2)}" y="${px.Y(D + 1.5)}" text-anchor="middle" font-family="${FONT}" font-size="10" letter-spacing="2" fill="${ACCENT}">ENTRANCE</text>`;
    } else {
      const y0 = sp.y + c - w / 2;
      const wx = ext ? (d.side === "left" ? 0 : W - EXT) : seg.x1 - INT / 2;
      g += `<rect x="${px.X(wx) - 1}" y="${px.Y(y0)}" width="${t * s + 2}" height="${w * s}" fill="${PAPER}"/>`;
      if (!d.open) {
        const into = d.side === "left" ? 1 : -1;
        const hx = d.side === "left" ? wx + t : wx;
        g += `<line x1="${px.X(hx)}" y1="${px.Y(y0)}" x2="${px.X(hx + into * w)}" y2="${px.Y(y0)}" stroke="${INK}" stroke-width="1.6"/>`;
        g += `<path d="M${px.X(hx + into * w)} ${px.Y(y0)} A${w * s} ${w * s} 0 0 ${into > 0 ? 1 : 0} ${px.X(hx)} ${px.Y(y0 + w)}" fill="none" stroke="${MID}" stroke-width="0.7"/>`;
      }
    }
  }

  // furniture + room tags
  for (const sp of level.spaces) {
    const inn = inner(model, sp);
    g += furniture(model, s, sp.kind, inn, px);
  }
  for (const sp of level.spaces) {
    if (sp.kind === "stair") continue;
    const inn = inner(model, sp);
    const area = (inn.w * inn.h).toFixed(1);
    const cx = px.X(inn.x + inn.w / 2);
    let cy = px.Y(inn.y + inn.h / 2);
    if (sp.kind === "master" || sp.kind === "bedroom") cy = px.Y(inn.y + Math.min(inn.h - 0.5, 2.6 + (inn.h - 2.6) / 2));
    if (sp.kind === "open") cy = px.Y(inn.y + inn.h * 0.3);
    const fs = inn.w * s < 90 ? 9 : 11;
    const label = inn.w * s < 70 && sp.label.length > 8 ? sp.label.split(" ")[0] : sp.label;
    const tw = label.length * fs * 0.68 + 16;
    g += `<rect x="${cx - tw / 2}" y="${cy - fs - 4}" width="${tw}" height="${fs * 2 + 14}" fill="${PAPER}" fill-opacity=".92"/>`;
    g += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="600" letter-spacing="1.2" fill="${INK}">${label}</text>`;
    if (sp.kind !== "void") g += `<text x="${cx}" y="${cy + fs + 5}" text-anchor="middle" font-family="${FONT}" font-size="${fs - 1}" fill="${MID}">${area} m²</text>`;
  }

  // pool (in front of the house, left side)
  if (pool) {
    const pxx = 0.6;
    const py = D + 2.2;
    g += `<rect x="${px.X(pxx - 0.3)}" y="${px.Y(py - 0.3)}" width="${(pool.w + 0.6) * s}" height="${(pool.d + 0.6) * s}" fill="none" stroke="${INK}" stroke-width="0.9"/>`;
    g += `<rect x="${px.X(pxx)}" y="${px.Y(py)}" width="${pool.w * s}" height="${pool.d * s}" fill="${ACCENT}" fill-opacity=".1" stroke="${INK}" stroke-width="1.4"/>`;
    for (let i = 1; i < 4; i++) g += `<line x1="${px.X(pxx + 0.4)}" y1="${px.Y(py + i)}" x2="${px.X(pxx + pool.w - 0.4)}" y2="${px.Y(py + i)}" stroke="${ACCENT}" stroke-width="0.6" stroke-opacity=".6"/>`;
    g += `<text x="${px.X(pxx + pool.w / 2)}" y="${px.Y(py + pool.d / 2) + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${INK}">POOL ${pool.w.toFixed(1)} × ${pool.d.toFixed(1)}</text>`;
  }

  // dimension chains
  const front = level.spaces.filter((sp) => Math.abs(sp.y + sp.h - D) < 0.01).flatMap((sp) => [sp.x, sp.x + sp.w]);
  const chain = [...new Set([0, W, ...front].map(r1))].sort((a, b) => a - b);
  const belowY = D + (level.veranda ? 3.2 : pool ? 0 : 1.2);
  if (!pool) g += dimChain(chain, belowY, s, ox, oy, true, 1);
  g += dimChain([0, W], -0.9, s, ox, oy, true, 1);
  const left = level.spaces.filter((sp) => sp.x < 0.01).flatMap((sp) => [sp.y, sp.y + sp.h]);
  g += dimChain([...new Set([0, D, ...left].map(r1))].sort((a, b) => a - b), -0.9, s, ox, oy, false);

  g += `<text x="${36 + 60}" y="${SHEET_H - 70}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${INK}">${level.name}</text>`;
  g += `<text x="${36 + 60}" y="${SHEET_H - 48}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${plan.title.en.toUpperCase()} · ${level.spaces.filter((sp) => sp.kind !== "void").length} SPACES · CLEAR DIMENSIONS IN METRES</text>`;
  g += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);

  return sheet({ plan, drawing: level.name, sheetNo, scaleNote: "GRAPHIC SCALE", body: g, north: true });
}

// ------------------------------------------------------------------ elevation sheet

export function elevationSheet(model, sheetNo, bare = false) {
  const { W, plan, above } = model;
  const garage = model.garage;
  const totalW = W + (garage ? garage.w : 0);
  let H;
  if (plan.roof === "aframe") H = W * 1.05;
  else H = above * STOREY + (plan.roof === "flat" ? 0.6 : plan.roof === "shed" ? 1.6 : plan.roof === "hip" ? 2.4 : 3.2);
  const areaW = bare ? COVER_W - 260 : SHEET_W - 330 - 36 - 220;
  const areaH = bare ? COVER_H - 260 : SHEET_H - 72 - 300;
  const s = Math.min(areaW / (totalW + 4), areaH / (H + (model.basement ? 3.6 : 1)), bare ? 90 : 60);
  const ox = (bare ? 100 : 36 + 110) + (areaW - totalW * s) / 2;
  const gy = (bare ? 130 : 36 + 120) + H * s + (areaH - (H + (model.basement ? 3.6 : 1)) * s) / 2;
  const X = (m) => ox + m * s;
  const Y = (m) => gy - m * s; // m = height above ground
  let g = "";

  // ground
  g += `<line x1="${X(-2)}" y1="${Y(0)}" x2="${X(totalW + 2)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2.4"/>`;
  for (let x = -2; x < totalW + 2; x += 0.35) g += `<line x1="${X(x)}" y1="${Y(0) + 2}" x2="${X(x - 0.25)}" y2="${Y(0) + 12}" stroke="${INK}" stroke-width="0.6" stroke-opacity=".45"/>`;

  const ground = model.levels[0];
  const frontWindows = (level) =>
    level.windows
      .filter((w) => w.side === "bottom")
      .map((w) => {
        const sp = level.spaces.find((x) => x.id === w.space);
        if (!sp || Math.abs(sp.y + sp.h - model.D) > 0.01) return null;
        const ww = Math.min(w.w, sp.w - 0.6);
        return { x: sp.x + w.at * sp.w - ww / 2, w: ww, kind: sp.kind };
      })
      .filter(Boolean);
  const tall = ["modern", "coastal", "luxury", "minimal", "duplex"].includes(plan.style);
  const drawWindow = (x, w, z, h, arch) => {
    let o = arch
      ? `<path d="M${X(x)} ${Y(z)} V${Y(z + h - w / 2)} A${(w / 2) * s} ${(w / 2) * s} 0 0 1 ${X(x + w)} ${Y(z + h - w / 2)} V${Y(z)} Z" fill="#e7e1d6" stroke="${INK}" stroke-width="1.3"/>`
      : `<rect x="${X(x)}" y="${Y(z + h)}" width="${w * s}" height="${h * s}" fill="#e7e1d6" stroke="${INK}" stroke-width="1.3"/>`;
    const n = Math.max(1, Math.round(w / 1.1));
    for (let i = 1; i < n; i++) o += `<line x1="${X(x + (w * i) / n)}" y1="${Y(z + h - (arch ? w / 2 : 0))}" x2="${X(x + (w * i) / n)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.8"/>`;
    o += `<line x1="${X(x + 0.12)}" y1="${Y(z + 0.15)}" x2="${X(x + Math.min(w, 1.2) * 0.6)}" y2="${Y(z + h * 0.7)}" stroke="#ffffff" stroke-width="1.2" stroke-opacity=".9"/>`;
    o += `<line x1="${X(x - 0.06)}" y1="${Y(z)}" x2="${X(x + w + 0.06)}" y2="${Y(z)}" stroke="${INK}" stroke-width="2"/>`;
    return o;
  };

  if (plan.roof === "aframe") {
    const mid = W / 2;
    g += `<path d="M${X(-0.3)} ${Y(0)} L${X(mid)} ${Y(H)} L${X(W + 0.3)} ${Y(0)}" fill="#ddd5c8" stroke="${INK}" stroke-width="2"/>`;
    const inset = 0.7;
    g += `<path d="M${X(inset)} ${Y(0)} L${X(mid)} ${Y(H - inset * 1.4)} L${X(W - inset)} ${Y(0)} Z" fill="#e7e1d6" stroke="${INK}" stroke-width="1.3"/>`;
    for (let z = 1.2; z < H - 1.5; z += 1.25) {
      const half = (W / 2 - inset) * (1 - z / (H - inset * 1.4));
      g += `<line x1="${X(mid - half)}" y1="${Y(z)}" x2="${X(mid + half)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.8"/>`;
    }
    g += `<line x1="${X(mid)}" y1="${Y(0)}" x2="${X(mid)}" y2="${Y(H - inset * 1.4)}" stroke="${INK}" stroke-width="0.8"/>`;
    g += `<rect x="${X(mid - 0.55)}" y="${Y(2.4)}" width="${1.1 * s}" height="${2.4 * s}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
    g += `<rect x="${X(-0.6)}" y="${Y(0.45)}" width="${(W + 1.2) * s}" height="${0.45 * s}" fill="#cfc6b8" stroke="${INK}" stroke-width="1"/>`;
  } else {
    const wallTop = above * STOREY;
    // facade body
    g += `<rect x="${X(0)}" y="${Y(wallTop)}" width="${W * s}" height="${wallTop * s}" fill="#ece6dc" stroke="${INK}" stroke-width="2"/>`;
    // material: horizontal cladding band on upper floor for modern styles, rustication on classic
    if (tall && above > 1) {
      for (let z = STOREY + 0.25; z < wallTop; z += 0.25) g += `<line x1="${X(0)}" y1="${Y(z)}" x2="${X(W)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.4" stroke-opacity=".35"/>`;
    }
    if (["classic", "mediterranean"].includes(plan.style)) {
      g += `<rect x="${X(-0.1)}" y="${Y(0.6)}" width="${(W + 0.2) * s}" height="${0.6 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1"/>`;
      for (let x = 0.5; x < W; x += 1.0) g += `<line x1="${X(x)}" y1="${Y(0.6)}" x2="${X(x)}" y2="${Y(0)}" stroke="${INK}" stroke-width="0.5"/>`;
      g += `<rect x="${X(-0.15)}" y="${Y(wallTop + 0.05)}" width="${(W + 0.3) * s}" height="${0.3 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1"/>`;
    }
    // floor slab lines
    for (let f = 1; f < above; f++) g += `<line x1="${X(0)}" y1="${Y(f * STOREY)}" x2="${X(W)}" y2="${Y(f * STOREY)}" stroke="${INK}" stroke-width="1.2"/>`;

    // windows per level, taken from the plans (front facade = plan bottom edge)
    model.levels.forEach((lv, li) => {
      if (li >= above) return;
      const z0 = li * STOREY;
      for (const w of frontWindows(lv)) {
        const living = w.kind === "open";
        const sill = tall && (living || li > 0) ? 0.1 : living ? 0.5 : 0.9;
        const head = tall ? 2.7 : 2.4;
        g += drawWindow(w.x, w.w, z0 + sill, head - sill, plan.style === "mediterranean");
      }
      if (li === 0) {
        const entry = lv.doors.find((d) => d.entry);
        const sp = entry && lv.spaces.find((x) => x.id === entry.space);
        if (sp) {
          const dw = Math.min(entry.w, sp.w - 0.4);
          const dx = sp.x + entry.at * sp.w - dw / 2;
          g += `<rect x="${X(dx)}" y="${Y(2.5)}" width="${dw * s}" height="${2.5 * s}" fill="#cfc6b8" stroke="${INK}" stroke-width="1.6"/>`;
          g += `<line x1="${X(dx + dw * 0.8)}" y1="${Y(1.0)}" x2="${X(dx + dw * 0.8)}" y2="${Y(1.4)}" stroke="${INK}" stroke-width="2"/>`;
          if (plan.roof === "flat" || plan.roof === "shed") g += `<rect x="${X(dx - 0.6)}" y="${Y(2.95)}" width="${(dw + 1.2) * s}" height="${0.18 * s}" fill="${INK}"/>`;
          g += `<rect x="${X(dx - 0.4)}" y="${Y(0.15)}" width="${(dw + 0.8) * s}" height="${0.15 * s}" fill="#cfc6b8" stroke="${INK}" stroke-width="0.8"/>`;
        }
      }
    });

    // roofs
    if (plan.roof === "flat") {
      g += `<rect x="${X(-0.1)}" y="${Y(wallTop + 0.6)}" width="${(W + 0.2) * s}" height="${0.6 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="2"/>`;
      g += `<rect x="${X(-0.15)}" y="${Y(wallTop + 0.66)}" width="${(W + 0.3) * s}" height="${0.08 * s}" fill="${INK}"/>`;
    } else if (plan.roof === "hip") {
      const ov = 0.6;
      g += `<path d="M${X(-ov)} ${Y(wallTop + 0.35)} L${X(W * 0.28)} ${Y(H)} L${X(W * 0.72)} ${Y(H)} L${X(W + ov)} ${Y(wallTop + 0.35)} Z" fill="#c9bba6" stroke="${INK}" stroke-width="2"/>`;
      for (let z = wallTop + 0.65; z < H; z += 0.3) {
        const t = (z - wallTop - 0.35) / (H - wallTop - 0.35);
        g += `<line x1="${X(-ov + (W * 0.28 + ov) * t)}" y1="${Y(z)}" x2="${X(W + ov - (W * 0.28 + ov) * t)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.45" stroke-opacity=".5"/>`;
      }
      g += `<line x1="${X(-ov)}" y1="${Y(wallTop + 0.35)}" x2="${X(W + ov)}" y2="${Y(wallTop + 0.35)}" stroke="${INK}" stroke-width="2.6"/>`;
    } else if (plan.roof === "gable") {
      // ridge parallel to the street: the front roof plane reads as a band between eaves and ridge
      const ov = 0.5;
      g += `<rect x="${X(-ov)}" y="${Y(H)}" width="${(W + 2 * ov) * s}" height="${(H - wallTop + 0.1) * s}" fill="#c9bba6" stroke="${INK}" stroke-width="2"/>`;
      for (let z = wallTop + 0.2; z < H; z += 0.28) g += `<line x1="${X(-ov)}" y1="${Y(z)}" x2="${X(W + ov)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.45" stroke-opacity=".5"/>`;
      g += `<rect x="${X(-ov - 0.05)}" y="${Y(H + 0.12)}" width="${(W + 2 * ov + 0.1) * s}" height="${0.12 * s}" fill="${INK}"/>`;
      g += `<line x1="${X(-ov)}" y1="${Y(wallTop - 0.1)}" x2="${X(W + ov)}" y2="${Y(wallTop - 0.1)}" stroke="${INK}" stroke-width="3"/>`;
    } else if (plan.roof === "shed") {
      g += `<path d="M${X(-0.4)} ${Y(H)} L${X(W + 0.4)} ${Y(wallTop + 0.15)} L${X(W + 0.4)} ${Y(wallTop - 0.1)} L${X(-0.4)} ${Y(H - 0.25)} Z" fill="${INK}"/>`;
      g += `<path d="M${X(0)} ${Y(H - 0.25)} L${X(0)} ${Y(wallTop)} M${X(W)} ${Y(wallTop - 0.1)} V${Y(wallTop)}" stroke="${INK}" stroke-width="2"/>`;
      g += `<path d="M${X(0)} ${Y(wallTop)} L${X(0)} ${Y(H - 0.25)} L${X(W)} ${Y(wallTop - 0.1)} Z" fill="#ece6dc" stroke="${INK}" stroke-width="1.2"/>`;
    }

    // veranda (farmhouse)
    if (ground.veranda) {
      for (let i = 0; i <= 4; i++) g += `<rect x="${X((W * i) / 4 - 0.1)}" y="${Y(2.7)}" width="${0.2 * s}" height="${2.7 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1"/>`;
      g += `<rect x="${X(-0.2)}" y="${Y(2.95)}" width="${(W + 0.4) * s}" height="${0.25 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1.2"/>`;
    }
    // duplex party wall
    if (plan.style === "duplex") g += `<rect x="${X(W / 2 - 0.15)}" y="${Y(wallTop + 0.9)}" width="${0.3 * s}" height="${(wallTop + 0.9) * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1.4"/>`;

    // garage
    if (garage) {
      const gx = W;
      g += `<rect x="${X(gx)}" y="${Y(3.0)}" width="${garage.w * s}" height="${3.0 * s}" fill="#ece6dc" stroke="${INK}" stroke-width="2"/>`;
      g += `<rect x="${X(gx - 0.05)}" y="${Y(3.3)}" width="${(garage.w + 0.25) * s}" height="${0.3 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1.4"/>`;
      g += `<rect x="${X(gx + 0.4)}" y="${Y(2.3)}" width="${(garage.w - 0.8) * s}" height="${2.3 * s}" fill="#ddd5c8" stroke="${INK}" stroke-width="1.3"/>`;
      for (let z = 0.3; z < 2.3; z += 0.3) g += `<line x1="${X(gx + 0.4)}" y1="${Y(z)}" x2="${X(gx + garage.w - 0.4)}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.5"/>`;
    }

    // level markers
    const lx = X(totalW + 1.0);
    const levelsZ = [0, ...Array.from({ length: above }, (_, i) => (i + 1) * STOREY)];
    if (plan.roof !== "flat") levelsZ.push(H);
    levelsZ.forEach((z) => {
      g += `<g font-family="${FONT}" font-size="11" fill="${INK}"><line x1="${lx - 10}" y1="${Y(z)}" x2="${lx + 80}" y2="${Y(z)}" stroke="${INK}" stroke-width="0.7"/>
        <path d="M${lx} ${Y(z)} l-7 -10 h14 z" fill="none" stroke="${INK}" stroke-width="0.9"/>
        <text x="${lx + 14}" y="${Y(z) - 5}">${z === 0 ? "±0.00" : `+${z.toFixed(2)}`}</text></g>`;
    });
  }

  // basement (luxury)
  if (model.basement) {
    g += `<rect x="${X(0)}" y="${Y(0)}" width="${W * s}" height="${3.2 * s}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="10 6"/>`;
    g += `<text x="${X(W / 2)}" y="${Y(-1.7)}" text-anchor="middle" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${MID}">LOWER LEVEL −3.20 · SPA · CINEMA</text>`;
  }
  // pool coping line
  if (model.pool) g += `<rect x="${X(-1.5 - Math.min(6, model.pool.w))}" y="${Y(0.12)}" width="${Math.min(6, model.pool.w) * s}" height="${0.12 * s}" fill="#cfc6b8" stroke="${INK}" stroke-width="0.8"/>`;

  // overall dimension
  g += dimChain([0, W, ...(garage ? [W + garage.w] : [])], 1.3 + (model.basement ? 3.3 : 0), s, ox, gy, true, -1);
  if (bare) return bareSvg(g);
  g += `<text x="${36 + 60}" y="${SHEET_H - 70}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${INK}">FRONT ELEVATION</text>`;
  g += `<text x="${36 + 60}" y="${SHEET_H - 48}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${plan.title.en.toUpperCase()} · LEVELS IN METRES ABOVE FINISHED GROUND FLOOR</text>`;
  g += scaleBar(SHEET_W - 330 - 60 - 5 * s, SHEET_H - 72, s);
  return sheet({ plan, drawing: "FRONT ELEVATION", sheetNo, scaleNote: "GRAPHIC SCALE", body: g, north: false });
}

// ------------------------------------------------------------------ axonometric massing

export function axonometricSheet(model, sheetNo, bare = false) {
  const { W, D, plan, above } = model;
  const wallTop = plan.roof === "aframe" ? 0 : above * STOREY;
  const ridge = plan.roof === "aframe" ? W * 1.05 : wallTop + (plan.roof === "flat" ? 0.6 : plan.roof === "shed" ? 1.6 : plan.roof === "hip" ? 2.4 : 3.2);
  // 30/60 axonometric; b = depth measured from the front facade toward the back
  const c30 = Math.cos(Math.PI / 6), s30 = 0.5, c60 = 0.5, s60 = Math.cos(Math.PI / 6);
  const proj = (x, b, z) => [x * c30 - b * c60, -(x * s30) - b * s60 - z];

  const gW = model.garage ? model.garage.w : 0;
  const pts = [];
  const front = model.pool ? -4.4 : plan.roof === "gable" ? -2.8 : -0.6;
  for (const [x, b, z] of [[0, front, 0], [W + gW, front, 0], [0, D, 0], [W + gW, D, 0], [0, 0, ridge], [W + gW, D, ridge], [0, D, ridge], [W + gW, 0, ridge]]) pts.push(proj(x, b, z));
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const areaW = bare ? COVER_W - 240 : SHEET_W - 330 - 36 - 200;
  const areaH = bare ? COVER_H - 240 : SHEET_H - 72 - 260;
  const s = Math.min(areaW / (maxX - minX), areaH / (maxY - minY));
  const ox = (bare ? 120 : 36 + 100) + (areaW - (maxX - minX) * s) / 2 - minX * s;
  const oy = (bare ? 120 : 36 + 130) + (areaH - (maxY - minY) * s) / 2 - minY * s;
  const P = (x, b, z) => {
    const [u, v] = proj(x, b, z);
    return `${(ox + u * s).toFixed(1)},${(oy + v * s).toFixed(1)}`;
  };
  const poly = (points, fill, extra = "") =>
    `<polygon points="${points.join(" ")}" fill="${fill}" stroke="${INK}" ${extra.includes("stroke-width") ? "" : 'stroke-width="1.2"'} stroke-linejoin="round" ${extra}/>`;
  const TOP = "#f4efe7", FRONT = "#e3dbcf", SIDE = "#cbc1b2", ROOF = "#b9ab97", GLASS = "#3c4247";

  let g = "";
  // soft ground shadow
  g += `<polygon points="${[P(-0.5, -0.5, 0), P(W + gW + 2.5, -0.5, 0), P(W + gW + 2.5, D + 1.5, 0), P(-0.5, D + 1.5, 0)].join(" ")}" fill="${INK}" fill-opacity=".06"/>`;
  // ground plate lines
  for (let x = -3; x <= W + gW + 3; x += 1) g += `<polyline points="${P(x, -2.5, 0)} ${P(x, D + 2.5, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.5" stroke-opacity=".7"/>`;
  for (let b = -2; b <= D + 2; b += 1) g += `<polyline points="${P(-3, b, 0)} ${P(W + gW + 3, b, 0)}" fill="none" stroke="${LIGHT}" stroke-width="0.5" stroke-opacity=".7"/>`;

  // pool in front-left
  if (model.pool) {
    const pw = Math.min(8, model.pool.w), pd = 3;
    g += poly([P(0, -1.2, 0), P(pw, -1.2, 0), P(pw, -1.2 - pd, 0), P(0, -1.2 - pd, 0)], "#9fb4b8", 'fill-opacity=".55"');
  }

  const box = (x0, x1, b0, b1, z0, z1, frontFill = FRONT, top = true) => {
    // visible faces for this projection (viewer front-left, above): front (b = b0), left (x = x0), top (z = z1)
    let o = poly([P(x0, b0, z0), P(x1, b0, z0), P(x1, b0, z1), P(x0, b0, z1)], frontFill);
    o += poly([P(x0, b0, z0), P(x0, b1, z0), P(x0, b1, z1), P(x0, b0, z1)], SIDE);
    if (top) o += poly([P(x0, b0, z1), P(x1, b0, z1), P(x1, b1, z1), P(x0, b1, z1)], TOP);
    return o;
  };
  const frontWin = (x, w, z, h) => poly([P(x, 0, z), P(x + w, 0, z), P(x + w, 0, z + h), P(x, 0, z + h)], GLASS, 'stroke-width="0.8"') + `<polyline points="${P(x + w * 0.15, 0, z + h * 0.2)} ${P(x + w * 0.45, 0, z + h * 0.85)}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>`;
  const sideWin = (b, w, z, h) => poly([P(0, b, z), P(0, b + w, z), P(0, b + w, z + h), P(0, b, z + h)], GLASS, 'stroke-width="0.8"');

  if (plan.roof === "aframe") {
    const mid = W / 2;
    g += poly([P(mid, 0, ridge), P(mid, D, ridge), P(W, D, 0), P(W, 0, 0)], "#cdbfa9");
    g += poly([P(0, 0, 0), P(W, 0, 0), P(mid, 0, ridge)], FRONT);
    g += poly([P(0, 0, 0), P(0, D, 0), P(mid, D, ridge), P(mid, 0, ridge)], ROOF);
    g += poly([P(0.7, 0, 0.1), P(W - 0.7, 0, 0.1), P(mid, 0, ridge - 1)], GLASS, 'stroke-width="0.8"');
    for (let z = 1.3; z < ridge - 1.6; z += 1.3) {
      const half = (mid - 0.7) * (1 - z / (ridge - 1));
      g += `<polyline points="${P(mid - half, 0, z)} ${P(mid + half, 0, z)}" fill="none" stroke="${FRONT}" stroke-width="1"/>`;
    }
    g += `<polyline points="${P(mid, 0, 0.1)} ${P(mid, 0, ridge - 1)}" fill="none" stroke="${FRONT}" stroke-width="1"/>`;
  } else {
    // garage first (it sits to the right, partly behind nothing)
    if (model.garage) {
      const gb = D - model.garage.d; // garage depth measured from front: front aligned with house front
      g += box(W, W + model.garage.w, 0, model.garage.d, 0, 3.0);
      g += poly([P(W + 0.4, 0, 0), P(W + model.garage.w - 0.4, 0, 0), P(W + model.garage.w - 0.4, 0, 2.3), P(W + 0.4, 0, 2.3)], SIDE, 'stroke-width="0.8"');
      void gb;
    }
    g += box(0, W, 0, D, 0, wallTop, FRONT, plan.roof === "flat");
    // floor lines on front
    for (let f = 1; f < above; f++) g += `<polyline points="${P(0, 0, f * STOREY)} ${P(W, 0, f * STOREY)} " fill="none" stroke="${INK}" stroke-width="0.8"/><polyline points="${P(0, 0, f * STOREY)} ${P(0, D, f * STOREY)}" fill="none" stroke="${INK}" stroke-width="0.8"/>`;
    // windows from plans
    const tall = ["modern", "coastal", "luxury", "minimal", "duplex"].includes(plan.style);
    model.levels.forEach((lv, li) => {
      if (li >= above) return;
      for (const w of lv.windows) {
        const sp = lv.spaces.find((x) => x.id === w.space);
        if (!sp) continue;
        const sill = tall ? 0.1 : 0.9;
        const head = tall ? 2.7 : 2.4;
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
      const entry = li === 0 && lv.doors.find((d) => d.entry);
      if (entry) {
        const sp = lv.spaces.find((x) => x.id === entry.space);
        const dw = Math.min(entry.w, sp.w - 0.4);
        const dx = sp.x + entry.at * sp.w - dw / 2;
        g += poly([P(dx, 0, 0), P(dx + dw, 0, 0), P(dx + dw, 0, 2.5), P(dx, 0, 2.5)], "#8b7a64", 'stroke-width="0.8"');
      }
    });
    // roofs
    if (plan.roof === "flat") {
      g += box(-0.1, W + 0.1, -0.1, D + 0.1, wallTop, wallTop + 0.6, "#d8cfc1");
    } else if (plan.roof === "hip") {
      // all four planes face upward, so all are visible; paint far planes first
      const ov = 0.5, rz = ridge, a = W * 0.28, b2 = W * 0.72;
      g += poly([P(-ov, D + ov, wallTop), P(W + ov, D + ov, wallTop), P(b2, D / 2, rz), P(a, D / 2, rz)], "#cdbfa9");
      g += poly([P(W + ov, -ov, wallTop), P(W + ov, D + ov, wallTop), P(b2, D / 2, rz)], "#c4b59f");
      g += poly([P(-ov, -ov, wallTop), P(W + ov, -ov, wallTop), P(b2, D / 2, rz), P(a, D / 2, rz)], ROOF);
      g += poly([P(-ov, -ov, wallTop), P(a, D / 2, rz), P(-ov, D + ov, wallTop)], "#a99a85");
    } else if (plan.roof === "gable") {
      // ridge runs parallel to the street (as in the elevation); gable ends face the sides
      const ov = 0.45, ez = wallTop - 0.1;
      g += poly([P(-ov, D + ov, ez), P(W + ov, D + ov, ez), P(W + ov, D / 2, ridge), P(-ov, D / 2, ridge)], "#cdbfa9");
      g += poly([P(0, 0, wallTop), P(0, D, wallTop), P(0, D / 2, ridge)], SIDE);
      g += poly([P(-ov, -ov, ez), P(W + ov, -ov, ez), P(W + ov, D / 2, ridge), P(-ov, D / 2, ridge)], ROOF);
      if (model.levels[0].veranda) {
        for (let i = 0; i <= 4; i++) g += `<polyline points="${P((W * i) / 4, -2.4, 0)} ${P((W * i) / 4, -2.4, 2.75)}" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
        g += poly([P(-0.2, -2.6, 2.75), P(W + 0.2, -2.6, 2.75), P(W + 0.2, -0.2, 3.1), P(-0.2, -0.2, 3.1)], "#a99a85");
      }
    } else if (plan.roof === "shed") {
      g += poly([P(0, 0, wallTop), P(0, D, wallTop), P(0, D, ridge - 0.25), P(0, 0, ridge - 0.25)], SIDE);
      g += poly([P(0, 0, wallTop), P(W, 0, wallTop), P(W, 0, wallTop - 0.1), P(0, 0, ridge - 0.25)], FRONT);
      g += poly([P(-0.4, -0.4, ridge), P(W + 0.4, -0.4, wallTop + 0.1), P(W + 0.4, D + 0.4, wallTop + 0.1), P(-0.4, D + 0.4, ridge)], "#6b6359");
    }
    if (plan.style === "duplex") g += `<polyline points="${P(W / 2, 0, 0)} ${P(W / 2, 0, wallTop + 0.6)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  }

  if (bare) return bareSvg(g);
  g += `<text x="${36 + 60}" y="${SHEET_H - 70}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="${INK}">AXONOMETRIC · MASSING</text>`;
  g += `<text x="${36 + 60}" y="${SHEET_H - 48}" font-family="${FONT}" font-size="12" letter-spacing="2" fill="${MID}">${plan.title.en.toUpperCase()} · ${STYLE_EN[plan.style] ?? plan.style.toUpperCase()} · VIEW FROM SOUTH-WEST</text>`;
  return sheet({ plan, drawing: "AXONOMETRIC VIEW", sheetNo, scaleNote: "NTS", body: g, north: false });
}

const STYLE_EN = {
  modern: "MODERN", classic: "CLASSIC", minimal: "MINIMALIST", coastal: "COASTAL", chalet: "CHALET",
  farmhouse: "FARMHOUSE", luxury: "LUXURY", compact: "COMPACT", mediterranean: "MEDITERRANEAN", duplex: "DUPLEX",
};
