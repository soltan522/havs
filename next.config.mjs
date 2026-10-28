import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // app/global-not-found.tsx: the fallback 404 for addresses no route matches, now that each locale has its own root
  // layout (app/[lang]) and there is no top-level app/layout
  experimental: { globalNotFound: true },
  // the Avropa Qapıları factory was renamed (zavod is the Russian word; fabrik is the Azerbaijani one)
  async redirects() {
    return [{ source: "/:lang/plans/avropa-zavod-118/:rest*", destination: "/:lang/plans/avropa-fabrik-118/:rest*", permanent: true }];
  },
};

export default nextConfig;
