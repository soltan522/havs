import type { Locale } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import type { PlanPackage } from "@/lib/plans";

const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const EXT = { pdf: "PDF", dwg: "DWG", cad: "DXF" } as const;

/** What the buyer gets: the package files with their sizes, each download locked until payment. */
export default function PackagePanel({ pkg, lang, demo }: { pkg: PlanPackage; lang: Locale; demo: boolean }) {
  const c = COPY[lang];
  return (
    <section className="package" aria-label={c.packageTitle}>
      <p className="package-title">{c.packageTitle}</p>
      <ul>
        {pkg.files.map((f) => (
          <li key={f.kind}>
            <span className={`ext ext-${f.kind}`}>{EXT[f.kind]}</span>
            <span className="file">
              <b>{c.packageFiles[f.kind]}</b>
              <small>
                {f.kind === "pdf" ? c.packageMeta.pdf(f.pages ?? pkg.sheets) : c.packageMeta[f.kind]} · {size(f.bytes)}
              </small>
            </span>
            <button type="button" className="locked" disabled aria-disabled="true" title={c.locked}>
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              {c.locked}
            </button>
          </li>
        ))}
      </ul>
      <p className="package-note">{demo ? c.unlockNote : c.unlockNotePaid}</p>
    </section>
  );
}
