import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { getFlaggedDeliveries } from "@/lib/delivery.ts";
import { formatEin, getCharitiesToReview } from "@/lib/verify.ts";
import { approveCharityAction, approveDeliveryAction } from "./actions.ts";

export default function ReviewPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader icon={ShieldCheck} eyebrow="Review queue" title="What a person should look at">
        Charities whose official website couldn&apos;t be confirmed automatically, and deliveries the photo check wasn&apos;t sure about. Nothing is rejected automatically; a person decides. (Demo: open to
        everyone.)
      </PageHeader>
      <Suspense fallback={null}>
        <Charities />
      </Suspense>
      <h2 className="font-serif text-xl font-semibold">Deliveries</h2>
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

async function Charities() {
  const charities = await getCharitiesToReview();
  if (charities.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl font-semibold">Charities</h2>
      <ul className="space-y-4">
        {charities.map((n) => (
          <li key={n.id} className="space-y-2 rounded-2xl border border-border bg-surface p-5 text-sm">
            <p className="font-medium">
              {n.name} — {n.website}
            </p>
            <p className="text-muted">
              IRS: {n.irsName}, {n.irsLocation}, EIN {n.ein && formatEin(n.ein)}. Code found at {n.verification?.checkedUrl}.
            </p>
            {n.verification && (
              <p className="text-amber">
                Web check ({n.verification.official}): {n.verification.evidence}
              </p>
            )}
            <form
              action={async () => {
                "use server";
                await approveCharityAction(n.id);
              }}
            >
              <button className="rounded-full bg-leaf px-4 py-1.5 font-medium text-white transition hover:opacity-90">
                It&apos;s their official website: verify
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
