import { Check, Clock, CreditCard, HeartHandshake, Store, User } from "lucide-react";
import type { Journey } from "@/lib/journey.ts";

// The route a gift travels: donor → PayPal → supplier → charity, drawn as one curve.
const ROUTE = "M60 90 C140 30 220 30 300 90 S460 150 540 90 S700 30 780 90";
const STOPS = [60, 300, 540, 780];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

/** Animated route plus a step-by-step record of one gift, with the IDs that prove each step. */
export function GiftJourney({ journey }: { journey: Journey }) {
  const { progress } = journey;
  const stops = [
    { icon: User, label: journey.donor, sub: "gave" },
    { icon: CreditCard, label: "PayPal", sub: "paid the supplier" },
    { icon: Store, label: journey.vendor.name, sub: journey.vendor.city },
    { icon: HeartHandshake, label: journey.ngo.name, sub: journey.ngo.city },
  ];
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <div className="relative mx-auto aspect-[840/200] w-full max-w-4xl">
          <svg viewBox="0 0 840 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={ROUTE} fill="none" stroke="var(--border)" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
            <path d={ROUTE} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress}>
              <animate attributeName="stroke-dashoffset" from="1" to={1 - progress} dur="2.6s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" />
            </path>
            <g>
              <ellipse rx="13" ry="10" fill="var(--stone)" stroke="var(--foreground)" strokeOpacity=".25" strokeWidth="2" />
              <animateMotion dur="2.6s" fill="freeze" path={ROUTE} keyPoints={`0;${progress}`} keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
            </g>
          </svg>
          {stops.map(({ icon: Icon, label, sub }, i) => {
            const reached = i < 3 || progress >= 1;
            return (
              <div
                key={i}
                className="absolute flex w-20 -translate-x-1/2 flex-col items-center text-center sm:w-36"
                style={{ left: `${(STOPS[i] / 840) * 100}%`, top: `${(62 / 200) * 100}%` }}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 sm:h-14 sm:w-14 ${
                    reached ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"
                  }`}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="mt-1.5 text-[11px] font-semibold leading-tight sm:text-sm">{label}</span>
                <span className="hidden text-xs text-muted sm:block">{sub}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ol className="relative space-y-6 border-l-2 border-border pl-8">
        {journey.steps.map((s) => (
          <li key={s.key} className={`relative ${s.state === "waiting" ? "opacity-55" : ""}`}>
            <span
              className={`absolute -left-[45px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${
                s.state === "done" ? "bg-leaf text-white" : "border-2 border-dashed border-muted bg-surface text-muted"
              }`}
            >
              {s.state === "done" ? <Check className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="font-semibold">{s.title}</h3>
              {s.state === "done" && when(s.at) && <time className="text-xs text-muted">{when(s.at)}</time>}
            </div>
            <p className="mt-1 text-sm text-muted">{s.detail}</p>
            {s.proof.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-2">
                {s.proof.map((p) => (
                  <span key={p.label} className="rounded-lg border border-border bg-background px-2 py-0.5 text-xs">
                    <span className="text-muted">{p.label}: </span>
                    <span className="font-mono">{p.value}</span>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
