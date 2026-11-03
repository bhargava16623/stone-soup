import { BadgeCheck, FlaskConical } from "lucide-react";
import type { Need, Ngo } from "@/db/schema.ts";

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

/** Whether the charity proved who it is (see src/lib/verify.ts). Demo charities are labelled as such. */
export function CharityBadge({ ngo, detailed = false }: { ngo: Pick<Ngo, "status" | "ein" | "website">; detailed?: boolean }) {
  if (ngo.status === "demo") {
    return (
      <span title="A fictional charity for this demo" className="inline-flex items-center gap-1 rounded-full bg-border px-2.5 py-0.5 text-xs font-medium text-muted">
        <FlaskConical className="h-3.5 w-3.5" /> Demo charity
      </span>
    );
  }
  if (ngo.status !== "verified") return null;
  const domain = ngo.website ? new URL(ngo.website).hostname.replace(/^www\./, "") : null;
  const facts = [ngo.ein && `EIN ${ngo.ein.slice(0, 2)}-${ngo.ein.slice(2)}`, domain && `owns ${domain}`].filter(Boolean).join(" · ");
  return (
    <span
      title={`IRS-registered 501(c)(3)${facts ? ` · ${facts}` : ""}`}
      className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-leaf"
    >
      <BadgeCheck className="h-3.5 w-3.5" /> Verified charity{detailed && facts ? ` · ${facts}` : ""}
    </span>
  );
}
