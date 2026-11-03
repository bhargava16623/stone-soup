"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Search, TriangleAlert } from "lucide-react";
import { lookupEinAction, registerNgoAction } from "@/app/ngo/join/actions.ts";
import type { IrsRecord } from "@/lib/verify.ts";

const field = "mt-1 w-full rounded-xl border border-border bg-transparent p-2.5";

/** Register a charity: IRS lookup by EIN first, then the details donors will see. */
export function NgoJoinForm() {
  const router = useRouter();
  const [ein, setEin] = useState("");
  const [record, setRecord] = useState<IrsRecord | null>(null);
  const [form, setForm] = useState({ name: "", website: "", paypalEmail: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lookup = () =>
    start(async () => {
      setError(null);
      setRecord(null);
      const res = await lookupEinAction(ein);
      if (!res.ok) return setError(res.error);
      setRecord(res.data);
      setForm((f) => ({ ...f, name: f.name || res.data.name }));
    });

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await registerNgoAction({ ein, ...form });
      if (!res.ok) return setError(res.error);
      router.push(`/ngo/${res.data.slug}/verify`);
    });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-6">
        <label htmlFor="ein" className="font-serif text-xl font-semibold">
          1. Your EIN
        </label>
        <p className="mt-1 text-sm text-muted">We look it up in the IRS list of registered nonprofits.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            id="ein"
            value={ein}
            onChange={(e) => setEin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="12-3456789"
            inputMode="numeric"
            className="w-48 rounded-xl border border-border bg-transparent p-2.5 font-mono"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={pending || ein.replace(/\D/g, "").length !== 9}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {pending && !record ? "Looking up…" : "Look up"}
          </button>
        </div>
        {record && (
          <div className={`mt-4 rounded-2xl p-4 text-sm ${record.is501c3 ? "bg-leaf-soft text-leaf" : "bg-amber-soft text-amber"}`}>
            <p className="flex items-center gap-2 font-semibold">
              {record.is501c3 ? <BadgeCheck className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              {record.name}
            </p>
            <p className="mt-1">
              {record.city}, {record.state}
              {record.since && ` · registered since ${record.since}`} ·{" "}
              {record.is501c3 ? "501(c)(3) charity" : "not a 501(c)(3) charity, so it can't receive gifts here"}
            </p>
          </div>
        )}
      </div>

      {record?.is501c3 && (
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6">
          <p className="font-serif text-xl font-semibold">2. What donors will see</p>
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Your website</span>
            <span className="text-muted"> — you&apos;ll prove you run it in the next step</span>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="hopeshelter.org"
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">PayPal account email</span>
            <span className="text-muted"> — for optional unrestricted gifts; item money goes to suppliers</span>
            <input
              type="email"
              value={form.paypalEmail}
              onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">One sentence about what you do</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="A 30-bed emergency shelter run by two staff and volunteers."
              className={field}
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !form.website.trim() || !form.paypalEmail.trim() || !form.description.trim()}
            className="rounded-full bg-foreground px-5 py-2.5 font-medium text-background transition hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Continue to verification"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
