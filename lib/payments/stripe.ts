import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";

export async function createStripeCheckout(args: {
  orderId: string;
  title: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.orderId,
    "metadata[order_id]": args.orderId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": args.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(args.amountCents),
    "line_items[0][price_data][product_data][name]": args.title,
  });
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status}`);
  const session = (await res.json()) as { url: string };
  return session.url;
}

/** Verifies the Stripe-Signature header (v1 scheme) with a 5-minute tolerance. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = header.split(",");
  const timestamp = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3))
    .some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
