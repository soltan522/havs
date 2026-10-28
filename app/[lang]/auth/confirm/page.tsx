import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import { ACCOUNT } from "@/lib/account";
import { isLocale } from "@/lib/i18n";

// same-origin: the token in the address never goes to another site, while our own form still sends its Origin
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: ACCOUNT[lang].confirmTitle, robots: { index: false, follow: false }, referrer: "same-origin" };
}

/** Landing page of an e-mailed sign-in link (token_hash templates): one click signs in (POST /api/auth/verify). */
export default async function AuthConfirm({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { token_hash = "", type = "email" } = await searchParams;
  const a = ACCOUNT[lang];
  return (
    <>
      <Header locale={lang} path="/login" />
      <main className="wrap login">
        <h1>{a.confirmTitle}</h1>
        <p className="lead muted">{a.confirmText}</p>
        <form className="pay-form" action="/api/auth/verify" method="post">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <button className="btn" type="submit">
            {a.confirmButton} <span className="arrow">→</span>
          </button>
        </form>
      </main>
      <Footer locale={lang} />
    </>
  );
}
