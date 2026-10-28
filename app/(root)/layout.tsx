import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE_META } from "@/lib/meta";

export const metadata: Metadata = SITE_META[DEFAULT_LOCALE];

/** Root layout of "/" only, which redirects to the default locale; the localized pages have their own in app/[lang]. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
