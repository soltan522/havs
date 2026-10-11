import { NextResponse } from "next/server";
import { getOrder, signedDownloadUrl } from "@/lib/store";
import { findPlan } from "@/lib/plans";

type FileKind = "pdf" | "dwg" | "cad";
const KINDS: FileKind[] = ["pdf", "dwg", "cad"];

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string; file: string }> }) {
  const { orderId, file } = await params;
  if (!KINDS.includes(file as FileKind)) return NextResponse.json({ error: "bad_file" }, { status: 400 });

  const order = await getOrder(orderId);
  if (!order || order.status !== "paid") return NextResponse.json({ error: "not_paid" }, { status: 403 });

  const plan = findPlan(order.plan_slug);
  if (!plan) return NextResponse.json({ error: "plan_missing" }, { status: 404 });

  // Redirect to a 10-minute signed URL; the file itself is never publicly addressable.
  const url = await signedDownloadUrl(plan.files[file as FileKind], 600);
  return NextResponse.redirect(url, 302);
}
