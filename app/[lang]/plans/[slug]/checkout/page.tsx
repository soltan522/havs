import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import PackagePanel from "@/components/PackagePanel";
import { PaymentIcon } from "@/components/PaymentIcon";
import { COPY } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { languageAlternates } from "@/lib/meta";
import { visitorCurrency } from "@/lib/geo";
import { areaText, coverOf, deliverables, findPlan, formatPrice, isCommercial, isCustomDrawn, planLabel, priceBasis } from "@/lib/plans";
import { providersFor } from "@/lib/providers";
import { objectsExist } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const c = COPY[lang];
  // "Package & payment: <villa>", or "Order request: <project>" for a custom-drawn set (no payment form on its page)
  return {
    title: `${isCustomDrawn(plan) ? c.custom.title : c.toCheckout}: ${plan.title[lang]}`,
    alternates: languageAlternates(`/plans/${slug}/checkout`),
  };
}

/**
 * Payment step: what the buyer gets, the price, their email and the payment methods that are switched on.
 * The form only appears when a provider is configured and every file of the package is in the private bucket,
 * so the site never takes money for something it cannot deliver. A custom-drawn set is never sold here: its page is
 * an order request (summary, design price, contact), whatever files the bucket holds.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lang, slug } = await params;
  const { error } = await searchParams;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const c = COPY[lang];
  const k = c.checkout;
  const cur = await visitorCurrency();
  const providers = providersFor(cur);
  // a custom-drawn set is supplied on request: no payment form, download promise or one-house licence
  const custom = isCustomDrawn(plan);
  const stored = !custom && providers.length > 0 && (await objectsExist(deliverables(plan).map((d) => d.key)));
  const price = formatPrice(plan.priceCents, lang, cur);
  const errorText = error && error in k.errors ? k.errors[error as keyof typeof k.errors] : null;
  const notes = custom ? c.custom.notes : k.notes;
  const title = custom ? c.custom.title : k.title;
  const steps: readonly string[] = custom ? c.custom.steps : k.steps;

  return (
    <>
      <Header locale={lang} path={`/plans/${slug}/checkout`} />
      <main className="wrap checkout">
        <Link className="back" href={`/${lang}/plans/${slug}`}>← {plan.title[lang]}</Link>
        <ol className="steps" aria-label={title}>
          {steps.map((step, i) => (
            <li key={step} className={i === 1 ? "current" : i === 0 ? "done" : ""}>
              <i>{i + 1}</i>
              {step}
            </li>
          ))}
        </ol>
        <h1 className="checkout-title">{title}</h1>
        <div className="checkout-grid">
          <section className="checkout-summary" aria-label={k.summary}>
            <div className="media">
              <Image src={coverOf(plan)} alt={plan.title[lang]} width={1200} height={800} sizes="(max-width: 900px) 100vw, 560px" />
            </div>
            <h2>{plan.title[lang]}</h2>
            <p className="muted small">
              {planLabel(plan, lang)} · {areaText(plan)} · {t.floors}: {plan.floors} · {plan.rooms ? `${c.project.rooms}: ${plan.rooms}` : plan.seats ? `${c.project.seats}: ${plan.seats}` : plan.flats ? `${c.project.flats}: ${plan.flats}` : isCommercial(plan) ? `${c.project.parking}: ${plan.parking ?? 0}` : plan.interior && !plan.bedrooms ? `${c.project.wcs}: ${plan.bathrooms}` : `${t.bedrooms}: ${plan.bedrooms}`}
            </p>
            {plan.package && <PackagePanel pkg={plan.package} lang={lang} />}
            <ul className="checkout-notes">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section className="checkout-pay" aria-label={k.method}>
            <div className="pay-total">
              <span>{custom ? c.custom.priceLabel : k.total}</span>
              <b>{price}</b>
            </div>
            <p className="pay-sub muted small">
              {plan.title[lang]} · {custom ? c.custom.formats : t.formats}
              <br />
              {priceBasis(plan, lang, cur)}
            </p>
            {errorText && (
              <p className="pay-error" role="alert">
                {errorText}
              </p>
            )}
            {stored ? (
              <form method="POST" action="/api/checkout" className="pay-form">
                <input type="hidden" name="slug" value={plan.slug} />
                <input type="hidden" name="locale" value={lang} />
                <input type="hidden" name="currency" value={cur} />
                <label className="pay-field">
                  <span>{k.email}</span>
                  <input type="email" name="email" required maxLength={254} autoComplete="email" inputMode="email" placeholder="name@example.com" />
                  <small>{k.emailHint}</small>
                </label>
                <fieldset className="pay-methods">
                  <legend>{k.method}</legend>
                  {providers.map((id, i) => (
                    <label key={id} className="pay-option">
                      <input type="radio" name="provider" value={id} defaultChecked={i === 0} required />
                      <PaymentIcon method={id} />
                      <span className="pay-text">
                        <b>{k.methods[id].name}</b>
                        <small>{k.methods[id].hint}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="pay-terms">
                  <input type="checkbox" required />
                  <span>
                    {k.agree} <Link href={`/${lang}/terms`}>{k.terms}</Link>
                  </span>
                </label>
                <button className="btn" type="submit">
                  {k.pay} — {price} <span className="arrow">→</span>
                </button>
                <p className="pay-instant">{k.instant}</p>
                <p className="muted small pay-secure">{k.secure}</p>
              </form>
            ) : (
              <>
                <p className="note">{custom ? c.custom.request : providers.length === 0 ? k.soon : k.unavailable}</p>
                <Link className="btn" href={`/${lang}/contact`} data-magnetic>
                  {c.contactToOrder} <span className="arrow">→</span>
                </Link>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
