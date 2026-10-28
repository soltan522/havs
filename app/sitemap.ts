import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { languageAlternates, SITE_URL } from "@/lib/meta";
import { coverOf, publishedPlans } from "@/lib/plans";

/** The indexable pages besides the plans, as their path after the locale. */
const PAGES = ["", "/plans", "/map", "/partners", "/about", "/contact", "/faq", "/terms", "/privacy"];

const absolute = (path: string) => new URL(path, SITE_URL).href;

/** One entry per locale, each naming the page in every locale (and x-default) as its alternates. */
function entries(path: string, image?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(Object.entries(languageAlternates(path)).map(([l, href]) => [l, absolute(href)]));
  return LOCALES.map((l) => ({ url: absolute(`/${l}${path}`), alternates: { languages }, ...(image ? { images: [absolute(image)] } : {}) }));
}

/**
 * /sitemap.xml: every public, indexable address in the three locales. Checkout, login, account, order, auth and the
 * plan-upload page (/plan) are left out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [...PAGES.flatMap((path) => entries(path)), ...publishedPlans().flatMap((plan) => entries(`/plans/${plan.slug}`, coverOf(plan)))];
}
