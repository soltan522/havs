import Link from "next/link";
import { LOCALES, UI, type Locale } from "@/lib/i18n";

const NAV: { key: string; label: Record<Locale, string> }[] = [
  { key: "", label: { az: "Planlar", en: "Plans", ru: "Проекты" } },
  { key: "about", label: { az: "Haqqımızda", en: "About", ru: "О нас" } },
  { key: "faq", label: { az: "FAQ", en: "FAQ", ru: "FAQ" } },
  { key: "contact", label: { az: "Əlaqə", en: "Contact", ru: "Контакты" } },
];

export function Header({ locale, path }: { locale: Locale; path: string }) {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link href={`/${locale}`} className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {UI[locale].siteName}
        </Link>
        <nav className="menu" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.key} href={`/${locale}${item.key ? `/${item.key}` : ""}`}>
              {item.label[locale]}
            </Link>
          ))}
        </nav>
        <nav className="lang" aria-label="Language">
          {LOCALES.map((l) => (
            <Link key={l} href={`/${l}${path}`} className={l === locale ? "active" : undefined} hrefLang={l}>
              {l.toUpperCase()}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const legal: { key: string; label: Record<Locale, string> }[] = [
    { key: "terms", label: { az: "İstifadə şərtləri", en: "Terms", ru: "Условия" } },
    { key: "privacy", label: { az: "Məxfilik", en: "Privacy", ru: "Конфиденциальность" } },
  ];
  return (
    <footer className="site-footer">
      <div className="wrap foot">
        <div>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            {UI[locale].siteName}
          </div>
          <p className="muted small">{UI[locale].tagline}</p>
        </div>
        <nav className="foot-links" aria-label="Footer">
          {legal.map((l) => (
            <Link key={l.key} href={`/${locale}/${l.key}`}>
              {l.label[locale]}
            </Link>
          ))}
        </nav>
      </div>
      <div className="wrap small muted copy">{UI[locale].footer}</div>
    </footer>
  );
}
