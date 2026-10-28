import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Store } from "lucide-react";
import { PageHeader } from "@/components/page-header.tsx";
import { getVendors } from "@/lib/queries.ts";

export default function VendorIndex() {
  return (
    <div className="max-w-2xl">
      <PageHeader icon={Store} eyebrow="For suppliers" title="Get paid up front to supply local charities">
        List your items once — type them or photograph your price list. Donors pay you directly through PayPal before you
        deliver. Pick a supplier to open its dashboard (demo: no logins).
      </PageHeader>
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
          <Link
            href={`/vendor/${v.slug}`}
            className="group flex items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
          >
            <span>
              <span className="block font-serif text-lg font-semibold group-hover:text-accent">{v.name}</span>
              <span className="text-sm text-muted">
                {v.city} · trust score {v.trustScore}/100
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
