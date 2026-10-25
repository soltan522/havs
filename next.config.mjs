import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // the Avropa Qapıları factory was renamed (zavod is the Russian word; fabrik is the Azerbaijani one)
  async redirects() {
    return [{ source: "/:lang/plans/avropa-zavod-118/:rest*", destination: "/:lang/plans/avropa-fabrik-118/:rest*", permanent: true }];
  },
};

export default nextConfig;
