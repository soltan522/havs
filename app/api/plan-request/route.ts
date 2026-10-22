import { NextResponse } from "next/server";
import { createPlanRequest, MAX_PLAN_FILE_BYTES, MAX_PLAN_FILES, PLAN_FILE_TYPES, planRequestsReady } from "@/lib/planRequests";

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Starts an apartment plan request: validates it, records it and hands back signed upload URLs for its files. */
export async function POST(req: Request) {
  if (!planRequestsReady()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  // a field people never see: bots fill it in
  if (text(body.website, 200)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const name = text(body.name, 120);
  const contact = text(body.contact, 160);
  const locale = body.locale === "en" || body.locale === "ru" ? body.locale : "az";
  const files = Array.isArray(body.files) ? body.files : [];
  const validFiles = files.every(
    (f) => f && typeof f === "object" && (f as { type?: string }).type! in PLAN_FILE_TYPES && Number((f as { size?: number }).size) > 0 && Number((f as { size?: number }).size) <= MAX_PLAN_FILE_BYTES,
  );
  if (!name || !contact || contact.length < 3 || files.length < 1 || files.length > MAX_PLAN_FILES || !validFiles) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const created = await createPlanRequest({
      buildingId: text(body.buildingId, 80),
      buildingLabel: text(body.buildingLabel, 160),
      apartment: text(body.apartment, 120),
      rooms: num(body.rooms, 0, 12),
      area: num(body.area, 1, 1999),
      name,
      contact,
      note: text(body.note, 2000),
      locale,
      files: files.map((f) => ({ type: (f as { type: string }).type, size: Number((f as { size: number }).size) })),
    });
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
