// Checks data/plans.json before anything is published, and renders every concept sheet in memory.
//   npm run validate                       all plans
//   npm run validate -- --require-renders  also require renders/<slug>/ images for every demo plan
// Exits with code 1 on the first run of problems; warnings do not fail.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { axonometricSheet, buildModel, cutawaySheet, elevationSheet, FACADE_OPTIONS, floorPlanSheet, grossFloorArea, INTERIOR_LAYOUTS, INTERIOR_TYPES, interiorSheets, isCustomDrawn, PALETTES, planSheets, PROJECT_RULES, scheduleSheet, SHEET_H, SHEET_W, sitePlanSheet, STYLE_RULES, TREES, wetRooms } from "./drawings.mjs";

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
 * Catalogue price rule (lib/pricing.ts): 30 per m² of drawn floor area, all houses of a multi-unit project together.
 * The site shows the same number as AZN to visitors in Azerbaijan and as USD to everyone else.
 */
export const PRICE_PER_M2 = 30;
export const catalogPrice = (plan) => plan.areaM2 * Math.max(1, plan.project?.units ?? 1) * PRICE_PER_M2;

// ---- nothing may repeat an existing design
const norm = (s) => s.toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0400-\u04ff]+/g, " ").trim();
const stem = (slug) => slug.replace(/-\d+$/, "");
// a multi-unit project is its own kind of design: it never collides with a single villa of the same style
const projectTag = (p) => (p.interior ? `interior:${p.interior.type}` : p.project ? `${p.project.kind}×${p.project.units}` : "villa");
// an interior repeats a design when the same kind of space has the same palette and bedrooms
const designKey = (p) => (p.interior ? [projectTag(p), p.interior.palette, p.bedrooms].join("|") : [projectTag(p), p.style, p.floors, p.bedrooms, p.garage ? "garage" : "-", p.pool ? "pool" : "-", ...(p.layout ? [p.layout] : [])].join("|"));
const layoutKey = (p) => (p.project || p.interior ? `project:${p.slug}` : [p.style === "duplex" ? "duplex" : p.style === "luxury" ? p.floors - 1 : p.floors, p.bedrooms, p.garage, p.pool, !!p.mirror].join("|"));
// custom-drawn plans have no generated design to compare: the design rules below look at generated plans only
const generated = plans.filter((p) => !isCustomDrawn(p));
const firstBy = (keyFn, list = plans) => {
  const map = new Map();
  for (const p of list) {
    const k = keyFn(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p.slug);
  }
  return map;
};
for (const [k, slugs] of firstBy((p) => stem(p.slug ?? ""))) if (slugs.length > 1) errors.push(`${slugs.join(", ")}: the same place name "${k}" is used more than once`);
for (const l of LANGS) for (const [k, slugs] of firstBy((p) => norm(p.title?.[l] ?? ""))) if (k && slugs.length > 1) errors.push(`${slugs.join(", ")}: identical ${l} title "${k}"`);
for (const [k, slugs] of firstBy(designKey, generated)) if (slugs.length > 1) errors.push(`${slugs.join(", ")}: same design (style|floors|bedrooms|garage|pool = ${k}) — change at least one of these`);
// same style and storeys with almost the same area reads as the same house
for (let i = 0; i < generated.length; i++) {
  for (let j = i + 1; j < generated.length; j++) {
    const a = generated[i], b = generated[j];
    if (a.style === b.style && a.floors === b.floors && projectTag(a) === projectTag(b) && (a.layout ?? "") === (b.layout ?? "") && Math.abs(a.areaM2 - b.areaM2) < 25) errors.push(`${a.slug}, ${b.slug}: same style and floors with areas only ${Math.abs(a.areaM2 - b.areaM2)} m² apart — make them clearly different`);
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
for (const [k, slugs] of firstBy(layoutKey, generated)) if (slugs.length > 2) warnings.push(`${slugs.join(", ")}: ${slugs.length} villas share the floor-plan layout ${k} — vary bedrooms, garage, pool or mirror`);
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
  if (!rules.custom && (perFloor < minFloor || perFloor > maxFloor)) err(`area per floor ${perFloor.toFixed(0)} m² is outside ${minFloor}–${maxFloor} m² — the generated plans would not be credible`);
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
  const maxRatio = rules.layouts ? 4.0 : 2.2;
  if (plan.ratio !== undefined && !(plan.ratio >= 1 && plan.ratio <= maxRatio)) err(`ratio must be between 1.0 and ${maxRatio}`);
  if (rules.layouts) {
    // commercial buildings: a drawn plan (layout) and cladding (facade); some plans fix the storeys and roof
    const lay = plan.layout ?? "a";
    if (!(lay in rules.layouts)) err(`layout must be one of ${Object.keys(rules.layouts).join(", ")}`);
    else if (rules.layouts[lay] && !rules.layouts[lay].includes(plan.floors)) err(`layout ${lay} of a ${plan.style} is drawn on ${rules.layouts[lay].join(" or ")} floor(s)`);
    if (plan.facade !== undefined && !(FACADE_OPTIONS[plan.style] ?? []).includes(plan.facade)) err(`facade must be one of ${(FACADE_OPTIONS[plan.style] ?? []).join(", ")}`);
    if (plan.style === "restaurant" && (lay === "d") !== (plan.roof === "gable")) err("the mountain lodge (layout d) has the pitched roof; the other restaurants are flat-roofed");
    if (plan.style === "restaurant" && lay === "d" && plan.facade !== "lodge") err('the mountain lodge (layout d) takes facade "lodge"');
    if (plan.style === "restaurant" && lay !== "d" && plan.facade === "lodge") err('facade "lodge" is for the mountain lodge (layout d)');
    if (plan.garage || plan.pool) err("commercial buildings park cars on the masterplan and have no private pool: set garage and pool to false");
  } else if (plan.layout !== undefined || plan.facade !== undefined) err(`"layout" and "facade" are for the commercial building styles`);
  if (plan.footprint !== undefined && !rules.custom) {
    // existing buildings keep their measured footprint instead of one derived from the area
    const [fw, fd] = Array.isArray(plan.footprint) ? plan.footprint : [];
    if (!(fw >= 6 && fw <= 60 && fd >= 6 && fd <= 40)) err("footprint must be [width, depth] in metres, as surveyed");
  }
  if (plan.tree !== undefined && !TREES.includes(plan.tree)) err(`tree must be one of ${TREES.join(", ")}`);
  if (plan.mirror !== undefined && typeof plan.mirror !== "boolean") err("mirror must be true or false");
  if (plan.inspiration !== undefined && !INSPIRATIONS.has(plan.inspiration)) err(`inspiration "${plan.inspiration}" is not a family in docs/design-references.md (${[...INSPIRATIONS].join(", ")})`);
  if (plan.priceCents % 100 !== 0) err("priceCents must be a whole amount");
  if (plan.model !== undefined) {
    const { src, bearing, origin, replaces, zoom } = plan.model ?? {};
    if (typeof src !== "string" || !src.startsWith("/models/") || !existsSync(path.join(root, "public", src))) err(`model.src must point to a file in public/models/, got ${JSON.stringify(src)}`);
    if (!(bearing >= 0 && bearing < 360)) err("model.bearing must be a compass bearing from 0 to 360");
    // city-layer buildings the model stands in place of (ids in public/tiles/buildings), and the map close-up for a large site
    if (replaces !== undefined && !(Array.isArray(replaces) && replaces.length && replaces.every((id) => typeof id === "string" && id))) err("model.replaces must be a list of city building ids");
    if (zoom !== undefined && !(typeof zoom === "number" && zoom >= 14 && zoom <= 20)) err("model.zoom must be a map zoom from 14 to 20");
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
  const price = catalogPrice(plan);
  if (plan.priceCents !== price * 100) err(`priceCents must be ${price * 100} (${plan.areaM2} m²${plan.project?.units > 1 ? ` × ${plan.project.units} houses` : ""} × ${PRICE_PER_M2} per m²), not ${plan.priceCents}`);

  // the site reads plan.drawings, the scripts the style: both must say the same
  if (plan.drawings !== undefined && plan.drawings !== "custom") err('drawings must be "custom" or left out');
  else if (!!rules.custom !== (plan.drawings === "custom")) err(rules.custom ? `style ${plan.style} is drawn outside the generator: set "drawings": "custom"` : `"drawings": "custom" is only for the custom-drawn styles (${Object.keys(STYLE_RULES).filter((s) => STYLE_RULES[s].custom).join(", ")})`);
  for (const field of ["staff", "siteM2"]) if (plan[field] !== undefined && !(Number.isInteger(plan[field]) && plan[field] > 0)) err(`${field} must be a positive integer`);
  if (plan.sheetTitles !== undefined && !rules.custom) err("sheetTitles name the sheets of a custom-drawn set");

  if (rules.custom) {
    // drawn outside the generator: nothing to render or count here — the listing carries its own figures and previews
    if (plan.footprint !== undefined || plan.layout !== undefined) err("footprint and layout only drive the generator; a custom-drawn plan takes neither");
    if (plan.parking !== undefined && !(Number.isInteger(plan.parking) && plan.parking >= 0)) err("parking must be a whole number");
    // the generator-side rules for these sit with the layouts above, which a custom style has none of
    if (plan.pool) err("a custom-drawn site has no private pool: set pool to false");
    if (rules.commercial && plan.bedrooms !== 0) err("commercial buildings have no bedrooms: set bedrooms to 0");
    const rdir = path.join(root, "renders", plan.slug);
    if (!(existsSync(rdir) && (await readdir(rdir)).some((f) => /\.(jpe?g|png|webp)$/i.test(f)))) err(`custom drawings need concept renders in renders/${plan.slug}/`);
    const pdir = path.join(root, "public", "plans", plan.slug);
    const sheets = existsSync(pdir) ? (await readdir(pdir)).filter((f) => /^image-\d+\.jpg$/.test(f)) : [];
    if (!sheets.length) err(`custom drawings need watermarked sheet previews public/plans/${plan.slug}/image-NN.jpg — put the full-resolution sheets in private-assets/${plan.slug}/ and run npm run previews -- --only ${plan.slug}`);
    for (const f of sheets) {
      const { width, height } = await sharp(path.join(pdir, f)).metadata();
      if (width > SHEET_W || height > SHEET_H) err(`public/plans/${plan.slug}/${f} is ${width}×${height} — public sheet previews are at most ${SHEET_W}×${SHEET_H}`);
    }
    // the gallery labels each sheet preview with its own title, in sheet order
    if (plan.sheetTitles !== undefined) {
      if (!Array.isArray(plan.sheetTitles) || plan.sheetTitles.length !== sheets.length) err(`sheetTitles must name each of the ${sheets.length} sheet previews, in order`);
      else plan.sheetTitles.forEach((t, i) => LANGS.forEach((l) => !t?.[l]?.trim() && err(`missing sheetTitles[${i}].${l}`)));
    }
    for (const dir of [rdir, pdir]) for (const f of existsSync(dir) ? await readdir(dir, { recursive: true }) : []) if (/\.(pdf|dwg|dxf)$/i.test(f)) err(`${path.relative(root, dir)}/${f}: package files never go in the public repository`);
    continue;
  }

  // the generated drawings must work and agree with the listing
  let model;
  try {
    model = buildModel(plan);
    const sheets = model.interior
      ? [...interiorSheets(model).flatMap((sh) => [sh.svg(), sh.kind === "schedules" ? null : sh.svg({ preview: true })]).filter(Boolean), cutawaySheet(model, "", { bare: true })]
      : [sitePlanSheet(model, "x"), elevationSheet(model, "x"), elevationSheet(model, "", true), axonometricSheet(model, "x"), scheduleSheet(model, "x"), ...planSheets(model).map((p) => floorPlanSheet(model, p.index, "x", { title: p.title }))];
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
  if (model.project && (rules.commercial || rules.residential) && plan.parking !== model.project.layout.parking) err(`parking is ${plan.parking} but the masterplan draws ${model.project.layout.parking} bays — set parking to ${model.project.layout.parking}`);
  if (rules.metric && plan[rules.metric] !== model.metrics[rules.metric]) err(`${rules.metric} is ${plan[rules.metric]} but the drawings have ${model.metrics[rules.metric]} — set ${rules.metric} to ${model.metrics[rules.metric]}`);
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
