import Link from "next/link";
import { LogoMark } from "./logo.tsx";

const COLUMNS = [
  {
    title: "Give",
    links: [
      { href: "/", label: "Open needs" },
      { href: "/give", label: "Giving Agent" },
      { href: "/check", label: "Scam Check" },
      { href: "/ledger", label: "Open ledger" },
    ],
  },
  {
    title: "Take part",
    links: [
      { href: "/ngo", label: "For organisations" },
      { href: "/vendor", label: "For suppliers" },
      { href: "/review", label: "Review queue" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-serif text-lg font-semibold">Stone Soup</span>
          </div>
          <p className="text-sm text-muted">
            Every gift becomes something real: paid straight to the supplier through PayPal, checked against the market, and
            confirmed when it arrives.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-foreground/80 underline-offset-4 hover:text-accent hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
          Demo on the PayPal sandbox — no real money moves. Market checks by Channel3, AI by Gemini.
        </p>
      </div>
    </footer>
  );
}
