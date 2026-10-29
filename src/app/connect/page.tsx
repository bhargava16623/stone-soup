import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Bot, CreditCard, Lock, ScanSearch, Sparkles, Store } from "lucide-react";
import { CopyText } from "@/components/copy-text.tsx";
import { PageHeader } from "@/components/page-header.tsx";

export const metadata: Metadata = { title: "Give from any AI · Stone Soup" };

const TOOLS = [
  { name: "find_needs", text: "Open needs from verified charities, with each price checked against the market." },
  { name: "plan_gift", text: "Asks Stone Soup's Giving Agent to build a basket for a budget and the causes you name." },
  { name: "create_gift", text: "Creates one PayPal checkout and returns the link. Nothing is charged until you approve it." },
  { name: "gift_status", text: "Paid, delivered, and a link to follow each item from PayPal to the charity." },
  { name: "check_appeal", text: "Scam Check for any appeal you've seen: a link or the text of a message." },
];

const PROMISES = [
  { icon: Lock, title: "It can't move money", text: "Your assistant only gets a PayPal link. You open it and approve the payment yourself." },
  { icon: Store, title: "It can't misspend", text: "PayPal pays each supplier directly for a specific item. No cash goes anywhere else." },
  { icon: ScanSearch, title: "It can't overpay", text: "Prices are set by suppliers and checked against the market before a need goes live." },
];

export default function ConnectPage() {
  return (
    <div className="space-y-12">
      <PageHeader icon={Bot} eyebrow="Give from any AI" title="Your AI assistant can give. It just can't misspend.">
        Connect Stone Soup to Gemini, Claude, ChatGPT or any assistant that supports MCP. Say what you care about and your
        budget. It finds verified needs and hands you one PayPal link that pays the suppliers directly.
      </PageHeader>

      <ul className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-3xl border border-border bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-soft text-leaf">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>

      <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">Connect it</h2>
          <Suspense fallback={<div className="h-64 rounded-2xl border border-border bg-surface" />}>
            <Setup />
          </Suspense>
        </div>
        <div className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">What it looks like</h2>
          <Conversation />
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Tools your assistant gets</h2>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {TOOLS.map((t) => (
            <li key={t.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6">
              <code className="w-36 shrink-0 font-mono text-sm text-accent">{t.name}</code>
              <span className="text-sm text-muted">{t.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function Setup() {
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/api/mcp`;
  const gemini = JSON.stringify({ mcpServers: { "stone-soup": { httpUrl: url } } }, null, 2);
  return (
    <div className="space-y-5 rounded-3xl border border-border bg-surface p-6">
      <div>
        <p className="text-sm font-medium">Server address</p>
        <div className="mt-2">
          <CopyText text={url} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Gemini CLI</p>
        <p className="text-xs text-muted">
          Add to <code>~/.gemini/settings.json</code>, then ask: “I have $40, help kids stay warm this winter.”
        </p>
        <div className="mt-2">
          <CopyText text={gemini} block />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Claude Code</p>
        <div className="mt-2">
          <CopyText text={`claude mcp add --transport http stone-soup ${url}`} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Claude.ai, ChatGPT and other apps: add a custom connector with the server address (it must be the public https
        address of this site).
      </p>
    </div>
  );
}

function Conversation() {
  return (
    <div className="space-y-3 rounded-3xl border border-border bg-surface p-6 text-sm">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-white">
        I have $40. Help kids stay warm this winter, and something for school.
      </p>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" /> used <code>plan_gift</code> and <code>create_gift</code>
      </p>
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3">
        <p>I found two verified needs that fit:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>1 fleece blanket for Hope Shelter — $19.16, paid to Sunrise Supplies</li>
          <li>2 toothbrush kits for Riverbend Community School — $19.16, paid to Harbor Wholesale</li>
        </ul>
        <p>Total $38.32. Both prices are below the market median.</p>
        <p className="inline-flex items-center gap-2 rounded-full bg-[#ffc439] px-4 py-1.5 font-semibold text-[#142c8e]">
          <CreditCard className="h-4 w-4" /> Review and approve in PayPal
        </p>
      </div>
    </div>
  );
}
