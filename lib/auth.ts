import type { NextRequest, NextResponse } from "next/server";
import { SIGNED_IN_COOKIE } from "./auth-cookie";

export { SIGNED_IN_COOKIE };

/**
 * Customer sign-in with Supabase Auth over REST (no SDK, like lib/store.ts): an e-mailed magic link, then the session
 * in httpOnly cookies. Server-only — it uses the service role key as the API key.
 */
export const ACCESS_COOKIE = "havs_at";
export const REFRESH_COOKIE = "havs_rt";
/** The address this browser asked a link for: a link opened elsewhere needs a click to confirm the account. */
export const PENDING_COOKIE = "havs_login";

export type Session = { access_token: string; refresh_token: string; expires_in: number };
export type AuthUser = { id: string; email: string };
export type SendResult = "ok" | "rate" | "unavailable" | "failed";

/** Supabase Auth did not answer (timeout, network, 5xx): keep the session, try again later. */
export class AuthUnavailable extends Error {}

const MONTH = 60 * 60 * 24 * 30;

export const authReady = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

async function gotrue(path: string, init: RequestInit & { bearer?: string } = {}): Promise<Response> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const { bearer, headers, ...rest } = init;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1${path}`, {
      ...rest,
      headers: { apikey: key, Authorization: `Bearer ${bearer ?? key}`, "Content-Type": "application/json", ...headers },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status >= 500) throw new AuthUnavailable(`auth ${path}: ${res.status}`);
    return res;
  } catch (e) {
    throw e instanceof AuthUnavailable ? e : new AuthUnavailable(`auth ${path}: ${(e as Error).message}`);
  }
}

export const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** E-mails a sign-in link (and creates the account on first use) that comes back to `redirectTo`. */
export async function sendMagicLink(email: string, redirectTo: string, locale: string): Promise<SendResult> {
  try {
    const res = await gotrue(`/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      // data becomes the new user's metadata: the e-mail templates can use {{ .Data.locale }}
      body: JSON.stringify({ email, create_user: true, data: { locale } }),
    });
    if (res.ok) return "ok";
    const detail = await res.text();
    console.error(`auth: magic link failed (${res.status}): ${detail.slice(0, 300)}`);
    if (res.status === 429 || /rate.?limit/i.test(detail)) return "rate";
    // the built-in Supabase mailer only sends to the project team until a custom SMTP server is set up
    if (/not.?authori[sz]ed|smtp|sending/i.test(detail)) return "unavailable";
    return "failed";
  } catch (e) {
    console.error("auth: magic link request failed", e);
    // Supabase answers 500 when its mailer cannot send
    return "unavailable";
  }
}

const toUser = (u: { id?: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null }): AuthUser | null =>
  // the address must be confirmed: the account page lists the orders placed with it
  u.id && u.email && (u.email_confirmed_at || u.confirmed_at) ? { id: u.id, email: u.email.toLowerCase() } : null;

/** The signed-in user behind an access token; null when it is expired, revoked or unconfirmed. Throws AuthUnavailable. */
export async function getUser(accessToken: string): Promise<AuthUser | null> {
  const res = await gotrue("/user", { bearer: accessToken });
  return res.ok ? toUser(await res.json()) : null;
}

const toSession = (s: Partial<Session>): Session | null =>
  s.access_token && s.refresh_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: Number(s.expires_in) || 3600 } : null;

/** A fresh session from a refresh token (Supabase rotates it); null when the token is no longer valid. Throws AuthUnavailable. */
export async function refreshSession(refreshToken: string): Promise<Session | null> {
  const res = await gotrue("/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  return res.ok ? toSession(await res.json()) : null;
}

/** Spends the one-time token of an e-mailed link (token_hash templates); null when it is expired or used. Throws AuthUnavailable. */
export async function verifyTokenHash(tokenHash: string, type: string): Promise<Session | null> {
  const res = await gotrue("/verify", { method: "POST", body: JSON.stringify({ token_hash: tokenHash, type }) });
  return res.ok ? toSession(await res.json()) : null;
}

/** Revokes the session's refresh token on Supabase (this device only). Never throws. */
export async function signOut(accessToken: string): Promise<void> {
  await gotrue("/logout?scope=local", { method: "POST", bearer: accessToken }).catch(() => undefined);
}

const cookieBase = () => ({ secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });

export function setSessionCookies(res: NextResponse, s: Session) {
  const base = cookieBase();
  res.cookies.set(ACCESS_COOKIE, s.access_token, { ...base, httpOnly: true, maxAge: Math.min(Math.max(s.expires_in, 60), 86400) });
  res.cookies.set(REFRESH_COOKIE, s.refresh_token, { ...base, httpOnly: true, maxAge: MONTH });
  res.cookies.set(SIGNED_IN_COOKIE, "1", { ...base, maxAge: MONTH });
  res.cookies.set(PENDING_COOKIE, "", { path: "/", maxAge: 0 });
}

export function setPendingCookie(res: NextResponse, email: string) {
  res.cookies.set(PENDING_COOKIE, email, { ...cookieBase(), httpOnly: true, maxAge: 60 * 60 });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SIGNED_IN_COOKIE]) res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

/** Browsers send Origin on POST: refuse requests started from another site (login CSRF, forced sign-out). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** The visitor's address as Vercel reports it (it sets these headers itself). */
export const clientIp = (req: NextRequest) => req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** A local path to go to after signing in; anything else (another site, //host) falls back to the account page. */
export function safeNext(next: unknown, lang: string): string {
  return typeof next === "string" && /^\/(?!\/)[^\\\s]*$/.test(next) ? next : `/${lang}/account`;
}
