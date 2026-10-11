import { NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/store";
import { capturePayPalOrder } from "@/lib/payments/paypal";
import { siteUrl } from "@/lib/providers";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order") ?? "";
  const order = await getOrder(orderId);
  const base = siteUrl();
  if (!order || order.provider !== "paypal" || !order.provider_ref) {
    return NextResponse.redirect(`${base}/az`, 303);
  }
  const captured = await capturePayPalOrder(order.provider_ref);
  await updateOrder(order.id, { status: captured ? "paid" : "failed" });
  return NextResponse.redirect(`${base}/${order.locale}/order/${order.id}`, 303);
}
