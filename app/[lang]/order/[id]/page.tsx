import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Footer, Header } from "@/components";
import AutoRefresh from "@/components/AutoRefresh";
import { COPY } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { deliverables, findPlan, formatPrice } from "@/lib/plans";
import { getOrder } from "@/lib/store";

// one order lookup per request, shared by generateMetadata and the page
const loadOrder = cache(getOrder);

// a fixed "Order" title; an unknown order is a 404 here already, so the 404 page's own title is used
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang) || !(await loadOrder(id))) notFound();
  return { title: COPY[lang].order.number, robots: { index: false, follow: false } };
}

const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const EXT = { pdf: "PDF", dwg: "DWG", cad: "DXF" } as const;

/** The buyer's order: downloads once paid, otherwise what is still needed (bank transfer, network confirmation, retry). */
export default async function OrderPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const order = await loadOrder(id);
  if (!order) notFound();
  const plan = findPlan(order.plan_slug);
  const c = COPY[lang];
  const o = c.order;
  const number = order.id.slice(0, 8).toUpperCase();
  const pkgFiles = plan?.package?.files ?? [];
  const heading = plan?.title[lang] ?? o.number;

  const facts = (
    <dl className="order-facts">
      <div>
        <dt>{o.number}</dt>
        <dd>{number}</dd>
      </div>
      {plan && (
        <div>
          <dt>{c.packageTitle}</dt>
          <dd>{plan.title[lang]}</dd>
        </div>
      )}
      <div>
        <dt>{c.checkout.total}</dt>
        <dd>{formatPrice(order.amount_cents, lang, order.currency)}</dd>
      </div>
      {order.buyer_email && (
        <div>
          <dt>{o.email}</dt>
          <dd>{order.buyer_email}</dd>
        </div>
      )}
    </dl>
  );

  return (
    <>
      <Header locale={lang} path="" />
      <main className="order">
        {order.status === "paid" ? (
          <>
            <span className="order-status paid">✓ {o.paidTitle}</span>
            <h1>{heading}</h1>
            <p className="muted">{o.paidText}</p>
            {facts}
            {plan && (
              <section className="package order-files" aria-label={o.files}>
                <p className="package-title">{o.files}</p>
                <ul>
                  {deliverables(plan).map(({ kind }) => {
                    const meta = pkgFiles.find((f) => f.kind === kind);
                    return (
                      <li key={kind}>
                        <span className={`ext ext-${kind}`}>{EXT[kind]}</span>
                        <span className="file">
                          <b>{c.packageFiles[kind]}</b>
                          <small>
                            {meta?.name ?? EXT[kind]}
                            {meta ? ` · ${size(meta.bytes)}` : ""}
                          </small>
                        </span>
                        <a className="btn secondary" href={`/api/download/${order.id}/${kind}`}>
                          {UI[lang].download}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        ) : order.status === "failed" ? (
          <>
            <span className="order-status failed">{o.failedTitle}</span>
            <h1>{heading}</h1>
            <p className="muted">{o.failedText}</p>
            {facts}
            <div className="detail-actions">
              {plan && (
                <Link className="btn" href={`/${lang}/plans/${plan.slug}/checkout`}>
                  {o.retry} <span className="arrow">→</span>
                </Link>
              )}
              <Link className="btn secondary" href={`/${lang}/contact`}>
                {o.contact}
              </Link>
            </div>
          </>
        ) : order.provider === "bank" ? (
          <>
            <span className="order-status pending">{o.bankTitle}</span>
            <h1>{heading}</h1>
            <p className="muted">{o.bankText}</p>
            {facts}
            <div className="notice">
              <b>{o.bankDetails}</b>
              <p style={{ whiteSpace: "pre-line" }}>{process.env.BANK_TRANSFER_DETAILS}</p>
              <p style={{ marginBottom: 0 }}>
                {o.reference}: <b>havs.dev {number}</b>
              </p>
            </div>
          </>
        ) : (
          <>
            <AutoRefresh everyMs={order.provider === "crypto" ? 20_000 : 5_000} forMinutes={order.provider === "crypto" ? 120 : 30} />
            <span className="order-status pending">
              <i className="spinner" aria-hidden="true" /> {o.waitingTitle}
            </span>
            <h1>{heading}</h1>
            <p className="muted">{order.provider === "crypto" ? o.cryptoText : o.waitingText}</p>
            {facts}
          </>
        )}
        <p>
          <Link href={`/${lang}/plans`}>← {c.catalogTitle}</Link>
        </p>
      </main>
      <Footer locale={lang} />
    </>
  );
}
