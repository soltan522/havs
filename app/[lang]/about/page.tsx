import { notFound } from "next/navigation";
import InfoPage from "@/components/InfoPage";
import { isLocale } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <InfoPage page="about" locale={lang} />;
}
