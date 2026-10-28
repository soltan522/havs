import type { Metadata } from "next";
import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { Footer, Header } from "@/components";
import { NOT_FOUND } from "@/lib/content";
import { DEFAULT_LOCALE, isLocale, UI, type Locale } from "@/lib/i18n";

async function locale(): Promise<Locale> {
  const value = await rootLang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: NOT_FOUND[await locale()].title };
}

/**
 * 404 inside a locale (an unknown villa, order, address such as /en/xyz, or locale such as /xyz), rendered in the site's
 * own layout. Its title comes from generateMetadata above: the pages call notFound() in their generateMetadata too.
 */
export default async function NotFound() {
  const lang = await locale();
  const t = NOT_FOUND[lang];
  return (
    <>
      <Header locale={lang} path="" />
      <main className="wrap info">
        <h1>{t.title}</h1>
        <p className="lead muted">{t.text}</p>
        <p>
          <Link href={`/${lang}/plans`}>{UI[lang].backToCatalog}</Link>
        </p>
      </main>
      <Footer locale={lang} />
    </>
  );
}
