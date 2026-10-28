import type { Need } from "@/db/schema.ts";

const fairPriceLabel: Record<Need["fairPrice"], { text: string; className: string }> = {
  fair: { text: "Fair price", className: "bg-leaf-soft text-leaf" },
  below_market: { text: "Below market", className: "bg-leaf-soft text-leaf" },
  above_market: { text: "Above market", className: "bg-amber-soft text-amber" },
  no_benchmark: { text: "No market data", className: "bg-border text-muted" },
};

export function FairPriceBadge({ verdict }: { verdict: Need["fairPrice"] }) {
  const { text, className } = fairPriceLabel[verdict];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{text}</span>;
}

const urgencyLabel: Record<Need["urgency"], string> = { high: "Urgent", medium: "Soon", low: "This month" };

export function UrgencyChip({ urgency }: { urgency: Need["urgency"] }) {
  const className = urgency === "high" ? "bg-accent-soft text-accent" : "bg-border text-muted";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{urgencyLabel[urgency]}</span>;
}

export function FundingProgress({ funded, total, unit }: { funded: number; total: number; unit: string }) {
  const pct = Math.min(100, Math.round((funded / total) * 100));
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-muted">
        <span className="font-medium text-foreground">{funded}</span> of {total} {unit}
        {total === 1 ? "" : "s"} funded
      </p>
    </div>
  );
}

export function formatDeadline(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
