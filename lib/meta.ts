import type { Metadata } from "next";
import { PAGES, type InfoPageKey } from "./content";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n";

/** The public address of the site: metadataBase of every page, and the absolute URLs of the sitemap and robots.txt. */
export const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://havs.dev");

/** Site-wide <title> default and description per locale (the layout's fallback for pages without their own). */
export const SITE_META: Record<Locale, { title: string; description: string }> = {
  az: { title: "havs.dev — villa layihələri", description: "Villa layihələri və exterior dizaynlar — PDF, DWG, CAD" },
  en: { title: "havs.dev — villa designs", description: "Villa projects and exterior designs — PDF, DWG, CAD" },
  ru: { title: "havs.dev — проекты вилл", description: "Проекты вилл и экстерьерные дизайны — PDF, DWG, CAD" },
};

/** Longest meta description search results show without cutting it themselves. */
export const DESCRIPTION_MAX = 155;

/** A cut description that ends with a whole sentence of at least this many characters keeps it, with no ellipsis. */
const SENTENCE_MIN = 110;

/**
 * Words a cut description must not end on, per locale (lower case): conjunctions, articles, prepositions and numerals
 * that only make sense with the word after them ("…a roof terrace with a…", "…на первом этаже и…", "…palıd və…").
 */
const DANGLING: Record<Locale, readonly string[]> = {
  az: ["və", "ilə", "ya", "yaxud", "həm", "bir", "iki", "üç", "dörd", "beş", "altı", "yeddi", "ön", "arxa"],
  en: ["a", "an", "the", "and", "or", "of", "with", "to", "in", "on", "at", "for", "by", "from", "into", "onto", "over", "under", "along", "across", "around", "its", "their", "one", "two", "three", "four", "five", "six", "seven"],
  ru: ["и", "с", "со", "в", "во", "на", "из", "к", "по", "над", "под", "для", "а", "или", "у", "о", "об", "от", "до", "за", "вдоль", "без", "при", "два", "две", "три", "четыре", "пять", "шесть", "семь"],
};

const TRAILING_PUNCTUATION = /[\s.,;:!?…–—-]+$/u;

/**
 * A meta description of at most `max` characters. A longer text is cut after its last whole sentence when that leaves
 * at least SENTENCE_MIN characters; otherwise at the last word boundary that fits, without trailing punctuation or a
 * dangling word (DANGLING, a bare number), and ends in "…". Shorter texts are returned as they are.
 */
export function metaDescription(text: string, lang: Locale, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const room = clean.slice(0, max + 1); // up to the character after the limit: a sentence or word may end right at it
  const sentence = Math.max(room.lastIndexOf(". "), room.lastIndexOf("! "), room.lastIndexOf("? "));
  if (sentence + 1 >= SENTENCE_MIN) return clean.slice(0, sentence + 1);
  // the last space that leaves room for the ellipsis; a single word longer than most of the room (none in the copy
  // today) is cut where it is
  const space = room.lastIndexOf(" ", max - 1);
  let cut = space > max / 2 ? clean.slice(0, space) : clean.slice(0, max - 1);
  for (;;) {
    const trimmed = cut.replace(TRAILING_PUNCTUATION, "");
    const last = trimmed.lastIndexOf(" ");
    const word = trimmed.slice(last + 1).toLocaleLowerCase(lang);
    const next = last > 0 && (DANGLING[lang].includes(word) || /^\d+$/.test(word)) ? trimmed.slice(0, last) : trimmed;
    if (next === cut) return `${cut}…`;
    cut = next;
  }
}

/** hreflang alternates of a page in every locale, plus x-default (the Azerbaijani page); `path` is the part after the locale ("" for the home page). */
export function languageAlternates(path: string): Record<Locale | "x-default", string> {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`])) as Record<Locale, string>;
  return { ...languages, "x-default": languages[DEFAULT_LOCALE] };
}

/** The canonical address of a page (its own locale's) and its hreflang alternates. */
export function pageAlternates(lang: Locale, path: string): NonNullable<Metadata["alternates"]> {
  return { canonical: `/${lang}${path}`, languages: languageAlternates(path) };
}

const OG_LOCALE: Record<Locale, string> = { az: "az_AZ", en: "en_US", ru: "ru_RU" };

/**
 * The layout's Open Graph defaults. They carry no url: a page that inherits them as they are (login, account, the
 * plan-upload page, 404) has no og:url rather than one naming another page, which share previews would show and link
 * to instead. Next replaces a parent's openGraph object with a page's own instead of merging the two, so every page
 * that sets openGraph spreads these first (pageMetadata does, and adds the page's url).
 */
export function openGraphDefaults(lang: Locale) {
  return {
    siteName: "havs.dev",
    type: "website" as const,
    locale: OG_LOCALE[lang],
    alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
  };
}

type PageMeta = {
  /** The page's own title (the layout's template adds the site name); left out: the layout's default title. */
  title?: string;
  /** Full text: the meta description is cut to DESCRIPTION_MAX, Open Graph keeps all of it. */
  description?: string;
  images?: { url: string; alt: string }[];
};

/**
 * Metadata of an indexable page at /<lang><path>: title, meta description, canonical + hreflang alternates and Open Graph
 * (the layout's defaults with this page's url, title, description and images).
 */
export function pageMetadata(lang: Locale, path: string, { title, description, images }: PageMeta): Metadata {
  return {
    ...(title ? { title } : {}),
    ...(description ? { description: metaDescription(description, lang) } : {}),
    alternates: pageAlternates(lang, path),
    openGraph: {
      ...openGraphDefaults(lang),
      url: `/${lang}${path}`,
      title: title ?? SITE_META[lang].title,
      description: description ?? SITE_META[lang].description,
      ...(images ? { images } : {}),
    },
  };
}

/** Metadata of an information page (about, faq, contact, terms, privacy) from its own copy in lib/content. */
export function infoPageMetadata(page: InfoPageKey, lang: Locale): Metadata {
  const content = PAGES[page][lang];
  // the legal pages open with a "draft" note, which is no description; they keep the site one
  const legal = page === "terms" || page === "privacy";
  return pageMetadata(lang, `/${page}`, { title: content.title, ...(legal ? {} : { description: content.intro }) });
}
