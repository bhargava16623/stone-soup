import Link from "next/link";
import { Suspense } from "react";
import { FairPriceBadge, formatDeadline, FundingProgress, UrgencyChip } from "@/components/need-bits.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getOpenNeeds } from "@/lib/queries.ts";

export default function Home() {
  return (
    <>
      <section className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm italic text-muted">
          In the old tale, each villager added one thing to the pot, and together it fed everyone.
        </p>
        <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
          Add one thing. <span className="text-accent">Watch it arrive.</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Fund a blanket, a backpack, a bag of rice. Your gift is paid straight to the supplier through PayPal, checked
          against market prices, and confirmed when it&apos;s delivered.
        </p>
      </section>

      <h2 className="mb-4 font-serif text-2xl font-semibold">Open needs</h2>
      <Suspense fallback={<p className="text-muted">Loading needs…</p>}>
        <NeedsGrid />
      </Suspense>
    </>
  );
}

async function NeedsGrid() {
  const needs = await getOpenNeeds();
  if (needs.length === 0) return <p className="text-muted">Every need is funded right now. Check back soon.</p>;

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {needs.map((need) => (
        <li key={need.id}>
          <Link
            href={`/needs/${need.id}`}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <ProductImage src={need.imageUrl} alt={need.catalogItem.name} className="h-44 w-full p-4" />
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <UrgencyChip urgency={need.urgency} />
                <FairPriceBadge verdict={need.fairPrice} />
              </div>
              <div>
                <p className="text-sm text-muted">
                  {need.ngo.name} · {need.ngo.city}
                </p>
                <h3 className="mt-0.5 font-serif text-lg font-semibold leading-snug">{need.title}</h3>
              </div>
              <div className="mt-auto space-y-3">
                <FundingProgress funded={need.fundedUnits} total={need.quantity} unit={need.catalogItem.unit} />
                <p className="text-sm text-muted">
                  <span className="font-medium text-foreground">{formatUsd(need.unitPriceCents)}</span> each · from{" "}
                  {need.vendor.name}
                  {need.deadline && <> · by {formatDeadline(need.deadline)}</>}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
