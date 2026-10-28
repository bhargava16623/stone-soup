import { revalidatePath } from "next/cache";
import { completeCheckout, DonationError } from "@/lib/donations.ts";
import { verifyWebhook } from "@/lib/paypal.ts";

interface WebhookEvent {
  id: string;
  event_type: string;
  resource?: { id?: string };
}

/**
 * PayPal webhook. If a donor approves but closes the page before our capture call,
 * CHECKOUT.ORDER.APPROVED lets the server finish the capture. Capture is idempotent,
 * so this is safe alongside the normal browser flow.
 */
export async function POST(request: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return new Response("Webhooks not configured", { status: 503 });
  const event = (await request.json().catch(() => null)) as WebhookEvent | null;
  if (!event?.event_type) return new Response("Bad request", { status: 400 });
  if (!(await verifyWebhook(request.headers, event))) return new Response("Invalid signature", { status: 401 });

  if (event.event_type === "CHECKOUT.ORDER.APPROVED" && event.resource?.id) {
    try {
      const order = await completeCheckout(event.resource.id);
      revalidatePath("/");
      for (const d of order.donations) revalidatePath(`/needs/${d.needId}`);
    } catch (e) {
      // Unknown orders (not created by Stone Soup) and already-failed payments are acknowledged, not retried.
      if (!(e instanceof DonationError)) throw e;
      console.warn(`webhook ${event.id}: ${e.message}`);
    }
  }
  return new Response(null, { status: 200 });
}
