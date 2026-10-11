import { NextResponse } from "next/server";
import { updateOrder } from "@/lib/store";
import { verifyStripeSignature } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    type: string;
    data: { object: { metadata?: { order_id?: string }; payment_status?: string; customer_details?: { email?: string } } };
  };
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === "paid") {
      await updateOrder(orderId, { status: "paid", buyer_email: session.customer_details?.email ?? null });
    }
  }
  return NextResponse.json({ received: true });
}
