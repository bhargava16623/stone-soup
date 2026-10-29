"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Camera, Eye, PenLine } from "lucide-react";
import { draftNeedsAction, draftNeedsFromPhotoAction, publishNeedAction } from "@/app/ngo/[slug]/actions.ts";
import { FairPriceBadge } from "@/components/need-bits.tsx";
import { formatUsd } from "@/lib/fees.ts";
import { resizeImage } from "@/lib/image.ts";
import type { NeedDraft } from "@/lib/intake.ts";

const EXAMPLES = [
  "We urgently need about 25 blankets before Friday, nights are freezing and we're at capacity.",
  "Rice for 30 people for two weeks, and sleeping bags for 10 people on overflow nights.",
  "School starts next month: backpacks for 20 kids and toothbrush kits for all 60.",
];

type DraftState = NeedDraft & { justification: string; published?: number; error?: string };

export function IntakeForm({ ngoSlug }: { ngoSlug: string }) {
  const [mode, setMode] = useState<"write" | "photo">("write");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [photoSummary, setPhotoSummary] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [publishing, startPublishing] = useTransition();

  const update = (key: string, patch: Partial<DraftState>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  function draft() {
    setError(null);
    startDrafting(async () => {
      const res = await draftNeedsAction(text);
      if (!res.ok) return setError(res.error);
      if (res.data.length === 0) return setError("We couldn't find any items in that. Try naming what you need.");
      setDrafts(res.data.map((d) => ({ ...d, justification: "" })));
    });
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhotoSummary(null);
    setDrafts([]);
    try {
      const img = await resizeImage(file);
      setPhoto({ ...img, preview: `data:${img.mimeType};base64,${img.base64}` });
    } catch {
      setError("We couldn't read that image. Try a JPEG or PNG photo.");
    }
  }

  function readShelf() {
    if (!photo) return;
    setError(null);
    startDrafting(async () => {
      const res = await draftNeedsFromPhotoAction({ photoBase64: photo.base64, photoMime: photo.mimeType, note });
      if (!res.ok) return setError(res.error);
      setPhotoSummary(res.data.summary);
      if (!res.data.looksLikeStorage) return setError("This doesn't look like a storeroom or supply shelf. Try a photo of where you keep supplies.");
      if (res.data.drafts.length === 0) return setError("Nothing looks low on this shelf. Nice work!");
      setDrafts(res.data.drafts.map((d) => ({ ...d, justification: "" })));
    });
  }

  function publish(d: DraftState) {
    if (!d.selectedCatalogItemId) return;
    startPublishing(async () => {
      const res = await publishNeedAction(ngoSlug, {
        catalogItemId: d.selectedCatalogItemId!,
        title: d.title,
        story: d.story,
        quantity: d.quantity,
        urgency: d.urgency,
        deadline: d.deadline,
        priceJustification: d.justification,
      });
      update(d.key, res.ok ? { published: res.data.id, error: undefined } : { error: res.error });
    });
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
        {(
          [
            ["write", PenLine, "Write it"],
            ["photo", Camera, "Snap the shelf"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            aria-pressed={mode === value}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition ${mode === value ? "bg-accent text-white" : "text-muted hover:text-accent"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "photo" ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="font-serif text-xl font-semibold">Photograph what&apos;s running low</p>
          <p className="mt-1 text-sm text-muted">
            Your pantry, linen closet or supply shelf. We&apos;ll spot what&apos;s missing, work out how much to restock, find
            suppliers and check their prices.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="relative flex min-h-56 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background text-sm text-muted transition hover:border-accent hover:text-accent">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.preview} alt="Your shelf" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 p-6 text-center">
                  <Camera className="h-8 w-8" /> Take or choose a photo
                </span>
              )}
              {drafting && photo && (
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-accent/10">
                  <span className="animate-scan absolute inset-x-0 h-1 bg-accent shadow-[0_0_24px_6px_var(--accent)]" />
                </span>
              )}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
            <div className="flex flex-col gap-3">
              <label className="text-sm">
                <span className="font-medium">Anything we should know?</span> <span className="text-muted">(optional)</span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. We feed 30 people a day; this needs to last two weeks."
                  className="mt-1 w-full rounded-xl border border-border bg-transparent p-3"
                />
              </label>
              <button
                type="button"
                onClick={readShelf}
                disabled={drafting || !photo}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> {drafting ? "Looking at your shelf…" : "Read the shelf"}
              </button>
              {photoSummary && <p className="rounded-xl bg-background p-3 text-sm text-muted">We see: {photoSummary}</p>}
              {error && <p className="text-sm text-accent">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
      <div className="rounded-2xl border border-border bg-surface p-6">
          <label htmlFor="request" className="font-serif text-xl font-semibold">
            What do you need?
          </label>
          <p className="mt-1 text-sm text-muted">Write it the way you&apos;d say it. We&apos;ll turn it into needs, find vendors and check prices.</p>
          <textarea
            id="request"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. We need about 40 blankets before Friday…"
            className="mt-4 w-full rounded-xl border border-border bg-transparent p-3"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-border px-3 py-1 text-left text-xs text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent">
                {ex.length > 60 ? `${ex.slice(0, 57)}…` : ex}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={draft}
            disabled={drafting || text.trim().length < 5}
            className="mt-4 rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-50 transition hover:brightness-110 active:scale-[0.98]"
          >
            {drafting ? "Reading your request and checking prices…" : "Draft needs"}
          </button>
          {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        </div>
      )}

      {drafts.map((d) => {
        const option = d.options.find((o) => o.catalogItemId === d.selectedCatalogItemId);
        const needsReason = option && (option.verdict === "above_market" || option.verdict === "no_benchmark");
        if (d.published) {
          return (
            <div key={d.key} className="rounded-2xl border border-leaf/30 bg-leaf-soft p-5 text-leaf">
              <p className="font-medium">Published: {d.title}</p>
              <Link href={`/needs/${d.published}`} className="text-sm underline">
                View it
              </Link>
            </div>
          );
        }
        return (
          <div key={d.key} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
            <input
              value={d.title}
              onChange={(e) => update(d.key, { title: e.target.value })}
              className="w-full bg-transparent font-serif text-lg font-semibold"
              aria-label="Title"
            />
            <textarea
              value={d.story}
              onChange={(e) => update(d.key, { story: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-border bg-transparent p-2 text-sm"
              aria-label="Why it's needed"
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={d.quantity}
                  onChange={(e) => update(d.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 rounded-lg border border-border bg-transparent p-1.5"
                />
              </label>
              {d.seen && (
                <p className="flex basis-full items-center gap-1.5 text-xs text-muted">
                  <Eye className="h-3.5 w-3.5 text-accent" /> Seen in your photo: {d.seen}
                </p>
              )}
              {d.quantityNote && <p className="basis-full text-xs text-muted">How we worked this out: {d.quantityNote}</p>}
              <label className="flex items-center gap-2">
                Urgency
                <select
                  value={d.urgency}
                  onChange={(e) => update(d.key, { urgency: e.target.value as DraftState["urgency"] })}
                  className="rounded-lg border border-border bg-transparent p-1.5"
                >
                  <option value="high">Urgent</option>
                  <option value="medium">Soon</option>
                  <option value="low">This month</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Needed by
                <input
                  type="date"
                  value={d.deadline ?? ""}
                  onChange={(e) => update(d.key, { deadline: e.target.value || null })}
                  className="rounded-lg border border-border bg-transparent p-1.5"
                />
              </label>
            </div>

            {d.options.length === 0 ? (
              <p className="rounded-lg bg-amber-soft p-3 text-sm text-amber">
                No vendor on Stone Soup sells “{d.requestedItem}” yet, so this can&apos;t be published.
              </p>
            ) : (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Who supplies it</legend>
                {d.options.map((o) => (
                  <label
                    key={o.catalogItemId}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition ${d.selectedCatalogItemId === o.catalogItemId ? "border-accent bg-accent-soft/40" : "border-border hover:border-accent/50"}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`vendor-${d.key}`}
                        checked={d.selectedCatalogItemId === o.catalogItemId}
                        onChange={() => update(d.key, { selectedCatalogItemId: o.catalogItemId })}
                      />
                      <span>
                        <span className="font-medium">{o.vendorName}</span>{" "}
                        <span className="text-muted">
                          · {o.vendorCity} · trust {o.trustScore}/100
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatUsd(o.unitPriceCents)}/{o.unit}
                      </span>
                      {o.marketMedianCents !== null && <span className="text-muted">market {formatUsd(o.marketMedianCents)}</span>}
                      <FairPriceBadge verdict={o.verdict} />
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {needsReason && (
              <label className="block text-sm">
                <span className="font-medium">
                  {option.verdict === "above_market" ? "Why is this vendor worth the higher price?" : "No online price for this item. Why is the price fair?"}
                </span>
                <input
                  value={d.justification}
                  onChange={(e) => update(d.key, { justification: e.target.value })}
                  placeholder="e.g. Local wholesale price, delivered to the shelter"
                  className="mt-1 w-full rounded-lg border border-border bg-transparent p-2"
                />
              </label>
            )}

            {option && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-sm text-muted">
                  Total if fully funded: <span className="font-medium text-foreground">{formatUsd(option.unitPriceCents * d.quantity)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => publish(d)}
                  disabled={publishing || (needsReason && !d.justification.trim())}
                  className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40 transition hover:brightness-110 active:scale-[0.98]"
                >
                  Publish
                </button>
              </div>
            )}
            {d.error && <p className="text-sm text-accent">{d.error}</p>}
          </div>
        );
      })}
    </div>
  );
}
