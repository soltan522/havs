// Checks data/plans.json before anything is published, and renders every concept sheet in memory.
//   npm run validate                       all plans
//   npm run validate -- --require-renders  also require renders/<slug>/ images for every demo plan
// Exits with code 1 on the first run of problems; warnings do not fail.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
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
