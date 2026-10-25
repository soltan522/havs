import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, refreshSession, sameOrigin, signOut } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

/** Signs out (form post from the account page), revoking the session on Supabase, and returns to the home page. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const value = form?.get("lang");
  const lang = typeof value === "string" && isLocale(value) ? value : "az";
  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  // the access cookie lasts an hour: past that, renew once so the refresh token can still be revoked
  if (!access && refresh) access = (await refreshSession(refresh).catch(() => null))?.access_token;
  if (access) await signOut(access);
  const res = NextResponse.redirect(new URL(`/${lang}`, req.url), 303);
  clearSessionCookies(res);
  return res;
}
