const base = () =>
  process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function createPayPalOrder(args: {
  orderId: string;
  title: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ paypalOrderId: string; approveUrl: string }> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: args.orderId,
          description: args.title,
          amount: { currency_code: args.currency, value: (args.amountCents / 100).toFixed(2) },
        },
      ],
      application_context: { return_url: args.returnUrl, cancel_url: args.cancelUrl, user_action: "PAY_NOW" },
    }),
  });
  if (!res.ok) throw new Error(`PayPal create failed: ${res.status}`);
  const data = (await res.json()) as { id: string; links: { rel: string; href: string }[] };
  const approve = data.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve) throw new Error("PayPal approve link missing");
  return { paypalOrderId: data.id, approveUrl: approve.href };
}

/** Captures an approved PayPal order. True only when PayPal reports COMPLETED. */
export async function capturePayPalOrder(paypalOrderId: string): Promise<boolean> {
  const token = await accessToken();
  const res = await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return ((await res.json()) as { status: string }).status === "COMPLETED";
}
