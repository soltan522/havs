import { NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/store";
import { CRYPTO_FAILED, CRYPTO_PAID, verifyNowPaymentsSignature, type CryptoIpn } from "@/lib/payments/crypto";

/** NOWPayments IPN: called on every status change of a crypto payment. */
export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const raw = await request.text();
  if (!verifyNowPaymentsSignature(raw, request.headers.get("x-nowpayments-sig"), secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const ipn = JSON.parse(raw) as CryptoIpn;
  const order = ipn.order_id ? await getOrder(ipn.order_id) : null;
  if (!order || order.provider !== "crypto") return NextResponse.json({ received: true, ignored: "unknown_order" });

  if (CRYPTO_PAID.has(ipn.payment_status)) {
    const amountOk = Math.abs(Number(ipn.price_amount) - order.amount_cents / 100) < 0.005;
    const currencyOk = String(ipn.price_currency ?? "").toLowerCase() === order.currency.toLowerCase();
    if (!amountOk || !currencyOk) {
      console.error(`crypto: order ${order.id} invoice ${ipn.price_amount} ${ipn.price_currency} does not match`);
      return NextResponse.json({ received: true, ignored: "amount_mismatch" });
    }
    if (order.status !== "paid") await updateOrder(order.id, { status: "paid" });
  } else if (CRYPTO_FAILED.has(ipn.payment_status)) {
    // a refund revokes a paid order; an expired or failed attempt only closes a pending one
    if (ipn.payment_status === "refunded" || order.status === "pending") await updateOrder(order.id, { status: "failed" });
  }
  return NextResponse.json({ received: true });
}
