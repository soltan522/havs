import { randomUUID } from "node:crypto";

export type Provider = "lemonsqueezy" | "stripe" | "paypal" | "crypto" | "bank";
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

/** Orders placed with this e-mail address (any letter case), newest first. */
export async function ordersByEmail(email: string): Promise<Order[]> {
  // ilike treats % _ and * as wildcards: escape them, then keep only exact matches
  const pattern = email.replace(/[\\%_*]/g, (c) => `\\${c}`);
  const res = await sb(`/rest/v1/orders?buyer_email=ilike.${encodeURIComponent(pattern)}&select=*&order=created_at.desc&limit=100`);
  if (!res.ok) throw new Error(`ordersByEmail failed: ${res.status}`);
  const wanted = email.toLowerCase();
  return ((await res.json()) as Order[]).filter((o) => o.buyer_email?.toLowerCase() === wanted);
}

/** Sign-in link requests allowed per visitor address (10 minutes) and per e-mail address (1 hour). */
const LOGIN_LIMITS = { ip: { max: 5, minutes: 10 }, email: { max: 3, minutes: 60 } };

/**
 * Counts and records a sign-in link request (table auth_attempts), so the endpoint cannot be used to flood inboxes or
 * use up the project's e-mail quota. True when the request is over a limit. Fails open: Supabase Auth has its own limits.
 */
export async function loginAttemptLimited(ip: string, email: string): Promise<boolean> {
  const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const recent = async (field: "ip" | "email", value: string, limit: { max: number; minutes: number }) => {
    const res = await sb(`/rest/v1/auth_attempts?select=id&${field}=eq.${encodeURIComponent(value)}&created_at=gte.${encodeURIComponent(since(limit.minutes))}&limit=${limit.max}`);
    if (!res.ok) throw new Error(`auth_attempts: ${res.status}`);
    return ((await res.json()) as unknown[]).length >= limit.max;
  };
  try {
    if ((await recent("ip", ip, LOGIN_LIMITS.ip)) || (await recent("email", email, LOGIN_LIMITS.email))) return true;
    await sb("/rest/v1/auth_attempts", { method: "POST", body: JSON.stringify({ ip, email }) });
    // now and then, drop rows older than a day
    if (Math.random() < 0.05) await sb(`/rest/v1/auth_attempts?created_at=lt.${encodeURIComponent(since(24 * 60))}`, { method: "DELETE" });
    return false;
  } catch (e) {
    console.error("auth: rate limit check failed", e);
    return false;
  }
}

export async function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "provider_ref" | "buyer_email">>) {
  const res = await sb(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateOrder failed: ${res.status}`);
}

const bucket = () => process.env.SUPABASE_PLANS_BUCKET ?? "plans-private";

/** True when every object is in the PRIVATE bucket (Storage signs URLs only for objects that exist). Never throws. */
export async function objectsExist(objectPaths: string[]): Promise<boolean> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || objectPaths.length === 0) return false;
  try {
    const results = await Promise.all(
      objectPaths.map((path) => sb(`/storage/v1/object/sign/${bucket()}/${path}`, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) })),
    );
    return results.every((res) => res.ok);
  } catch {
    return false;
  }
}

/** Short-lived signed URL for a file in the PRIVATE bucket. */
export async function signedDownloadUrl(objectPath: string, expiresInSeconds = 600): Promise<string> {
  const res = await sb(`/storage/v1/object/sign/${bucket()}/${objectPath}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) throw new Error(`signedDownloadUrl failed: ${res.status}`);
  const { signedURL } = (await res.json()) as { signedURL: string };
  const name = objectPath.split("/").pop() ?? "download";
  return `${env("SUPABASE_URL")}/storage/v1${signedURL}&download=${encodeURIComponent(name)}`;
}
