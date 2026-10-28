"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalOneTimePaymentButton, PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import { feeCoverCents, formatUsd, MIN_NGO_SHARE_CENTS } from "@/lib/fees.ts";

interface Props {
  needId: number;
  ngoId: number;
  unitName: string;
  unitPriceCents: number;
  remaining: number;
  ngoName: string;
  vendorName: string;
}

const NGO_SHARE_OPTIONS = [0, MIN_NGO_SHARE_CENTS, 1000];

export function DonatePanel({ needId, ngoId, unitName, unitPriceCents, remaining, ngoName, vendorName }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState(1);
  const [coverFees, setCoverFees] = useState(true);
  const [ngoShareCents, setNgoShareCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<{ units: number; orderId: string } | null>(null);

  const goodsCents = units * unitPriceCents;
  const feeCents = coverFees ? feeCoverCents(goodsCents) : 0;
  const totalCents = goodsCents + feeCents + ngoShareCents;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (thanks !== null) {
    return (
      <div className="rounded-2xl border border-leaf/30 bg-leaf-soft p-6 text-leaf">
        <p className="font-serif text-xl font-semibold">
          You added {thanks.units} {unitName}
          {thanks.units === 1 ? "" : "s"} to the pot.
        </p>
        <p className="mt-2 text-sm">
          {vendorName} has been paid directly. We&apos;ll show you the delivery as soon as {ngoName} confirms it.
        </p>
        <div className="mt-4 flex gap-4 text-sm font-medium">
          <Link href={`/gifts/${thanks.orderId}`} className="underline">
            Follow your gift
          </Link>
          <button className="underline" onClick={() => setThanks(null)}>
            Give again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-6">
      <div>
        <label htmlFor="units" className="text-sm font-medium">
          How many {unitName}s?
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label="Fewer"
            className="h-10 w-10 rounded-full border border-border text-lg transition hover:border-accent hover:text-accent disabled:opacity-40"
            disabled={units <= 1}
            onClick={() => setUnits((u) => Math.max(1, u - 1))}
          >
            −
          </button>
          <input
            id="units"
            type="number"
            min={1}
            max={remaining}
            value={units}
            onChange={(e) => setUnits(Math.min(remaining, Math.max(1, Number(e.target.value) || 1)))}
            className="h-10 w-16 rounded-lg border border-border bg-transparent text-center text-lg font-medium"
          />
          <button
            type="button"
            aria-label="More"
            className="h-10 w-10 rounded-full border border-border text-lg transition hover:border-accent hover:text-accent disabled:opacity-40"
            disabled={units >= remaining}
            onClick={() => setUnits((u) => Math.min(remaining, u + 1))}
          >
            +
          </button>
          <span className="text-sm text-muted">× {formatUsd(unitPriceCents)}</span>
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={coverFees} onChange={(e) => setCoverFees(e.target.checked)} />
        <span>
          Cover PayPal&apos;s fee ({formatUsd(feeCoverCents(goodsCents))}) so {vendorName} receives the full price
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Also give {ngoName} something to spend where it&apos;s needed most?</legend>
        <div className="mt-2 flex gap-2">
          {NGO_SHARE_OPTIONS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => setNgoShareCents(cents)}
              className={`rounded-full border px-3 py-1 text-sm transition ${ngoShareCents === cents ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent hover:text-accent"}`}
            >
              {cents === 0 ? "No thanks" : formatUsd(cents)}
            </button>
          ))}
        </div>
      </fieldset>

      <dl className="space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">
            {units} {unitName}
            {units === 1 ? "" : "s"} → paid to {vendorName}
          </dt>
          <dd>{formatUsd(goodsCents + feeCents)}</dd>
        </div>
        {ngoShareCents > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Gift → paid to {ngoName}</dt>
            <dd>{formatUsd(ngoShareCents)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatUsd(totalCents)}</dd>
        </div>
      </dl>

      {error && <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent">{error}</p>}

      {clientId ? (
        <PayPalProvider clientId={clientId} environment="sandbox" components={["paypal-payments"]} pageType="checkout">
          <PayPalOneTimePaymentButton
            type="donate"
            createOrder={async () => {
              setError(null);
              const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  items: [{ needId, units }],
                  coverFees,
                  ngoShare: ngoShareCents > 0 ? { ngoId, cents: ngoShareCents } : null,
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error ?? "Could not start the donation");
                throw new Error(data.error);
              }
              return { orderId: data.orderId as string };
            }}
            onApprove={async ({ orderId }) => {
              const res = await fetch(`/api/checkout/${orderId}/capture`, { method: "POST" });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error ?? "The payment could not be completed");
                return;
              }
              setThanks({ units: data.gifts[0].units, orderId });
              setUnits(1);
              router.refresh();
            }}
            onCancel={() => setError(null)}
            onError={() => setError("PayPal ran into a problem. Please try again.")}
          />
        </PayPalProvider>
      ) : (
        <p className="text-sm text-muted">PayPal is not configured (NEXT_PUBLIC_PAYPAL_CLIENT_ID).</p>
      )}
      <p className="text-xs text-muted">The money goes straight to {vendorName} via PayPal. Stone Soup never holds it.</p>
    </div>
  );
}
