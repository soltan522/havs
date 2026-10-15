import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Lightbox from "@/components/motion/Lightbox";
import PackagePanel from "@/components/PackagePanel";
import Reveal, { MaskLines } from "@/components/Reveal";
import { COPY, sheetName } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { findPlan, formatPrice, STYLE_LABELS } from "@/lib/plans";
import { currency } from "@/lib/providers";

const LOCKED = new Set(["schedules"]);

export default async function PlanPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const c = COPY[lang];
  const checkoutHref = `/${lang}/plans/${slug}/checkout`;
  // sheets that carry the sellable detail are shown locked; the rest open in the lightbox
  const open = plan.gallery.filter((item) => !LOCKED.has(item.kind));

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
                  {LOCKED.has(item.kind) ? (
                    <Link className="sheet sheet-locked" href={checkoutHref} data-cursor={c.toCheckout}>
                      <Image src={item.src} alt={`${plan.title[lang]} — ${sheetName(c.sheetNames, item.kind)}`} width={1600} height={1067} sizes="(max-width: 960px) 100vw, 58vw" />
                      <span className="sheet-label">
                        <i>{String(i + 1).padStart(2, "0")}</i> {sheetName(c.sheetNames, item.kind)}
                      </span>
                      <span className="lock-overlay">
                        <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
                          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                        <b>{c.lockedSheet}</b>
                        <small>PDF · DWG · DXF</small>
                      </span>
                    </Link>
                  ) : (
                  <div className={`sheet sheet-${item.kind.startsWith("plan") ? "plan" : item.kind}`} data-sheet={open.indexOf(item)} data-cursor={c.zoom}>
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
                  )}
                </Reveal>
              ))}
            </figure>
            <Lightbox items={open.map((item) => ({ src: item.src, label: sheetName(c.sheetNames, item.kind) }))} closeLabel={c.close} />
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
            {plan.package && <PackagePanel pkg={plan.package} lang={lang} checkoutHref={checkoutHref} />}

            {plan.demo && <p className="note">{c.sampleNote}</p>}
            <div className="detail-actions">
              <Link className="btn" href={checkoutHref} data-magnetic>
                {c.toCheckout} <span className="arrow">→</span>
              </Link>
              <Link className="btn secondary" href={`/${lang}/contact`}>
                {c.contactToCustomise}
              </Link>
            </div>
          </aside>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
