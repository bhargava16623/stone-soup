"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, ImageUp, Link2, ListChecks, ShieldAlert, ShieldCheck, Type } from "lucide-react";
import { checkAppealAction, type SuggestedNeed } from "@/app/check/actions.ts";
import { formatUsd } from "@/lib/fees.ts";
import { resizeImage } from "@/lib/image.ts";
import type { ScamCheckResult } from "@/lib/scam-check.ts";
import { ProductImage } from "./product-image.tsx";

type Mode = "link" | "text" | "image";
type Result = ScamCheckResult & { needs: SuggestedNeed[] };

const MODES: { id: Mode; label: string; icon: typeof Link2 }[] = [
  { id: "link", label: "Link", icon: Link2 },
  { id: "text", label: "Message", icon: Type },
  { id: "image", label: "Screenshot", icon: ImageUp },
];

const EXAMPLE =
  "URGENT!!! Families freezing after the storm. Send $50 in Apple gift cards or crypto to help NOW. Only 2 hours left, donations matched 3x! Text Pastor Mike at +1 555 0100 for the wallet address.";

const RISK = {
  high: { label: "High risk", icon: ShieldAlert, box: "border-accent/40 bg-accent-soft", text: "text-accent" },
  medium: { label: "Be careful", icon: AlertTriangle, box: "border-amber/40 bg-amber-soft", text: "text-amber" },
  low: { label: "Looks legitimate", icon: ShieldCheck, box: "border-leaf/40 bg-leaf-soft", text: "text-leaf" },
} as const;

export function ScamCheckForm() {
  const [mode, setMode] = useState<Mode>("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ready = mode === "link" ? url.trim().length > 4 : mode === "text" ? text.trim().length > 10 : Boolean(file);

  function check() {
    setError(null);
    setResult(null);
    start(async () => {
      const image = mode === "image" && file ? await resizeImage(file, 1400) : undefined;
      const res = await checkAppealAction({
        url: mode === "link" ? url : undefined,
        text: mode === "text" ? text : undefined,
        image,
      });
      if (res.ok) setResult(res.data);
      else setError(res.error);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <section className="space-y-4 self-start rounded-3xl border border-border bg-surface p-6">
        <div className="flex gap-1 rounded-full bg-background p-1" role="tablist" aria-label="What to check">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
                mode === id ? "bg-surface font-medium text-accent shadow-sm" : "text-muted hover:text-accent"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {mode === "link" && (
          <label className="block text-sm">
            <span className="font-medium">Paste the link</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="mt-1 w-full rounded-xl border border-border bg-transparent p-3"
            />
            <span className="mt-1 block text-xs text-muted">Crowdfunding pages, charity sites, links from messages.</span>
          </label>
        )}
        {mode === "text" && (
          <label className="block text-sm">
            <span className="font-medium">Paste the message</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste a WhatsApp forward, email, or social post asking for donations…"
              className="mt-1 w-full rounded-xl border border-border bg-transparent p-3"
            />
            <button type="button" onClick={() => setText(EXAMPLE)} className="mt-1 text-xs text-muted underline transition hover:text-accent">
              Try an example
            </button>
          </label>
        )}
        {mode === "image" && (
          <label className="block text-sm">
            <span className="font-medium">Upload a screenshot</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
            <span className="mt-1 block text-xs text-muted">A post, flyer or message. We read it and check what it claims.</span>
          </label>
        )}

        <button
          type="button"
          onClick={check}
          disabled={!ready || pending}
          className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Researching it on the web…" : "Check this appeal"}
        </button>
        <p className="text-xs text-muted">We don&apos;t store what you check. This is guidance, not a guarantee.</p>
        {error && <p className="text-sm text-accent">{error}</p>}
      </section>

      <section aria-live="polite">
        {pending && (
          <div className="space-y-3 rounded-3xl border border-border bg-surface p-6">
            {["Reading the appeal", "Searching the web for the organisation and scam reports", "Weighing the evidence"].map((s, i) => (
              <p key={s} className="flex items-center gap-2 text-sm text-muted" style={{ opacity: 1 - i * 0.25 }}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {s}…
              </p>
            ))}
          </div>
        )}
        {!pending && !result && (
          <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted">
            The verdict appears here: warning signs with evidence, signs of legitimacy, how to verify it yourself, and verified
            needs for the same cause if you&apos;d rather give safely.
          </div>
        )}
        {result && <Verdict result={result} />}
      </section>
    </div>
  );
}

function Verdict({ result }: { result: Result }) {
  const r = RISK[result.risk];
  return (
    <div className="space-y-5">
      <div className={`rounded-3xl border p-6 ${r.box}`}>
        <p className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${r.text}`}>
          <r.icon className="h-5 w-5" /> {r.label}
        </p>
        <p className="mt-2 font-serif text-xl font-semibold text-foreground">{result.headline}</p>
        {result.page && <p className="mt-1 text-xs text-muted">Read: {result.page.title || result.page.url}</p>}
      </div>

      {result.redFlags.length > 0 && (
        <div className="rounded-3xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Warning signs</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {result.redFlags.map((f) => (
              <li key={f.flag} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="font-medium">{f.flag}.</span> <span className="text-muted">{f.evidence}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.reassuring.length > 0 && (
        <div className="rounded-3xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Signs of legitimacy</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {result.reassuring.map((g) => (
              <li key={g} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-surface p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <ListChecks className="h-4 w-4 text-accent" /> Check it yourself
        </h3>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-muted">
          {result.howToVerify.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {result.sources.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
              >
                {s.title} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        ) : (
          !result.researched && <p className="mt-3 text-xs text-muted">Web research wasn&apos;t available, so this is based on the content alone.</p>
        )}
      </div>

      {result.needs.length > 0 && (
        <div className="rounded-3xl border border-border bg-surface p-6">
          <h3 className="font-semibold">Want to help with {result.cause} safely?</h3>
          <p className="mt-1 text-sm text-muted">These needs are verified: the price is checked and the supplier is paid directly.</p>
          <ul className="mt-4 space-y-3">
            {result.needs.map((n) => (
              <li key={n.id}>
                <Link href={`/needs/${n.id}`} className="group flex items-center gap-4 rounded-2xl border border-border p-3 transition hover:border-accent/50">
                  <ProductImage src={n.imageUrl} alt={n.title} className="h-16 w-16 shrink-0" />
                  <span className="flex-1 text-sm">
                    <span className="block font-medium group-hover:text-accent">{n.title}</span>
                    <span className="text-muted">
                      {n.ngo} · {n.city} · {formatUsd(n.unitPriceCents)} per {n.unit}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
