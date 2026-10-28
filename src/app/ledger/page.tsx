import { Suspense } from "react";
import { LedgerGrid } from "@/components/ledger-grid.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getLedger } from "@/lib/queries.ts";

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold">Open ledger</h1>
        <p className="mt-2 text-muted">
          Every gift on Stone Soup: what it bought, which supplier PayPal paid, whether the price was fair, and whether it
          arrived. Donors appear by first name only.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Loading the ledger…</p>}>
        <Ledger />
      </Suspense>
    </div>
  );
}

async function Ledger() {
  const rows = await getLedger();
  const given = rows.reduce((s, r) => s + r.amountCents, 0);
  const items = rows.reduce((s, r) => s + r.units, 0);
  const suppliers = new Set(rows.map((r) => r.vendor)).size;
  const delivered = rows.filter((r) => r.delivery === "Delivered").length;
  const viaAgent = rows.filter((r) => r.via === "Giving Agent").length;

  const stats = [
    { label: "Paid to suppliers", value: formatUsd(given) },
    { label: "Items funded", value: items.toLocaleString("en-US") },
    { label: "Suppliers paid", value: suppliers.toString() },
    { label: "Gifts delivered", value: rows.length ? `${Math.round((delivered / rows.length) * 100)}%` : "—" },
    { label: "Via Giving Agent", value: rows.length ? `${Math.round((viaAgent / rows.length) * 100)}%` : "—" },
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <LedgerGrid rows={rows} />
    </>
  );
}
