"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up to `to` when scrolled into view. Renders the final value on the server and without JS. */
export default function Counter({ to, duration = 1600, delay = 0 }: { to: number; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setValue(0);
    let raf = 0;
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      timer = window.setTimeout(() => {
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, delay);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [to, duration, delay]);

  return <span ref={ref}>{String(value).padStart(2, "0")}</span>;
}
