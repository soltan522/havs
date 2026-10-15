// Downloads the concept renders listed in renders/manifest.json ({ "<slug>": ["<url>", …] }) and stores
// them as high-quality JPEGs in renders/<slug>/NN.jpg. Existing files are kept, so re-runs are safe.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const manifest = JSON.parse(fs.readFileSync("renders/manifest.json", "utf8"));
(async () => {
  for (const [slug, urls] of Object.entries(manifest)) {
    const dir = path.join("renders", slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, url] of urls.entries()) {
      const file = path.join(dir, `${String(i + 1).padStart(2, "0")}.jpg`);
      if (fs.existsSync(file)) {
        console.log("exists", file);
        continue;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${slug}: HTTP ${res.status} for ${url}`);
      const img = sharp(Buffer.from(await res.arrayBuffer()));
      const { width, height } = await img.metadata();
      if (width < 1200 || height < 700) throw new Error(`${slug}: render is only ${width}×${height}`);
      await img.jpeg({ quality: 92, mozjpeg: true }).toFile(file);
      console.log("saved", file, `${width}×${height}`);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
