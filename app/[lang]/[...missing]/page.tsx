import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Any other address under a locale (/en/xyz, /ru/foo/bar): a 404 in that locale through app/[lang]/not-found, with the
 * site header and footer, instead of the locale-less app/global-not-found. generateMetadata throws as well, so the
 * 404 page's own title is used.
 */
export async function generateMetadata(): Promise<Metadata> {
  notFound();
}

export default function Missing() {
  notFound();
}
