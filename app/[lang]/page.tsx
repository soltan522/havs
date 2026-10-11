import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Reveal from "@/components/Reveal";
import { isLocale, UI } from "@/lib/i18n";
import { LANDING } from "@/lib/landing";
import { coverOf, formatPrice, publishedPlans } from "@/lib/plans";
import { currency } from "@/lib/providers";

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = LANDING[lang];
  const plans = publishedPlans();
  const hero = plans[0];
  const marquee = [...t.marquee, ...t.marquee];

  return (
    <>
      <Header locale={lang} path="" />

      <section className="hero">
        {hero && <Image className="hero-bg" src={coverOf(hero)} alt="" fill priority sizes="100vw" />}
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="wrap hero-inner">
          <p className="eyebrow anim-in" style={{ animationDelay: "0ms" }}>{t.eyebrow}</p>
          <h1 className="hero-title">
            <span className="line anim-in" style={{ animationDelay: "120ms" }}>{t.heroTitle[0]}</span>
            <span className="line anim-in" style={{ animationDelay: "260ms" }}>{t.heroTitle[1]}</span>
          </h1>
          <p className="hero-text anim-in" style={{ animationDelay: "420ms" }}>{t.heroText}</p>
          <div className="hero-cta anim-in" style={{ animationDelay: "560ms" }}>
            <Link className="btn" href={`/${lang}#plans`}>{t.ctaPrimary}</Link>
            <Link className="btn ghost" href={`/${lang}#process`}>{t.ctaSecondary}</Link>
          </div>
          <div className="scroll-cue" aria-hidden="true"><span /></div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {marquee.map((w, i) => (
            <span key={i}>{w}<i>◆</i></span>
          ))}
        </div>
      </div>

      <section className="section" id="plans">
        <div className="wrap">
          <Reveal>
            <h2 className="section-title">{t.featuredTitle}</h2>
            <p className="muted lead">{t.featuredText}</p>
          </Reveal>
          <div className="grid">
            {plans.map((plan, i) => (
              <Reveal key={plan.slug} delay={i * 120}>
                <article className="card lift">
                  <Link href={`/${lang}/plans/${plan.slug}`} className="card-img">
                    <Image src={coverOf(plan)} alt={plan.title[lang]} width={1600} height={1067} sizes="(max-width: 700px) 100vw, 46vw" />
                  </Link>
                  <div className="body">
                    <h3><Link href={`/${lang}/plans/${plan.slug}`}>{plan.title[lang]}</Link></h3>
                    <p className="muted">{plan.summary[lang]}</p>
                    <p className="specs-line muted">
                      {plan.areaM2} m² · {plan.floors} {UI[lang].floors.toLowerCase()} · {plan.bedrooms} {UI[lang].bedrooms.toLowerCase()}
                    </p>
                    <div className="row">
                      <span className="price">{formatPrice(plan.priceCents, lang, currency())}</span>
                      <Link className="btn small-btn" href={`/${lang}/plans/${plan.slug}`}>{UI[lang].buy}</Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="center"><Link href={`/${lang}`} className="link-arrow">{t.viewAll}</Link></p>
          </Reveal>
        </div>
      </section>

      <section className="section alt" id="process">
        <div className="wrap">
          <Reveal><h2 className="section-title">{t.processTitle}</h2></Reveal>
          <div className="steps">
            {t.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 150}>
                <div className="step">
                  <span className="num">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal><h2 className="section-title">{t.whyTitle}</h2></Reveal>
          <div className="features">
            {t.why.map((w, i) => (
              <Reveal key={w.title} delay={i * 120}>
                <div className="feature lift">
                  <h3>{w.title}</h3>
                  <p className="muted">{w.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <Reveal>
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaText}</p>
            <Link className="btn light" href={`/${lang}#plans`}>{t.ctaButton}</Link>
          </Reveal>
        </div>
      </section>

      <Footer locale={lang} />
    </>
  );
}
