import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DonatePanel } from "@/components/donate-panel.tsx";
import { FairPriceBadge, formatDeadline, FundingProgress, UrgencyChip } from "@/components/need-bits.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getNeed, type NeedWithRelations } from "@/lib/queries.ts";

export default function NeedPage({ params }: PageProps<"/needs/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NeedView params={params} />
    </Suspense>
  );
}

async function NeedView({ params }: { params: PageProps<"/needs/[id]">["params"] }) {
  const { id } = await params;
  const need = await getNeed(Number(id));
  if (!need) notFound();

  const remaining = need.quantity - need.fundedUnits;
  const unit = need.catalogItem.unit;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <article className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <UrgencyChip urgency={need.urgency} />
            <FairPriceBadge verdict={need.fairPrice} />
            {need.deadline && <span className="text-sm text-muted">Needed by {formatDeadline(need.deadline)}</span>}
          </div>
          <p className="text-muted">
            {need.ngo.name} · {need.ngo.city}
          </p>
          <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">{need.title}</h1>
          {need.story && <p className="text-lg">{need.story}</p>}
          <FundingProgress funded={need.fundedUnits} total={need.quantity} unit={unit} />
        </div>

        <ProductImage src={need.imageUrl} alt={need.catalogItem.name} className="h-64 w-full rounded-2xl border border-border p-6" />

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold">Where your money goes</h2>
          <ol className="mt-4 space-y-3 text-sm">
            <li>
              <span className="font-medium">1. Paid directly to {need.vendor.name}</span>{" "}
              <span className="text-muted">
                ({need.vendor.city}, trust score {need.vendor.trustScore}/100) through PayPal. Stone Soup never holds the money.
              </span>
            </li>
            <li>
              <span className="font-medium">2. Delivered to {need.ngo.name}</span>{" "}
              <span className="text-muted">— {need.catalogItem.spec}, {formatUsd(need.unitPriceCents)} per {unit}.</span>
            </li>
            <li>
              <span className="font-medium">3. Delivery confirmed</span>{" "}
              <span className="text-muted">with a photo checked against the order, then reported back to you.</span>
            </li>
          </ol>
        </section>

        <Deliveries need={need} />
        <MarketCheck need={need} />
        <RecentGifts need={need} />
      </article>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        {need.status === "open" && remaining > 0 ? (
          <DonatePanel
            needId={need.id}
            ngoId={need.ngoId}
            unitName={unit}
            unitPriceCents={need.unitPriceCents}
            remaining={remaining}
            ngoName={need.ngo.name}
            vendorName={need.vendor.name}
          />
        ) : (
          <div className="rounded-2xl border border-leaf/30 bg-leaf-soft p-6 text-leaf">
            <p className="font-serif text-xl font-semibold">Fully funded</p>
            <p className="mt-2 text-sm">Thank you to everyone who added to the pot.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Deliveries({ need }: { need: NeedWithRelations }) {
  if (need.deliveries.length === 0) {
    if (need.fundedUnits === 0) return null;
    return (
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold">Delivery</h2>
        <p className="mt-2 text-sm text-muted">
          {need.fundedUnits} {need.catalogItem.unit}
          {need.fundedUnits === 1 ? " is" : "s are"} paid for and on the way from {need.vendor.name}.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="font-serif text-xl font-semibold">Deliveries</h2>
      <ul className="mt-4 space-y-4">
        {need.deliveries.map((d) => (
          <li key={d.id} className="flex gap-4">
            <ProductImage src={`/api/deliveries/${d.id}/photo`} alt={d.aiSummary ?? "Delivery photo"} fit="cover" className="h-24 w-24 shrink-0 rounded-xl border border-border" />
            <div className="text-sm">
              <p className="font-medium">
                {d.units} {need.catalogItem.unit}
                {d.units === 1 ? "" : "s"} delivered · {d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                {d.verdict === "verified" ? (
                  <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs text-leaf">Verified</span>
                ) : (
                  <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs text-amber">Under review</span>
                )}
              </p>
              {d.aiSummary && <p className="mt-1 text-muted">{d.aiSummary}</p>}
              {d.note && <p className="mt-1">“{d.note}” — {need.ngo.name}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MarketCheck({ need }: { need: NeedWithRelations }) {
  const b = need.benchmark;
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold">Market check</h2>
        <FairPriceBadge verdict={need.fairPrice} />
      </div>
      {b ? (
        <>
          <p className="mt-3 text-sm">
            {need.vendor.name} charges <span className="font-semibold">{formatUsd(need.unitPriceCents)}</span>. Comparable
            products sell for a median of <span className="font-semibold">{formatUsd(b.medianCents)}</span> (typical range{" "}
            {formatUsd(b.lowCents)}–{formatUsd(b.highCents)}), based on {b.products.length} products found with Channel3.
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted hover:text-foreground">See the products we compared</summary>
            <ul className="mt-2 divide-y divide-border">
              {b.products.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-2">
                  <span>
                    {p.title} <span className="text-muted">· {p.domain}</span>
                  </span>
                  <span className="shrink-0 font-medium">{formatUsd(p.priceCents)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Checked {new Date(b.checkedAt).toLocaleDateString("en-US")}.</p>
          </details>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No reliable online price for this item.
          {need.priceJustification && (
            <>
              {" "}
              {need.ngo.name} says: <span className="text-foreground">“{need.priceJustification}”</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}

function RecentGifts({ need }: { need: NeedWithRelations }) {
  if (need.donations.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold">Recent gifts</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {need.donations.map((d) => (
          <li key={d.id} className="flex justify-between">
            <span>
              {d.order.donorName?.split(" ")[0] ?? "Someone"}
              {d.order.source === "agent" ? " (via Giving Agent)" : ""} added {d.units} {need.catalogItem.unit}
              {d.units === 1 ? "" : "s"}
            </span>
            <span className="text-muted">{d.order.capturedAt?.toLocaleDateString("en-US")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
