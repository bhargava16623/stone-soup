import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { getFlaggedDeliveries } from "@/lib/delivery.ts";
import { approveDeliveryAction } from "./actions.ts";

export default function ReviewPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader icon={ShieldCheck} eyebrow="Review queue" title="Deliveries a person should look at">
        The photo check wasn&apos;t sure about these. Nothing is rejected automatically; a person decides. (Demo: open to
        everyone.)
      </PageHeader>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}

async function Queue() {
  const flagged = await getFlaggedDeliveries();
  if (flagged.length === 0) return <p className="text-muted">Nothing to review.</p>;
  return (
    <ul className="space-y-4">
      {flagged.map((d) => (
        <li key={d.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-5">
          <ProductImage src={`/api/deliveries/${d.id}/photo`} alt={d.aiSummary ?? "Delivery photo"} fit="cover" className="h-32 w-32 shrink-0 rounded-xl border border-border" />
          <div className="flex-1 space-y-2 text-sm">
            <Link href={`/needs/${d.needId}`} className="font-medium hover:underline">
              {d.units} × {d.need.catalogItem.name} — {d.need.ngo.name}
            </Link>
            <p className="text-muted">{d.aiSummary}</p>
            {d.aiCheck && d.aiCheck.concerns.length > 0 && (
              <ul className="list-inside list-disc text-amber">
                {d.aiCheck.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <form
              action={async () => {
                "use server";
                await approveDeliveryAction(d.id);
              }}
            >
              <button className="rounded-full bg-leaf px-4 py-1.5 font-medium text-white transition hover:opacity-90">Accept delivery</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
