import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { getFlaggedDeliveries } from "@/lib/delivery.ts";
import { isReviewer } from "@/lib/access.ts";
import { formatEin, getCharitiesToReview } from "@/lib/verify.ts";
import { approveCharityAction, approveDeliveryAction, unlockReviewAction } from "./actions.ts";

export default function ReviewPage({ searchParams }: PageProps<"/review">) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader icon={ShieldCheck} eyebrow="Review queue" title="What a person should look at">
        Charities whose official website couldn&apos;t be confirmed automatically, and deliveries the photo check wasn&apos;t sure about. Nothing is rejected automatically; a person decides. Anyone can see the queue; only reviewers can
        approve.
      </PageHeader>
      <Suspense fallback={null}>
        <Unlock searchParams={searchParams} />
      </Suspense>
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

async function Unlock({ searchParams }: Pick<PageProps<"/review">, "searchParams">) {
  if (await isReviewer()) return <p className="text-sm text-leaf">You&apos;re signed in as a reviewer.</p>;
  const wrong = (await searchParams).wrong;
  return (
    <form action={unlockReviewAction} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm">
      <label htmlFor="review-key" className="font-medium">
        Reviewer key
      </label>
      <input id="review-key" name="key" type="password" required autoComplete="off" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-1.5" />
      <button className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition hover:opacity-90">Unlock</button>
      {wrong && <p className="w-full text-amber">That key isn&apos;t right.</p>}
    </form>
  );
}

async function Queue() {
  const reviewer = await isReviewer();
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
            {reviewer && (
              <form
                action={async () => {
                  "use server";
                  await approveDeliveryAction(d.id);
                }}
              >
                <button className="rounded-full bg-leaf px-4 py-1.5 font-medium text-white transition hover:opacity-90">Accept delivery</button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Charities() {
  const reviewer = await isReviewer();
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
            {reviewer && (
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
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
