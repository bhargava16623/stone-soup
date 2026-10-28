"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { Logo } from "./logo.tsx";
import { ThemeToggle } from "./theme-toggle.tsx";

const LINKS = [
  { href: "/", label: "Needs", match: (p: string) => p === "/" || p.startsWith("/needs") },
  { href: "/give", label: "Giving Agent", match: (p: string) => p.startsWith("/give") || p.startsWith("/club"), icon: true },
  { href: "/check", label: "Scam Check", match: (p: string) => p.startsWith("/check") },
  { href: "/ledger", label: "Ledger", match: (p: string) => p.startsWith("/ledger") || p.startsWith("/gifts") },
  { href: "/ngo", label: "For organisations", match: (p: string) => p.startsWith("/ngo") },
  { href: "/vendor", label: "For suppliers", match: (p: string) => p.startsWith("/vendor") },
];

/** Reads the URL to highlight the current page; render inside <Suspense> with <SiteHeaderShell /> as fallback. */
export function SiteHeader() {
  return <HeaderView pathname={usePathname()} />;
}

/** Same header without an active page, used while the URL is not yet known. */
export function SiteHeaderShell() {
  return <HeaderView pathname="" />;
}

function HeaderView({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  const linkClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
      active ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-accent-soft hover:text-accent"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3" aria-label="Main">
        <Link href="/" className="rounded-lg transition-opacity hover:opacity-80" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} className={linkClass(active)} aria-current={active ? "page" : undefined}>
                {l.icon && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                {l.label}
              </Link>
            );
          })}
          <ThemeToggle className="ml-1" />
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
          type="button"
          className="rounded-full p-2 text-muted hover:bg-accent-soft hover:text-accent"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border/70 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`${linkClass(active)} justify-start py-2.5`}
                  aria-current={active ? "page" : undefined}
                >
                  {l.icon && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
