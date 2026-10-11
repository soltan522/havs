import { Footer, Header } from "@/components";
import { PAGES, type InfoPageKey } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

/** Renders one of the static information pages in the current locale. */
export default function InfoPage({ page, locale }: { page: InfoPageKey; locale: Locale }) {
  const content = PAGES[page][locale];
  const email = process.env.CONTACT_EMAIL ?? "info@havs.dev";
  return (
    <>
      <Header locale={locale} path={`/${page}`} />
      <main className="wrap info">
        <h1>{content.title}</h1>
        <p className="lead muted">{content.intro}</p>
        {content.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i}>{p === "__EMAIL__" ? (email ?? "—") : p}</p>
            ))}
          </section>
        ))}
      </main>
      <Footer locale={locale} />
    </>
  );
}
