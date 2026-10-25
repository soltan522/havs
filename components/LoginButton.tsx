"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SIGNED_IN_COOKIE } from "@/lib/auth-cookie";

const signedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_COOKIE}=1`);
const noSubscription = () => () => {};

/**
 * Header button: "Sign in", or "My account" while the sign-in cookie is there. The cookie is read in the browser, so
 * pages stay static; after a client navigation the right label shows on the first render.
 */
export default function LoginButton({ lang, login, account }: { lang: string; login: string; account: string }) {
  const inside = useSyncExternalStore(noSubscription, signedIn, () => false);
  const label = inside ? account : login;
  return (
    <Link className="login-btn" href={`/${lang}/${inside ? "account" : "login"}`} prefetch={false} aria-label={label}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="5.2" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.6 14c.7-2.7 2.8-4.2 5.4-4.2s4.7 1.5 5.4 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="login-label">{label}</span>
    </Link>
  );
}
