"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Maximize, X } from "lucide-react";
import { PotFill } from "@/components/pot-fill.tsx";
import { formatUsd } from "@/lib/fees.ts";
import type { LiveSnapshot } from "@/lib/pots.ts";

const POLL_MS = 3000;

interface Props {
  slug: string;
  initial: LiveSnapshot;
  qrSvg: string;
  shareUrl: string;
  title: string;
  organizer: string;
  ngoName: string;
  vendorName: string;
  unit: string;
  unitPriceCents: number;
}

type Contribution = LiveSnapshot["contributions"][number];

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Big-screen pot for events and classrooms: people scan, pay on their phones, and watch it fill. */
export function LiveWall({ slug, initial, qrSvg, shareUrl, title, organizer, ngoName, vendorName, unit, unitPriceCents }: Props) {
  const [snap, setSnap] = useState(initial);
  const [drops, setDrops] = useState<{ key: string; x: number; delay: number }[]>([]);
  const [toast, setToast] = useState<Contribution | null>(null);
  const [reveal, setReveal] = useState(false);
  const seen = useRef(new Set(initial.contributions.map((c) => c.id)));
  const hadDelivery = useRef(Boolean(initial.delivery));

  useEffect(() => {
    let stopped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    async function poll() {
      try {
        const res = await fetch(`/api/pots/${slug}/live`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as LiveSnapshot;
        const fresh = next.contributions.filter((c) => !seen.current.has(c.id));
        for (const c of fresh) seen.current.add(c.id);
        if (fresh.length) {
          // One stone per unit (up to 6 per gift) drops into the pot.
          const stones = fresh.flatMap((c) =>
            Array.from({ length: Math.min(6, c.units) }, (_, i) => ({ key: `${c.id}-${i}`, x: 25 + Math.random() * 50, delay: i * 0.18 })),
          );
          setDrops((d) => [...d, ...stones]);
          later(() => setDrops((d) => d.filter((s) => !stones.includes(s))), 2600);
          setToast(fresh[0]);
          later(() => setToast((t) => (t?.id === fresh[0].id ? null : t)), 6000);
        }
        if (next.delivery && !hadDelivery.current) {
          hadDelivery.current = true;
          setReveal(true);
          later(() => setReveal(false), 9000);
        }
        setSnap(next);
      } catch {
        // Network blip: try again on the next tick.
      }
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [slug]);

  const pct = Math.min(100, (snap.raisedUnits / snap.goalUnits) * 100);
  const left = Math.max(0, snap.goalUnits - snap.raisedUnits);
  const full = left === 0;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto grid min-h-full max-w-[1600px] gap-8 p-6 sm:p-10 lg:grid-cols-[1.35fr_1fr]">
        <section className="flex flex-col">
          <div className="flex items-center justify-between gap-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              Live · group pot started by {organizer}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
                className="rounded-full border border-border p-2 text-muted transition hover:border-accent hover:text-accent"
                aria-label="Full screen"
              >
                <Maximize className="h-4 w-4" />
              </button>
              <Link
                href={`/pot/${slug}`}
                className="rounded-full border border-border p-2 text-muted transition hover:border-accent hover:text-accent"
                aria-label="Leave the live wall"
              >
                <X className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-6xl">{title}</h1>
          <p className="mt-2 text-lg text-muted">
            for {ngoName} · every gift is paid straight to {vendorName} through PayPal
          </p>

          <div className="relative mx-auto mt-6 flex flex-1 items-center justify-center">
            <PotFill pct={pct} className="h-[44vh] max-h-[520px] w-auto" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[38%]">
              {drops.map((s) => (
                <span
                  key={s.key}
                  className="animate-drop absolute h-6 w-8 rounded-[45%] bg-stone shadow-md"
                  style={{ left: `${s.x}%`, animationDelay: `${s.delay}s` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="font-serif text-6xl font-semibold sm:text-7xl">
              {snap.raisedUnits}
              <span className="text-muted"> / {plural(snap.goalUnits, unit)}</span>
            </p>
            <p className="mt-2 text-xl text-muted">
              {full ? "The pot is full. Thank you, everyone!" : `${left} to go — ${formatUsd(left * unitPriceCents)} fills it`}
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          {snap.delivery && <DeliveredCard delivery={snap.delivery} />}
          {snap.delivery ? (
            !full && (
              <div className="flex items-center gap-5 rounded-3xl border border-border bg-surface p-5">
                <div className="w-32 shrink-0 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <div>
                  <p className="font-serif text-2xl font-semibold">Scan to add a stone</p>
                  <p className="mt-1 break-all text-sm text-muted">{shareUrl.replace(/^https?:\/\//, "")}</p>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-center">
              <div className="mx-auto w-[min(34vh,320px)] rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-4 font-serif text-3xl font-semibold">{full ? "We did it" : "Scan to add a stone"}</p>
              <p className="mt-1 break-all text-sm text-muted">{shareUrl.replace(/^https?:\/\//, "")}</p>
            </div>
          )}

          <div className="flex-1 rounded-3xl border border-border bg-surface p-6">
            <h2 className="font-serif text-2xl font-semibold">Stones in the pot</h2>
            {snap.contributions.length === 0 ? (
              <p className="mt-3 text-muted">Be the first — scan the code with your phone camera.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {snap.contributions.slice(0, 7).map((c) => (
                  <li key={c.id} className="animate-pop-in flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
                      {c.name[0]}
                    </span>
                    <span className="text-lg">
                      <span className="font-semibold">{c.name}</span> added {plural(c.units, unit)}
                      {c.note && <span className="block text-base text-muted">“{c.note}”</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {toast && (
        <div key={toast.id} className="animate-pop-in fixed inset-x-0 top-6 z-10 mx-auto w-fit max-w-[90vw] rounded-full bg-accent px-8 py-4 text-center text-2xl font-semibold text-white shadow-xl">
          {toast.name} just added {plural(toast.units, unit)}!
        </div>
      )}

      {reveal && snap.delivery && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6" onClick={() => setReveal(false)}>
          <div className="animate-pop-in w-full max-w-3xl">
            <DeliveredCard delivery={snap.delivery} large />
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveredCard({ delivery, large = false }: { delivery: NonNullable<LiveSnapshot["delivery"]>; large?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-leaf/40 bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/deliveries/${delivery.id}/photo`} alt={delivery.summary ?? "Delivery photo"} className={`w-full object-cover ${large ? "max-h-[70vh]" : "max-h-[40vh]"}`} />
      <span
        className={`animate-stamp absolute right-5 top-5 inline-flex items-center gap-2 rounded-xl border-4 border-leaf bg-surface/90 px-4 py-2 font-black uppercase tracking-wider text-leaf ${large ? "text-3xl" : "text-xl"}`}
      >
        <BadgeCheck className={large ? "h-8 w-8" : "h-6 w-6"} /> Delivered
      </span>
      <p className={`p-5 ${large ? "text-xl" : ""}`}>
        <span className="font-semibold text-leaf">Verified by photo. </span>
        {delivery.summary}
      </p>
    </div>
  );
}
