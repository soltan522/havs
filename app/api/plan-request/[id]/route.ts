import { NextResponse } from "next/server";
import { finishPlanRequest, planRequestsReady } from "@/lib/planRequests";

/** Confirms an apartment plan request once the browser has uploaded all its files. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!planRequestsReady()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { id } = await params;
  return (await finishPlanRequest(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "incomplete" }, { status: 409 });
}
