// Checks data/plans.json before anything is published, and renders every concept sheet in memory.
//   npm run validate                       all plans
//   npm run validate -- --require-renders  also require renders/<slug>/ images for every demo plan
// Exits with code 1 on the first run of problems; warnings do not fail.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { axonometricSheet, buildModel, elevationSheet, floorPlanSheet, sitePlanSheet, STYLE_RULES, TREES, wetRooms } from "./drawings.mjs";

const root = process.cwd();
const plans = JSON.parse(await readFile(path.join(root, "data", "plans.json"), "utf8"));
const requireRenders = process.argv.includes("--require-renders");
const LANGS = ["az", "en", "ru"];
const errors = [];
const warnings = [];

/** Catalogue price rule for sample villas (USD): ~$300 + $4.2/m², rounded to …90, +$100 for premium styles. */
export function suggestedPrice(plan) {
  const premium = ["tuscan", "coastal", "luxury", "mediterranean"].includes(plan.style) ? 100 : 0;
  return Math.round((300 + 4.2 * plan.areaM2) / 100) * 100 - 10 + premium;
}

// ---- nothing may repeat an existing design
const norm = (s) => s.toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0400-\u04ff]+/g, " ").trim();
const stem = (slug) => slug.replace(/-\d+$/, "");
const designKey = (p) => [p.style, p.floors, p.bedrooms, p.garage ? "garage" : "-", p.pool ? "pool" : "-", p.mirror ? "mirror" : "-"].join("|");
const layoutKey = (p) => [p.style === "duplex" ? "duplex" : p.style === "luxury" ? p.floors - 1 : p.floors, p.bedrooms, p.garage, p.pool, !!p.mirror].join("|");
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
for (const [k, slugs] of firstBy(designKey)) if (slugs.length > 1) errors.push(`${slugs.join(", ")}: same design (style|floors|bedrooms|garage|pool|mirror = ${k}) — change at least one of these`);
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
  for (const field of ["title", "summary"]) for (const l of LANGS) if (!plan[field]?.[l]?.trim()) err(`missing ${field}.${l}`);
  for (const field of ["areaM2", "floors", "bedrooms", "bathrooms", "priceCents"]) if (!Number.isInteger(plan[field]) || plan[field] <= 0) err(`${field} must be a positive integer`);
  for (const field of ["garage", "pool", "published", "demo"]) if (typeof plan[field] !== "boolean") err(`${field} must be true or false`);
  const perFloor = plan.areaM2 / plan.floors;
  if (perFloor < 80 || perFloor > 320) err(`area per floor ${perFloor.toFixed(0)} m² is outside 80–320 m² — the generated plans would not be credible`);
  if (plan.style === "duplex" && plan.bedrooms !== 6) err("duplex template has exactly 6 bedrooms (3 per unit)");
  if (plan.ratio !== undefined && !(plan.ratio >= 1 && plan.ratio <= 2.2)) err("ratio must be between 1.0 and 2.2");
  if (plan.tree !== undefined && !TREES.includes(plan.tree)) err(`tree must be one of ${TREES.join(", ")}`);
  if (plan.mirror !== undefined && typeof plan.mirror !== "boolean") err("mirror must be true or false");
  if (plan.priceCents % 100 !== 0) err("priceCents must be whole dollars");
  const suggested = suggestedPrice(plan);
  if (Math.abs(plan.priceCents / 100 - suggested) / suggested > 0.15) warnings.push(`${id}: price $${plan.priceCents / 100} is more than 15% from the rule ($${suggested})`);

  // the generated drawings must work and agree with the listing
  let model;
  try {
    model = buildModel(plan);
    const sheets = [sitePlanSheet(model, "x"), elevationSheet(model, "x"), elevationSheet(model, "", true), axonometricSheet(model, "x"), ...model.levels.map((_, i) => floorPlanSheet(model, i, "x"))];
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
