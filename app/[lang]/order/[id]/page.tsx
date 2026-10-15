import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import { isLocale, UI } from "@/lib/i18n";
import { findPlan } from "@/lib/plans";
import { getOrder } from "@/lib/store";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const t = UI[lang];
  const order = await getOrder(id);
  if (!order) notFound();
  const plan = findPlan(order.plan_slug);

  return (
    <>
      <Header locale={lang} path="" />
      <main className="order">
        {order.status === "paid" ? (
          <>
            <h1>{t.success}</h1>
            <p className="muted">{t.successText}</p>
            <div className="panel">
              <p style={{ marginTop: 0, fontWeight: 600 }}>{plan?.title[lang]}</p>
              {(["pdf", "dwg", "cad"] as const).map((file) => (
                <p key={file}>
                  <a className="btn secondary" href={`/api/download/${order.id}/${file}`}>
                    {t.download} — {file === "cad" ? "DXF (CAD)" : file.toUpperCase()}
                  </a>
                </p>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1>{t.pending}</h1>
            <p className="muted">{t.pendingText}</p>
            {order.provider === "bank" && (
              <div className="notice">
                <b>{t.bankDetails}</b>
                <p style={{ whiteSpace: "pre-line", marginBottom: 0 }}>{process.env.BANK_TRANSFER_DETAILS}</p>
                <p className="muted">Order: {order.id}</p>
              </div>
            )}
          </>
        )}
        <p>
          <Link href={`/${lang}`}>{t.backToCatalog}</Link>
        </p>
      </main>
      <Footer locale={lang} />
    </>
  );
}
