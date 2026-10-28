import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/meta";

/**
 * Private pages (the customer's own account and orders, and the sign-in links from e-mails), under every locale. The
 * sign-in page (/login) is not among them although it is private too: every page links to it, so a crawler blocked
 * from it could still list its bare URL; left crawlable, it reads the page's own noindex and leaves it out.
 */
const PRIVATE = ["account", "order", "auth"];

/** /robots.txt: everything may be crawled except the API and the private pages; the sitemap lists the public ones. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...LOCALES.flatMap((l) => PRIVATE.map((page) => `/${l}/${page}`))] },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
