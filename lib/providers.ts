import type { Provider } from "./store";

/**
 * Payment methods offered at checkout, in display order. A method appears only when it can also confirm the payment
 * on its own: its API keys and its webhook secret (or, for bank transfers, the admin token) must all be set.
 */
export function availableProviders(): Provider[] {
  const env = process.env;
  const list: Provider[] = [];
  if (env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID && env.LEMONSQUEEZY_VARIANT_ID && env.LEMONSQUEEZY_WEBHOOK_SECRET)
    list.push("lemonsqueezy");
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) list.push("stripe");
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) list.push("paypal");
  if (env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET) list.push("crypto");
  if (env.BANK_TRANSFER_DETAILS && env.ADMIN_TOKEN) list.push("bank");
  return list;
}

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const currency = () => process.env.DEFAULT_CURRENCY ?? "USD";
