/** A soup pot that fills with each gift. `pct` is 0–100. */
export function PotFill({ pct, className = "h-56 w-56" }: { pct: number; className?: string }) {
  const level = Math.max(0, Math.min(100, pct));
  // The pot body spans y = 60…150 in the viewBox; soup rises from the bottom.
  const top = 150 - (90 * level) / 100;
  return (
    <svg viewBox="0 0 200 170" className={className} role="img" aria-label={`${Math.round(level)}% full`}>
      <defs>
        <clipPath id="pot-body">
          <path d="M30 60h140l-10 72a20 20 0 0 1-19.8 18H59.8A20 20 0 0 1 40 132Z" />
        </clipPath>
        <linearGradient id="soup" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--amber)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      {level > 0 &&
        [80, 100, 120].map((x, i) => (
          <path
            key={x}
            d={`M${x} 46c-5-6 5-11 0-17s5-11 0-17`}
            stroke="var(--muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="animate-steam"
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
      <path d="M30 60h140l-10 72a20 20 0 0 1-19.8 18H59.8A20 20 0 0 1 40 132Z" fill="var(--accent-soft)" />
      <rect x="0" y={top} width="200" height={150 - top + 2} fill="url(#soup)" clipPath="url(#pot-body)" style={{ transition: "y .8s ease, height .8s ease" }} />
      <path d="M30 60h140l-10 72a20 20 0 0 1-19.8 18H59.8A20 20 0 0 1 40 132Z" fill="none" stroke="var(--foreground)" strokeOpacity=".2" strokeWidth="3" />
      <rect x="20" y="52" width="160" height="12" rx="6" fill="var(--foreground)" />
      <rect x="8" y="55" width="16" height="6" rx="3" fill="var(--foreground)" />
      <rect x="176" y="55" width="16" height="6" rx="3" fill="var(--foreground)" />
      <text x="100" y="112" textAnchor="middle" fontSize="26" fontWeight="700" fill={level > 45 ? "#fff" : "var(--foreground)"} fontFamily="var(--font-fraunces)">
        {Math.round(level)}%
      </text>
    </svg>
  );
}
