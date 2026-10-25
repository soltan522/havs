"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ACCOUNT } from "@/lib/account";
import type { Locale } from "@/lib/i18n";

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

/**
 * Finishes a magic-link sign-in. Supabase returns the session in the URL fragment (#access_token=…) — to
 * /<lang>/auth/callback, or to the home page when that address is not on its redirect list — so this runs from the
 * layout and acts on those two pages only: it clears the fragment and hands the tokens to /api/auth/session. A link
 * this browser did not ask for (another device, or someone else's link) shows the account's address and asks first.
 */
export default function AuthRelay({ lang }: { lang: Locale }) {
  const router = useRouter();
  const a = ACCOUNT[lang];
  const [ask, setAsk] = useState<{ email: string; tokens: Tokens } | null>(null);

  const finish = async (tokens: Tokens, confirmed: boolean) => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tokens, confirmed }),
      });
      if (res.status === 409) {
        const { confirm } = (await res.json()) as { confirm: string };
        return setAsk({ email: confirm, tokens });
      }
      router.replace(res.ok ? `/${lang}/account` : `/${lang}/login?error=${res.status === 503 ? "busy" : "signin"}`);
    } catch {
      router.replace(`/${lang}/login?error=busy`);
    }
  };

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, "");
    const onCallback = path === `/${lang}/auth/callback`;
    if (!onCallback && path !== `/${lang}`) return;
    const hash = window.location.hash.slice(1);
    const p = new URLSearchParams(hash);
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    const failed = p.has("error") || p.has("error_code");
    if (!failed && !(access_token && refresh_token)) {
      // the callback page without a usable link (opened directly, or the tokens are incomplete)
      if (onCallback) router.replace(`/${lang}/login?error=signin`);
      return;
    }
    // keep the tokens out of the address bar and the history
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (failed) {
      router.replace(`/${lang}/login?error=${p.get("error_code") === "otp_expired" ? "expired" : "signin"}`);
      return;
    }
    void finish({ access_token: access_token!, refresh_token: refresh_token!, expires_in: Number(p.get("expires_in")) || 3600 }, false);
    // once per page load
  }, []);

  if (!ask) return null;
  return (
    <div className="auth-ask" role="dialog" aria-modal="true" aria-labelledby="auth-ask-title">
      <div className="auth-ask-card">
        <b id="auth-ask-title">{a.askTitle}</b>
        <p>{a.askText(ask.email)}</p>
        <div className="auth-ask-actions">
          <button className="btn small-btn" type="button" autoFocus onClick={() => void finish(ask.tokens, true)}>
            {a.askYes}
          </button>
          <button className="btn outline small-btn" type="button" onClick={() => { setAsk(null); router.replace(`/${lang}`); }}>
            {a.askNo}
          </button>
        </div>
      </div>
    </div>
  );
}
