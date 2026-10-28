import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NotFoundPage from "@/components/NotFoundPage";
import { NOT_FOUND } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n";
import { NOT_FOUND_SEGMENT } from "@/lib/routes";

type Params = Promise<{ lang: string; missing: string[] }>;

/**
 * The localized 404 page as a page of its own, /<lang>/404, prerendered for every locale: proxy.ts rewrites each
 * unknown address (/xyz, /en/xyz, /ru/foo/bar, an unknown villa) to it with status 404, so the page arrives rendered on
 * the server, inside the site's layout. Any other address that gets here (/404/favicon.ico, from the rewrite in
 * next.config.mjs) is a 404 for Next's router (dynamicParams), which answers it with app/global-not-found.
 */
export function generateStaticParams() {
  return [{ missing: [NOT_FOUND_SEGMENT] }];
}

export const dynamicParams = false;

async function locale(params: Params): Promise<Locale> {
  const { lang, missing } = await params;
  if (!isLocale(lang) || missing.join("/") !== NOT_FOUND_SEGMENT) notFound();
  return lang;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: NOT_FOUND[await locale(params)].title, robots: { index: false } };
}

export default async function Missing({ params }: { params: Params }) {
  return <NotFoundPage locale={await locale(params)} />;
}
