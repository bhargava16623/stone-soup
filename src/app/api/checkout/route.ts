import { errorResponse } from "@/lib/api.ts";
import { startCheckout } from "@/lib/donations.ts";

interface Body {
  items?: { needId?: unknown; units?: unknown }[];
  coverFees?: unknown;
  ngoShare?: { ngoId?: unknown; cents?: unknown } | null;
}

/** Create one PayPal order for a basket of needs. Amounts are computed server-side. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.items)) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { orderId } = await startCheckout({
      items: body.items.map((i) => ({ needId: Number(i.needId), units: Number(i.units) })),
      coverFees: body.coverFees === true,
      ngoShare: body.ngoShare ? { ngoId: Number(body.ngoShare.ngoId), cents: Number(body.ngoShare.cents) } : undefined,
    });
    return Response.json({ orderId });
  } catch (e) {
    return errorResponse(e, "PayPal could not create the order");
  }
}
