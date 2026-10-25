import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import Reveal, { MaskLines } from "@/components/Reveal";
import { isLocale } from "@/lib/i18n";
import { PARTNERS } from "@/lib/partners";
import { coverOf, publishedPlans } from "@/lib/plans";

export default async function PartnersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = PARTNERS[lang];
  const email = process.env.CONTACT_EMAIL ?? "info@havs.dev";
  // the owner's own company: its projects published in the catalogue
  const avropa = publishedPlans().filter((p) => p.slug.startsWith("avropa-"));
  const avropaCover = avropa.map(coverOf).find(Boolean);

  return (
    <>
      <Header locale={lang} path="/partners" />
      <main>
        <section className="wrap partners-head">
          <Reveal variant="mask">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 className="section-title"><MaskLines lines={[t.title[0], <em key="e">{t.title[1]}</em>]} /></h1>
          </Reveal>
          <Reveal delay={150}><p className="lead muted">{t.lead}</p></Reveal>
        </section>

        <section className="section tight">
          <div className="wrap">
            <Reveal variant="mask" className="section-head">
              <div>
                <p className="eyebrow">{t.ourEyebrow}</p>
                <h2 className="section-title"><MaskLines lines={[t.ourTitle[0], <em key="e">{t.ourTitle[1]}</em>]} /></h2>
              </div>
            </Reveal>
            <Reveal>
              <article className="partner-card">
                {avropaCover && (
                  <div className="media">
                    <Image src={avropaCover} alt="Avropa Qapıları" fill sizes="(max-width: 800px) 100vw, 50vw" />
                  </div>
                )}
                <div className="body">
                  <p className="partner-role">{t.avropa.role}</p>
                  <h3>Avropa Qapıları</h3>
                  <p className="muted">{t.avropa.text}</p>
                  {avropa.length > 0 && (
                    <>
                      <p className="partner-label">{t.avropa.projects}</p>
                      <ul className="partner-projects">
                        {avropa.map((p) => (
                          <li key={p.slug}>
                            <Link href={`/${lang}/plans/${p.slug}`}>
                              {p.title[lang]} <span className="arrow">→</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="section alt partners-who">
          <div className="wrap">
            <Reveal variant="mask" className="section-head">
              <div>
                <p className="eyebrow">{t.whoEyebrow}</p>
                <h2 className="section-title"><MaskLines lines={[t.whoTitle[0], <em key="e">{t.whoTitle[1]}</em>]} /></h2>
              </div>
            </Reveal>
            <div className="features">
              {t.who.map((w, i) => (
                <Reveal key={w.title} delay={(i % 3) * 120}>
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
              <h2><MaskLines lines={[t.joinTitle[0], <em key="e">{t.joinTitle[1]}</em>]} /></h2>
            </Reveal>
            <Reveal delay={200}>
              <p>{t.joinText}</p>
              <div className="partners-cta">
                <a className="btn light" href={`mailto:${email}?subject=${encodeURIComponent(t.joinSubject)}`} data-magnetic>
                  {t.joinButton} <span className="arrow">→</span>
                </a>
                <Link className="btn ghost" href={`/${lang}/contact`} data-magnetic>
                  {t.contact}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer locale={lang} />
    </>
  );
}
