"use client";

import { useEffect } from "react";

/** Keeps <html lang> in sync with the current locale (the root layout cannot read the [lang] segment). */
export default function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
