import type { Provider } from "./store";

export type ProviderInfo = { id: Provider; label: string };

/** Only providers whose credentials are configured are offered at checkout. */
export function availableProviders(): ProviderInfo[] {
  const list: ProviderInfo[] = [];
  if (process.env.STRIPE_SECRET_KEY) list.push({ id: "stripe", label: "Bank kartı / Apple Pay / Google Pay (Stripe)" });
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
    list.push({ id: "paypal", label: "PayPal" });
  if (process.env.BANK_TRANSFER_DETAILS) list.push({ id: "bank", label: "Bank köçürməsi" });
  return list;
}

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const currency = () => process.env.DEFAULT_CURRENCY ?? "USD";
