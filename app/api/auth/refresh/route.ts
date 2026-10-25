import { NextResponse, type NextRequest } from "next/server";
import { AuthUnavailable, clearSessionCookies, getUser, REFRESH_COOKIE, refreshSession, safeNext, setSessionCookies } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

/**
 * Renews an expired access token from the refresh cookie, then goes back to `next`. Signs out only when Supabase
 * rejects the token; when Supabase does not answer, the cookies stay and the login page says so.
 */
export async function GET(req: NextRequest) {
  const first = req.nextUrl.searchParams.get("next")?.split("/")[1] ?? "";
  const lang = isLocale(first) ? first : "az";
  const next = safeNext(req.nextUrl.searchParams.get("next"), lang);
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    const session = refresh && refresh.length > 10 && refresh.length < 4096 ? await refreshSession(refresh) : null;
    // check the new token too, so a deleted account cannot loop between the account page and here
    if (session && (await getUser(session.access_token))) {
      const res = NextResponse.redirect(new URL(next, req.url), 303);
      setSessionCookies(res, session);
      return res;
    }
  } catch (e) {
    if (e instanceof AuthUnavailable) return NextResponse.redirect(new URL(`/${lang}/login?error=busy`, req.url), 303);
    throw e;
  }
  const res = NextResponse.redirect(new URL(`/${lang}/login`, req.url), 303);
  clearSessionCookies(res);
  return res;
}
