"use client";

import { useState, useTransition } from "react";
import { updateMemberAction } from "@/app/club/actions.ts";
import { formatUsd } from "@/lib/fees.ts";

const BUDGETS = [1500, 3000, 5000, 10000];

export function ClubSettings({ token, budget, causes, active }: { token: string; budget: number; causes: string; active: boolean }) {
  const [b, setB] = useState(budget);
  const [c, setC] = useState(causes);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (patch: { monthlyBudgetCents?: number; causes?: string; active?: boolean }) =>
    start(async () => {
      const res = await updateMemberAction(token, patch);
      setMessage(res.ok ? "Saved. Changes apply from the next basket." : res.error);
    });

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 text-sm">
      <h2 className="font-serif text-xl font-semibold">Your settings</h2>
      <label className="block">
        <span className="font-medium">Monthly budget</span>
        <select
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border border-border bg-transparent p-2.5"
        >
          {[...new Set([...BUDGETS, budget])].sort((x, y) => x - y).map((v) => (
            <option key={v} value={v}>
              {formatUsd(v)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">What you care about</span>
        <input value={c} onChange={(e) => setC(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-transparent p-2.5" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => save({ monthlyBudgetCents: b, causes: c })}
          className="rounded-full bg-foreground px-4 py-2 font-medium text-background transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save({ active: !active })}
          className="rounded-full border border-border px-4 py-2 transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {active ? "Pause membership" : "Resume membership"}
        </button>
      </div>
      {message && <p className="text-muted">{message}</p>}
    </div>
  );
}
