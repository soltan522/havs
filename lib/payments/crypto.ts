import { createHmac, timingSafeEqual } from "node:crypto";

// Crypto payments through NOWPayments: a hosted invoice where the buyer picks the coin (USDT, USDC, BTC, ETH, …),
// priced in our fiat currency. NOWPayments calls our IPN endpoint as the payment progresses.
const api = () => (process.env.NOWPAYMENTS_SANDBOX === "1" ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1");

export async function createCryptoInvoice(args: {
  orderId: string;
  title: string;
  amountCents: number;
  currency: string;
  ipnUrl: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ invoiceId: string; url: string }> {
  const res = await fetch(`${api()}/invoice`, {
    method: "POST",
    headers: { "x-api-key": String(process.env.NOWPAYMENTS_API_KEY), "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: args.amountCents / 100,
      price_currency: args.currency.toLowerCase(),
      order_id: args.orderId,
      order_description: args.title,
      ipn_callback_url: args.ipnUrl,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    }),
  });
  if (!res.ok) throw new Error(`NOWPayments invoice failed: ${res.status} ${await res.text()}`);
  const invoice = (await res.json()) as { id: string | number; invoice_url: string };
  return { invoiceId: String(invoice.id), url: invoice.invoice_url };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** x-nowpayments-sig is the hex HMAC-SHA512 of the IPN body re-serialised with all keys sorted. */
export function verifyNowPaymentsSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = createHmac("sha512", secret).update(JSON.stringify(sortKeys(body))).digest("hex");
  const given = header.toLowerCase();
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export type CryptoIpn = {
  payment_id?: number | string;
  invoice_id?: number | string;
  payment_status: string;
  order_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_currency?: string;
};

/** Statuses after which the coins are on the blockchain and counted for the full amount. */
export const CRYPTO_PAID = new Set(["confirmed", "sending", "finished"]);
export const CRYPTO_FAILED = new Set(["failed", "expired", "refunded"]);
