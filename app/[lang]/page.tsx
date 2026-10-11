import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import HeroBlueprint from "@/components/HeroBlueprint";
import Counter from "@/components/motion/Counter";
import HorizontalGallery from "@/components/motion/HorizontalGallery";
import ProcessBlueprint from "@/components/motion/ProcessBlueprint";
import ScrollStatement from "@/components/motion/ScrollStatement";
import Reveal, { MaskLines } from "@/components/Reveal";
import { COPY, floorsText } from "@/lib/copy";
import { isLocale, UI } from "@/lib/i18n";
import { LANDING } from "@/lib/landing";
import { coverOf, formatPrice, publishedPlans, STYLE_LABELS, type PlanStyle } from "@/lib/plans";
import { currency } from "@/lib/providers";

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = LANDING[lang];
  const c = COPY[lang];
  const plans = publishedPlans();
  const featured = plans.slice(0, 6);
  const styles = Object.keys(STYLE_LABELS) as PlanStyle[];
  const styleCounts = styles.map((s) => ({ s, n: plans.filter((p) => p.style === s).length })).filter((x) => x.n > 0);
  const marquee = [...t.marquee, ...t.marquee];

  return (
    <>
      <Header locale={lang} path="" overDark />

      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap hero-inner intro-anim">
          <div>
            <p className="eyebrow fade-in" style={{ ["--i" as string]: 0 }}>{t.eyebrow}</p>
            <h1 className="hero-title">
              <MaskLines lines={[t.heroLines[0], <em key="em">{t.heroLines[1]}</em>, t.heroLines[2]]} />
            </h1>
            <p className="hero-text fade-in" style={{ ["--i" as string]: 1 }}>{t.heroText}</p>
            <div className="hero-cta fade-in" style={{ ["--i" as string]: 2 }}>
              <Link className="btn light" href={`/${lang}/plans`} data-magnetic>
                {t.ctaPrimary} <span className="arrow">→</span>
              </Link>
              <Link className="btn ghost" href={`/${lang}#process`} data-magnetic>
                {t.ctaSecondary}
              </Link>
            </div>
            <div className="stats fade-in" style={{ ["--i" as string]: 3 }}>
              <div className="stat"><b><Counter to={plans.length} delay={1800} /></b><span>{t.stats.plans}</span></div>
              <div className="stat"><b><Counter to={3} delay={1900} /></b><span>{t.stats.formats}</span></div>
              <div className="stat"><b><Counter to={3} delay={2000} /></b><span>{t.stats.languages}</span></div>
            </div>
          </div>
          <div className="hero-drawing">
            <HeroBlueprint />
          </div>
        </div>
        <div className="scroll-cue" aria-hidden="true"><span>{t.scroll}</span><i /></div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {marquee.map((w, i) => (
            <span key={i}>{w}<i>◆</i></span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <Reveal><p className="eyebrow">havs.dev</p></Reveal>
          <ScrollStatement text={t.statement} />
        </div>
      </section>

      <HorizontalGallery
        header={
          <div className="wrap section-head">
            <Reveal variant="mask">
              <p className="eyebrow">{t.featuredEyebrow}</p>
              <h2 className="section-title"><MaskLines lines={[t.featuredTitle[0], <em key="e">{t.featuredTitle[1]}</em>]} /></h2>
            </Reveal>
            <Reveal><Link className="link-arrow" href={`/${lang}/plans`}>{t.viewAll} →</Link></Reveal>
          </div>
        }
      >
        {featured.map((plan, i) => (
          <Link key={plan.slug} href={`/${lang}/plans/${plan.slug}`} className="hcard" data-cursor={c.view}>
            <Reveal variant="clip" delay={i * 90}>
              <div className="media">
                <Image src={coverOf(plan)} alt={plan.title[lang]} width={1200} height={900} sizes="(max-width: 900px) 78vw, 520px" />
                <span className="tag">{STYLE_LABELS[plan.style][lang]}</span>
              </div>
            </Reveal>
            <div className="meta">
              <div>
                <span className="num">{String(i + 1).padStart(2, "0")} / {String(featured.length).padStart(2, "0")}</span>
                <h3>{plan.title[lang]}</h3>
                <span className="muted small">{plan.areaM2} m² · {floorsText(lang, plan.floors, UI[lang].floors)} · {plan.bedrooms} {UI[lang].bedrooms.toLowerCase()}</span>
              </div>
              <span className="price">{formatPrice(plan.priceCents, lang, currency())}</span>
            </div>
          </Link>
        ))}
      </HorizontalGallery>

      <ProcessBlueprint
        steps={t.steps}
        header={
          <Reveal variant="mask" className="section-head">
            <div>
              <p className="eyebrow">{t.processEyebrow}</p>
              <h2 className="section-title"><MaskLines lines={[t.processTitle[0], <em key="e">{t.processTitle[1]}</em>]} /></h2>
            </div>
          </Reveal>
        }
      />

      <section className="section alt">
        <div className="wrap">
          <Reveal variant="mask" className="section-head">
            <div>
              <p className="eyebrow">{t.stylesEyebrow}</p>
              <h2 className="section-title"><MaskLines lines={[t.stylesTitle[0], <em key="e">{t.stylesTitle[1]}</em>]} /></h2>
            </div>
          </Reveal>
          <ul className="style-list">
            {styleCounts.map(({ s, n }, i) => (
              <li key={s}>
                <Reveal delay={i * 50}>
                  <Link href={`/${lang}/plans?style=${s}`}>
                    <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="name">{STYLE_LABELS[s][lang]}</span>
                    <span className="count">{t.plansWord(n)}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal variant="mask" className="section-head">
            <div>
              <p className="eyebrow">{t.whyEyebrow}</p>
              <h2 className="section-title"><MaskLines lines={[t.whyTitle[0], <em key="e">{t.whyTitle[1]}</em>]} /></h2>
            </div>
          </Reveal>
          <div className="features">
            {t.why.map((w, i) => (
              <Reveal key={w.title} delay={i * 120}>
                <div className="feature">
                  <span className="num">0{i + 1}</span>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <Reveal variant="mask">
            <h2><MaskLines lines={[t.ctaTitle[0], <em key="e">{t.ctaTitle[1]}</em>]} /></h2>
          </Reveal>
          <Reveal delay={200}>
            <p>{t.ctaText}</p>
            <Link className="btn light" href={`/${lang}/plans`} data-magnetic>
              {t.ctaButton} <span className="arrow">→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      <Footer locale={lang} />
    </>
  );
}
