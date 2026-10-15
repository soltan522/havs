import { randomUUID } from "node:crypto";

export type Provider = "stripe" | "paypal" | "bank";
export type OrderStatus = "pending" | "paid" | "failed";

export type Order = {
  id: string;
  plan_slug: string;
  provider: Provider;
  status: OrderStatus;
  amount_cents: number;
  currency: string;
  locale: string;
  buyer_email: string | null;
  provider_ref: string | null;
  created_at: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

/** Thin REST client over Supabase (no SDK needed). Service role key is server-only. */
async function sb(path: string, init: RequestInit = {}): Promise<Response> {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

export async function createOrder(input: Omit<Order, "id" | "status" | "provider_ref" | "created_at">): Promise<Order> {
  const row = { id: randomUUID(), status: "pending", provider_ref: null, ...input };
  const res = await sb("/rest/v1/orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`createOrder failed: ${res.status}`);
  const [created] = (await res.json()) as Order[];
  return created;
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await sb(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!res.ok) throw new Error(`getOrder failed: ${res.status}`);
  const [order] = (await res.json()) as Order[];
  return order ?? null;
}

export async function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "provider_ref" | "buyer_email">>) {
  const res = await sb(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateOrder failed: ${res.status}`);
}

/** Short-lived signed URL for a file in the PRIVATE bucket. */
export async function signedDownloadUrl(objectPath: string, expiresInSeconds = 600): Promise<string> {
  const bucket = process.env.SUPABASE_PLANS_BUCKET ?? "plans-private";
  const res = await sb(`/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) throw new Error(`signedDownloadUrl failed: ${res.status}`);
  const { signedURL } = (await res.json()) as { signedURL: string };
  const name = objectPath.split("/").pop() ?? "download";
  return `${env("SUPABASE_URL")}/storage/v1${signedURL}&download=${encodeURIComponent(name)}`;
}
