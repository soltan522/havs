"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { src: string; label: string };

/**
 * Full-screen viewer for the plan gallery: click a sheet to open it at full resolution,
 * ←/→ to move between sheets, Esc or click outside to close.
 */
export default function Lightbox({ items, closeLabel }: { items: Item[]; closeLabel: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    // open from any gallery sheet (the sheets are server-rendered)
    const onClick = (e: MouseEvent) => {
      const sheet = (e.target as HTMLElement).closest<HTMLElement>("[data-sheet]");
      if (sheet) setIndex(Number(sheet.dataset.sheet));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("lightbox-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("lightbox-open");
    };
  }, [index, close, step]);

  if (index === null) return null;
  const item = items[index];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.label} onClick={close} data-lenis-prevent>
      {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution original, no resizing wanted */}
      <img src={item.src} alt={item.label} onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => step(-1)} aria-label="←">←</button>
        <span>
          <i>{String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</i> {item.label}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="→">→</button>
        <button type="button" className="close" onClick={close}>{closeLabel} ✕</button>
      </div>
    </div>
  );
}
