import { NextResponse, type NextRequest } from "next/server";
import { authReady, AuthUnavailable, getUser, PENDING_COOKIE, sameOrigin, setSessionCookies } from "@/lib/auth";

const token = (v: unknown) => (typeof v === "string" && v.length > 10 && v.length < 4096 ? v : null);

/**
 * Turns the tokens a magic link brings back (in the URL fragment, read by components/AuthRelay) into the session
 * cookies, after Supabase confirms the access token. A link this browser did not ask for (opened on another device,
 * or sent by someone else) first answers 409 with the account's address, and signs in only once the visitor confirms.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!authReady()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const access = token(body.access_token);
  const refresh = token(body.refresh_token);
  if (!access || !refresh) return NextResponse.json({ error: "invalid" }, { status: 400 });
  let user;
  try {
    user = await getUser(access);
  } catch (e) {
    if (e instanceof AuthUnavailable) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw e;
  }
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 401 });
  if (req.cookies.get(PENDING_COOKIE)?.value !== user.email && body.confirmed !== true) {
    return NextResponse.json({ confirm: user.email }, { status: 409 });
  }

  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, { access_token: access, refresh_token: refresh, expires_in: Number(body.expires_in) || 3600 });
  return res;
}
