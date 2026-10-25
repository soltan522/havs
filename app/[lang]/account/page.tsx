import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Header } from "@/components";
import { ACCOUNT } from "@/lib/account";
import { ACCESS_COOKIE, authReady, AuthUnavailable, getUser, REFRESH_COOKIE, type AuthUser } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { findPlan, formatPrice } from "@/lib/plans";
import { ordersByEmail, type Order } from "@/lib/store";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const DATE_LOCALE = { az: "az-AZ", en: "en-GB", ru: "ru-RU" } as const;

/** The signed-in customer's account: their e-mail and every order placed with it. */
export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const jar = await cookies();
  if (!authReady()) redirect(`/${lang}/login`);
  const access = jar.get(ACCESS_COOKIE)?.value;
  let user: AuthUser | null = null;
  try {
    user = access ? await getUser(access) : null;
  } catch (e) {
    // Supabase did not answer: keep the session and say so, rather than signing the customer out
    if (!(e instanceof AuthUnavailable)) throw e;
    redirect(`/${lang}/login?error=busy`);
  }
  if (!user) {
    // an expired access token is renewed from the refresh cookie, which comes back here
    redirect(jar.get(REFRESH_COOKIE)?.value ? `/api/auth/refresh?next=${encodeURIComponent(`/${lang}/account`)}` : `/${lang}/login`);
  }
  const a = ACCOUNT[lang];
  let orders: Order[] = [];
  let failed = false;
  try {
    orders = await ordersByEmail(user.email);
  } catch {
    failed = true;
  }

  return (
    <>
      <Header locale={lang} path="/account" />
      <main className="order account">
        <h1>{a.title}</h1>
        <div className="account-who">
          <p className="muted">{a.signedInAs(user.email)}</p>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="lang" value={lang} />
            <button className="btn outline small-btn" type="submit">{a.logout}</button>
          </form>
        </div>

        <h2>{a.orders}</h2>
        {failed ? (
          <p className="pay-error">{a.ordersFailed}</p>
        ) : orders.length === 0 ? (
          <div className="account-empty">
            <p className="muted">{a.noOrders}</p>
            <Link className="btn small-btn" href={`/${lang}/plans`}>
              {a.browse} <span className="arrow">→</span>
            </Link>
          </div>
        ) : (
          <ul className="account-orders">
            {orders.map((o) => {
              const plan = findPlan(o.plan_slug);
              return (
                <li key={o.id}>
                  <div>
                    <b>{plan?.title[lang] ?? o.plan_slug}</b>
                    <small className="muted">
                      {o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Baku" })} · {formatPrice(o.amount_cents, lang, o.currency)}
                    </small>
                  </div>
                  <span className={`order-status ${o.status}`}>{a.status[o.status]}</span>
                  <Link className="btn outline small-btn" href={`/${lang}/order/${o.id}`}>
                    {a.open}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer locale={lang} />
    </>
  );
}
