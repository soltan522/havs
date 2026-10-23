import { NextResponse } from "next/server";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { deliverables, findPlan } from "@/lib/plans";
import { createOrder, objectsExist, updateOrder, type Provider } from "@/lib/store";
import { createLemonCheckout } from "@/lib/payments/lemonsqueezy";
import { createStripeCheckout } from "@/lib/payments/stripe";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { createCryptoInvoice } from "@/lib/payments/crypto";
import { requestCurrency } from "@/lib/geo";
import { providersFor, siteUrl } from "@/lib/providers";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Checkout form → order row → the provider's hosted payment page. Every problem goes back to the form with a reason. */
export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  const provider = String(form.get("provider") ?? "") as Provider;
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const localeRaw = String(form.get("locale") ?? DEFAULT_LOCALE);
  const locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const base = siteUrl();

  const plan = findPlan(slug);
  if (!plan) return NextResponse.redirect(`${base}/${locale}/plans`, 303);
  const checkoutPage = `${base}/${locale}/plans/${plan.slug}/checkout`;
  const back = (error: string) => NextResponse.redirect(`${checkoutPage}?error=${error}`, 303);

  // The price shown and charged follows the visitor's country: 30 AZN/m² in Azerbaijan, 30 USD/m² elsewhere.
  const cur = requestCurrency(request);
  if (!providersFor(cur).includes(provider)) return back("method");
  if (email.length > 254 || !EMAIL.test(email)) return back("email");
  // Never take money for files that cannot be delivered: every file must already be in the private bucket.
  if (!(await objectsExist(deliverables(plan).map((d) => d.key)))) return back("unavailable");

  let order;
  try {
    order = await createOrder({ plan_slug: plan.slug, provider, amount_cents: plan.priceCents, currency: cur, locale, buyer_email: email });
  } catch (err) {
    console.error("checkout: order not created", err);
    return back("provider");
  }

  const title = `${plan.title[locale]} — PDF, DWG, DXF`;
  const orderPage = `${base}/${locale}/order/${order.id}`;
  try {
    switch (provider) {
      case "bank":
        return NextResponse.redirect(orderPage, 303);
      case "lemonsqueezy": {
        const url = await createLemonCheckout({
          orderId: order.id,
          title,
          description: plan.summary[locale],
          amountCents: plan.priceCents,
          email,
          redirectUrl: orderPage,
        });
        return NextResponse.redirect(url, 303);
      }
      case "stripe": {
        const url = await createStripeCheckout({
          orderId: order.id,
          title,
          amountCents: plan.priceCents,
          currency: cur,
          successUrl: orderPage,
          cancelUrl: checkoutPage,
          customerEmail: email,
        });
        return NextResponse.redirect(url, 303);
      }
      case "paypal": {
        const { paypalOrderId, approveUrl } = await createPayPalOrder({
          orderId: order.id,
          title,
          amountCents: plan.priceCents,
          currency: cur,
          returnUrl: `${base}/api/paypal/return?order=${order.id}`,
          cancelUrl: checkoutPage,
        });
        await updateOrder(order.id, { provider_ref: paypalOrderId });
        return NextResponse.redirect(approveUrl, 303);
      }
      case "crypto": {
        const { invoiceId, url } = await createCryptoInvoice({
          orderId: order.id,
          title,
          amountCents: plan.priceCents,
          currency: cur,
          ipnUrl: `${base}/api/webhooks/crypto`,
          successUrl: orderPage,
          cancelUrl: checkoutPage,
        });
        await updateOrder(order.id, { provider_ref: invoiceId });
        return NextResponse.redirect(url, 303);
      }
    }
  } catch (err) {
    console.error(`checkout: ${provider} failed`, err);
    await updateOrder(order.id, { status: "failed" }).catch(() => {});
    return back("provider");
  }
  return back("method");
}
