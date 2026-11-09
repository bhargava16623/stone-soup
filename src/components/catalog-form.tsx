"use client";

import { useRef, useState, useTransition } from "react";
import { addCatalogItemsAction, readPriceListAction } from "@/app/vendor/[slug]/actions.ts";
import type { CatalogEntry } from "@/lib/catalog.ts";
import { resizeImage } from "@/lib/image.ts";
import { plural } from "@/lib/plural.ts";

type Row = CatalogEntry & { key: number; price: string };

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, name: "", spec: "", unit: "", unitPriceCents: 0, price: "" });
const fromEntry = (e: CatalogEntry): Row => ({ ...e, key: nextKey++, price: (e.unitPriceCents / 100).toFixed(2) });

export function CatalogForm({ vendorSlug }: { vendorSlug: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function onPhoto(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    startReading(async () => {
      const { base64, mimeType } = await resizeImage(file, 1600);
      const res = await readPriceListAction(base64, mimeType);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setRows(res.data.map(fromEntry));
      setMessage({ ok: true, text: `Read ${plural(res.data.length, "item")}. Check them, then save.` });
    });
  }

  function save() {
    const entries = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name, spec: r.spec, unit: r.unit, unitPriceCents: Math.round(Number(r.price) * 100) }));
    setMessage(null);
    startSaving(async () => {
      const res = await addCatalogItemsAction(vendorSlug, entries);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setRows([emptyRow()]);
      setMessage({ ok: true, text: `Added ${res.data.added} item${res.data.added === 1 ? "" : "s"} with market checks.` });
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold">Add to your catalog</h2>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={reading}
          className="rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {reading ? "Reading your price list…" : "📷 Read a photo of my price list"}
        </button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="grid gap-2 sm:grid-cols-[1.2fr_1.6fr_0.8fr_0.7fr_auto]">
            <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="Item, e.g. Fleece blanket" aria-label="Item name" className="rounded-lg border border-border bg-transparent p-2 text-sm" />
            <input value={r.spec} onChange={(e) => update(r.key, { spec: e.target.value })} placeholder="Details, e.g. fleece blanket, twin size" aria-label="Details" className="rounded-lg border border-border bg-transparent p-2 text-sm" />
            <input value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })} placeholder="Per, e.g. blanket" aria-label="Unit" className="rounded-lg border border-border bg-transparent p-2 text-sm" />
            <input value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} placeholder="Price $" inputMode="decimal" aria-label="Price in dollars" className="rounded-lg border border-border bg-transparent p-2 text-sm" />
            <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [emptyRow()]))} aria-label="Remove row" className="px-2 text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="text-sm text-muted underline transition hover:text-accent">
          + Add a row
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !rows.some((r) => r.name.trim() && Number(r.price) > 0)}
          className="ml-auto rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-50 transition hover:brightness-110 active:scale-[0.98]"
        >
          {saving ? "Checking market prices…" : "Save items"}
        </button>
      </div>
      {message && <p className={`text-sm ${message.ok ? "text-leaf" : "text-accent"}`}>{message.text}</p>}
    </div>
  );
}
