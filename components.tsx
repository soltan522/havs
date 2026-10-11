import Link from "next/link";
import HeaderShell from "@/components/motion/HeaderShell";
import { LOCALES, UI, type Locale } from "@/lib/i18n";

const NAV: { href: string; label: Record<Locale, string> }[] = [
  { href: "/plans", label: { az: "Kataloq", en: "Catalogue", ru: "Каталог" } },
  { href: "/about", label: { az: "Haqqımızda", en: "About", ru: "О нас" } },
  { href: "/faq", label: { az: "FAQ", en: "FAQ", ru: "FAQ" } },
  { href: "/contact", label: { az: "Əlaqə", en: "Contact", ru: "Контакты" } },
];

export function Header({ locale, path, overDark = false }: { locale: Locale; path: string; overDark?: boolean }) {
  return (
    <HeaderShell overDark={overDark}>
      <div className="wrap bar">
        <Link href={`/${locale}`} className="brand" data-magnetic>
          <span className="brand-mark" aria-hidden="true" />
          {UI[locale].siteName}
        </Link>
        <nav className="menu" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={`/${locale}${item.href}`}>
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
    </HeaderShell>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const legal: { key: string; label: Record<Locale, string> }[] = [
    { key: "terms", label: { az: "İstifadə şərtləri", en: "Terms", ru: "Условия" } },
    { key: "privacy", label: { az: "Məxfilik", en: "Privacy", ru: "Конфиденциальность" } },
  ];
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <div className="brand">
              <span className="brand-mark" aria-hidden="true" />
              {UI[locale].siteName}
            </div>
            <p className="muted small" style={{ maxWidth: 360 }}>{UI[locale].tagline}</p>
            <a className="small" href="mailto:info@havs.dev" style={{ color: "var(--accent-soft)" }}>
              info@havs.dev
            </a>
          </div>
          <nav className="foot-links" aria-label="Footer">
            {NAV.map((item) => (
              <Link key={item.href} href={`/${locale}${item.href}`}>
                {item.label[locale]}
              </Link>
            ))}
            {legal.map((l) => (
              <Link key={l.key} href={`/${locale}/${l.key}`}>
                {l.label[locale]}
              </Link>
            ))}
          </nav>
        </div>
        <div className="giant" aria-hidden="true">havs</div>
        <div className="copy">
          <span>{UI[locale].footer}</span>
          <span>PDF · DWG · CAD</span>
        </div>
      </div>
    </footer>
  );
}
