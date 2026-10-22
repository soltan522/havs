// Checks data/plans.json before anything is published, and renders every concept sheet in memory.
//   npm run validate                       all plans
//   npm run validate -- --require-renders  also require renders/<slug>/ images for every demo plan
// Exits with code 1 on the first run of problems; warnings do not fail.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { axonometricSheet, buildModel, cutawaySheet, elevationSheet, floorPlanSheet, grossFloorArea, INTERIOR_LAYOUTS, INTERIOR_TYPES, interiorSheets, PALETTES, PROJECT_RULES, scheduleSheet, sitePlanSheet, STYLE_RULES, TREES, wetRooms } from "./drawings.mjs";

const root = process.cwd();
const plans = JSON.parse(await readFile(path.join(root, "data", "plans.json"), "utf8"));
const requireRenders = process.argv.includes("--require-renders");
const LANGS = ["az", "en", "ru"];
// reference design families, declared as "### <id> —" headings in docs/design-references.md
const refsFile = path.join(root, "docs", "design-references.md");
const INSPIRATIONS = new Set(existsSync(refsFile) ? [...(await readFile(refsFile, "utf8")).matchAll(/^### ([a-z0-9-]+) —/gm)].map((m) => m[1]) : []);
const errors = [];
const warnings = [];
// map positions of place names (data/places.json); a plan's own "location" takes precedence
const placesFile = path.join(root, "data", "places.json");
const PLACES = existsSync(placesFile) ? JSON.parse(await readFile(placesFile, "utf8")) : {};

/**
 * Catalogue price rule for sample villas (USD): ~$300 + $4.2/m², rounded to …90, +$100 for premium styles.
 * A multi-unit project: the typical house, plus 35 % of it for every further house on the masterplan.
 */
export function suggestedPrice(plan) {
  // interior design package: ~$300 + $9/m²
  if (plan.interior) return Math.round((300 + 9 * plan.areaM2) / 100) * 100 - 10;
  // commercial buildings: ~$900 + $1.5/m²
  if (STYLE_RULES[plan.style]?.commercial) return Math.round((900 + 1.5 * plan.areaM2) / 100) * 100 - 10;
  const premium = ["tuscan", "coastal", "luxury", "mediterranean", "absheron", "noir", "yali"].includes(plan.style) ? 100 : 0;
  const house = Math.round((300 + 4.2 * plan.areaM2) / 100) * 100 - 10 + premium;
  if (!plan.project) return house;
  return Math.round(((house + 10) * (1 + 0.35 * (plan.project.units - 1))) / 100) * 100 - 10;
}

// ---- nothing may repeat an existing design
const norm = (s) => s.toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0400-\u04ff]+/g, " ").trim();
const stem = (slug) => slug.replace(/-\d+$/, "");
// a multi-unit project is its own kind of design: it never collides with a single villa of the same style
const projectTag = (p) => (p.interior ? `interior:${p.interior.type}` : p.project ? `${p.project.kind}×${p.project.units}` : "villa");
// an interior repeats a design when the same kind of space has the same palette and bedrooms
const designKey = (p) => (p.interior ? [projectTag(p), p.interior.palette, p.bedrooms].join("|") : [projectTag(p), p.style, p.floors, p.bedrooms, p.garage ? "garage" : "-", p.pool ? "pool" : "-"].join("|"));
const layoutKey = (p) => (p.project || p.interior ? `project:${p.slug}` : [p.style === "duplex" ? "duplex" : p.style === "luxury" ? p.floors - 1 : p.floors, p.bedrooms, p.garage, p.pool, !!p.mirror].join("|"));
const firstBy = (keyFn) => {
  const map = new Map();
  for (const p of plans) {
    const k = keyFn(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p.slug);
  }
  return map;
};
for (const [k, slugs] of firstBy((p) => stem(p.slug ?? ""))) if (slugs.length > 1) errors.push(`${slugs.join(", ")}: the same place name "${k}" is used more than once`);
for (const l of LANGS) for (const [k, slugs] of firstBy((p) => norm(p.title?.[l] ?? ""))) if (k && slugs.length > 1) errors.push(`${slugs.join(", ")}: identical ${l} title "${k}"`);
for (const [k, slugs] of firstBy(designKey)) if (slugs.length > 1) errors.push(`${slugs.join(", ")}: same design (style|floors|bedrooms|garage|pool = ${k}) — change at least one of these`);
// same style and storeys with almost the same area reads as the same house
for (let i = 0; i < plans.length; i++) {
  for (let j = i + 1; j < plans.length; j++) {
    const a = plans[i], b = plans[j];
    if (a.style === b.style && a.floors === b.floors && projectTag(a) === projectTag(b) && Math.abs(a.areaM2 - b.areaM2) < 25) errors.push(`${a.slug}, ${b.slug}: same style and floors with areas only ${Math.abs(a.areaM2 - b.areaM2)} m² apart — make them clearly different`);
  }
}
// render prompts (the design brief) must differ, not just the names
const words = (s) => new Set(norm(s ?? "").split(" ").filter((w) => w.length > 3));
const briefs = plans.filter((p) => p.prompt).map((p) => ({ slug: p.slug, w: words(p.prompt) }));
for (let i = 0; i < briefs.length; i++) {
  for (let j = i + 1; j < briefs.length; j++) {
    const a = briefs[i].w, b = briefs[j].w;
    const shared = [...a].filter((w) => b.has(w)).length;
    const jaccard = shared / (a.size + b.size - shared || 1);
    if (jaccard >= 0.75) errors.push(`${briefs[i].slug}, ${briefs[j].slug}: render prompts are ${Math.round(jaccard * 100)}% the same — write a different design brief`);
    else if (jaccard >= 0.6) warnings.push(`${briefs[i].slug}, ${briefs[j].slug}: render prompts are ${Math.round(jaccard * 100)}% alike`);
  }
}
for (const [k, slugs] of firstBy(layoutKey)) if (slugs.length > 2) warnings.push(`${slugs.join(", ")}: ${slugs.length} villas share the floor-plan layout ${k} — vary bedrooms, garage, pool or mirror`);
for (const [k, slugs] of firstBy((p) => norm(p.summary?.en ?? ""))) if (k && slugs.length > 1) errors.push(`${slugs.join(", ")}: identical English summary`);

// concept renders must not be near-copies of each other (perceptual difference hash, 256 bits)
async function dhash(file) {
  const data = await sharp(file).grayscale().resize(17, 16, { fit: "fill" }).raw().toBuffer();
  const bits = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits.push(data[y * 17 + x] < data[y * 17 + x + 1] ? 1 : 0);
  return bits;
}
const hashes = [];
for (const p of plans) {
  const dir = path.join(root, "renders", p.slug ?? "");
  if (!existsSync(dir)) continue;
  for (const f of (await readdir(dir)).filter((x) => /\.(jpe?g|png|webp)$/i.test(x))) hashes.push({ slug: p.slug, file: f, bits: await dhash(path.join(dir, f)) });
}
for (let i = 0; i < hashes.length; i++) {
  for (let j = i + 1; j < hashes.length; j++) {
    if (hashes[i].slug === hashes[j].slug) continue;
    const d = hashes[i].bits.reduce((n, v, k) => n + (v !== hashes[j].bits[k]), 0);
    // distinct villas measure 95+; a re-used or lightly edited image measures under 20
    if (d < 60) errors.push(`${hashes[j].slug}: render looks like a copy of ${hashes[i].slug} (difference ${d}/256) — generate a different design`);
    else if (d < 80) warnings.push(`${hashes[j].slug}: render is close to ${hashes[i].slug} (difference ${d}/256)`);
  }
}

const seen = new Set();
for (const plan of plans) {
  const id = plan.slug ?? "(no slug)";
  const err = (msg) => errors.push(`${id}: ${msg}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plan.slug ?? "")) err("slug must be lowercase ascii words joined by '-'");
  if (seen.has(plan.slug)) err("duplicate slug");
  seen.add(plan.slug);

  const rules = STYLE_RULES[plan.style];
  if (!rules) {
    err(`unknown style "${plan.style}" (allowed: ${Object.keys(STYLE_RULES).join(", ")})`);
    continue;
  }
  if (!rules.roofs.includes(plan.roof)) err(`roof "${plan.roof}" does not fit style ${plan.style} (allowed: ${rules.roofs.join(", ")})`);
  if (!rules.floors.includes(plan.floors)) err(`${plan.floors} floor(s) does not fit style ${plan.style} (allowed: ${rules.floors.join(", ")})`);
  const itype = plan.interior ? INTERIOR_TYPES[plan.interior.type] : null;
  if (rules.interior) {
    if (!itype) err(`interior.type must be one of ${Object.keys(INTERIOR_TYPES).join(", ")}`);
    else {
      if (!itype.floors.includes(plan.floors)) err(`a ${plan.interior.type} interior is drawn on ${itype.floors.join(" or ")} level(s)`);
      if (!itype.bedrooms.includes(plan.bedrooms)) err(`a ${plan.interior.type} interior is drawn with ${itype.bedrooms.join(", ")} bedroom(s)`);
    }
    if (!PALETTES[plan.interior?.palette]) err(`interior.palette must be one of ${Object.keys(PALETTES).join(", ")}`);
    else if (itype && !PALETTES[plan.interior.palette].for.includes(plan.interior.type)) err(`palette ${plan.interior.palette} is written for ${PALETTES[plan.interior.palette].for.join(", ")} (its materials name those rooms), not for a ${plan.interior.type}`);
    if (plan.interior?.layout !== undefined && !(INTERIOR_LAYOUTS[plan.interior.type] ?? []).includes(plan.interior.layout)) err(`interior.layout of a ${plan.interior.type} must be one of ${(INTERIOR_LAYOUTS[plan.interior.type] ?? ["(none)"]).join(", ")}`);
    if (plan.interior?.layout === "b" && ["flat", "penthouse"].includes(plan.interior.type) && plan.bedrooms !== 3) err("the second apartment plan (layout b) has three bedrooms");
    if (plan.inspiration !== undefined && plan.inspiration !== plan.interior?.palette) err("an interior's inspiration is its palette id");
    if (plan.garage || plan.pool) err("interior projects have no garage or pool");
  } else if (plan.interior !== undefined) err(`"interior" needs style "interior"`);
  for (const field of ["title", "summary"]) for (const l of LANGS) if (!plan[field]?.[l]?.trim()) err(`missing ${field}.${l}`);
  for (const field of ["areaM2", "floors", "bedrooms", "bathrooms", "priceCents"]) if (!Number.isInteger(plan[field]) || plan[field] <= 0) if (!(field === "bedrooms" && (rules.commercial || itype?.commercial) && plan[field] === 0)) err(`${field} must be a positive integer`);
  for (const field of ["garage", "pool", "published", "demo"]) if (typeof plan[field] !== "boolean") err(`${field} must be true or false`);
  const perFloor = plan.areaM2 / plan.floors;
  const [minFloor, maxFloor] = rules.floorArea ?? [80, 320];
  if (perFloor < minFloor || perFloor > maxFloor) err(`area per floor ${perFloor.toFixed(0)} m² is outside ${minFloor}–${maxFloor} m² — the generated plans would not be credible`);
  if (plan.style === "duplex" && plan.bedrooms !== 6) err("duplex template has exactly 6 bedrooms (3 per unit)");
  if (plan.project !== undefined) {
    const pr = PROJECT_RULES[plan.project?.kind];
    if (!pr) err(`project.kind must be one of ${Object.keys(PROJECT_RULES).join(", ")}`);
    else {
      if (!pr.units.includes(plan.project.units)) err(`a ${plan.project.kind} project is drawn for ${pr.units.join(", ")} houses`);
      if (!pr.styles.includes(plan.style)) err(`a ${plan.project.kind} project takes the styles ${pr.styles.join(", ")}`);
    }
    if (plan.garage) err("projects park cars on the masterplan: set garage to false");
    if (plan.sign !== undefined && (typeof plan.sign !== "string" || !/^[A-Z0-9 .&-]{2,24}$/.test(plan.sign))) err("sign must be 2–24 capital letters (the owner's own name only — never a third-party brand)");
  } else if (rules.projectOnly) err(`style ${plan.style} is only drawn as part of a project (set "project")`);
  if (plan.ratio !== undefined && !(plan.ratio >= 1 && plan.ratio <= 2.2)) err("ratio must be between 1.0 and 2.2");
  if (plan.footprint !== undefined) {
    // existing buildings keep their measured footprint instead of one derived from the area
    const [fw, fd] = Array.isArray(plan.footprint) ? plan.footprint : [];
    if (!(fw >= 6 && fw <= 60 && fd >= 6 && fd <= 40)) err("footprint must be [width, depth] in metres, as surveyed");
  }
  if (plan.tree !== undefined && !TREES.includes(plan.tree)) err(`tree must be one of ${TREES.join(", ")}`);
  if (plan.mirror !== undefined && typeof plan.mirror !== "boolean") err("mirror must be true or false");
  if (plan.inspiration !== undefined && !INSPIRATIONS.has(plan.inspiration)) err(`inspiration "${plan.inspiration}" is not a family in docs/design-references.md (${[...INSPIRATIONS].join(", ")})`);
  if (plan.priceCents % 100 !== 0) err("priceCents must be whole dollars");
  if (plan.model !== undefined) {
    const { src, bearing, origin } = plan.model ?? {};
    if (typeof src !== "string" || !src.startsWith("/models/") || !existsSync(path.join(root, "public", src))) err(`model.src must point to a file in public/models/, got ${JSON.stringify(src)}`);
    if (!(bearing >= 0 && bearing < 360)) err("model.bearing must be a compass bearing from 0 to 360");
    if (plan.location === undefined) err("a plan with a 3D model needs its exact location");
    else if (origin !== undefined) {
      // the model stands at its own surveyed spot, next to the map point (its entrance, say)
      const [lng, lat] = Array.isArray(origin) ? origin : [];
      const metres = Math.hypot((lng - plan.location[0]) * 111320 * Math.cos((lat * Math.PI) / 180), (lat - plan.location[1]) * 110540);
      if (!(metres < 60)) err(`model.origin must be [longitude, latitude] within 60 m of location, got ${JSON.stringify(origin)}`);
    }
  }
  // the projects map (/map): Azerbaijan lies within 44.7–50.7 E, 38.3–42 N
  if (plan.location !== undefined) {
    const [lng, lat] = Array.isArray(plan.location) ? plan.location : [];
    if (!(lng >= 44.7 && lng <= 50.7 && lat >= 38.3 && lat <= 42)) err(`location must be [longitude, latitude] inside Azerbaijan, got ${JSON.stringify(plan.location)}`);
  } else if (!(plan.slug?.replace(/-\d+$/, "") in PLACES)) {
    warnings.push(`${id}: no map position — add "location": [longitude, latitude] (centre of the place it is named after) so it shows on /map`);
  }
  const suggested = suggestedPrice(plan);
  if (Math.abs(plan.priceCents / 100 - suggested) / suggested > 0.15) warnings.push(`${id}: price $${plan.priceCents / 100} is more than 15% from the rule ($${suggested})`);

  // the generated drawings must work and agree with the listing
  let model;
  try {
    model = buildModel(plan);
    const sheets = model.interior
      ? [...interiorSheets(model).flatMap((sh) => [sh.svg(), sh.kind === "schedules" ? null : sh.svg({ preview: true })]).filter(Boolean), cutawaySheet(model, "", { bare: true })]
      : [sitePlanSheet(model, "x"), elevationSheet(model, "x"), elevationSheet(model, "", true), axonometricSheet(model, "x"), scheduleSheet(model, "x"), ...model.levels.map((_, i) => floorPlanSheet(model, i, "x"))];
    if (model.project) sheets.push(axonometricSheet(model, "x", { typical: true }));
    for (const svg of sheets) {
      const s = svg.toString();
      if (/NaN|undefined|Infinity/.test(s)) err(`a generated sheet contains invalid numbers: …${s.match(/.{40}(NaN|undefined|Infinity).{10}/)?.[0]}…`);
      for (const tag of s.match(/<[a-zA-Z][^>]*>/g) ?? []) {
        const names = [...tag.matchAll(/\s([a-zA-Z-:]+)=/g)].map((m) => m[1]);
        const dup = names.find((n, i) => names.indexOf(n) !== i);
        if (dup) {
          err(`a generated sheet has a duplicate "${dup}" attribute`);
          break;
        }
      }
    }
  } catch (e) {
    err(`drawing generator failed: ${e.message}`);
    continue;
  }
  if (plan.footprint !== undefined) {
    // the area must be what the drawings show: every level's footprint less any double-height void
    const gross = grossFloorArea(model);
    if (Math.abs(gross - plan.areaM2) / plan.areaM2 > 0.05) err(`the drawings have ${gross.toFixed(0)} m² of floor area (footprint ${plan.footprint.join(" × ")} m on ${plan.floors} levels, less voids) — set areaM2 to ${Math.round(gross)}`);
  }
  if (model.project && rules.commercial && plan.parking !== model.project.layout.parking) err(`parking is ${plan.parking} but the masterplan draws ${model.project.layout.parking} bays — set parking to ${model.project.layout.parking}`);
  const wet = wetRooms(model);
  if (wet !== plan.bathrooms) err(`bathrooms is ${plan.bathrooms} but the generated plans have ${wet} bathrooms/WCs — set bathrooms to ${wet}`);
  const bedrooms = model.levels.reduce((n, lv) => n + lv.spaces.filter((s) => s.kind === "bedroom" || s.kind === "master").length, 0);
  if (bedrooms !== plan.bedrooms) err(`bedrooms is ${plan.bedrooms} but the generated plans have ${bedrooms}`);

  if (plan.demo) {
    const dir = path.join(root, "renders", plan.slug);
    const has = existsSync(dir) && (await readdir(dir)).some((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (!has) (requireRenders ? errors : warnings).push(`${id}: no concept render in renders/${plan.slug}/`);
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
console.log(`${plans.length} plans checked, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
