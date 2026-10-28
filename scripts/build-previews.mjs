// Builds public preview images for the plans in data/plans.json.
//   renders/<slug>/*.jpg|png|webp         ->  public/plans/<slug>/render-NN.jpg  (concept visualisations, no watermark)
//   renders/<slug>/owner/*.jpg|png|webp   ->  public/plans/<slug>/owner-NN.jpg   (the owner's own photos and plans,
//                                             shown whole on a paper background; strip private details first)
//   private-assets/<slug>/*.jpg|png|webp  ->  public/plans/<slug>/image-NN.jpg   (real drawings/renders, watermarked)
// Plans without private originals also get generated concept sheets (see scripts/drawings.mjs):
//   site.jpg, lower.jpg (a luxury villa's lower ground floor), plan-0.jpg, plan-1.jpg…, elevation.jpg, section.jpg (a
//   luxury villa's section through its sunken court), axonometric.jpg, schedules.jpg
// and every plan gets card images cover.jpg (main visual) and cover-2.jpg (rendered elevation, shown on hover).
//
//   npm run previews                    rebuild every plan
//   npm run previews -- --missing       only plans that have no public/plans/<slug> folder yet
//   npm run previews -- --only a,b      only the listed slugs
//   npm run previews -- --only a --out /tmp/x   write into /tmp/x/<slug>/ and /tmp/x/previews.generated.ts instead of
//                                               public/plans and lib/ (to look at the sheets without touching the site)
//
// lib/previews.generated.ts is always rewritten from the files on disk, so partial runs keep the other plans.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { axonometricSheet, buildModel, cutawaySheet, elevationSheet, floorPlanSheet, interiorSheets, isCustomDrawn, planSheets, scheduleSheet, sectionSheet, sitePlanSheet, SHEET_H, SHEET_W } from "./drawings.mjs";

const root = process.cwd();
const SOURCE = path.join(root, "private-assets");
const RENDERS = path.join(root, "renders");
const outArg = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
const OUT = outArg ? path.resolve(outArg) : path.join(root, "public", "plans");
const GENERATED = outArg ? path.join(OUT, "previews.generated.ts") : path.join(root, "lib", "previews.generated.ts");
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const CARD = { width: 1200, height: 800 };
const PAPER = "#f5f2ec"; // sheet paper colour (scripts/drawings.mjs)

const plans = JSON.parse(await readFile(path.join(root, "data", "plans.json"), "utf8"));

const args = process.argv.slice(2);
const onlyArg = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const only = onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim())) : null;
const missing = args.includes("--missing");
const selected = plans.filter((p) => (only ? only.has(p.slug) : missing ? !existsSync(path.join(OUT, p.slug)) : true));
if (only) for (const slug of only) if (!plans.some((p) => p.slug === slug)) throw new Error(`--only: no plan "${slug}" in data/plans.json`);

function watermarkSvg(width, height) {
  const text = "havs.dev · PREVIEW";
  const step = 320;
  let marks = "";
  for (let y = -step; y < height + step; y += step) {
    for (let x = -step; x < width + step; x += step) {
      marks += `<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-family="Inter, sans-serif" font-size="46" font-weight="700" fill="white" fill-opacity="0.38" stroke="black" stroke-opacity="0.25" stroke-width="2">${text}</text>`;
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${marks}</svg>`);
}

// soften: a slight blur at preview size so the small dimension and table text of a full drawing sheet cannot be read
async function writePreview(input, outFile, { soften = false } = {}) {
  let img = sharp(input)
    .rotate()
    .resize({ width: SHEET_W, height: SHEET_H, fit: "inside", withoutEnlargement: true });
  if (soften) img = sharp(await img.toBuffer()).blur(1.1);
  const resized = await img.toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  await sharp(resized.data)
    .composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outFile);
}

const listImages = async (dir) => (existsSync(dir) ? (await readdir(dir)).filter((f) => IMAGE_EXT.test(f)).sort() : []);
const render = (svg, file) => sharp(svg, { density: 96 }).jpeg({ quality: 88, mozjpeg: true }).toFile(file);
const card = (input, file) => sharp(input, { density: 72 }).resize({ ...CARD, fit: "cover", position: "centre" }).jpeg({ quality: 84, mozjpeg: true }).toFile(file);
const nn = (i) => String(i + 1).padStart(2, "0");

for (const plan of selected) {
  const { slug } = plan;
  const outDir = path.join(OUT, slug);
  const custom = isCustomDrawn(plan);
  const sources = await listImages(path.join(SOURCE, slug));
  if (custom && !sources.length) {
    // a custom sheet set is previewed only from its full-resolution originals, which are never committed: keep what is there
    if (existsSync(outDir)) {
      console.warn(`${slug}: custom drawings — private-assets/${slug}/ is not on this machine, keeping public/plans/${slug}/ as it is`);
      continue;
    }
    throw new Error(`${slug}: custom drawings — put the full-resolution sheet images in private-assets/${slug}/ first`);
  }
  if (custom && !(await listImages(path.join(RENDERS, slug))).length) throw new Error(`${slug}: custom drawings need concept renders in renders/${slug}/`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // 1. concept visualisations (renders/<slug>)
  const renders = await listImages(path.join(RENDERS, slug));
  for (const [i, name] of renders.entries()) {
    await sharp(path.join(RENDERS, slug, name))
      .rotate()
      .resize({ width: SHEET_W, height: SHEET_H, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(outDir, `render-${nn(i)}.jpg`));
  }

  // 1b. the owner's own photos, sketches and survey plans, fitted whole into the gallery frame
  const owner = await listImages(path.join(RENDERS, slug, "owner"));
  for (const [i, name] of owner.entries()) {
    await sharp(path.join(RENDERS, slug, "owner", name))
      .rotate()
      .resize({ width: 1600, height: 1067, fit: "contain", background: PAPER })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(outDir, `owner-${nn(i)}.jpg`));
  }

  // 2. real material (watermarked) or generated concept sheets
  const model = custom ? null : buildModel(plan);
  if (sources.length) {
    for (const [i, name] of sources.entries()) await writePreview(path.join(SOURCE, slug, name), path.join(outDir, `image-${nn(i)}.jpg`), { soften: custom });
  } else if (model.interior) {
    // interior set: layouts, finishes, ceilings, elevations, cutaway and materials board; schedules as a locked teaser
    for (const sh of interiorSheets(model)) {
      if (sh.kind === "schedules") await sharp(sh.svg(), { density: 36 }).blur(6).jpeg({ quality: 60 }).toFile(path.join(outDir, "schedules.jpg"));
      else await render(sh.svg({ preview: true }), path.join(outDir, `${sh.kind}.jpg`));
    }
  } else {
    // public previews: watermarked, without dimensions, level heights or a scale bar — the full sheets are only in the paid package
    const preview = { preview: true };
    await render(sitePlanSheet(model, "A-001", preview), path.join(outDir, "site.jpg"));
    // one sheet per level; a run of identical typical floors is drawn once (typical.jpg)
    for (const [k, p] of planSheets(model).entries()) await render(floorPlanSheet(model, p.index, `A-10${k + 1}`, { ...preview, title: p.title }), path.join(outDir, `${p.kind}.jpg`));
    await render(elevationSheet(model, "A-201", false, preview), path.join(outDir, "elevation.jpg"));
    if (model.lower) await render(sectionSheet(model, "A-202", preview), path.join(outDir, "section.jpg"));
    await render(axonometricSheet(model, "A-301", preview), path.join(outDir, "axonometric.jpg"));
    // schedules are shown locked: a small, blurred teaser only
    await sharp(scheduleSheet(model, "A-401"), { density: 36 }).blur(6).jpeg({ quality: 60 }).toFile(path.join(outDir, "schedules.jpg"));
  }

  // 3. card images: the first render (or first image), and the rendered elevation on hover
  // (an interior shows its cutaway on hover instead of the building's elevation)
  const hover = custom ? path.join(RENDERS, slug, renders[1] ?? renders[0]) : model.interior ? cutawaySheet(model, "", { bare: true }) : elevationSheet(model, "", true, { preview: true });
  const coverSrc = renders.length ? path.join(RENDERS, slug, renders[0]) : sources.length ? path.join(SOURCE, slug, sources[0]) : hover;
  await card(coverSrc, path.join(outDir, "cover.jpg"));
  await card(hover, path.join(outDir, "cover-2.jpg"));
  console.log(`${slug}: ${renders.length} render(s), ${owner.length ? `${owner.length} owner image(s), ` : ""}${sources.length ? `${sources.length} watermarked image(s)` : `${model.interior ? interiorSheets(model).length : planSheets(model).length + 4 + (model.lower ? 1 : 0)} concept sheets`}`);
}
if (!selected.length) console.log("nothing to build");

// Gallery order: renders, owner's material, real images, site plan, floor plans (from the lower ground floor up),
// elevation, axonometric.
const KIND_ORDER = [/^render-/, /^owner-/, /^image-/, /^site\./, /^lower\./, /^plan-/, /^typical\./, /^finish-/, /^ceiling-/, /^elevation\./, /^section\./, /^interior\./, /^axonometric\./, /^cutaway\./, /^materials\./, /^schedules\./];
const kindOf = (file) => file.replace(/\.jpg$/, "").replace(/^(render|owner|image)-\d+$/, "$1");
const generated = {};
for (const { slug } of plans) {
  const dir = path.join(OUT, slug);
  if (!existsSync(dir)) {
    if (!outArg) console.warn(`warning: public/plans/${slug} is missing — run npm run previews -- --only ${slug}`);
    continue;
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg") && !f.startsWith("cover"));
  const rank = (f) => KIND_ORDER.findIndex((re) => re.test(f));
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "en", { numeric: true }));
  const url = (f) => `/plans/${slug}/${f}`;
  generated[slug] = { cover: url("cover.jpg"), hover: url("cover-2.jpg"), sheets: files.map((f) => ({ src: url(f), kind: kindOf(f) })) };
}

// Folders with no plan entry are probably typos.
for (const dir of outArg ? [] : [SOURCE, RENDERS, OUT]) {
  if (!existsSync(dir)) continue;
  for (const name of await readdir(dir)) {
    if (!plans.some((p) => p.slug === name) && !name.includes(".")) console.warn(`warning: ${path.relative(root, dir)}/${name} has no matching plan in data/plans.json`);
  }
}

await writeFile(
  GENERATED,
  `// Generated by scripts/build-previews.mjs — do not edit by hand.\nexport type SheetKind = "render" | "owner" | "image" | "site" | "elevation" | "axonometric" | "schedules" | "interior" | "cutaway" | "materials" | "typical" | "lower" | "section" | \`plan-\${number}\` | \`finish-\${number}\` | \`ceiling-\${number}\`;\nexport const PREVIEWS: Record<string, { cover: string; hover: string; sheets: { src: string; kind: SheetKind }[] }> = ${JSON.stringify(generated, null, 2)};\n`,
);
console.log("wrote", path.relative(root, GENERATED));
