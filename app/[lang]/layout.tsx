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
import { SITE_META } from "@/lib/meta";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const site = SITE_META[isLocale(lang) ? lang : DEFAULT_LOCALE];
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://havs.dev"),
    title: { default: site.title, template: "%s — havs.dev" },
    description: site.description,
  };
}

/**
 * Root layout of every localized page: <html lang> is rendered on the server from the [lang] segment.
 * An unknown first segment (/xyz) is not rejected here but by the page (every page and its generateMetadata call
 * notFound() for it), so the 404 renders through app/[lang]/not-found inside this layout instead of bypassing every
 * boundary. Unknown deeper addresses (/en/xyz) reach the same 404 through app/[lang]/[...missing].
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
