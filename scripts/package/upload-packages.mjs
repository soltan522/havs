// Uploads deliverables/<slug>/* to the PRIVATE Supabase bucket, where /api/download serves them to buyers
// through 10-minute signed links. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub Actions secrets);
// without them it prints a notice and exits successfully, so publishing never depends on it.
//
//   node scripts/package/upload-packages.mjs [--only a,b]
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const bucket = process.env.SUPABASE_PLANS_BUCKET || "plans-private";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log("notice: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — packages were built but not uploaded");
  process.exit(0);
}
const root = path.join(process.cwd(), "deliverables");
const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const TYPES = { ".pdf": "application/pdf", ".dwg": "application/acad", ".dxf": "application/dxf" };

let count = 0;
for (const slug of existsSync(root) ? await readdir(root) : []) {
  if (only && !only.has(slug)) continue;
  for (const name of await readdir(path.join(root, slug))) {
    const type = TYPES[path.extname(name)];
    if (!type) continue;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${slug}/${name}`, {
      method: "POST",
      headers: { authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY, "content-type": type, "x-upsert": "true" },
      body: await readFile(path.join(root, slug, name)),
    });
    if (!res.ok) throw new Error(`upload ${slug}/${name} failed: ${res.status} ${await res.text()}`);
    count++;
  }
}
console.log(`uploaded ${count} file(s) to ${bucket}`);
