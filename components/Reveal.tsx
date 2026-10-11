"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const VARIANT = { up: "reveal", clip: "reveal-clip", fade: "reveal-fade", mask: "reveal-mask" } as const;

/**
 * Reveals children once they scroll into view.
 * up: fade + lift · clip: image wipes in from the bottom · fade: opacity · mask: lines slide up from behind a mask.
 */
export default function Reveal({
  children,
  delay = 0,
  variant = "up",
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  variant?: keyof typeof VARIANT;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${VARIANT[variant]} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/** Splits a heading into masked lines; pair with <Reveal variant="mask"> or the .intro-anim wrapper. */
export function MaskLines({ lines, start = 0 }: { lines: ReactNode[]; start?: number }) {
  return (
    <>
      {lines.map((line, i) => (
        <span className="mask-line" key={i} style={{ "--i": i + start } as CSSProperties}>
          <span>{line}</span>
        </span>
      ))}
    </>
  );
}
