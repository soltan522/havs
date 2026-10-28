import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { isLocalePage, NOT_FOUND_SEGMENT } from "@/lib/routes";

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Serves unknown addresses the localized 404 page, rendered on the server. A notFound() thrown while a page renders
 * comes out of Next as an empty error document (status 404, no <html lang>, no styles, no content) that only turns
 * into the not-found page once JavaScript has run, so an address known to be missing never reaches a page: it is
 * rewritten, keeping its URL and with status 404, to /<lang>/404 in its own locale (the default one when the first
 * segment is no locale, as in /xyz), which renders the 404 page inside the site's layout. Unknown order numbers are
 * the exception (only the database knows them): their page still calls notFound().
 */
export function proxy(request: NextRequest) {
  const [lang, ...rest] = request.nextUrl.pathname.split("/").filter(Boolean).map(decode);
  if (lang === undefined) return; // "/" redirects to the default locale
  if (isLocale(lang) && isLocalePage(rest)) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${isLocale(lang) ? lang : DEFAULT_LOCALE}/${NOT_FOUND_SEGMENT}`;
  return NextResponse.rewrite(url, { status: 404 });
}

export const config = {
  matcher: [
    // pages: not the API, Next's own files or any file (public/, sitemap.xml, robots.txt: a dot in the path; one that
    // is no file gets app/global-not-found through the afterFiles rewrite in next.config.mjs)
    "/((?!api/|_next/|.*\\.).*)",
    // everything under a locale, dots included (/en/plans/x.y): no file is served there (lib/i18n LOCALES)
    "/(az|en|ru)/:path*",
  ],
};
