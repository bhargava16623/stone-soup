import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductImage } from "@/components/product-image.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getOrderForDonor } from "@/lib/queries.ts";

export default function GiftsPage({ params }: PageProps<"/gifts/[orderId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Gifts params={params} />
    </Suspense>
  );
}

async function Gifts({ params }: { params: PageProps<"/gifts/[orderId]">["params"] }) {
  const { orderId } = await params;
  const order = await getOrderForDonor(orderId);
  if (!order || order.status !== "captured") notFound();
  const firstName = order.donorName?.split(" ")[0];

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-muted">PayPal order {order.paypalOrderId}</p>
        <h1 className="font-serif text-3xl font-semibold">{firstName ? `${firstName}, here's` : "Here's"} what you added to the pot</h1>
        {order.source === "agent" && order.agentNote && <p className="mt-2 text-muted">Giving Agent: “{order.agentNote}”</p>}
      </header>

      <ul className="space-y-4">
        {order.donations.map((d) => {
          const update = d.impactUpdates[0];
          const { need } = d;
          return (
            <li key={d.id} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/needs/${need.id}`} className="font-serif text-lg font-semibold hover:underline">
                    {d.units} × {need.catalogItem.name}
                  </Link>
                  <p className="text-sm text-muted">
                    for {need.ngo.name} · {formatUsd(d.vendorAmountCents)} paid directly to {need.vendor.name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${update ? "bg-leaf-soft text-leaf" : "bg-border text-muted"}`}
                >
                  {update ? "Delivered" : "On its way"}
                </span>
              </div>
              {update ? (
                <div className="mt-4 flex gap-4">
                  <ProductImage src={`/api/deliveries/${update.deliveryId}/photo`} alt={update.delivery.aiSummary ?? "Delivery photo"} fit="cover" className="h-28 w-28 shrink-0 rounded-xl border border-border" />
                  <p>{update.message}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  {need.vendor.name} has been paid. You&apos;ll see a photo here once {need.ngo.name} confirms the delivery.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {order.ngoShareCents > 0 && order.ngoShareNgo && (
        <p className="text-sm text-muted">
          Plus {formatUsd(order.ngoShareCents)} to {order.ngoShareNgo.name} to spend where it&apos;s needed most.
        </p>
      )}
    </div>
  );
}
