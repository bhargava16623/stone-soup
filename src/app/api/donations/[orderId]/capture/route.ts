import { revalidatePath } from "next/cache";
import { completeDonation, DonationError } from "@/lib/donations.ts";
import { PayPalError } from "@/lib/paypal.ts";

/** Capture a donation after the donor approved it in PayPal. Idempotent. */
export async function POST(_request: Request, ctx: RouteContext<"/api/donations/[orderId]/capture">) {
  const { orderId } = await ctx.params;
  try {
    const donation = await completeDonation(orderId);
    revalidatePath("/");
    revalidatePath(`/needs/${donation.needId}`);
    return Response.json({ status: donation.status, needId: donation.needId, units: donation.units });
  } catch (e) {
    if (e instanceof DonationError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof PayPalError) {
      console.error(e.message, JSON.stringify(e.body));
      return Response.json({ error: "PayPal could not capture the payment" }, { status: 502 });
    }
    throw e;
  }
}
