import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { LogoMark } from "@/components/logo.tsx";
import { PrintButton } from "@/components/print-button.tsx";
import { ProductImage } from "@/components/product-image.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getReportFacts, writeReportNarrative, type ReportFacts } from "@/lib/report.ts";

export default function ReportPage({ params }: PageProps<"/ngo/[slug]/report">) {
  return (
    <Suspense fallback={<p className="text-muted">Gathering verified data…</p>}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: { params: PageProps<"/ngo/[slug]/report">["params"] }) {
  const { slug } = await params;
  const facts = await getReportFacts(slug);
  if (!facts) notFound();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const since = new Date(facts.since).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const tiles = [
    { label: "Items delivered and verified", value: facts.unitsDelivered.toLocaleString("en-US") },
    { label: "Value of goods delivered", value: formatUsd(facts.valueDeliveredCents) },
    { label: "Saved vs. market prices", value: formatUsd(facts.savedVsMarketCents) },
    { label: "Donors", value: facts.donors.toLocaleString("en-US") },
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/ngo/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <FileText className="h-4 w-4" /> Impact report · {since} – {today}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold">{facts.ngo.name}</h1>
          <p className="mt-1 text-muted">
            {facts.ngo.city} · {facts.ngo.description}
          </p>
        </div>
        <LogoMark className="h-12 w-12 shrink-0" />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="print-avoid-break rounded-2xl border border-border bg-surface p-4">
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="print-avoid-break">
        <h2 className="font-serif text-2xl font-semibold">Summary</h2>
        <Suspense fallback={<p className="mt-3 text-muted">Writing the summary from verified data…</p>}>
          <Narrative facts={facts} />
        </Suspense>
      </section>

      <section className="print-avoid-break">
        <h2 className="font-serif text-2xl font-semibold">What arrived</h2>
        {facts.itemsDelivered.length === 0 ? (
          <p className="mt-3 text-muted">No deliveries have been verified yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Delivered</th>
                <th className="py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {facts.itemsDelivered.map((i) => (
                <tr key={i.item} className="border-b border-border">
                  <td className="py-2">{i.item}</td>
                  <td className="py-2 text-right">
                    {i.units} {i.unit}
                    {i.units === 1 ? "" : "s"}
                  </td>
                  <td className="py-2 text-right">{formatUsd(i.valueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {facts.photos.length > 0 && (
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-semibold">Delivery photos</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.photos.map((p) => (
              <li key={p.deliveryId}>
                <ProductImage src={`/api/deliveries/${p.deliveryId}/photo`} alt={p.caption} fit="cover" className="aspect-square w-full rounded-xl border border-border" />
                <p className="mt-1 text-xs text-muted">{p.caption}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="print-avoid-break">
        <h2 className="font-serif text-2xl font-semibold">How it was kept accountable</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <span className="font-medium">Suppliers paid directly through PayPal:</span>{" "}
            {facts.suppliers.length ? facts.suppliers.map((s) => `${s.name} (${formatUsd(s.paidCents)})`).join(", ") : "none yet"}. The
            organisation never handled the money.
          </li>
          <li>
            <span className="font-medium">Prices checked against the market</span> before each need was published, using
            comparable products found with Channel3.
          </li>
          <li>
            <span className="font-medium">Deliveries verified</span> with photos checked by AI and a fingerprint against reuse
            {facts.flaggedDeliveries ? `; ${facts.flaggedDeliveries} delivery was sent for human review` : ""}.
          </li>
          <li>
            <span className="font-medium">{facts.gifts} gifts</span> from {facts.donors} donors
            {facts.giftsViaAgent ? `, ${facts.giftsViaAgent} arranged by the Giving Agent` : ""}. Every gift is listed in the public
            ledger.
          </li>
        </ul>
      </section>

      <p className="border-t border-border pt-4 text-xs text-muted">
        Generated by Stone Soup on {today} from payment records and verified deliveries. Summary written by AI from the figures above.
      </p>
    </article>
  );
}

async function Narrative({ facts }: { facts: ReportFacts }) {
  const text = await writeReportNarrative(JSON.stringify(facts)).catch(() => null);
  if (!text) return <p className="mt-3 text-muted">The summary couldn&apos;t be written right now; the figures below are complete.</p>;
  return (
    <div className="mt-3 space-y-3 leading-relaxed">
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
