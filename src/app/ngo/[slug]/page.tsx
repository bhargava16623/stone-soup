import Link from "next/link";
import { FileText, Lock, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeliveryForm } from "@/components/delivery-form.tsx";
import { IntakeForm } from "@/components/intake-form.tsx";
import { CharityBadge, FairPriceBadge } from "@/components/need-bits.tsx";
import { getNgoDashboard } from "@/lib/queries.ts";
import { canPostNeeds } from "@/lib/verify.ts";
import { canManageNgo } from "@/lib/access.ts";

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
  const owner = await canManageNgo(ngo);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <section className="space-y-4">
        <p className="text-sm text-muted">{ngo.status === "demo" ? "Demo dashboard: anyone can try it" : owner ? "Your dashboard" : "Charity dashboard"}</p>
        <h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-semibold">
          {ngo.name} <CharityBadge ngo={ngo} />
        </h1>
        <p className="text-muted">{ngo.description}</p>
        {!owner ? (
          <p className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            <Lock className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Only the person who registered {ngo.name} can post needs or confirm deliveries here, from the browser they
              registered with. You can still see its needs and its{" "}
              <Link href={`/ngo/${ngo.slug}/report`} className="text-accent hover:underline">
                funder report
              </Link>
              .
            </span>
          </p>
        ) : canPostNeeds(ngo.status) ? (
          <IntakeForm ngoSlug={ngo.slug} />
        ) : (
          <Link
            href={`/ngo/${ngo.slug}/verify`}
            className="flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber-soft p-5 text-amber transition hover:border-amber"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">
                {ngo.status === "review" ? "A person is confirming your charity" : "Verify your charity to start posting needs"}
              </span>
              <span className="text-sm">
                {ngo.status === "review"
                  ? "Your website check passed. We'll let you post as soon as it's confirmed."
                  : "Prove you run this charity's website. Until then nothing can be posted in its name."}
              </span>
            </span>
          </Link>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">Your needs</h2>
          <Link
            href={`/ngo/${ngo.slug}/report`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-accent hover:text-accent"
          >
            <FileText className="h-4 w-4" /> Funder report
          </Link>
        </div>
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
                  {statusLabel[n.status]} · {n.fundedUnits}/{n.quantity} funded · {n.deliveredUnits} delivered · {n.vendor.name}
                </p>
                {owner && n.fundedUnits > n.deliveredUnits && (
                  <DeliveryForm
                    ngoSlug={ngo.slug}
                    needId={n.id}
                    outstanding={n.fundedUnits - n.deliveredUnits}
                    unit={n.catalogItem.unit}
                    vendorName={n.vendor.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
