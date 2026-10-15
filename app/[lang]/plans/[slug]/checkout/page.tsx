import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import PackagePanel from "@/components/PackagePanel";
import { COPY } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { coverOf, findPlan, formatPrice, STYLE_LABELS } from "@/lib/plans";
import { availableProviders, currency } from "@/lib/providers";

/** Payment step: what the buyer gets, the price and the payment methods. Files unlock on the order page. */
export default async function CheckoutPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const c = COPY[lang];
  const k = c.checkout;
  const providers = plan.demo ? [] : availableProviders();

  return (
    <>
      <Header locale={lang} path={`/plans/${slug}/checkout`} />
      <main className="wrap checkout">
        <Link className="back" href={`/${lang}/plans/${slug}`}>← {plan.title[lang]}</Link>
        <ol className="steps" aria-label={k.title}>
          {k.steps.map((step, i) => (
            <li key={step} className={i === 1 ? "current" : i === 0 ? "done" : ""}>
              <i>{i + 1}</i>
              {step}
            </li>
          ))}
        </ol>
        <h1 className="checkout-title">{k.title}</h1>
        <div className="checkout-grid">
          <section className="checkout-summary" aria-label={k.summary}>
            <div className="media">
              <Image src={coverOf(plan)} alt={plan.title[lang]} width={1200} height={800} sizes="(max-width: 900px) 100vw, 560px" />
            </div>
            <h2>{plan.title[lang]}</h2>
            <p className="muted small">
              {STYLE_LABELS[plan.style][lang]} · {plan.areaM2} m² · {plan.floors} {t.floors.toLowerCase()} · {plan.bedrooms} {t.bedrooms.toLowerCase()}
            </p>
            {plan.package && <PackagePanel pkg={plan.package} lang={lang} demo={plan.demo} />}
            <ul className="checkout-notes">
              {k.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section className="checkout-pay" aria-label={t.pay}>
            <span className="muted small">{c.priceFrom}</span>
            <div className="price">{formatPrice(plan.priceCents, lang, currency())}</div>
            {plan.demo ? (
              <>
                <p className="note">{k.sample}</p>
                <Link className="btn" href={`/${lang}/contact`} data-magnetic>
                  {c.contactToOrder} <span className="arrow">→</span>
                </Link>
              </>
            ) : providers.length === 0 ? (
              <>
                <p className="note">{k.noProviders}</p>
                <Link className="btn" href={`/${lang}/contact`} data-magnetic>
                  {c.contactToOrder} <span className="arrow">→</span>
                </Link>
              </>
            ) : (
              <form method="POST" action="/api/checkout" className="pay-form">
                <input type="hidden" name="slug" value={plan.slug} />
                <input type="hidden" name="locale" value={lang} />
                <p className="pay-label">{t.pay}</p>
                {providers.map((p, i) => (
                  <label key={p.id} className="pay-option">
                    <input type="radio" name="provider" value={p.id} defaultChecked={i === 0} required />
                    <span>{p.label}</span>
                  </label>
                ))}
                <label className="pay-terms">
                  <input type="checkbox" required />
                  <span>
                    {k.agree} <Link href={`/${lang}/terms`}>{k.terms}</Link>
                  </span>
                </label>
                <button className="btn" type="submit">
                  {t.buy} — {formatPrice(plan.priceCents, lang, currency())} <span className="arrow">→</span>
                </button>
                <p className="muted small">{k.secure}</p>
              </form>
            )}
          </section>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
