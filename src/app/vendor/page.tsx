import Link from "next/link";
import { Suspense } from "react";
import { getVendors } from "@/lib/queries.ts";

export default function VendorIndex() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl font-semibold">For suppliers</h1>
      <p className="text-muted">Pick a supplier to see its catalog and orders. (Demo: there are no logins.)</p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <VendorList />
      </Suspense>
    </div>
  );
}

async function VendorList() {
  const vendors = await getVendors();
  return (
    <ul className="space-y-3">
      {vendors.map((v) => (
        <li key={v.id}>
          <Link href={`/vendor/${v.slug}`} className="block rounded-2xl border border-border bg-surface p-5 hover:shadow-md">
            <p className="font-serif text-lg font-semibold">{v.name}</p>
            <p className="text-sm text-muted">
              {v.city} · trust score {v.trustScore}/100
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
