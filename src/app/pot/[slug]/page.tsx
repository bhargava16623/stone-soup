import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { MonitorPlay, Users } from "lucide-react";
import { DonatePanel } from "@/components/donate-panel.tsx";
import { FairPriceBadge } from "@/components/need-bits.tsx";
import { PageHeader } from "@/components/page-header.tsx";
import { PotFill } from "@/components/pot-fill.tsx";
import { ShareLink } from "@/components/share-link.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getPot } from "@/lib/pots.ts";

export default function PotPage({ params }: PageProps<"/pot/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <PotView params={params} />
    </Suspense>
  );
}

async function PotView({ params }: { params: PageProps<"/pot/[slug]">["params"] }) {
  const { slug } = await params;
  const pot = await getPot(slug);
  if (!pot) notFound();
  const { need } = pot;
  const unit = need.catalogItem.unit;
  const pct = Math.min(100, (pot.raisedUnits / pot.goalUnits) * 100);
  const remainingOnNeed = need.quantity - need.fundedUnits;
  const leftInPot = Math.max(0, pot.goalUnits - pot.raisedUnits);

  const h = await headers();
  const shareUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pot/${pot.slug}`;
  const qr = await QRCode.toString(shareUrl, { type: "svg", margin: 1, color: { dark: "#2b2118", light: "#ffffff" } });

  return (
    <div>
      <PageHeader icon={Users} eyebrow={`Group pot · started by ${pot.organizerName}`} title={pot.title}>
        Everyone adds what they can toward{" "}
        <Link href={`/needs/${need.id}`} className="text-accent hover:underline">
          {need.title}
        </Link>{" "}
        for {need.ngo.name}. Each gift is paid straight to {need.vendor.name}.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface p-6 sm:flex-row">
            <PotFill pct={pct} className="h-56 w-56 shrink-0" />
            <div className="space-y-3">
              <p className="font-serif text-3xl font-semibold">
                {pot.raisedUnits} of {pot.goalUnits} {unit}s
              </p>
              <p className="text-muted">
                {leftInPot > 0
                  ? `${leftInPot} to go — ${formatUsd(leftInPot * need.unitPriceCents)} would fill it.`
                  : "The pot is full. Thank you, everyone!"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <FairPriceBadge verdict={need.fairPrice} />
                <span className="text-muted">
                  {formatUsd(need.unitPriceCents)} per {unit} · {pot.contributions.length} contribution
                  {pot.contributions.length === 1 ? "" : "s"}
                </span>
              </div>
              <ShareLink url={shareUrl} title={pot.title} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6">
            <h2 className="font-serif text-xl font-semibold">Who&apos;s added to the pot</h2>
            {pot.contributions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nobody yet — be the first stone in the soup.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pot.contributions.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 text-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                      {(c.donorName ?? "?")[0]}
                    </span>
                    <span>
                      <span className="font-medium">{c.donorName?.split(" ")[0] ?? "Someone"}</span> added {c.units} {unit}
                      {c.units === 1 ? "" : "s"}
                      {c.note && <span className="block text-muted">“{c.note}”</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {need.status === "open" && remainingOnNeed > 0 ? (
            <DonatePanel
              needId={need.id}
              ngoId={need.ngoId}
              unitName={unit}
              unitPriceCents={need.unitPriceCents}
              remaining={remainingOnNeed}
              ngoName={need.ngo.name}
              vendorName={need.vendor.name}
              pot={{ id: pot.id, title: pot.title }}
            />
          ) : (
            <div className="rounded-2xl border border-leaf/30 bg-leaf-soft p-6 text-leaf">This need is fully funded.</div>
          )}
          <div className="rounded-2xl border border-border bg-surface p-5 text-center">
            <div className="mx-auto w-40 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-2 text-xs text-muted">Scan to join this pot — print it for the office or classroom.</p>
            <Link
              href={`/pot/${pot.slug}/live`}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
            >
              <MonitorPlay className="h-4 w-4" /> Put it on the big screen
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
