import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import { isLocale, UI } from "@/lib/i18n";
import { coverOf, formatPrice, publishedPlans } from "@/lib/plans";
import { currency } from "@/lib/providers";

export default async function Catalog({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = UI[lang];

  return (
    <>
      <Header locale={lang} path="" />
      <main className="wrap">
        <section className="hero">
          <h1>{t.catalog}</h1>
          <p>{t.tagline}</p>
        </section>
        <div className="grid">
          {publishedPlans().map((plan) => (
            <article className="card" key={plan.slug}>
              <Link href={`/${lang}/plans/${plan.slug}`}>
                <Image src={coverOf(plan)} alt={plan.title[lang]} width={1600} height={1067} sizes="(max-width: 700px) 100vw, 360px" />
              </Link>
              <div className="body">
                <h2>
                  <Link href={`/${lang}/plans/${plan.slug}`}>{plan.title[lang]}</Link>
                </h2>
                <p className="muted">{plan.summary[lang]}</p>
                <p className="muted">
                  {plan.areaM2} m² · {plan.floors} {t.floors.toLowerCase()} · {plan.bedrooms} {t.bedrooms.toLowerCase()}
                </p>
                <div className="price">{formatPrice(plan.priceCents, lang, currency())}</div>
                <Link className="btn" href={`/${lang}/plans/${plan.slug}`}>
                  {t.buy}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
