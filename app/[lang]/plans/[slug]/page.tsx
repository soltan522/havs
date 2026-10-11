import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Lightbox from "@/components/motion/Lightbox";
import Reveal, { MaskLines } from "@/components/Reveal";
import { COPY, sheetName } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { findPlan, formatPrice, STYLE_LABELS } from "@/lib/plans";
import { availableProviders, currency } from "@/lib/providers";

export default async function PlanPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const c = COPY[lang];
  const providers = plan.demo ? [] : availableProviders();

  const specs: [string, string][] = [
    [t.area, `${plan.areaM2} m²`],
    [t.floors, String(plan.floors)],
    [t.bedrooms, String(plan.bedrooms)],
    [c.bathrooms, String(plan.bathrooms)],
    [t.garage, plan.garage ? c.yes : c.no],
    [c.pool, plan.pool ? c.yes : c.no],
  ];

  return (
    <>
      <Header locale={lang} path={`/plans/${slug}`} />
      <main className="wrap">
        <div className="detail">
          <div>
            <Link className="back" href={`/${lang}/plans`}>{t.backToCatalog}</Link>
            <figure className="gallery">
              {plan.gallery.map((item, i) => (
                <Reveal key={item.src} variant="clip" delay={i === 0 ? 0 : 80}>
                  <div className={`sheet sheet-${item.kind.startsWith("plan") ? "plan" : item.kind}`} data-sheet={i} data-cursor={c.zoom}>
                    <Image
                      src={item.src}
                      alt={`${plan.title[lang]} — ${sheetName(c.sheetNames, item.kind)}`}
                      width={1600}
                      height={1067}
                      priority={i === 0}
                      sizes="(max-width: 960px) 100vw, 58vw"
                    />
                    <span className="sheet-label">
                      <i>{String(i + 1).padStart(2, "0")}</i> {sheetName(c.sheetNames, item.kind)}
                    </span>
                  </div>
                </Reveal>
              ))}
            </figure>
            <Lightbox items={plan.gallery.map((item) => ({ src: item.src, label: sheetName(c.sheetNames, item.kind) }))} closeLabel={c.close} />
          </div>
          <aside className="detail-side">
            <span className="style-tag">{STYLE_LABELS[plan.style][lang]}{plan.demo ? ` · ${c.sampleBadge}` : ""}</span>
            <Reveal variant="mask">
              <h1><MaskLines lines={[plan.title[lang]]} /></h1>
            </Reveal>
            <p className="muted" style={{ fontSize: 17 }}>{plan.summary[lang]}</p>
            <div className="specs">
              {specs.map(([k, v]) => (
                <div key={k}><b>{k}</b><span>{v}</span></div>
              ))}
            </div>
            <span className="muted small">{c.priceFrom} · {t.includes}: {t.formats}</span>
            <div className="price">{formatPrice(plan.priceCents, lang, currency())}</div>

            {plan.demo ? (
              <>
                <p className="note">{c.sampleNote}</p>
                <Link className="btn" href={`/${lang}/contact`} data-magnetic>
                  {c.contactToOrder} <span className="arrow">→</span>
                </Link>
              </>
            ) : (
              <form className="panel" method="POST" action="/api/checkout">
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
                  <button className="btn" type="submit" style={{ marginTop: 16, width: "100%" }}>
                    {t.buy}
                  </button>
                )}
              </form>
            )}
          </aside>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
