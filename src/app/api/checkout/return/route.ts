import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { completeCheckout } from "@/lib/donations.ts";

/**
 * PayPal sends the payer here after approving a gift from a link (e.g. one set up by an AI
 * assistant). Capture it and show the donor their gifts. Idempotent, like the button flow.
 */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token");
  if (!orderId) return new Response("Missing PayPal order", { status: 400 });
  try {
    const order = await completeCheckout(orderId);
    revalidatePath("/");
    for (const d of order.donations) revalidatePath(`/needs/${d.needId}`);
  } catch (e) {
    console.error("return capture failed", e);
    return new Response("The payment could not be completed. Nothing was charged; you can close this page.", { status: 502 });
  }
  redirect(`/gifts/${encodeURIComponent(orderId)}`);
}
