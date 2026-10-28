import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera, HandHeart, ScanSearch, ShieldCheck, Sparkles, Store } from "lucide-react";
import { FinishIt } from "@/components/finish-it.tsx";
import { NeedCard } from "@/components/need-card.tsx";
import { PotIllustration } from "@/components/pot-illustration.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { getAlmostFunded, getImpactStats, getOpenNeeds } from "@/lib/queries.ts";

const STEPS = [
  { icon: HandHeart, title: "A charity asks", text: "In plain words. AI turns it into specific items and quantities." },
  { icon: ScanSearch, title: "Prices are checked", text: "Each supplier price is compared with real products on the market." },
  { icon: Store, title: "PayPal pays the supplier", text: "Your money goes straight to the shop — never to us, never as cash." },
  { icon: Camera, title: "Delivery is confirmed", text: "A photo is checked by AI, and you get a note about your gift." },
];

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-leaf" />
            Donations that can&apos;t be misspent
          </p>
          <h1 className="mt-5 font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Add one thing.
            <br />
            <span className="text-accent">Watch it arrive.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            In the old tale, each villager added one thing to the pot, and together it fed everyone. Fund a blanket, a backpack,
            a bag of rice — paid straight to the supplier through PayPal, checked against market prices, and confirmed when it
            arrives.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#needs"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              See open needs <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/give"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-medium transition hover:border-accent hover:text-accent"
            >
              <Sparkles className="h-4 w-4" /> Ask the Giving Agent
            </Link>
          </div>
        </div>
        <PotIllustration />
      </section>

      <Suspense fallback={<div className="h-28 rounded-3xl border border-border bg-surface" />}>
        <ImpactStrip />
      </Suspense>

      <section>
        <h2 className="font-serif text-3xl font-semibold">How a gift travels</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-3xl border border-border bg-surface p-6">
              <span className="absolute right-5 top-5 font-serif text-3xl font-semibold text-border">{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={null}>
        <AlmostThere />
      </Suspense>

      <section id="needs" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold">Open needs</h2>
            <p className="mt-1 text-muted">Most urgent first. Every price has been checked against the market.</p>
          </div>
          <Link href="/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline">
            See where past gifts went <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Suspense fallback={<p className="mt-6 text-muted">Loading needs…</p>}>
          <NeedsGrid />
        </Suspense>
      </section>
    </div>
  );
}

async function AlmostThere() {
  return <FinishIt items={await getAlmostFunded()} />;
}

async function ImpactStrip() {
  const s = await getImpactStats();
  const stats = [
    { value: formatUsd(s.paidCents), label: "paid straight to suppliers" },
    { value: s.itemsFunded.toLocaleString("en-US"), label: "items funded" },
    { value: s.itemsDelivered.toLocaleString("en-US"), label: "delivered and verified" },
    { value: `${s.ngos} · ${s.suppliers}`, label: "charities · local suppliers" },
  ];
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
      {stats.map((x) => (
        <div key={x.label} className="bg-surface p-6">
          <p className="font-serif text-3xl font-semibold">{x.value}</p>
          <p className="mt-1 text-sm text-muted">{x.label}</p>
        </div>
      ))}
    </section>
  );
}

async function NeedsGrid() {
  const needs = await getOpenNeeds();
  if (needs.length === 0) return <p className="mt-6 text-muted">Every need is funded right now. Check back soon.</p>;
  return (
    <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {needs.map((need) => (
        <li key={need.id}>
          <NeedCard need={need} />
        </li>
      ))}
    </ul>
  );
}
