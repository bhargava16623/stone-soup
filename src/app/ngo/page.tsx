import Link from "next/link";
import { Suspense } from "react";
import { getNgos } from "@/lib/queries.ts";

export default function NgoIndex() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl font-semibold">For organisations</h1>
      <p className="text-muted">Pick an organisation to see its dashboard. (Demo: there are no logins.)</p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NgoList />
      </Suspense>
    </div>
  );
}

async function NgoList() {
  const ngos = await getNgos();
  return (
    <ul className="space-y-3">
      {ngos.map((n) => (
        <li key={n.id}>
          <Link href={`/ngo/${n.slug}`} className="block rounded-2xl border border-border bg-surface p-5 hover:shadow-md">
            <p className="font-serif text-lg font-semibold">{n.name}</p>
            <p className="text-sm text-muted">
              {n.city} · {n.description}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
