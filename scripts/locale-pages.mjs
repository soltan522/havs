// The pages under app/[lang], read from the folders at build time. next.config.mjs hands the list to proxy.ts (through
// `env`), which answers every other address under a locale with the 404 page, so the list can never fall behind the
// app: a new page folder is on it at the next build (or `next dev` start). Run it directly to print the list.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = /^page\.(?:tsx|ts|jsx|js|mdx)$/;
// files that answer an address of their own besides the page; proxy.ts only knows pages, so it would answer them 404
const OTHER_ROUTE = /^(?:route|opengraph-image|twitter-image|icon|apple-icon|sitemap)(?:\.|$)/;

/**
 * Every page under app/[lang] as its route after the locale, e.g. "" (the home page), "about", "plans/[slug]/checkout".
 * Route groups add no segment and private (_) folders none at all; [...missing] at the top is the 404 page itself.
 * Anything proxy.ts cannot match yet (a catch-all, a parallel or intercepting route, a route handler, a metadata image)
 * stops the build, so it gets supported instead of answering 404.
 */
export function localePages(appDir) {
  const pages = [];
  const walk = (dir, route) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const { name } = entry;
      const where = join(dir, name);
      if (entry.isFile()) {
        if (PAGE.test(name)) pages.push(route.join("/"));
        else if (OTHER_ROUTE.test(name)) throw new Error(`${where}: proxy.ts only lets the pages under app/[lang] through; teach lib/routes.ts this file`);
        continue;
      }
      if (!entry.isDirectory() || name.startsWith("_")) continue;
      if (route.length === 0 && name === "[...missing]") continue;
      if (/^\([^.)][^)]*\)$/.test(name)) walk(where, route);
      else if (/^[[(@]/.test(name) && !/^\[[^.[\]]+\]$/.test(name)) throw new Error(`${where}: lib/routes.ts does not match this kind of segment yet`);
      else walk(where, [...route, name]);
    }
  };
  walk(join(appDir, "[lang]"), []);
  return pages.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(localePages(fileURLToPath(new URL("../app", import.meta.url))));
}
