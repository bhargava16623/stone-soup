"use client";

import { useState, useTransition } from "react";
import { joinClubAction } from "@/app/club/actions.ts";
import { formatUsd } from "@/lib/fees.ts";

const CAUSES = ["Winter warmth", "Kids & school", "Shelter food", "Hygiene", "Disaster relief"];
const BUDGETS = [1500, 3000, 5000, 10000];

export function ClubJoinForm() {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(3000);
  const [picked, setPicked] = useState<string[]>(["Winter warmth", "Kids & school"]);
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const causes = [...picked, extra.trim()].filter(Boolean).join(", ");
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  function join() {
    setError(null);
    start(async () => {
      const res = await joinClubAction({ name, monthlyBudgetCents: budget, causes });
      // On success the action redirects to the member's private page.
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 sm:p-8">
      <label className="block text-sm">
        <span className="font-medium">Your first name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" className="mt-1 w-full rounded-xl border border-border bg-transparent p-3" />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Monthly budget</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              className={`rounded-full border px-4 py-2 text-sm transition ${budget === b ? "border-accent bg-accent text-white" : "border-border hover:border-accent hover:text-accent"}`}
            >
              {formatUsd(b)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">What do you care about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAUSES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={picked.includes(c)}
              onClick={() => toggle(c)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${picked.includes(c) ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent hover:text-accent"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Anything else? e.g. prefer my own city"
          className="mt-3 w-full rounded-xl border border-border bg-transparent p-3 text-sm"
        />
      </fieldset>

      <button
        type="button"
        onClick={join}
        disabled={pending || !name.trim() || !causes}
        className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "The Giving Agent is preparing your first basket…" : `Join Soup Club · ${formatUsd(budget)}/month`}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
      <p className="text-xs text-muted">Nothing is charged until you approve each month&apos;s basket in PayPal. Skip or pause any time.</p>
    </div>
  );
}
