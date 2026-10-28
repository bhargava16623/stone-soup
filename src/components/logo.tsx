/** A soup pot with one stone in it — the mark of Stone Soup. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M14 9c0-2 2-2 2-4M20 9c0-2 2-2 2-4M26 9c0-2 2-2 2-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".45" />
      <path d="M6 15h28l-2.4 14.2A6 6 0 0 1 25.7 34H14.3a6 6 0 0 1-5.9-4.8Z" fill="var(--accent)" />
      <rect x="4" y="12.5" width="32" height="4" rx="2" fill="var(--foreground)" />
      <ellipse cx="20" cy="23.5" rx="4.2" ry="3.2" fill="var(--background)" opacity=".9" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-foreground">
      <LogoMark />
      <span className="font-serif text-2xl font-semibold tracking-tight">Stone Soup</span>
    </span>
  );
}
