import { Backpack, BedDouble, Droplets, Shirt, Wheat, type LucideIcon } from "lucide-react";

const ITEMS: { icon: LucideIcon; label: string; className: string; delay: string }[] = [
  { icon: BedDouble, label: "Blanket", className: "left-[4%] top-[18%]", delay: "0s" },
  { icon: Wheat, label: "Rice", className: "right-[6%] top-[10%]", delay: "1.2s" },
  { icon: Backpack, label: "Backpack", className: "left-[14%] bottom-[30%]", delay: "2.1s" },
  { icon: Droplets, label: "Soap", className: "right-[2%] bottom-[36%]", delay: "0.6s" },
  { icon: Shirt, label: "Socks", className: "left-[42%] top-[0%]", delay: "1.7s" },
];

/** Everyday items floating into the pot: the folk tale as a picture. */
export function PotIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[17rem] sm:max-w-md" aria-hidden="true">
      <div className="absolute inset-[12%] rounded-full bg-accent-soft/70 blur-2xl" />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        {[70, 100, 130].map((x, i) => (
          <path
            key={x}
            d={`M${x} 92c-6-8 6-14 0-22s6-14 0-22`}
            stroke="var(--muted)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className="animate-steam"
            style={{ animationDelay: `${i * 0.9}s`, transformBox: "fill-box" }}
          />
        ))}
        <path d="M34 104h132l-10 52a22 22 0 0 1-21.6 18H65.6A22 22 0 0 1 44 156Z" fill="var(--accent)" />
        <path d="M44 156a22 22 0 0 0 21.6 18h68.8a22 22 0 0 0 21.6-18" fill="none" stroke="var(--foreground)" strokeOpacity=".15" strokeWidth="4" />
        <rect x="24" y="94" width="152" height="16" rx="8" fill="var(--foreground)" />
        <rect x="14" y="98" width="16" height="8" rx="4" fill="var(--foreground)" />
        <rect x="170" y="98" width="16" height="8" rx="4" fill="var(--foreground)" />
        <ellipse cx="100" cy="136" rx="16" ry="11" fill="var(--background)" opacity=".9" />
        <ellipse cx="96" cy="133" rx="5" ry="3" fill="var(--surface)" />
      </svg>
      {ITEMS.map(({ icon: Icon, label, className, delay }) => (
        <div
          key={label}
          className={`animate-bob absolute flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm ${className}`}
          style={{ animationDelay: delay }}
        >
          <Icon className="h-4 w-4 text-accent" />
          {label}
        </div>
      ))}
    </div>
  );
}
