import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://havs.dev"),
  title: { default: "havs.dev", template: "%s — havs.dev" },
  description: "Villa layihələri və exterior dizaynlar — PDF, DWG, CAD",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
