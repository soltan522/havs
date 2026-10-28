import Link from "next/link";
import { Footer, Header } from "@/components";
import { NOT_FOUND } from "@/lib/content";
import { UI, type Locale } from "@/lib/i18n";

/** The localized 404 page: the site header, the message with a link back to the catalogue, and the footer. */
export default function NotFoundPage({ locale }: { locale: Locale }) {
  const t = NOT_FOUND[locale];
  return (
    <>
      <Header locale={locale} path="" />
      <main className="wrap info">
        <h1>{t.title}</h1>
        <p className="lead muted">{t.text}</p>
        <p>
          <Link href={`/${locale}/plans`}>{UI[locale].backToCatalog}</Link>
        </p>
      </main>
      <Footer locale={locale} />
    </>
  );
}
