import { randomUUID } from "node:crypto";

/** An apartment plan sent by its owner from the projects map: who, which building and flat, and the uploaded files. */
export type PlanRequestInput = {
  buildingId: string | null;
  buildingLabel: string | null;
  apartment: string | null;
  rooms: number | null;
  area: number | null;
  name: string;
  contact: string;
  note: string | null;
  locale: "az" | "en" | "ru";
  files: { type: string; size: number }[];
};

const BUCKET = "plan-uploads";
export const PLAN_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};
export const MAX_PLAN_FILES = 4;
export const MAX_PLAN_FILE_BYTES = 15 * 1024 * 1024;

export const planRequestsReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

/** Records the request and returns one signed upload URL per file; the browser uploads the files straight to Storage. */
export async function createPlanRequest(input: PlanRequestInput): Promise<{ id: string; uploads: string[] }> {
  const id = randomUUID();
  const files = input.files.map((f, i) => `${id}/${i + 1}.${PLAN_FILE_TYPES[f.type]}`);
  const row = {
    id,
    building_id: input.buildingId,
    building_label: input.buildingLabel,
    apartment: input.apartment,
    rooms: input.rooms,
    area: input.area,
    name: input.name,
    contact: input.contact,
    note: input.note,
    files,
    locale: input.locale,
  };
  const res = await sb("/rest/v1/plan_requests", { method: "POST", body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`plan request insert failed: ${res.status}`);
  const uploads = await Promise.all(
    files.map(async (path) => {
      const signed = await sb(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: "POST", body: "{}" });
      if (!signed.ok) throw new Error(`upload sign failed: ${signed.status}`);
      const { url } = (await signed.json()) as { url: string };
      return `${process.env.SUPABASE_URL}/storage/v1${url}`;
    }),
  );
  return { id, uploads };
}

/** Marks a request as sent once all its files are in Storage. */
export async function finishPlanRequest(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const res = await sb(`/rest/v1/plan_requests?id=eq.${id}&select=files,status`);
  if (!res.ok) return false;
  const [row] = (await res.json()) as { files: string[]; status: string }[];
  if (!row || row.status !== "uploading") return false;
  // Storage signs URLs only for objects that exist
  const present = await Promise.all(
    row.files.map((path) => sb(`/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) }).then((r) => r.ok)),
  );
  if (!present.every(Boolean)) return false;
  const done = await sb(`/rest/v1/plan_requests?id=eq.${id}&status=eq.uploading`, { method: "PATCH", body: JSON.stringify({ status: "new" }) });
  return done.ok;
}
