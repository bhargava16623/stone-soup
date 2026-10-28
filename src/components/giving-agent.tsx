"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { PayPalOneTimePaymentButton, PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import { agentAction } from "@/app/give/actions.ts";
import type { AgentBasket, ChatMessage } from "@/lib/agent.ts";
import { formatUsd } from "@/lib/fees.ts";

const STARTERS = [
  "I have $50. I care about kids and winter relief.",
  "$120 for the shelter, please",
  "Spend $25 on whatever is most urgent",
];

type Turn = ChatMessage & { steps?: string[] };

export function GivingAgent() {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", text: "Hi! Tell me how much you'd like to give and what you care about, and I'll find real things to fund." },
  ]);
  const [input, setInput] = useState("");
  const [basket, setBasket] = useState<AgentBasket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ lines: AgentBasket["lines"]; orderId: string } | null>(null);
  const [thinking, startThinking] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [turns, basket]);

  function send(text: string) {
    const message = text.trim();
    if (!message || thinking) return;
    const history: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(history);
    setInput("");
    setError(null);
    startThinking(async () => {
      // The first greeting is UI only; the agent sees the conversation from the donor's first message.
      const res = await agentAction(history.slice(1).map(({ role, text }) => ({ role, text })));
      if (!res.ok) return setError(res.error);
      setTurns((t) => [...t, { role: "assistant", text: res.data.text, steps: res.data.steps }]);
      if (res.data.basket) setBasket(res.data.basket);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-leaf/30 bg-leaf-soft p-8 text-leaf">
        <p className="font-serif text-2xl font-semibold">Your gifts are on their way to the pot.</p>
        <ul className="mt-4 space-y-1">
          {done.lines.map((l) => (
            <li key={l.needId}>
              <Link href={`/needs/${l.needId}`} className="underline">
                {l.units} × {l.itemName}
              </Link>{" "}
              for {l.ngoName}, paid to {l.vendorName}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">Each supplier was paid directly through PayPal. You&apos;ll see each delivery once it&apos;s confirmed.</p>
        <Link href={`/gifts/${done.orderId}`} className="mt-4 inline-block font-medium underline">
          Follow your gifts →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <section className="flex min-h-[460px] flex-col rounded-2xl border border-border bg-surface">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${t.role === "user" ? "bg-accent text-white" : "bg-background"}`}>
                {t.steps && t.steps.length > 0 && (
                  <p className="mb-1.5 text-xs text-muted">{t.steps.join(" → ")}</p>
                )}
                <p className="whitespace-pre-wrap">{t.text}</p>
              </div>
            </div>
          ))}
          {thinking && <p className="text-sm text-muted">Looking through open needs and pricing a basket…</p>}
          {error && <p className="text-sm text-accent">{error}</p>}
          <div ref={end} />
        </div>
        {turns.length === 1 && (
          <div className="flex flex-wrap gap-2 px-6 pb-3">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. $40 for kids' school things"
            aria-label="Message the Giving Agent"
            className="flex-1 rounded-full border border-border bg-transparent px-4 py-2"
          />
          <button type="submit" disabled={thinking || !input.trim()} className="rounded-full bg-accent px-5 py-2 font-medium text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        {basket ? (
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-xl font-semibold">Your basket</h2>
            {basket.rationale && <p className="text-sm text-muted">{basket.rationale}</p>}
            <ul className="space-y-3 text-sm">
              {basket.lines.map((l) => (
                <li key={l.needId} className="flex justify-between gap-3">
                  <span>
                    <Link href={`/needs/${l.needId}`} className="font-medium hover:underline">
                      {l.units} × {l.itemName}
                    </Link>
                    <span className="block text-muted">
                      {l.ngoName} · paid to {l.vendorName}
                    </span>
                  </span>
                  <span className="shrink-0">{formatUsd(l.goodsCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted">
                <dt>PayPal fees (covered, so suppliers get the full price)</dt>
                <dd>{formatUsd(basket.feeCents)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatUsd(basket.totalCents)}</dd>
              </div>
            </dl>
            {clientId && (
              <PayPalProvider clientId={clientId} environment="sandbox" components={["paypal-payments"]} pageType="checkout">
                <PayPalOneTimePaymentButton
                  type="donate"
                  createOrder={async () => {
                    setError(null);
                    const res = await fetch("/api/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ items: basket.items, coverFees: true, source: "agent", agentNote: basket.rationale }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(data.error ?? "Could not start the checkout");
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
                    setDone({ lines: basket.lines, orderId });
                  }}
                  onError={() => setError("PayPal ran into a problem. Please try again.")}
                />
              </PayPalProvider>
            )}
            <p className="text-xs text-muted">One approval pays each supplier directly. Nothing is charged until you approve in PayPal.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Your basket will appear here. The agent picks needs and quantities; prices always come from the suppliers&apos; listings.
          </div>
        )}
      </aside>
    </div>
  );
}
