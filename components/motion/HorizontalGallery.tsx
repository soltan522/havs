"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Pinned horizontal gallery: on wide screens vertical scrolling moves the track sideways while the
 * section stays pinned. On touch / narrow screens it falls back to a native swipeable strip.
 */
export default function HorizontalGallery({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const apply = () => setPinned(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const sec = section.current;
    const tr = track.current;
    if (!sec || !tr) return;
    if (!pinned) {
      sec.style.height = "";
      tr.style.transform = "";
      return;
    }
    let distance = 0;
    const measure = () => {
      distance = Math.max(0, tr.scrollWidth - window.innerWidth);
      sec.style.height = `${window.innerHeight + distance}px`;
      update();
    };
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = sec.getBoundingClientRect().top;
      const p = distance ? Math.min(1, Math.max(0, -top / distance)) : 0;
      tr.style.transform = `translate3d(${-p * distance}px, 0, 0)`;
      bar.current?.style.setProperty("--p", String(p));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [pinned]);

  return (
    <section ref={section} className={`hgallery ${pinned ? "" : "native"}`}>
      <div className="hgallery-sticky">
        {header}
        <div ref={track} className="hgallery-track">
          {children}
        </div>
        <div ref={bar} className="progress-line" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
