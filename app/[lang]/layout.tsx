import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Cursor from "@/components/motion/Cursor";
import SmoothScroll from "@/components/motion/SmoothScroll";
import { isLocale, LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      {/* Curtain preloader: pure CSS, plays once per full page load (the layout persists across client navigation). */}
      <div className="preloader" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <path d="M60 8 L112 60 L60 112 L8 60 Z" />
          <path d="M60 30 L90 60 L60 90 L30 60 Z" />
        </svg>
        <span className="word">havs</span>
        <span className="bar" />
      </div>
      <SmoothScroll />
      <Cursor />
      {children}
    </>
  );
}
