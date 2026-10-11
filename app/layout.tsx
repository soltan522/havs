import type { ReactNode } from "react";
import "@fontsource-variable/inter-tight";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://havs.dev"),
  title: { default: "havs.dev — villa layihələri", template: "%s — havs.dev" },
  description: "Villa layihələri və exterior dizaynlar — PDF, DWG, CAD",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
