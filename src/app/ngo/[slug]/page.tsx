import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IntakeForm } from "@/components/intake-form.tsx";
import { FairPriceBadge } from "@/components/need-bits.tsx";
import { getNgoDashboard } from "@/lib/queries.ts";

export default function NgoDashboardPage({ params }: PageProps<"/ngo/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

const statusLabel = { draft: "Draft", open: "Open", funded: "Funded — awaiting delivery", delivered: "Delivered", verified: "Delivered ✓" };

async function Dashboard({ params }: { params: PageProps<"/ngo/[slug]">["params"] }) {
  const { slug } = await params;
  const ngo = await getNgoDashboard(slug);
  if (!ngo) notFound();

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <section className="space-y-4">
        <p className="text-sm text-muted">Acting as (demo)</p>
        <h1 className="font-serif text-3xl font-semibold">{ngo.name}</h1>
        <p className="text-muted">{ngo.description}</p>
        <IntakeForm ngoSlug={ngo.slug} />
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Your needs</h2>
        {ngo.needs.length === 0 ? (
          <p className="text-sm text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="space-y-3">
            {ngo.needs.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/needs/${n.id}`} className="font-medium hover:underline">
                    {n.title}
                  </Link>
                  <FairPriceBadge verdict={n.fairPrice} />
                </div>
                <p className="mt-1 text-muted">
                  {statusLabel[n.status]} · {n.fundedUnits}/{n.quantity} funded · {n.vendor.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
