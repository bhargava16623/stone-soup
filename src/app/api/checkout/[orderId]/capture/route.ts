import { revalidatePath } from "next/cache";
import { completeCheckout } from "@/lib/donations.ts";
import { errorResponse } from "@/lib/api.ts";

/** Capture an order after the donor approved it in PayPal. Idempotent. */
export async function POST(_request: Request, ctx: RouteContext<"/api/checkout/[orderId]/capture">) {
  const { orderId } = await ctx.params;
  try {
    const order = await completeCheckout(orderId);
    revalidatePath("/");
    for (const d of order.donations) revalidatePath(`/needs/${d.needId}`);
    return Response.json({
      status: order.status,
      gifts: order.donations.map((d) => ({ needId: d.needId, units: d.units })),
    });
  } catch (e) {
    return errorResponse(e, "PayPal could not capture the payment");
  }
}
