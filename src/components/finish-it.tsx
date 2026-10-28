import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { formatUsd } from "@/lib/fees.ts";
import type { getAlmostFunded } from "@/lib/queries.ts";
import { ProductImage } from "./product-image.tsx";

type Item = Awaited<ReturnType<typeof getAlmostFunded>>[number];

/** "Finish the pot" suggestions: needs one gift away from complete, with the remaining units pre-filled. */
export function FinishIt({ items, title = "Almost there — finish one" }: { items: Item[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
        <Flag className="h-5 w-5 text-accent" /> {title}
      </h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map(({ need, left }) => (
          <li key={need.id}>
            <Link
              href={`/needs/${need.id}?units=${left}`}
              className="group flex h-full items-center gap-4 rounded-3xl border border-amber/40 bg-amber-soft/60 p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md"
            >
              <ProductImage src={need.imageUrl} alt={need.catalogItem.name} className="h-16 w-16 shrink-0" />
              <span className="flex-1 text-sm">
                <span className="block font-semibold group-hover:text-accent">
                  {left} {need.catalogItem.unit}
                  {left === 1 ? "" : "s"} left
                </span>
                <span className="text-muted">
                  {need.ngo.name} · finish it for {formatUsd(left * need.unitPriceCents)}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
