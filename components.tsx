import Link from "next/link";
import { LOCALES, UI, type Locale } from "@/lib/i18n";

export function Header({ locale, path }: { locale: Locale; path: string }) {
  return (
    <header className="top wrap">
      <Link href={`/${locale}`} className="brand">
        {UI[locale].siteName}
      </Link>
      <nav className="lang">
        {LOCALES.map((l) => (
          <Link key={l} href={`/${l}${path}`} className={l === locale ? "active" : undefined} hrefLang={l}>
            {l.toUpperCase()}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer>
      <div className="wrap">{UI[locale].footer}</div>
    </footer>
  );
}
