"use client";

import { useState, useTransition } from "react";
import { confirmDeliveryAction, type DeliveryOutcome } from "@/app/ngo/[slug]/actions.ts";
import { resizeImage } from "@/lib/image.ts";

interface Props {
  ngoSlug: string;
  needId: number;
  outstanding: number;
  unit: string;
  vendorName: string;
}

export function DeliveryForm({ ngoSlug, needId, outstanding, unit, vendorName }: Props) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(outstanding);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<DeliveryOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (outcome) {
    const ok = outcome.verdict === "verified";
    return (
      <div className={`mt-3 rounded-lg p-3 text-sm ${ok ? "bg-leaf-soft text-leaf" : "bg-amber-soft text-amber"}`}>
        <p className="font-medium">{ok ? "Delivery verified" : "Delivery sent for review"}</p>
        <p className="mt-1">{outcome.summary}</p>
        {!ok && outcome.concerns.length > 0 && <p className="mt-1">Why: {outcome.concerns.join("; ")}</p>}
        {ok && outcome.updatesSent > 0 && (
          <p className="mt-1">
            {outcome.updatesSent} donor{outcome.updatesSent === 1 ? "" : "s"} got a personal update.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-full bg-leaf px-4 py-1.5 text-sm font-medium text-white">
        Confirm delivery from {vendorName}
      </button>
    );
  }

  function submit() {
    if (!photo) return setError("Add a photo of what arrived");
    setError(null);
    start(async () => {
      const { base64, mimeType } = await resizeImage(photo, 1280);
      const res = await confirmDeliveryAction(ngoSlug, { needId, units, note, photoBase64: base64, photoMime: mimeType });
      if (!res.ok) return setError(res.error);
      setOutcome(res.data);
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border p-4 text-sm">
      <label className="flex items-center gap-2">
        {unit[0].toUpperCase() + unit.slice(1)}s received
        <input
          type="number"
          min={1}
          max={outstanding}
          value={units}
          onChange={(e) => setUnits(Math.min(outstanding, Math.max(1, Number(e.target.value) || 1)))}
          className="w-20 rounded-lg border border-border bg-transparent p-1.5"
        />
        <span className="text-muted">of {outstanding} paid for</span>
      </label>
      <label className="block">
        <span className="font-medium">Photo of the delivery</span>
        <span className="block text-xs text-muted">Photograph the items, not people. We check it before telling donors.</span>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for donors (optional)" className="w-full rounded-lg border border-border bg-transparent p-2" />
      {error && <p className="text-accent">{error}</p>}
      <button type="button" onClick={submit} disabled={pending} className="rounded-full bg-leaf px-4 py-1.5 font-medium text-white disabled:opacity-50">
        {pending ? "Checking the photo…" : "Confirm delivery"}
      </button>
    </div>
  );
}
