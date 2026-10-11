"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Fixed header that turns solid after the first scroll, hides on scroll down and returns on scroll up. */
export default function HeaderShell({ children, overDark = false }: { children: ReactNode; overDark?: boolean }) {
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      setSolid(y > 40);
      setHidden(y > 240 && y > last + 2);
      if (y < last - 2) setHidden(false);
      last = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cls = ["site-header", solid ? "is-solid" : overDark ? "on-dark" : "", hidden ? "is-hidden" : ""].join(" ");
  return <header className={cls}>{children}</header>;
}
