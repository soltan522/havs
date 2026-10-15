import type { Provider } from "@/lib/store";

const PATHS: Record<"card" | "wallet" | "coin" | "bank", React.ReactNode> = {
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5V6a2 2 0 0 1 2-2h11v3.5" />
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M16 13.5h2.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 7.5v9M10 8h3.2a2 2 0 0 1 0 4H10m0 0h3.7a2 2 0 0 1 0 4H10M12 6v1.5M12 16.5V18" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20h18" />
    </>
  ),
};

const KIND: Record<Provider, keyof typeof PATHS> = { lemonsqueezy: "card", stripe: "card", paypal: "wallet", crypto: "coin", bank: "bank" };

/** Neutral line icon for a payment method (no brand marks). */
export function PaymentIcon({ method }: { method: Provider }) {
  return (
    <span className="pay-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[KIND[method]]}
      </svg>
    </span>
  );
}
