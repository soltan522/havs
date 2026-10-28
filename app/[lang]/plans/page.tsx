import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Reveal, { MaskLines } from "@/components/Reveal";
import { COPY, specsLine } from "@/lib/copy";
import { visitorCurrency } from "@/lib/geo";
import { pricedAreaM2 } from "@/lib/pricing";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/meta";
import { formatPrice, planLabel, publishedPlans, STYLE_LABELS, type PlanStyle } from "@/lib/plans";

type Search = { style?: string; floors?: string; sort?: string };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = COPY[lang];
  return pageMetadata(lang, "/plans", { title: c.catalogTitle, description: c.catalogLead });
}

export default async function Catalogue({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Search>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const q = await searchParams;
  const c = COPY[lang];
  const cur = await visitorCurrency();
  const all = publishedPlans();
  const styles = (Object.keys(STYLE_LABELS) as PlanStyle[]).filter((s) => all.some((p) => p.style === s));
  const style = styles.includes(q.style as PlanStyle) ? (q.style as PlanStyle) : undefined;
  const floors = ["1", "2", "3"].includes(q.floors ?? "") ? Number(q.floors) : undefined;
  const sort = ["price-asc", "price-desc", "area"].includes(q.sort ?? "") ? q.sort : undefined;

  let plans = all.filter((p) => (!style || p.style === style) && (!floors || p.floors === floors));
  if (sort === "price-asc") plans = [...plans].sort((a, b) => a.priceCents - b.priceCents);
  if (sort === "price-desc") plans = [...plans].sort((a, b) => b.priceCents - a.priceCents);
  if (sort === "area") plans = [...plans].sort((a, b) => pricedAreaM2(b) - pricedAreaM2(a));

  const href = (next: Partial<Search>) => {
    const merged = { style, floors: floors ? String(floors) : undefined, sort, ...next };
    const qs = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&");
    return `/${lang}/plans${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <Header locale={lang} path="/plans" />
      <main className="wrap">
        <section className="catalog-head">
          <Reveal variant="mask">
            <p className="eyebrow">havs.dev</p>
            <h1 className="section-title"><MaskLines lines={[c.catalogTitle]} /></h1>
          </Reveal>
          <Reveal delay={150}><p className="lead muted">{c.catalogLead}</p></Reveal>
          <nav className="filters" aria-label={c.style}>
            <Link className={`chip ${!style ? "on" : ""}`} href={href({ style: undefined })} scroll={false}>{c.allStyles} <small>{all.length}</small></Link>
            {styles.map((s) => (
              <Link key={s} className={`chip ${style === s ? "on" : ""}`} href={href({ style: s })} scroll={false}>
                {STYLE_LABELS[s][lang]} <small>{all.filter((p) => p.style === s).length}</small>
              </Link>
            ))}
          </nav>
        </section>

        <div className="filter-row">
          <div className="group">
            <span className="muted">{c.floorsLabel}:</span>
            <Link className={`chip ${!floors ? "on" : ""}`} href={href({ floors: undefined })} scroll={false}>{c.anyFloors}</Link>
            {[1, 2, 3].map((f) => (
              <Link key={f} className={`chip ${floors === f ? "on" : ""}`} href={href({ floors: String(f) })} scroll={false}>{f}</Link>
            ))}
          </div>
          <div className="group">
            <span className="muted">{c.sortLabel}:</span>
            <Link className={`chip ${sort === "price-asc" ? "on" : ""}`} href={href({ sort: "price-asc" })} scroll={false}>{c.sortPriceAsc}</Link>
            <Link className={`chip ${sort === "price-desc" ? "on" : ""}`} href={href({ sort: "price-desc" })} scroll={false}>{c.sortPriceDesc}</Link>
            <Link className={`chip ${sort === "area" ? "on" : ""}`} href={href({ sort: "area" })} scroll={false}>{c.sortArea}</Link>
            <span className="muted" style={{ marginLeft: 8 }}>{c.results(plans.length)}</span>
          </div>
        </div>

        {plans.length === 0 ? (
          <p className="empty">{c.empty}</p>
        ) : (
          <div className="cards">
            {plans.map((plan, i) => (
              <Reveal key={plan.slug} delay={(i % 3) * 110}>
                <Link href={`/${lang}/plans/${plan.slug}`} className="card" data-cursor={c.view}>
                  <div className="media">
                    <Image src={plan.cover} alt={plan.title[lang]} width={1200} height={800} sizes="(max-width: 760px) 100vw, 400px" />
                    <Image className="second" src={plan.hover} alt="" width={1200} height={800} sizes="(max-width: 760px) 100vw, 400px" />
                  </div>
                  <span className="eyebrow" style={{ margin: "18px 0 0" }}>{planLabel(plan, lang)}</span>
                  <h3>{plan.title[lang]}</h3>
                  <p className="specs-line">
                    {specsLine(lang, plan)}
                  </p>
                  <div className="row">
                    <span className="price">{formatPrice(plan.priceCents, lang, cur)}</span>
                    <span className="link-arrow">{c.view} →</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </main>
      <Footer locale={lang} />
    </>
  );
}
