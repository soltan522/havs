import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Footer, Header } from "@/components";
import LoginForm from "@/components/LoginForm";
import { ACCOUNT, type AccountError } from "@/lib/account";
import { ACCESS_COOKIE, getUser } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: ACCOUNT[lang].loginTitle, robots: { index: false, follow: false } };
}

/** Sign-in with an e-mailed link; already signed-in visitors go straight to their account. */
export default async function LoginPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ error?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const signedIn = access ? await getUser(access).catch(() => null) : null;
  if (signedIn) redirect(`/${lang}/account`);
  const { error } = await searchParams;
  const a = ACCOUNT[lang];
  const shown = error && error in a.errors ? (error as AccountError) : undefined;
  return (
    <>
      <Header locale={lang} path="/login" />
      <main className="wrap login">
        <h1>{a.loginTitle}</h1>
        <p className="lead muted">{a.loginLead}</p>
        <LoginForm lang={lang} initialError={shown} />
      </main>
      <Footer locale={lang} />
    </>
  );
}
