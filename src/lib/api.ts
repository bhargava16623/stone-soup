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

/** The site's public origin, for links sent outside the app (PayPal return URLs, MCP replies). */
export function publicOrigin(request: Request): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
