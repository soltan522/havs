# Payments — setup

Every payment method switches on by itself when its environment variables are set in Vercel
(Project → Settings → Environment Variables, Production) and the site is redeployed. Nothing else in the code changes.
The checkout page shows the payment form only when at least one method is on **and** every file of the villa's package
is in the private Supabase bucket, so the site never takes money for files it cannot deliver.

| Method | What the buyer sees | Works for a seller in Azerbaijan | Env variables |
|---|---|---|---|
| **Lemon Squeezy** (recommended) | Card (Visa, Mastercard, Amex), Apple Pay on Safari, Google Pay on Chrome, PayPal | Yes — merchant of record, bank payouts to Azerbaijan | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` |
| **NOWPayments** (crypto) | USDT, USDC, BTC, ETH and other coins | Yes — paid out to your own wallet | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` (`NOWPAYMENTS_SANDBOX=1` for tests) |
| **Bank transfer** | Your bank details; files unlock after you confirm | Yes — any bank account | `BANK_TRANSFER_DETAILS` (optional `ADMIN_TOKEN`) |
| Stripe | Card, Apple Pay, Google Pay | Only with a company in a Stripe country | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | PayPal | Only with an account that can receive payments | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=live` |

## Prices and currencies

Every package costs 30 per m² of its floor area (`lib/pricing.ts`). Vercel tells the site the visitor's country
(`x-vercel-ip-country`): visitors in Azerbaijan see and pay the amount in **AZN**, everyone else in **USD**. Lemon
Squeezy (USD store), PayPal and NOWPayments cannot take manat, so a visitor from Azerbaijan is offered only the methods
that can: a card through Stripe and the bank transfer (`providersFor` in `lib/providers.ts`). Stripe needs a company in
a Stripe country, so with the setup below (Lemon Squeezy, NOWPayments, bank) **visitors from Azerbaijan can pay only by
bank transfer in manat**; without `BANK_TRANSFER_DETAILS` they see "online payment opens soon". The checkout form sends
the currency it showed, and the order is refused (the page shows the new price) if the visitor's country changed before
paying. `DEFAULT_CURRENCY` is no longer used.

## 0. Files first

The packages (PDF, DWG, DXF) must be in the bucket `plans-private`. Add the repository secrets `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (GitHub → Settings → Secrets and variables → Actions), then run the workflow
**Rebuild drawing packages** once. New villas are uploaded automatically from then on.

## 1. Lemon Squeezy — cards, Apple Pay, Google Pay, PayPal

1. Sign up at lemonsqueezy.com, create a store in **USD**, complete identity verification and add a payout method
   (bank account or PayPal).
2. Products → New product: name "Villa plan package", **single payment**, any price (each checkout sets the real price),
   no file (the site delivers the files). Publish it.
3. Copy the IDs: the store ID (Settings → Stores) and the variant ID of that product (Products → ⋯ → Copy variant ID).
4. Settings → API → create an API key.
5. Settings → Webhooks → add: URL `https://havs.dev/api/webhooks/lemonsqueezy`, a long random signing secret,
   events `order_created` and `order_refunded`.
6. Put the four values in Vercel and redeploy.

Apple Pay and Google Pay need no extra setup here: Lemon Squeezy shows them on its own checkout page (Apple Pay in
Safari on Apple devices, Google Pay in Chrome). Test mode: switch the store to test mode and pay with card
`4242 4242 4242 4242`.

## 2. NOWPayments — crypto

1. Sign up at nowpayments.io and add a payout wallet (for example USDT TRC-20).
2. Store settings → create an **API key** and generate an **IPN secret key**.
3. Put `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` in Vercel and redeploy. The site sends the IPN URL
   (`https://havs.dev/api/webhooks/crypto`) with every invoice.

An order counts as paid when NOWPayments reports `confirmed`, `sending` or `finished` for the full invoice amount.
For tests use a sandbox account at account-sandbox.nowpayments.io with `NOWPAYMENTS_SANDBOX=1`.

## 3. Bank transfer

`BANK_TRANSFER_DETAILS` is shown on the order page (multi-line text: recipient, bank, IBAN, SWIFT). The buyer puts the
order number in the payment reference. Orders from Azerbaijan are in AZN, all others in USD: confirm an order only when
the amount **and the currency** received match the order (`amount_cents`, `currency`). When the money arrives, find the order in Supabase (Table Editor → `orders`,
filter by email or by the first 8 characters of the id) and set `status` to `paid` — the buyer's order page then
shows the downloads. With `ADMIN_TOKEN` set, the same can be done from a terminal:

```bash
curl -X POST https://havs.dev/api/admin/orders/<order-id> -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## What happens after payment

The provider's webhook marks the order `paid`; the buyer's order page (`/<lang>/order/<id>`) refreshes by itself and
shows the downloads. Each download is a 10-minute signed link to the private bucket. Refunds (Lemon Squeezy
`order_refunded`, NOWPayments `refunded`) set the order back to `failed`, which closes the downloads.

The database must allow the provider names: `supabase/schema.sql` has the constraint (and the upgrade statement for
older databases).
