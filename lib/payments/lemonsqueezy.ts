import { createHmac, timingSafeEqual } from "node:crypto";

// Lemon Squeezy is the merchant of record: its hosted checkout takes cards, Apple Pay (Safari), Google Pay (Chrome)
// and PayPal, charges the buyer's VAT and pays out to the seller's bank. One product variant is enough — every
// checkout overrides its price and name, and carries our order id back in the webhook as custom data.
const API = "https://api.lemonsqueezy.com/v1";

export async function createLemonCheckout(args: {
  orderId: string;
  title: string;
  description: string;
  amountCents: number;
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: args.amountCents,
          product_options: {
            name: args.title,
            description: args.description,
            redirect_url: args.redirectUrl,
            receipt_link_url: args.redirectUrl,
          },
          checkout_data: { email: args.email, custom: { order_id: args.orderId } },
        },
        relationships: {
          store: { data: { type: "stores", id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(process.env.LEMONSQUEEZY_VARIANT_ID) } },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}

/** X-Signature is the hex HMAC-SHA256 of the raw request body with the webhook signing secret. */
export function verifyLemonSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export type LemonOrderEvent = {
  meta: { event_name: string; custom_data?: { order_id?: string } };
  data: { id: string; attributes: { status: string; user_email?: string; currency?: string; subtotal?: number } };
};
