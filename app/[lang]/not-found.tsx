import type { Metadata } from "next";
import { lang as rootLang } from "next/root-params";
import NotFoundPage from "@/components/NotFoundPage";
import { NOT_FOUND } from "@/lib/content";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

async function locale(): Promise<Locale> {
  const value = await rootLang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: NOT_FOUND[await locale()].title };
}

/**
 * The 404 page for a notFound() thrown while a page renders: an unknown order, or an address proxy.ts did not see.
 * Next sends such a 404 as an empty document and this page appears once JavaScript has run; every address known to be
 * missing gets the same page rendered on the server instead (proxy.ts, app/[lang]/[...missing]).
 */
export default async function NotFound() {
  return <NotFoundPage locale={await locale()} />;
}
