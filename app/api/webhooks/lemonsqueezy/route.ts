import { NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/store";
import { verifyLemonSignature, type LemonOrderEvent } from "@/lib/payments/lemonsqueezy";

/** Lemon Squeezy webhook (events: order_created, order_refunded). Marks our order paid or revokes it. */
export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const raw = await request.text();
  if (!verifyLemonSignature(raw, request.headers.get("x-signature"), secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as LemonOrderEvent;
  const orderId = event.meta.custom_data?.order_id;
  const order = orderId ? await getOrder(orderId) : null;
  if (!order || order.provider !== "lemonsqueezy") return NextResponse.json({ received: true, ignored: "unknown_order" });

  const lemon = event.data.attributes;
  if (event.meta.event_name === "order_created" && lemon.status === "paid") {
    // The price is set server-side when the checkout is created; still refuse anything below it.
    if (typeof lemon.subtotal === "number" && lemon.subtotal < order.amount_cents) {
      console.error(`lemonsqueezy: order ${order.id} paid ${lemon.subtotal} < ${order.amount_cents}`);
      return NextResponse.json({ received: true, ignored: "amount_mismatch" });
    }
    await updateOrder(order.id, { status: "paid", provider_ref: event.data.id, buyer_email: lemon.user_email ?? order.buyer_email });
  } else if (event.meta.event_name === "order_refunded" || lemon.status === "refunded" || lemon.status === "fraudulent") {
    await updateOrder(order.id, { status: "failed" });
  }
  return NextResponse.json({ received: true });
}
