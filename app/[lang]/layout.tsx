import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter-tight";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "../globals.css";
import AuthRelay from "@/components/AuthRelay";
import Cursor from "@/components/motion/Cursor";
import SmoothScroll from "@/components/motion/SmoothScroll";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n";
import { openGraphDefaults, SITE_META, SITE_URL } from "@/lib/meta";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const site = SITE_META[locale];
  return {
    metadataBase: SITE_URL,
    title: { default: site.title, template: "%s — havs.dev" },
    description: site.description,
    // a page's own openGraph replaces this object, so pages spread these defaults (lib/meta pageMetadata)
    openGraph: openGraphDefaults(locale),
  };
}

/**
 * Root layout of every localized page: <html lang> is rendered on the server from the [lang] segment.
 * Unknown addresses (/xyz, /en/xyz, an unknown villa) never get here as themselves: proxy.ts rewrites them, with status
 * 404, to the localized 404 page (app/[lang]/[...missing]), which renders inside this layout like any other page. The
 * pages still call notFound() for an unknown locale or record as a fallback (and unknown orders only ever do), which
 * shows app/[lang]/not-found.
 */
export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: segment } = await params;
  const lang = isLocale(segment) ? segment : DEFAULT_LOCALE;
  return (
    <html lang={lang}>
      <body>
        {/* Curtain preloader: pure CSS, plays once per full page load (the layout persists across client navigation). */}
        <div className="preloader" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <path d="M60 8 L112 60 L60 112 L8 60 Z" />
            <path d="M60 30 L90 60 L60 90 L30 60 Z" />
          </svg>
          <span className="word">havs</span>
          <span className="bar" />
        </div>
        <AuthRelay lang={lang} />
        <SmoothScroll />
        <Cursor />
        {/* lang on the wrapper makes CSS uppercase use the right rules (no Turkish dotted İ on EN/RU pages) */}
        <div lang={lang}>{children}</div>
      </body>
    </html>
  );
}
