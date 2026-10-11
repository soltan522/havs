"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor follower: a small dot that trails the pointer and grows into a labelled disc over
 * elements marked with data-cursor="Label". Elements with data-magnetic lean toward the pointer.
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!fine || reduce || !el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let id = 0;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor]");
      if (target) {
        el.classList.add("big");
        if (label.current) label.current.textContent = target.dataset.cursor ?? "";
      } else {
        el.classList.remove("big");
      }
      const mag = (e.target as Element | null)?.closest<HTMLElement>("[data-magnetic]");
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((m) => {
        if (m !== mag) m.style.transform = "";
      });
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.25;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
        mag.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    const loop = () => {
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      id = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    id = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <div ref={ref} className="cursor" aria-hidden="true">
      <span ref={label} />
    </div>
  );
}
