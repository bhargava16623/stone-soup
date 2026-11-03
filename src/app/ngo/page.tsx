import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { CharityBadge } from "@/components/need-bits.tsx";
import { PageHeader } from "@/components/page-header.tsx";
import { getNgos } from "@/lib/queries.ts";

export default function NgoIndex() {
  return (
    <div className="max-w-2xl">
      <PageHeader icon={Building2} eyebrow="For organisations" title="Ask for what you need, in your own words">
        We turn it into specific items, find local suppliers, check prices, and tell your donors when it arrives. Pick an
        organisation to open its dashboard (demo: no logins).
      </PageHeader>
      <Link
        href="/ngo/join"
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> Register your charity
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NgoList />
      </Suspense>
    </div>
  );
}

async function NgoList() {
  const ngos = await getNgos();
  return (
    <ul className="space-y-3">
      {ngos.map((n) => (
        <li key={n.id}>
          <Link
            href={`/ngo/${n.slug}`}
            className="group flex items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
          >
            <span>
              <span className="flex flex-wrap items-center gap-2 font-serif text-lg font-semibold group-hover:text-accent">
                {n.name} <CharityBadge ngo={n} />
                {(n.status === "unverified" || n.status === "review") && (
                  <span className="rounded-full bg-amber-soft px-2.5 py-0.5 font-sans text-xs font-medium text-amber">
                    {n.status === "review" ? "Being confirmed" : "Not verified yet"}
                  </span>
                )}
              </span>
              <span className="text-sm text-muted">
                {n.city} · {n.description}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
