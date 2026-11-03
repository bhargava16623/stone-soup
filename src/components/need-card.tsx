import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatUsd } from "@/lib/fees.ts";
import type { getOpenNeeds } from "@/lib/queries.ts";
import { CharityBadge, FairPriceBadge, formatDeadline, UrgencyChip } from "./need-bits.tsx";
import { ProductImage } from "./product-image.tsx";

type OpenNeed = Awaited<ReturnType<typeof getOpenNeeds>>[number];

export function NeedCard({ need }: { need: OpenNeed }) {
  const remaining = need.quantity - need.fundedUnits;
  const pct = Math.round((need.fundedUnits / need.quantity) * 100);
  const unit = need.catalogItem.unit;

  return (
    <Link
      href={`/needs/${need.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg"
    >
      <div className="relative bg-gradient-to-b from-background to-surface">
        <ProductImage src={need.imageUrl} alt={need.catalogItem.name} className="h-52 w-full px-5 pb-4 pt-12 transition duration-300 group-hover:scale-105" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          <UrgencyChip urgency={need.urgency} />
          <FairPriceBadge verdict={need.fairPrice} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {need.ngo.name} · {need.ngo.city} <CharityBadge ngo={need.ngo} />
          </p>
          <h3 className="mt-1 font-serif text-xl font-semibold leading-snug transition-colors group-hover:text-accent">{need.title}</h3>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="font-semibold">{need.fundedUnits}</span>
              <span className="text-muted"> of {need.quantity} funded</span>
            </span>
            <span className="text-muted">
              {remaining} {unit}
              {remaining === 1 ? "" : "s"} left
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-amber transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span>
            <span className="text-lg font-semibold">{formatUsd(need.unitPriceCents)}</span>
            <span className="text-muted"> / {unit}</span>
            {need.deadline && <span className="block text-xs text-muted">needed by {formatDeadline(need.deadline)}</span>}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent transition-colors group-hover:bg-accent group-hover:text-white">
            Add to the pot <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
