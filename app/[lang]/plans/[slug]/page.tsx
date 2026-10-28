import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Lightbox from "@/components/motion/Lightbox";
import PackagePanel from "@/components/PackagePanel";
import Reveal, { MaskLines } from "@/components/Reveal";
import { COPY, planSheetName } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { metaDescription, pageMetadata } from "@/lib/meta";
import { placeOf } from "@/lib/places";
import { visitorCurrency } from "@/lib/geo";
import { coverOf, findPlan, formatNumber, formatPrice, INTERIOR_TYPE_LABELS, isCommercial, isCommercialInterior, isCustomDrawn, isResidential, PALETTE_LABELS, planLabel, priceBasis, type GalleryItem } from "@/lib/plans";

const LOCKED = new Set(["schedules"]);

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const title = plan.title[lang];
  const cover = coverOf(plan);
  const images = cover ? [{ url: cover, alt: title }] : undefined;
  // the summary is the full description: the meta description is cut from it, Open Graph keeps all of it
  const meta = pageMetadata(lang, `/plans/${slug}`, { title, description: plan.summary[lang], images });
  return {
    ...meta,
    twitter: { card: "summary_large_image", title, description: metaDescription(plan.summary[lang], lang), ...(images ? { images } : {}) },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const plan = findPlan(slug);
  if (!plan) notFound();
  const t = UI[lang];
  const c = COPY[lang];
  const cur = await visitorCurrency();
  const checkoutHref = `/${lang}/plans/${slug}/checkout`;
  // sheets that carry the sellable detail are shown locked; the rest open in the lightbox
  const open = plan.gallery.filter((item) => !LOCKED.has(item.kind));

  // a custom-drawn set names each of its sheets (plan.sheetTitles, in order); the renders keep the usual label
  const custom = isCustomDrawn(plan);
  const images = plan.gallery.filter((item) => item.kind === "image");
  const name = (item: GalleryItem) => (item.kind === "image" ? plan.sheetTitles?.[images.indexOf(item)]?.[lang] : undefined) ?? planSheetName(c, plan, item.kind);
  // a custom-drawn sheet keeps the number in its own title block (A1-01 …); everything else is numbered in gallery order
  const sheetNo = (item: GalleryItem) => (custom && item.kind === "image" ? `A1-${String(images.indexOf(item) + 1).padStart(2, "0")}` : null);
  const number = (item: GalleryItem, i: number) => sheetNo(item) ?? String(i + 1).padStart(2, "0");
  const area: [string, string][] = plan.project && plan.project.units > 1
    ? [
        [c.project.houses, String(plan.project.units)],
        [c.project.perHouse, `${plan.areaM2} m²`],
        [c.project.total, `${plan.project.units * plan.areaM2} m²`],
      ]
    : [[t.area, `${plan.areaM2} m²`]];
  const specs: [string, string][] = custom
    ? [
        // a whole site: the buildings' gross floor area, the plot, and the people and cars it is laid out for
        [c.project.total, `${formatNumber(plan.areaM2, lang)} m²`],
        ...(plan.siteM2 ? [[c.project.siteArea, `${formatNumber(plan.siteM2, lang)} m²`] as [string, string]] : []),
        [t.floors, String(plan.floors)],
        [c.project.parking, String(plan.parking ?? 0)],
        ...(plan.staff ? [[c.project.staff, String(plan.staff)] as [string, string]] : []),
      ]
    : plan.interior
    ? [
        [c.interior.type, INTERIOR_TYPE_LABELS[plan.interior.type][lang]],
        [c.interior.palette, PALETTE_LABELS[plan.interior.palette][lang]],
        ...area,
        [t.floors, String(plan.floors)],
        ...(isCommercialInterior(plan)
          ? [[c.project.wcs, String(plan.bathrooms)] as [string, string]]
          : [[t.bedrooms, String(plan.bedrooms)] as [string, string], [c.bathrooms, String(plan.bathrooms)] as [string, string]]),
      ]
    : isCommercial(plan)
    ? [
        ...area,
        [t.floors, String(plan.floors)],
        ...(plan.rooms ? [[c.project.rooms, String(plan.rooms)] as [string, string]] : []),
        ...(plan.seats ? [[c.project.seats, String(plan.seats)] as [string, string]] : []),
        // a hotel lists its guest rooms (each with its own shower room) instead of the public WCs
        ...(plan.rooms ? [] : [[c.project.wcs, String(plan.bathrooms)] as [string, string]]),
        [c.project.parking, String(plan.parking ?? 0)],
      ]
    : isResidential(plan)
    ? [...area, [t.floors, String(plan.floors)], [c.project.flats, String(plan.flats ?? 0)], [t.bedrooms, String(plan.bedrooms)], [c.bathrooms, String(plan.bathrooms)], [c.project.parking, String(plan.parking ?? 0)]]
    : [
        ...area,
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
                      <Image src={item.src} alt={`${plan.title[lang]} — ${name(item)}`} width={1600} height={1067} sizes="(max-width: 960px) 100vw, 58vw" />
                      <span className="sheet-label">
                        <i>{number(item, i)}</i> {name(item)}
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
                      alt={`${plan.title[lang]} — ${name(item)}`}
                      width={1600}
                      height={1067}
                      priority={i === 0}
                      sizes="(max-width: 960px) 100vw, 58vw"
                    />
                    <span className="sheet-label">
                      <i>{number(item, i)}</i> {name(item)}
                    </span>
                  </div>
                  )}
                </Reveal>
              ))}
            </figure>
            <Lightbox items={open.map((item) => ({ src: item.src, label: sheetNo(item) ? `${sheetNo(item)} · ${name(item)}` : name(item) }))} closeLabel={c.close} />
          </div>
          <aside className="detail-side">
            <span className="style-tag">{planLabel(plan, lang)}{plan.demo ? ` · ${c.sampleBadge}` : ""}</span>
            <Reveal variant="mask">
              <h1><MaskLines lines={[plan.title[lang]]} /></h1>
            </Reveal>
            <p className="muted" style={{ fontSize: 17 }}>{plan.summary[lang]}</p>
            {placeOf(plan.slug, plan.location) && (
              <Link className="map-link" href={`/${lang}/map?p=${plan.slug}`}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15Z" /><circle cx="8" cy="6.5" r="1.8" /></svg>
                {({ az: "Xəritədə göstər", en: "Show on the map", ru: "Показать на карте" } as const)[lang]}
              </Link>
            )}
            <div className="specs">
              {specs.map(([k, v]) => (
                <div key={k}><b>{k}</b><span>{v}</span></div>
              ))}
            </div>
            {/* a custom-drawn set has no package: the price is for the design, and the set is supplied on request (the note below) */}
            <span className="muted small">{custom ? c.custom.priceLabel : `${c.priceFrom} · ${t.includes}: ${t.formats}`}</span>
            <div className="price">{formatPrice(plan.priceCents, lang, cur)}</div>
            <span className="muted small price-basis">{priceBasis(plan, lang, cur)}</span>
            {plan.package && <PackagePanel pkg={plan.package} lang={lang} checkoutHref={checkoutHref} />}

            {custom ? <p className="note">{plan.demo ? c.custom.sampleNote : c.custom.notes[0]}</p> : plan.demo && <p className="note">{c.sampleNote}</p>}
            <div className="detail-actions">
              <Link className="btn" href={checkoutHref} data-magnetic>
                {custom ? c.custom.cta : c.toCheckout} <span className="arrow">→</span>
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
