import { errorResponse } from "@/lib/api.ts";
import { ClubError, currentMonth, getMember } from "@/lib/club.ts";
import { startCheckout } from "@/lib/donations.ts";
import { db } from "@/db/index.ts";

/** Create the PayPal order for this month's Soup Club basket. Items come from the stored basket, not the client. */
export async function POST(_request: Request, ctx: RouteContext<"/api/club/[token]/checkout">) {
  const { token } = await ctx.params;
  try {
    const member = await getMember(token);
    const basket = await db.query.clubBaskets.findFirst({
      where: (b, { and, eq }) => and(eq(b.memberId, member.id), eq(b.month, currentMonth()), eq(b.status, "ready")),
    });
    if (!basket) throw new ClubError("There's no basket waiting for approval this month");
    const { orderId } = await startCheckout({
      items: basket.items,
      coverFees: true,
      source: "agent",
      agentNote: `Soup Club ${basket.month}: ${basket.rationale}`.slice(0, 500),
      clubBasketId: basket.id,
    });
    return Response.json({ orderId });
  } catch (e) {
    if (e instanceof ClubError) return Response.json({ error: e.message }, { status: 400 });
    return errorResponse(e, "PayPal could not create the order");
  }
}
