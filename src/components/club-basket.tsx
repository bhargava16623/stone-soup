"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PayPalOneTimePaymentButton, PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import { RefreshCw, SkipForward } from "lucide-react";
import { rebuildBasketAction, skipMonthAction } from "@/app/club/actions.ts";

/** Approve, rebuild or skip this month's Soup Club basket. */
export function ClubBasketActions({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const run = (action: (t: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await action(token);
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });

  return (
    <div className="space-y-3">
      {clientId && (
        <PayPalProvider clientId={clientId} environment="sandbox" components={["paypal-payments"]} pageType="checkout">
          <PayPalOneTimePaymentButton
            type="donate"
            disabled={pending}
            createOrder={async () => {
              setError(null);
              const res = await fetch(`/api/club/${token}/checkout`, { method: "POST" });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error ?? "Could not start the checkout");
                throw new Error(data.error);
              }
              return { orderId: data.orderId as string };
            }}
            onApprove={async ({ orderId }) => {
              const res = await fetch(`/api/checkout/${orderId}/capture`, { method: "POST" });
              if (!res.ok) {
                setError((await res.json()).error ?? "The payment could not be completed");
                return;
              }
              router.refresh();
            }}
            onError={() => setError("PayPal ran into a problem. Please try again.")}
          />
        </PayPalProvider>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(rebuildBasketAction)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> {pending ? "Working…" : "Pick again"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(skipMonthAction)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <SkipForward className="h-4 w-4" /> Skip this month
        </button>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

/** Ask the agent to prepare this month's basket (shown when none exists yet, e.g. after a skip or a busy agent). */
export function PrepareBasketButton({ token, label = "Prepare this month's basket" }: { token: string; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await rebuildBasketAction(token);
            if (!res.ok) setError(res.error);
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> {pending ? "The Giving Agent is choosing…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
