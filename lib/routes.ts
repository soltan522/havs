import { publishedPlans } from "./plans";

/** /<lang>/404: the localized 404 page (app/[lang]/[...missing], prerendered), where proxy.ts sends unknown addresses. */
export const NOT_FOUND_SEGMENT = "404";

/**
 * Every page under /<lang>, as its route after the locale ("plans/[slug]/checkout"). The list is read from the
 * app/[lang] folders when the site is built (scripts/locale-pages.mjs, through next.config.mjs `env`), so a new page
 * is known to proxy.ts without being listed anywhere; `next dev` reads it when it starts.
 */
const LOCALE_PAGES = (() => {
  const list = process.env.LOCALE_PAGES;
  if (!list) throw new Error("LOCALE_PAGES is not set: next.config.mjs lists the pages under app/[lang]");
  return (JSON.parse(list) as string[]).map((page) => page.split("/").filter(Boolean));
})();

const PLAN_SLUGS = new Set(publishedPlans().map((p) => p.slug));

/**
 * Dynamic segments with a known set of values, by their route up to the segment: an unknown villa is a 404 here. Any
 * other dynamic segment ([id] of an order) takes any value and its page decides.
 */
const KNOWN_VALUES: Record<string, (value: string) => boolean> = {
  "plans/[slug]": (slug) => PLAN_SLUGS.has(slug),
};

const matches = (pattern: string[], segments: string[]) =>
  pattern.length === segments.length &&
  pattern.every((part, i) => {
    if (!part.startsWith("[")) return part === segments[i];
    const known = KNOWN_VALUES[pattern.slice(0, i + 1).join("/")];
    return known ? known(segments[i]) : true;
  });

/** Whether /<lang>/<segments> is a page of the site (a known locale is checked by the caller). */
export const isLocalePage = (segments: string[]) => LOCALE_PAGES.some((pattern) => matches(pattern, segments));
