/**
 * Catalogue pricing: every project costs the same amount per square metre of its drawn floor area, shown in manat to
 * visitors in Azerbaijan and in US dollars to everyone else (30 AZN/m² or 30 USD/m²). A multi-unit project is priced on
 * all of its houses together.
 */
export const PRICE_PER_M2 = 30;

export type Currency = "AZN" | "USD";

/** The visitor's currency from their ISO country code (Vercel's x-vercel-ip-country). Unknown country: USD. */
export const currencyForCountry = (country?: string | null): Currency => (country?.trim().toUpperCase() === "AZ" ? "AZN" : "USD");

type Priced = { areaM2: number; project?: { units: number } };

/** The floor area the price is based on: one house, or all houses of a multi-unit project. */
export const pricedAreaM2 = (plan: Priced) => plan.areaM2 * Math.max(1, plan.project?.units ?? 1);

/** Price in minor units (qəpik or cents); the number is the same in both currencies. */
export const planPriceCents = (plan: Priced) => pricedAreaM2(plan) * PRICE_PER_M2 * 100;
