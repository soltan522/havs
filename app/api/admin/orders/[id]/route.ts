import { NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/store";

/** Marks a bank-transfer order as paid after the money has been received. Bearer ADMIN_TOKEN required. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.provider !== "bank") return NextResponse.json({ error: "not_bank_order" }, { status: 400 });

  await updateOrder(id, { status: "paid" });
  return NextResponse.json({ ok: true, id, status: "paid" });
}
