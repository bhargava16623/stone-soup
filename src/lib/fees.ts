// Fee math shared by the server (order amounts) and the browser (checkout preview).

/** US PayPal checkout fee (observed in sandbox: $18.00 → $1.12). */
export const PAYPAL_FEE = { rate: 0.0349, fixedCents: 49 };

/** Minimum NGO share: PayPal's fixed fee applies per payee, so tiny shares mostly go to fees. */
export const MIN_NGO_SHARE_CENTS = 500;

/** Extra amount so the payee nets `netCents` after PayPal's fee. */
export function feeCoverCents(netCents: number): number {
  const gross = Math.ceil((netCents + PAYPAL_FEE.fixedCents) / (1 - PAYPAL_FEE.rate));
  return gross - netCents;
}

export const formatUsd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
