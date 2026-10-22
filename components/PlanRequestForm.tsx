"use client";

import { useState } from "react";

export type PlanFormText = {
  building: string;
  buildingHint: string;
  apartment: string;
  apartmentHint: string;
  rooms: string;
  area: string;
  files: string;
  filesHint: string;
  name: string;
  contact: string;
  contactHint: string;
  note: string;
  consent: string;
  send: string;
  sending: string;
  sent: string;
  sentLead: string;
  errors: { files: string; failed: string; unavailable: string };
};

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const MAX_FILES = 4;
const MAX_BYTES = 15 * 1024 * 1024;

/** Sends an apartment plan: the details go to the site, the files straight to private storage through signed URLs. */
export default function PlanRequestForm({ text, locale, buildingId, buildingLabel }: { text: PlanFormText; locale: string; buildingId?: string; buildingLabel?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length || files.length > MAX_FILES || files.some((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES)) {
      setError(text.errors.files);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/plan-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: buildingId ?? null,
          buildingLabel: form.get("building"),
          apartment: form.get("apartment"),
          rooms: form.get("rooms"),
          area: form.get("area"),
          name: form.get("name"),
          contact: form.get("contact"),
          note: form.get("note"),
          website: form.get("website"),
          locale,
          files: files.map((f) => ({ type: f.type, size: f.size })),
        }),
      });
      if (res.status === 503) throw new Error("unavailable");
      if (!res.ok) throw new Error("failed");
      const { id, uploads } = (await res.json()) as { id: string; uploads: string[] };
      for (let i = 0; i < files.length; i++) {
        const up = await fetch(uploads[i], { method: "PUT", headers: { "Content-Type": files[i].type }, body: files[i] });
        if (!up.ok) throw new Error("failed");
        setProgress((i + 1) / files.length);
      }
      const done = await fetch(`/api/plan-request/${id}`, { method: "POST" });
      if (!done.ok) throw new Error("failed");
      setState("sent");
    } catch (err) {
      setState("idle");
      setProgress(0);
      setError(err instanceof Error && err.message === "unavailable" ? text.errors.unavailable : text.errors.failed);
    }
  }

  if (state === "sent") {
    return (
      <div className="plan-sent" role="status">
        <b>{text.sent}</b>
        <p>{text.sentLead}</p>
      </div>
    );
  }
  return (
    <form className="pay-form plan-form" onSubmit={submit}>
      {error && (
        <p className="pay-error" role="alert">
          {error}
        </p>
      )}
      <label className="pay-field">
        <span>{text.building}</span>
        <input id="plan-building" name="building" defaultValue={buildingLabel ?? ""} maxLength={160} placeholder={text.buildingHint} required />
      </label>
      <label className="pay-field">
        <span>{text.apartment}</span>
        <input id="plan-apartment" name="apartment" maxLength={120} placeholder={text.apartmentHint} />
      </label>
      <div className="plan-row">
        <label className="pay-field">
          <span>{text.rooms}</span>
          <select id="plan-rooms" name="rooms" defaultValue="">
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n === 6 ? "6+" : n}
              </option>
            ))}
          </select>
        </label>
        <label className="pay-field">
          <span>{text.area}</span>
          <input id="plan-area" name="area" inputMode="decimal" maxLength={7} placeholder="m²" />
        </label>
      </div>
      <label className="pay-field">
        <span>{text.files}</span>
        <input id="plan-files" name="files" type="file" accept={TYPES.join(",")} multiple required />
        <small>{text.filesHint}</small>
      </label>
      <label className="pay-field">
        <span>{text.name}</span>
        <input id="plan-name" name="name" maxLength={120} autoComplete="name" required />
      </label>
      <label className="pay-field">
        <span>{text.contact}</span>
        <input id="plan-contact" name="contact" maxLength={160} autoComplete="tel" required />
        <small>{text.contactHint}</small>
      </label>
      <label className="pay-field">
        <span>{text.note}</span>
        <textarea id="plan-note" name="note" maxLength={2000} rows={3} />
      </label>
      <input className="plan-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="muted small">{text.consent}</p>
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? `${text.sending} ${Math.round(progress * 100)}%` : text.send} <span className="arrow">→</span>
      </button>
    </form>
  );
}
