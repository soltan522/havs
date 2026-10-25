import { NextResponse, type NextRequest } from "next/server";
import { AuthUnavailable, authReady, getUser, sameOrigin, setSessionCookies, verifyTokenHash } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

const TOKEN_TYPES = ["email", "magiclink", "signup"];

/**
 * Signs in from the confirm page (POST): spends the e-mailed one-time token there and not on the link's GET, so mail
 * scanners that open links in advance cannot use it up. Used once the Supabase e-mail templates link to
 * /<lang>/auth/confirm?token_hash={{ .TokenHash }}&type=email (see docs/auth.md).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const field = (name: string) => {
    const v = form?.get(name);
    return typeof v === "string" ? v : "";
  };
  const lang = isLocale(field("lang")) ? field("lang") : "az";
  const tokenHash = field("token_hash");
  const type = field("type");
  const back = (error: string) => NextResponse.redirect(new URL(`/${lang}/login?error=${error}`, req.url), 303);
  if (!authReady()) return back("unavailable");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash) || !TOKEN_TYPES.includes(type)) return back("expired");
  try {
    const session = await verifyTokenHash(tokenHash, type);
    if (!session || !(await getUser(session.access_token))) return back("expired");
    const res = NextResponse.redirect(new URL(`/${lang}/account`, req.url), 303);
    setSessionCookies(res, session);
    return res;
  } catch (e) {
    if (e instanceof AuthUnavailable) return back("busy");
    throw e;
  }
}
