"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ACCOUNT, type AccountError as Err } from "@/lib/account";
import type { Locale } from "@/lib/i18n";

/** E-mail form that asks for a magic sign-in link (POST /api/auth/login). */
export default function LoginForm({ lang, initialError }: { lang: Locale; initialError?: Err }) {
  const a = ACCOUNT[lang];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<Err | null>(initialError ?? null);
  const sentRef = useRef<HTMLElement>(null);
  // the form is replaced by the confirmation: move focus with it
  useEffect(() => {
    if (state === "sent") sentRef.current?.focus();
  }, [state]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("email");
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale: lang, website }),
      });
      if (res.ok) return setState("sent");
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error && body.error in a.errors ? (body.error as Err) : "failed");
    } catch {
      setError("failed");
    }
    setState("idle");
  }

  if (state === "sent") {
    return (
      <div className="login-sent" role="status">
        <b ref={sentRef} tabIndex={-1}>{a.sentTitle}</b>
        <p>{a.sentText(email.trim())}</p>
        <button type="button" className="btn outline small-btn" onClick={() => setState("idle")}>
          {a.other}
        </button>
      </div>
    );
  }

  return (
    <form className="pay-form login-form" onSubmit={submit} noValidate>
      {error && <p className="pay-error" id="login-error" role="alert">{a.errors[error]}</p>}
      <label className="pay-field">
        <span>{a.email}</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" required aria-invalid={error === "email"} aria-describedby={error ? "login-error" : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </label>
      <input className="plan-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? a.sending : a.send} {state !== "sending" && <span className="arrow">→</span>}
      </button>
      <p className="muted small">{a.why}</p>
    </form>
  );
}
