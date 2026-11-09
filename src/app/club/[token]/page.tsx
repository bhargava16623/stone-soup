import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, CalendarHeart, CheckCircle2 } from "lucide-react";
import { ClubBasketActions, PrepareBasketButton } from "@/components/club-basket.tsx";
import { ClubSettings } from "@/components/club-settings.tsx";
import { PageHeader } from "@/components/page-header.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { ClubError, getClubDashboard } from "@/lib/club.ts";
import { formatUsd } from "@/lib/fees.ts";
import { plural } from "@/lib/plural.ts";

export default function ClubMemberPage({ params }: PageProps<"/club/[token]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

async function Dashboard({ params }: { params: PageProps<"/club/[token]">["params"] }) {
  const { token } = await params;
  const data = await getClubDashboard(token).catch((e) => {
    if (e instanceof ClubError) return null;
    throw e;
  });
  if (!data) notFound();
  const { member, baskets, needs, month } = data;
  const current = baskets.find((b) => b.month === month);
  const past = baskets.filter((b) => b.month !== month);
  const need = (id: number) => needs.find((n) => n.id === id);

  return (
    <div>
      <PageHeader icon={CalendarHeart} eyebrow="Soup Club" title={`${member.name}'s pot`}>
        {formatUsd(member.monthlyBudgetCents)} a month for {member.causes}.{" "}
        <span className="text-sm">Bookmark this page — it&apos;s your private link.</span>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <p className="text-sm text-muted">{monthName(month)}</p>
            {!member.active ? (
              <p className="mt-2">Your membership is paused. Resume it to get a basket this month.</p>
            ) : !current || current.status === "skipped" ? (
              <div className="mt-2 space-y-3">
                <p>{current ? "You skipped this month." : "No basket yet this month."}</p>
                <PrepareBasketButton token={token} label={current ? "Prepare one after all" : "Prepare this month's basket"} />
              </div>
            ) : (
              <>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {current.status === "paid" ? "This month's gifts are paid" : "This month's basket is ready"}
                </h2>
                <p className="mt-2 text-muted">{current.rationale}</p>
                <ul className="mt-5 space-y-3">
                  {current.items.map((item) => {
                    const n = need(item.needId);
                    if (!n) return null;
                    return (
                      <li key={item.needId} className="flex items-center gap-4 rounded-2xl border border-border p-3">
                        <ProductImage src={n.imageUrl} alt={n.catalogItem.name} className="h-16 w-16 shrink-0" />
                        <span className="flex-1 text-sm">
                          <Link href={`/needs/${n.id}`} className="font-medium hover:text-accent hover:underline">
                            {item.units} × {n.catalogItem.name}
                          </Link>
                          <span className="block text-muted">
                            {n.ngo.name} · paid to {n.vendor.name}
                          </span>
                        </span>
                        <span className="text-sm">{formatUsd(item.units * n.unitPriceCents)}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 flex justify-between border-t border-border pt-4 font-semibold">
                  <span>Total with PayPal fees covered</span>
                  <span>{formatUsd(current.totalCents)}</span>
                </p>
                <div className="mt-5">
                  {current.status === "paid" ? (
                    <Link href={`/gifts/${current.paypalOrderId}`} className="inline-flex items-center gap-2 font-medium text-leaf hover:underline">
                      <CheckCircle2 className="h-5 w-5" /> Paid — follow these gifts <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <ClubBasketActions token={token} />
                  )}
                </div>
              </>
            )}
          </div>

          {past.length > 0 && (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <h2 className="font-serif text-xl font-semibold">Past months</h2>
              <ul className="mt-4 divide-y divide-border text-sm">
                {past.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <span className="font-medium">{monthName(b.month)}</span>{" "}
                      <span className="text-muted">
                        · {plural(b.items.reduce((s, i) => s + i.units, 0), "item")} · {formatUsd(b.totalCents)}
                      </span>
                    </span>
                    {b.status === "paid" && b.paypalOrderId ? (
                      <Link href={`/gifts/${b.paypalOrderId}`} className="text-accent hover:underline">
                        See deliveries →
                      </Link>
                    ) : (
                      <span className="text-muted">{b.status === "skipped" ? "Skipped" : "Not approved"}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ClubSettings token={token} budget={member.monthlyBudgetCents} causes={member.causes} active={member.active} />
        </aside>
      </div>
    </div>
  );
}
