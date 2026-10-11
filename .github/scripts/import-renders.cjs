// Downloads the concept renders listed in renders/manifest.json and stores them as
// high-quality JPEGs in renders/<slug>/NN.jpg (scripts/build-previews.mjs picks them up).
const fs = require("node:fs");
const path = require("node:path");
const sharp = require(process.env.SHARP_PATH);

const manifest = JSON.parse(fs.readFileSync("renders/manifest.json", "utf8"));
(async () => {
  for (const [slug, urls] of Object.entries(manifest)) {
    const dir = path.join("renders", slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, url] of urls.entries()) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
      const file = path.join(dir, `${String(i + 1).padStart(2, "0")}.jpg`);
      await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
      console.log("saved", file);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
