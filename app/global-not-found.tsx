import type { Metadata } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource/cormorant-garamond/500.css";
import "./globals.css";
import { NOT_FOUND } from "@/lib/content";
import { LOCALES } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "404 — havs.dev",
  description: NOT_FOUND.az.text,
};

/**
 * 404 for an address that no route matches. Unknown pages (/xyz, /en/xyz, /en/plans/x.y, an unknown villa) get the
 * localized 404 page through proxy.ts instead; this one answers what the proxy skips: an unknown /api/... address and
 * a path with a dot outside the locales that is no file (/favicon.ico, /xyz.html), which next.config.mjs rewrites to
 * an address no route matches. It is also the fallback Next needs without a top-level app/layout. There is no locale
 * to pick, so the page speaks all three. It replaces the root layouts (app/[lang], app/(root)), so it brings its own
 * <html>, styles and fonts.
 */
export default function GlobalNotFound() {
  return (
    <html lang="az">
      <body>
        <main className="wrap info">
          <h1>404</h1>
          {LOCALES.map((l) => (
            <section key={l} lang={l}>
              <h2>{NOT_FOUND[l].title}</h2>
              <p className="muted">{NOT_FOUND[l].text}</p>
              <p>
                <a href={`/${l}`}>{NOT_FOUND[l].home} →</a>
              </p>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
