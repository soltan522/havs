import { headers } from "next/headers";
import { currencyForCountry, type Currency } from "./pricing";

/** Country header Vercel adds to every request (absent in local development, which then shows USD). */
const COUNTRY_HEADER = "x-vercel-ip-country";

/** The currency to show the current visitor (server components; makes the page render per request). */
export async function visitorCurrency(): Promise<Currency> {
  return currencyForCountry((await headers()).get(COUNTRY_HEADER));
}

/** The same decision inside a route handler. */
export const requestCurrency = (request: Request): Currency => currencyForCountry(request.headers.get(COUNTRY_HEADER));
