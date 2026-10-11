// Builds public preview images for every plan in data/plans.json.
//   renders/<slug>/*.jpg|png|webp         ->  public/plans/<slug>/render-NN.jpg  (concept visualisations, no watermark)
//   private-assets/<slug>/*.jpg|png|webp  ->  public/plans/<slug>/NN.jpg         (real drawings/renders, watermarked)
// Plans without private originals also get generated concept sheets (see scripts/drawings.mjs):
//   A-001 site plan, A-101+ floor plans, A-201 south elevation, A-301 axonometric.
// Also writes lib/previews.generated.ts so the site knows each plan's gallery and card images.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { axonometricSheet, buildModel, elevationSheet, floorPlanSheet, sitePlanSheet, SHEET_H, SHEET_W } from "./drawings.mjs";

const root = process.cwd();
const SOURCE = path.join(root, "private-assets");
const RENDERS = path.join(root, "renders");
const OUT = path.join(root, "public", "plans");
const GENERATED = path.join(root, "lib", "previews.generated.ts");
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const CARD = { width: 1200, height: 800 };

const plans = JSON.parse(await readFile(path.join(root, "data", "plans.json"), "utf8"));

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

async function writePreview(input, outFile) {
  const resized = await sharp(input)
    .rotate()
    .resize({ width: SHEET_W, height: SHEET_H, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  await sharp(resized.data)
    .composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outFile);
}

const listImages = async (dir) => (existsSync(dir) ? (await readdir(dir)).filter((f) => IMAGE_EXT.test(f)).sort() : []);
const render = (svg, file) => sharp(svg, { density: 96 }).jpeg({ quality: 88, mozjpeg: true }).toFile(file);
const card = (input, file) => sharp(input, { density: 72 }).resize({ ...CARD, fit: "cover", position: "centre" }).jpeg({ quality: 84, mozjpeg: true }).toFile(file);

const generated = {};
for (const plan of plans) {
  const { slug } = plan;
  const outDir = path.join(OUT, slug);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const url = (f) => `/plans/${slug}/${f}`;
  const items = [];

  // 1. concept visualisations (renders/<slug>)
  const renders = await listImages(path.join(RENDERS, slug));
  for (const [i, name] of renders.entries()) {
    const file = `render-${String(i + 1).padStart(2, "0")}.jpg`;
    await sharp(path.join(RENDERS, slug, name))
      .rotate()
      .resize({ width: SHEET_W, height: SHEET_H, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(outDir, file));
    items.push({ src: url(file), kind: "render" });
  }

  // 2. real material (watermarked) or generated concept sheets
  const sources = await listImages(path.join(SOURCE, slug));
  const model = buildModel(plan);
  if (sources.length) {
    for (const [i, name] of sources.entries()) {
      const file = `${String(i + 1).padStart(2, "0")}.jpg`;
      await writePreview(path.join(SOURCE, slug, name), path.join(outDir, file));
      items.push({ src: url(file), kind: "image" });
    }
  } else {
    const sheets = [["site", sitePlanSheet(model, "A-001")]];
    model.levels.forEach((_, i) => sheets.push([`plan-${i}`, floorPlanSheet(model, i, `A-10${i + 1}`)]));
    sheets.push(["elevation", elevationSheet(model, "A-201")], ["axonometric", axonometricSheet(model, "A-301")]);
    for (const [i, [kind, svg]] of sheets.entries()) {
      const file = `sheet-${String(i + 1).padStart(2, "0")}.jpg`;
      await render(svg, path.join(outDir, file));
      items.push({ src: url(file), kind });
    }
  }

  // 3. card images: the first render (or first image), and the rendered elevation on hover
  const coverSrc = renders.length ? path.join(RENDERS, slug, renders[0]) : sources.length ? path.join(SOURCE, slug, sources[0]) : null;
  if (coverSrc) await card(coverSrc, path.join(outDir, "cover.jpg"));
  else await card(elevationSheet(model, "", true), path.join(outDir, "cover.jpg"));
  await card(elevationSheet(model, "", true), path.join(outDir, "cover-2.jpg"));

  generated[slug] = { cover: url("cover.jpg"), hover: url("cover-2.jpg"), sheets: items };
  console.log(`${slug}: ${renders.length} render(s), ${sources.length ? `${sources.length} watermarked image(s)` : `${items.length - renders.length} concept sheets`}`);
}

// Folders with no plan entry are probably typos.
for (const dir of [SOURCE, RENDERS]) {
  if (!existsSync(dir)) continue;
  for (const name of await readdir(dir)) {
    if (!plans.some((p) => p.slug === name) && !name.includes(".")) console.warn(`warning: ${path.relative(root, dir)}/${name} has no matching plan in data/plans.json`);
  }
}

await writeFile(
  GENERATED,
  `// Generated by scripts/build-previews.mjs — do not edit by hand.\nexport type SheetKind = "render" | "image" | "site" | "elevation" | "axonometric" | \`plan-\${number}\`;\nexport const PREVIEWS: Record<string, { cover: string; hover: string; sheets: { src: string; kind: SheetKind }[] }> = ${JSON.stringify(generated, null, 2)};\n`,
);
console.log("wrote", path.relative(root, GENERATED));
