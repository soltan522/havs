import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InfoPage from "@/components/InfoPage";
import { isLocale } from "@/lib/i18n";
import { infoPageMetadata } from "@/lib/meta";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return infoPageMetadata("contact", lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <InfoPage page="contact" locale={lang} />;
}
