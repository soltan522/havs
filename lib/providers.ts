import type { Currency } from "./pricing";
import type { Provider } from "./store";

/**
 * Payment methods offered at checkout, in display order. An online method appears only when it can also confirm the
 * payment on its own (API keys and webhook secret). A bank transfer is confirmed by the owner: in Supabase
 * (orders → status "paid") or through /api/admin/orders/<id> when ADMIN_TOKEN is set.
 */
export function availableProviders(): Provider[] {
  const env = process.env;
  const list: Provider[] = [];
  if (env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID && env.LEMONSQUEEZY_VARIANT_ID && env.LEMONSQUEEZY_WEBHOOK_SECRET)
    list.push("lemonsqueezy");
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) list.push("stripe");
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) list.push("paypal");
  if (env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET) list.push("crypto");
  if (env.BANK_TRANSFER_DETAILS) list.push("bank");
  return list;
}

/**
 * Methods that can charge an order in manat. Lemon Squeezy charges in its store currency (US dollars), and PayPal and
 * NOWPayments do not take AZN, so visitors from Azerbaijan pay by card through Stripe or by bank transfer.
 */
const MANAT_PROVIDERS: Provider[] = ["stripe", "bank"];

/** The switched-on methods that can take a payment in the visitor's currency. */
export const providersFor = (cur: Currency) => availableProviders().filter((p) => cur === "USD" || MANAT_PROVIDERS.includes(p));

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
