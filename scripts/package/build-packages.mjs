// Builds the downloadable drawing package of each sample villa into deliverables/<slug>/ (git-ignored):
//   <slug>-drawings.pdf  vector A3 drawing set: cover, site plan, floor plans, elevation, isometric, schedules
//                        (a multi-unit project: masterplan, typical house plans, street elevation, two isometrics)
//   <slug>.dxf           layered CAD model (metres) with A3 paper-space layouts per floor   (python3 + ezdxf)
//   <slug>.dwg           the same drawing as AutoCAD 2000 DWG                               (LibreDWG dxf2dwg)
// and records file names, sizes and sheet counts in data/packages.json for the website.
//
//   node scripts/package/build-packages.mjs [--missing | --only a,b]
//   DXF2DWG=/path/to/dxf2dwg DWG2DXF=/path/to/dwg2dxf  — optional; DWG is skipped when not available.
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { axonometricSheet, buildModel, cadModel, coverSheet, elevationSheet, floorPlanSheet, scheduleSheet, sitePlanSheet, SHEET_H, SHEET_W } from "../drawings.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const OUT = path.join(root, "deliverables");
const META = path.join(root, "data", "packages.json");
const A3 = [1190.55, 841.89]; // points, landscape
const FONTS = {
  regular: require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff"),
  semibold: require.resolve("@fontsource/inter/files/inter-latin-600-normal.woff"),
};

const plans = JSON.parse(await readFile(path.join(root, "data", "plans.json"), "utf8"));
const meta = existsSync(META) ? JSON.parse(await readFile(META, "utf8")) : {};
const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const missing = args.includes("--missing");
const selected = plans.filter((p) => (only ? only.has(p.slug) : missing ? !meta[p.slug] : true));

const tool = (envName, fallback) => {
  const p = process.env[envName] || fallback;
  return p && existsSync(p) ? p : null;
};
const DXF2DWG = tool("DXF2DWG", "/usr/local/bin/dxf2dwg");
const DWG2DXF = tool("DWG2DXF", "/usr/local/bin/dwg2dxf");
const PYTHON = process.env.PYTHON || "python3";

function sheetsFor(model, renderUri) {
  // a multi-unit project: masterplan, the typical house, the street front / ensemble, then the typical house in 3D
  const project = model.project;
  const several = !!project && project.units > 1;
  const typical = several ? "Typical house — " : "";
  const list = [{ no: "A-001", title: project ? "Masterplan" : "Site plan", scale: "Graphic", svg: () => sitePlanSheet(model, "A-001") }];
  model.levels.forEach((lv, i) => list.push({ no: `A-10${i + 1}`, title: typical + (several ? lv.name.toLowerCase() : lv.name.charAt(0) + lv.name.slice(1).toLowerCase()), scale: "Graphic", svg: () => floorPlanSheet(model, i, `A-10${i + 1}`) }));
  list.push({ no: "A-201", title: project?.kind === "row" ? "Street elevation" : `${typical}${several ? "south" : "South"} elevation`, scale: "Graphic", svg: () => elevationSheet(model, "A-201") });
  list.push({ no: "A-301", title: several ? "Isometric view — whole project" : project ? "Isometric view — whole site" : "Isometric view", scale: "NTS", svg: () => axonometricSheet(model, "A-301") });
  if (several) list.push({ no: "A-302", title: "Isometric view — typical house", scale: "NTS", svg: () => axonometricSheet(model, "A-302", { typical: true }) });
  list.push({ no: "A-401", title: "Area, room, door and window schedules", scale: "NTS", svg: () => scheduleSheet(model, "A-401") });
  const index = [{ no: "A-000", title: "Cover sheet", scale: "NTS" }, ...list.map(({ no, title, scale }) => ({ no, title, scale }))];
  return [{ no: "A-000", svg: () => coverSheet(model, renderUri, index) }, ...list];
}

function writePdf(file, plan, sheets) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: A3,
      margin: 0,
      autoFirstPage: false,
      info: {
        Title: `${plan.title.en} — concept design drawings`,
        Author: "havs.dev",
        Subject: "Concept design package — not for construction",
        Keywords: "villa, architecture, floor plan, elevation, site plan",
        Creator: "havs.dev",
      },
    });
    doc.registerFont("Inter", FONTS.regular);
    doc.registerFont("Inter-SemiBold", FONTS.semibold);
    const stream = createWriteStream(file);
    doc.pipe(stream);
    const k = Math.min(A3[0] / SHEET_W, A3[1] / SHEET_H);
    const w = SHEET_W * k;
    const h = SHEET_H * k;
    for (const s of sheets) {
      doc.addPage();
      doc.rect(0, 0, A3[0], A3[1]).fill("#f5f2ec");
      SVGtoPDF(doc, s.svg().toString(), (A3[0] - w) / 2, (A3[1] - h) / 2, {
        width: w,
        height: h,
        assumePt: false,
        fontCallback: (family, bold) => (bold ? "Inter-SemiBold" : "Inter"),
        warningCallback: () => {},
      });
    }
    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function buildDwg(dxf, dwg) {
  if (!DXF2DWG) return "skipped (dxf2dwg not installed)";
  const tmp = dwg.replace(/\.dwg$/, ".r2000.dxf");
  execFileSync(PYTHON, [path.join(root, "scripts/package/dxf_for_dwg.py"), dxf, tmp], { stdio: "pipe" });
  try {
    execFileSync(DXF2DWG, ["-y", "-o", dwg, tmp], { stdio: "pipe" });
  } catch {
    // dxf2dwg reports non-fatal warnings with a non-zero status; the round trip below decides
  }
  if (!existsSync(dwg)) return "failed (no output)";
  if (DWG2DXF) {
    // round trip: the DWG must read back with (almost) all entities
    const back = dwg.replace(/\.dwg$/, ".roundtrip.dxf");
    try {
      execFileSync(DWG2DXF, ["-y", "-o", back, dwg], { stdio: "pipe" });
    } catch {
      // see above
    }
    const count = (f) => Number(execFileSync(PYTHON, ["-c", `import ezdxf,sys\nfrom ezdxf import recover\nd,a=recover.readfile(sys.argv[1])\nprint(len(d.modelspace()))`, f]).toString().trim());
    const ok = existsSync(back) && count(back) >= 0.95 * count(tmp);
    execFileSync("rm", ["-f", back]);
    if (!ok) {
      execFileSync("rm", ["-f", dwg, tmp]);
      return "failed round trip";
    }
  }
  execFileSync("rm", ["-f", tmp]);
  return "ok";
}

for (const plan of selected) {
  const dir = path.join(OUT, plan.slug);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const model = buildModel(plan);

  const renderFile = path.join(root, "renders", plan.slug, "01.jpg");
  const renderUri = existsSync(renderFile) ? `data:image/jpeg;base64,${readFileSync(renderFile).toString("base64")}` : null;
  const sheets = sheetsFor(model, renderUri);

  const pdf = path.join(dir, `${plan.slug}-drawings.pdf`);
  await writePdf(pdf, plan, sheets);

  const json = path.join(dir, "cad.json");
  await writeFile(json, JSON.stringify(cadModel(model)));
  const dxf = path.join(dir, `${plan.slug}.dxf`);
  execFileSync(PYTHON, [path.join(root, "scripts/package/make_dxf.py"), json, dxf], { stdio: "inherit" });
  await rm(json);
  const dwg = path.join(dir, `${plan.slug}.dwg`);
  const dwgStatus = buildDwg(dxf, dwg);

  const files = [];
  const add = async (kind, file, extra = {}) => {
    if (existsSync(file)) files.push({ kind, name: path.basename(file), bytes: (await stat(file)).size, ...extra });
  };
  await add("pdf", pdf, { pages: sheets.length });
  await add("dwg", dwg);
  await add("cad", dxf);
  meta[plan.slug] = { files, sheets: sheets.length, builtAt: new Date().toISOString().slice(0, 10) };
  console.log(`${plan.slug}: ${files.map((f) => `${f.name} ${(f.bytes / 1024).toFixed(0)} KB`).join(", ")} · DWG ${dwgStatus}`);
}

// drop entries of plans that no longer exist, keep catalogue order
const ordered = Object.fromEntries(plans.filter((p) => meta[p.slug]).map((p) => [p.slug, meta[p.slug]]));
await writeFile(META, JSON.stringify(ordered, null, 2) + "\n");
console.log(`wrote ${path.relative(root, META)} (${Object.keys(ordered).length} packages)`);
for (const name of existsSync(OUT) ? await readdir(OUT) : []) if (!plans.some((p) => p.slug === name)) console.warn(`warning: deliverables/${name} has no plan`);
