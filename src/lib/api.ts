import { DonationError } from "./donations.ts";
import { PayPalError } from "./paypal.ts";

/** Map known errors to JSON responses; rethrow anything unexpected. */
export function errorResponse(e: unknown, paypalMessage: string) {
  if (e instanceof DonationError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof PayPalError) {
    console.error(e.message, JSON.stringify(e.body));
    return Response.json({ error: paypalMessage }, { status: 502 });
  }
  throw e;
}
