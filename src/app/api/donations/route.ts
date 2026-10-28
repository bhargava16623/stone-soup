import { DonationError, startDonation } from "@/lib/donations.ts";
import { PayPalError } from "@/lib/paypal.ts";

/** Create a PayPal order for a donation. Amounts are computed server-side from the need. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    needId?: unknown;
    units?: unknown;
    ngoShareCents?: unknown;
    coverFees?: unknown;
  } | null;
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { orderId } = await startDonation({
      needId: Number(body.needId),
      units: Number(body.units),
      ngoShareCents: Number(body.ngoShareCents ?? 0),
      coverFees: body.coverFees === true,
    });
    return Response.json({ orderId });
  } catch (e) {
    if (e instanceof DonationError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof PayPalError) {
      console.error(e.message, JSON.stringify(e.body));
      return Response.json({ error: "PayPal could not create the order" }, { status: 502 });
    }
    throw e;
  }
}
