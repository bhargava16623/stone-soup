import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogForm } from "@/components/catalog-form.tsx";
import { FairPriceBadge } from "@/components/need-bits.tsx";
import { checkVendorPrice } from "@/lib/benchmark.ts";
import { formatUsd } from "@/lib/fees.ts";
import { getVendorDashboard } from "@/lib/queries.ts";

export default function VendorDashboardPage({ params }: PageProps<"/vendor/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: PageProps<"/vendor/[slug]">["params"] }) {
  const { slug } = await params;
  const vendor = await getVendorDashboard(slug);
  if (!vendor) notFound();
  const toDeliver = vendor.needs.filter((n) => n.fundedUnits > n.deliveredUnits);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-sm text-muted">Acting as (demo)</p>
        <h1 className="font-serif text-3xl font-semibold">{vendor.name}</h1>
        <p className="text-muted">
          {vendor.city} · trust score {vendor.trustScore}/100 · paid via PayPal to {vendor.paypalEmail}
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">To deliver</h2>
        {toDeliver.length === 0 ? (
          <p className="text-sm text-muted">Nothing funded and waiting for delivery.</p>
        ) : (
          <ul className="space-y-2">
            {toDeliver.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border bg-surface p-4 text-sm">
                <Link href={`/needs/${n.id}`} className="font-medium hover:underline">
                  {n.fundedUnits - n.deliveredUnits} × {n.catalogItem.name} → {n.ngo.name}
                </Link>
                <span className="text-muted">
                  {formatUsd((n.fundedUnits - n.deliveredUnits) * n.unitPriceCents)} already paid to you
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">Your catalog</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-border">
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium">Your price</th>
                <th className="p-3 font-medium">Market median</th>
                <th className="p-3 font-medium">Check</th>
              </tr>
            </thead>
            <tbody>
              {vendor.catalog.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">{c.spec}</span>
                  </td>
                  <td className="p-3">
                    {formatUsd(c.unitPriceCents)} / {c.unit}
                  </td>
                  <td className="p-3 text-muted">{c.benchmark ? formatUsd(c.benchmark.medianCents) : "—"}</td>
                  <td className="p-3">
                    <FairPriceBadge verdict={checkVendorPrice(c.unitPriceCents, c.benchmark ?? undefined).verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CatalogForm vendorSlug={vendor.slug} />
      </section>
    </div>
  );
}
