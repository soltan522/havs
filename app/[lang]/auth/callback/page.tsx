import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACCOUNT } from "@/lib/account";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Where the e-mailed sign-in link lands; components/AuthRelay (in the layout) finishes the sign-in. */
export default async function AuthCallback({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <main className="wrap login">
      <p className="order-status" role="status">
        <span className="spinner" aria-hidden="true" /> {ACCOUNT[lang].signingIn}
      </p>
    </main>
  );
}
