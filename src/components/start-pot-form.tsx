"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { createPotAction } from "@/app/pot/actions.ts";

export function StartPotForm({ needId, remaining, unit, ngoName }: { needId: number; remaining: number; unit: string; ngoName: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(Math.min(remaining, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent"
      >
        <Users className="h-4 w-4" /> Start a group pot
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm">
      <p className="font-semibold">Start a group pot</p>
      <p className="text-muted">Share a link with friends, your team or class. Everyone pays their own part straight to the supplier.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. Office winter drive for ${ngoName}`} className="w-full rounded-lg border border-border bg-transparent p-2" aria-label="Pot name" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" className="w-full rounded-lg border border-border bg-transparent p-2" aria-label="Your first name" />
      <label className="flex items-center gap-2">
        Goal
        <input
          type="number"
          min={1}
          max={remaining}
          value={goal}
          onChange={(e) => setGoal(Math.min(remaining, Math.max(1, Number(e.target.value) || 1)))}
          className="w-20 rounded-lg border border-border bg-transparent p-1.5"
        />
        {unit}s
      </label>
      <button
        type="button"
        disabled={pending || !title.trim() || !name.trim()}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createPotAction({ needId, title, organizerName: name, goalUnits: goal });
            if (res && !res.ok) setError(res.error);
          })
        }
        className="w-full rounded-full bg-accent px-4 py-2 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start the pot"}
      </button>
      {error && <p className="text-accent">{error}</p>}
    </div>
  );
}
