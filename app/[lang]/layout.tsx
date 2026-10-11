import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
  return <>{children}</>;
}
