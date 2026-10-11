import { NextResponse } from "next/server";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { findPlan } from "@/lib/plans";
import { createOrder, updateOrder, type Provider } from "@/lib/store";
import { createStripeCheckout } from "@/lib/payments/stripe";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { availableProviders, currency, siteUrl } from "@/lib/providers";

export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  const provider = String(form.get("provider") ?? "") as Provider;
  const localeRaw = String(form.get("locale") ?? DEFAULT_LOCALE);
  const locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  const plan = findPlan(slug);
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  if (!availableProviders().some((p) => p.id === provider))
    return NextResponse.json({ error: "provider_unavailable" }, { status: 400 });

  const cur = currency();
  const order = await createOrder({
    plan_slug: plan.slug,
    provider,
    amount_cents: plan.priceCents,
    currency: cur,
    locale,
    buyer_email: null,
  });

  const base = siteUrl();
  const title = plan.title[locale];
  const orderPage = `${base}/${locale}/order/${order.id}`;

  if (provider === "bank") {
    return NextResponse.redirect(orderPage, 303);
  }

  if (provider === "stripe") {
    const url = await createStripeCheckout({
      orderId: order.id,
      title,
      amountCents: plan.priceCents,
      currency: cur,
      successUrl: `${orderPage}?paid=1`,
      cancelUrl: `${base}/${locale}/plans/${plan.slug}`,
    });
    return NextResponse.redirect(url, 303);
  }

  // PayPal
  const { paypalOrderId, approveUrl } = await createPayPalOrder({
    orderId: order.id,
    title,
    amountCents: plan.priceCents,
    currency: cur,
    returnUrl: `${base}/api/paypal/return?order=${order.id}`,
    cancelUrl: `${base}/${locale}/plans/${plan.slug}`,
  });
  await updateOrder(order.id, { provider_ref: paypalOrderId });
  return NextResponse.redirect(approveUrl, 303);
}
