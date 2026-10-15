"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the current server page every few seconds (an order waiting for its payment webhook), for a limited time. */
export default function AutoRefresh({ everyMs = 6000, forMinutes = 30 }: { everyMs?: number; forMinutes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const until = Date.now() + forMinutes * 60_000;
    const timer = setInterval(() => {
      if (Date.now() > until) clearInterval(timer);
      else router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs, forMinutes]);
  return null;
}
