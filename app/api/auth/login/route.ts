import { NextResponse, type NextRequest } from "next/server";
import { authReady, clientIp, isEmail, sameOrigin, sendMagicLink, setPendingCookie } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { loginAttemptLimited } from "@/lib/store";

/** Sends a sign-in link to the e-mail address; the link returns to /<lang>/auth/callback. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!authReady()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "email" }, { status: 400 });
  }
  // a field people never see: bots fill it in
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ error: "email" }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return NextResponse.json({ error: "email" }, { status: 400 });
  const lang = typeof body.locale === "string" && isLocale(body.locale) ? body.locale : "az";
  if (await loginAttemptLimited(clientIp(req), email)) return NextResponse.json({ error: "rate" }, { status: 429 });

  const result = await sendMagicLink(email, `${req.nextUrl.origin}/${lang}/auth/callback`, lang);
  if (result !== "ok") return NextResponse.json({ error: result }, { status: result === "rate" ? 429 : result === "unavailable" ? 503 : 502 });
  const res = NextResponse.json({ ok: true });
  setPendingCookie(res, email);
  return res;
}
