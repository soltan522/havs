import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { localePages } from "./scripts/locale-pages.mjs";

const appDir = fileURLToPath(new URL("./app", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // the pages under app/[lang], for proxy.ts (lib/routes.ts): inlined into the build, so `next start` without the
  // sources (none needed) keeps the list the build was made with
  env: existsSync(`${appDir}/[lang]`) ? { LOCALE_PAGES: JSON.stringify(localePages(appDir)) } : {},
  // app/global-not-found.tsx: the fallback 404 for addresses no route matches, now that each locale has its own root
  // layout (app/[lang]) and there is no top-level app/layout
  experimental: { globalNotFound: true },
  // the Avropa Qapıları factory was renamed (zavod is the Russian word; fabrik is the Azerbaijani one)
  async redirects() {
    return [{ source: "/:lang/plans/avropa-zavod-118/:rest*", destination: "/:lang/plans/avropa-fabrik-118/:rest*", permanent: true }];
  },
  async rewrites() {
    return {
      // An address with a dot that is no file (public/, robots.txt and sitemap.xml are served before this) and that
      // proxy.ts skips (it only sees dotted paths under a locale): /favicon.ico, /xyz.html, /wp-login.php. The [lang]
      // pages would take it as a locale and call notFound() while rendering, which Next sends as an empty document;
      // /404/<path> is no page (app/[lang]/[...missing] only has /<locale>/404), so Next's router answers it with
      // app/global-not-found, rendered on the server. The API is left alone: its downloads have file names.
      afterFiles: [{ source: "/:path((?!api/|_next/).*\\..*)", destination: "/404/:path" }],
    };
  },
};

export default nextConfig;
