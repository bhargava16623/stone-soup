import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Consistent page title block: small labelled eyebrow, serif title, short description. */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 max-w-2xl">
      <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 text-lg text-muted">{children}</div>}
    </header>
  );
}
