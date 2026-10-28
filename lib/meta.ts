import type { Metadata } from "next";
import { PAGES, type InfoPageKey } from "./content";
import { LOCALES, type Locale } from "./i18n";

/** Site-wide <title> default and description per locale (the layout's fallback for pages without their own). */
export const SITE_META: Record<Locale, { title: string; description: string }> = {
  az: { title: "havs.dev — villa layihələri", description: "Villa layihələri və exterior dizaynlar — PDF, DWG, CAD" },
  en: { title: "havs.dev — villa designs", description: "Villa projects and exterior designs — PDF, DWG, CAD" },
  ru: { title: "havs.dev — проекты вилл", description: "Проекты вилл и экстерьерные дизайны — PDF, DWG, CAD" },
};

/** hreflang links to the same page in every locale; `path` is the part after the locale ("" for the home page). */
export function languageAlternates(path: string): NonNullable<Metadata["alternates"]> {
  return { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`])) };
}

/** Metadata of an information page (about, faq, contact, terms, privacy) from its own copy in lib/content. */
export function infoPageMetadata(page: InfoPageKey, lang: Locale): Metadata {
  const content = PAGES[page][lang];
  // the legal pages open with a "draft" note, which is no description; they keep the site one
  const legal = page === "terms" || page === "privacy";
  return {
    title: content.title,
    ...(legal ? {} : { description: content.intro }),
    alternates: languageAlternates(`/${page}`),
  };
}
