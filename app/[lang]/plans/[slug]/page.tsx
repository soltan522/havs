import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import { isLocale, UI } from "@/lib/i18n";
import { findPlan, formatPrice } from "@/lib/plans";
import { availableProviders, currency } from "@/lib/providers";

export default async function PlanPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const providers = availableProviders();

  return (
    <>
      <Header locale={lang} path={`/plans/${slug}`} />
      <main className="wrap">
        <p>
          <Link href={`/${lang}`}>{t.backToCatalog}</Link>
        </p>
        <div className="detail">
          <Image src={plan.image} alt={plan.title[lang]} width={1200} height={900} priority />
          <section>
            <h1>{plan.title[lang]}</h1>
            <p className="muted">{plan.summary[lang]}</p>
            <div className="specs">
              <div>
                <b>{t.area}</b>
                {plan.areaM2} m²
              </div>
              <div>
                <b>{t.floors}</b>
                {plan.floors}
              </div>
              <div>
                <b>{t.bedrooms}</b>
                {plan.bedrooms}
              </div>
              <div>
                <b>{t.garage}</b>
                {plan.garage ? t.garageYes : t.garageNo}
              </div>
              <div>
                <b>{t.includes}</b>
                {t.formats}
              </div>
            </div>
            <div className="price">{formatPrice(plan.priceCents, lang, currency())}</div>

            <form className="panel" method="POST" action="/api/checkout" style={{ marginTop: 16 }}>
              <input type="hidden" name="slug" value={plan.slug} />
              <input type="hidden" name="locale" value={lang} />
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{t.pay}</p>
              {providers.length === 0 && <p className="muted">—</p>}
              {providers.map((p, i) => (
                <label key={p.id}>
                  <input type="radio" name="provider" value={p.id} defaultChecked={i === 0} required />
                  {p.label}
                </label>
              ))}
              {providers.length > 0 && (
                <button className="btn" type="submit" style={{ marginTop: 12 }}>
                  {t.buy}
                </button>
              )}
            </form>
          </section>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
